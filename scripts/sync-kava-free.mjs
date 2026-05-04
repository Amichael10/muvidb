import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log('🚀 Starting FREE Kava Scrape via Playwright...');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    // 1. Ensure Kava Channel exists
    let { data: channel } = await supabase.from('channels').select('id').eq('name', 'Kava Data').maybeSingle();
    
    if (!channel) {
      console.log('Creating Kava Data channel...');
      const { data: newChannel, error } = await supabase.from('channels').insert([{ 
        name: 'Kava Data', 
        channel_handle: 'kava.tv',
        adapter: 'kava',
        is_active: true 
      }]).select().single();
      
      if (error) throw error;
      channel = newChannel;
    }

    // 2. Navigate and Scrape
    console.log('Navigating to Kava.tv...');
    await page.goto('https://kava.tv/category/p1', { waitUntil: 'networkidle', timeout: 60000 });
    
    // Wait for content to be visible
    await page.waitForSelector('.dataContents', { timeout: 15000 });

    console.log('Extracting movie data...');
    const movies = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.col-lg-3, .col-md-4, .col-sm-6'));
      return cards.map(card => {
        const titleEl = card.querySelector('.dataContents span');
        const descEl = card.querySelector('.dataContents div');
        const linkEl = card.querySelector('a.dataContents');
        const imgEl = card.querySelector('.content_img img');
        
        if (!titleEl || !linkEl) return null;

        return {
          title: titleEl.textContent?.trim(),
          synopsis: descEl?.textContent?.trim() || '',
          slug: linkEl.getAttribute('href')?.split('/').pop() || '',
          url: linkEl.href,
          poster_url: imgEl?.getAttribute('src') || null
        };
      }).filter(m => m !== null && m.title);
    });

    console.log(`✅ Found ${movies.length} movies on Kava via Playwright.`);

    if (movies.length === 0) {
      console.warn('⚠️ No movies found. Site structure might have changed.');
      await browser.close();
      return;
    }

    // Fetch existing Kava films to avoid inserting duplicates
    const { data: existingFilms } = await supabase
      .from('films')
      .select('source_video_id')
      .eq('source', 'kava');
    const existingSet = new Set(existingFilms?.map(f => f.source_video_id) || []);

    // 3. Insert into films
    const filmsToUpsert = movies.map(m => {
      const source_video_id = `kava-${m.slug || m.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const watchUrl = m.url || `https://kava.tv/watch/${m.slug}`;
      return {
        title: m.title,
        synopsis: m.synopsis,
        poster_url: m.poster_url,
        backdrop_url: m.poster_url,
        source: 'kava',
        source_video_id,
        youtube_watch_url: watchUrl,
        release_type: 'kava',
        countries: ['Nigeria'],
        needs_review: false
      };
    }).filter(row => !existingSet.has(row.source_video_id));

    let inserted = 0;
    let errors = 0;
    
    for (const film of filmsToUpsert) {
      const { error } = await supabase.from('films').insert([film]);
      if (error) {
        console.error(`Error inserting ${film.title}:`, error.message);
        errors++;
      } else {
        inserted++;
      }
    }

    console.log(`✨ Successfully synced ${inserted} new items to films. Errors: ${errors}.`);

  } catch (err) {
    console.error('❌ Playwright Scrape Failed:', err.message);
    // Take a screenshot for debugging if it fails
    try {
      await page.screenshot({ path: 'kava-error-screenshot.png' });
      console.log('Error screenshot saved to kava-error-screenshot.png');
    } catch (e) {}
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
