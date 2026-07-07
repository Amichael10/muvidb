import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { cleanTitle } from '../api/_lib/yt_service.js';

// Load stealth plugin
const stealthPlugin = stealth();
chromium.use(stealthPlugin);

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function upsertPerson(name: string, photoUrl?: string) {
  const cleanedName = name.trim().replace(/\s+/g, ' ');
  if (!cleanedName || cleanedName.length < 2) return null;
  
  // Guard against site names or generic placeholders
  const lowerName = cleanedName.toLowerCase();
  if (lowerName === 'irokotv' || lowerName === 'iroko' || lowerName === 'filmflux' || lowerName === 'actor' || lowerName === 'unknown') {
    return null;
  }

  const { data: existing } = await supabase.from('people')
    .select('id, photo_url')
    .ilike('name', cleanedName);

  if (existing && existing.length > 0) {
    const person = existing[0];
    if (photoUrl && !person.photo_url) {
      await supabase.from('people').update({ photo_url: photoUrl }).eq('id', person.id);
    }
    return person.id;
  }

  const { data: newPerson, error } = await supabase.from('people').insert({
    name: cleanedName,
    photo_url: photoUrl,
    source: 'irokotv'
  }).select('id').single();

  if (error) {
    console.error(`  ❌ Error inserting person ${cleanedName}:`, error.message);
    return null;
  }
  return newPerson.id;
}

async function syncFeedGamma() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    console.log('🚀 Starting Feed Gamma Sync via Playwright...');

    // 1. Discovery Phase
    const CHANNEL_HANDLE = process.env.FEED_GAMMA_CHANNEL_HANDLE;
    const CHANNEL_NAME = process.env.FEED_GAMMA_CHANNEL_NAME || 'Gamma Feed';
    const BASE_URL = process.env.FEED_GAMMA_BASE_URL;
    if (!CHANNEL_HANDLE || !BASE_URL) {
      throw new Error('FEED_GAMMA_CHANNEL_HANDLE or FEED_GAMMA_BASE_URL is not configured');
    }
    let { data: channel } = await supabase.from('channels').select('id').eq('channel_handle', CHANNEL_HANDLE).maybeSingle();
    
    if (!channel) {
      const { data: newChannel, error } = await supabase.from('channels').insert([{
        name: CHANNEL_NAME,
        channel_handle: CHANNEL_HANDLE,
        channel_url: BASE_URL
      }]).select('id').single();
      
      if (error) throw error;
      channel = newChannel;
    }

    const targetUrl = process.env.FEED_GAMMA_URL;
    if (!targetUrl) {
      throw new Error('FEED_GAMMA_URL is not configured');
    }
    console.log('Navigating to feed...');
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    try {
      await page.waitForSelector('a.callByAjax[href^="/content/"]', { timeout: 15000 });
    } catch (e) {
      console.log('⚠️ No content links found initially.');
    }

    // Scroll more aggressively
    console.log('Scrolling to load more content...');
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 5));
      await page.waitForTimeout(2000);
    }

    console.log('Extracting movie links...');
    const finalLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a.callByAjax[href^="/content/"]'));
      return links.map(l => (l as HTMLAnchorElement).href);
    });

    const uniqueLinks = Array.from(new Set(finalLinks));
    console.log(`✅ Found ${uniqueLinks.length} movie links. Starting detail extraction...`);

    let inserted = 0;
    let updated = 0;
    let errors = 0;

    // 2. Extraction Phase
    for (const link of uniqueLinks) { 
      try {
        console.log(`Processing Feed Gamma: ${link}`);
        await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // Wait for content to stabilize
        try {
          await page.waitForSelector('.banner-content h1, .banner-content h5', { timeout: 20000 });
        } catch (e) {
          console.log(`  ⚠️ Title element not found for ${link}`);
        }

        const data = await page.evaluate(() => {
          const titleEl = document.querySelector('.banner-content h1, .banner-content h5, h1');
          const title = titleEl?.textContent?.trim() || '';
          
          const synopsisEl = document.querySelector('.banner-content p, .content-description p, .content-description');
          const synopsis = synopsisEl?.textContent?.trim() || '';
          
          const banner = document.querySelector('.banner-section, .vd-banner, .movie-banner') as HTMLElement;
          let backdrop = '';
          if (banner) {
            const bg = window.getComputedStyle(banner).backgroundImage;
            backdrop = bg.replace(/url\(['"]?|['"]?\)/g, '');
            if (backdrop === 'none') backdrop = '';
          }
          
          const slug = window.location.pathname.split('/').pop();

          // Cast
          const castItems = Array.from(document.querySelectorAll('.cast-details a, .cast-list .cast-member')).map(el => {
            const nameEl = el.querySelector('.cast-name, span');
            const name = nameEl?.textContent?.trim() || el.textContent?.trim() || '';
            const character = el.nextElementSibling?.tagName === 'SPAN' ? el.nextElementSibling.textContent?.trim() : '';
            const photoUrl = (el.querySelector('img') as HTMLImageElement)?.src || '';
            return { name, character, role: 'actor', photoUrl };
          });

          return { title, synopsis, backdrop, slug, cast: castItems };
        });

        if (!data.title || data.title.toLowerCase().includes('irokotv') || data.title.toLowerCase().includes('iroko')) {
          console.log(`  ⚠️ Skipping invalid title: ${data.title}`);
          continue;
        }

        // Strict skip: missing both synopsis and backdrop
        if (!data.synopsis && (!data.backdrop || data.backdrop.includes('data:image'))) {
          console.log(`  ⚠️ Skipping ${data.title}: Missing metadata.`);
          continue;
        }

        const cleanedTitle = cleanTitle(data.title);
        const source_video_id = `iroko-${data.slug}`;

        console.log(`🔄 Matching: ${cleanedTitle}`);
        
        let { data: results } = await supabase.from('films').select('*').ilike('title', cleanedTitle);
        const existing = results?.[0];
        let filmId;

        const filmPayload: any = {
          title: cleanedTitle,
          synopsis: data.synopsis,
          poster_url: data.backdrop,
          backdrop_url: data.backdrop,
          source: 'irokotv',
          source_video_id,
          youtube_watch_url: link,
          release_type: 'irokotv',
          countries: ['Nigeria'],
          needs_review: false,
          status: 'released',
          streaming_links: {
            irokotv: link
          }
        };

        if (existing) {
          filmId = existing.id;
          const updatePayload: any = {
            streaming_links: { ...(existing.streaming_links || {}), irokotv: link }
          };
          if (!existing.synopsis && data.synopsis) updatePayload.synopsis = data.synopsis;
          if (!existing.poster_url && data.backdrop && !data.backdrop.includes('data:image')) {
            updatePayload.poster_url = data.backdrop;
            updatePayload.backdrop_url = data.backdrop;
          }
          
          await supabase.from('films').update(updatePayload).eq('id', filmId);
          updated++;
        } else {
          const { data: insertedRecord, error: insertError } = await supabase.from('films').insert(filmPayload).select().single();
          if (insertError) {
            console.error(`  ❌ Error inserting ${cleanedTitle}:`, insertError.message);
            errors++;
            continue;
          }
          filmId = insertedRecord.id;
          inserted++;
          console.log(`  ✨ New Film: ${cleanedTitle}`);
        }

        if (filmId && data.cast.length > 0) {
          for (const item of data.cast) {
            const personId = await upsertPerson(item.name, item.photoUrl);
            if (personId) {
              await supabase.from('credits').upsert({
                film_id: filmId,
                person_id: personId,
                role: item.role,
                character_name: item.character
              }, { onConflict: 'film_id,person_id,role' });
            }
          }
        }
      } catch (e) {
        console.error(`  ❌ Failed to process ${link}: ${e.message}`);
        errors++;
      }
    }

    console.log(`\n✅ Feed Gamma Sync Complete!`);
    console.log(`✨ New: ${inserted}, Updated: ${updated}, Errors: ${errors}`);

  } catch (error) {
    console.error('💀 Fatal error:', error);
  } finally {
    await browser.close();
  }
}

syncFeedGamma();
