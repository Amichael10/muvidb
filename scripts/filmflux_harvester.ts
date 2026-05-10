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
const TMDB_KEY = process.env.TMDB_API_KEY;

/** Search TMDB for a person and return photo_url, biography, tmdb_id */
async function lookupPersonOnTMDB(name: string): Promise<{ photo_url?: string; biography?: string; tmdb_id?: number } | null> {
  if (!TMDB_KEY) return null;
  try {
    const res = await fetch(`https://api.themoviedb.org/3/search/person?api_key=${TMDB_KEY}&query=${encodeURIComponent(name)}`);
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.results?.[0];
    if (!result) return null;

    // Fetch full details for biography
    const detRes = await fetch(`https://api.themoviedb.org/3/person/${result.id}?api_key=${TMDB_KEY}`);
    const detData = detRes.ok ? await detRes.json() : result;

    return {
      tmdb_id: result.id,
      photo_url: result.profile_path ? `https://image.tmdb.org/t/p/w185${result.profile_path}` : undefined,
      biography: detData.biography?.trim().length > 20 ? detData.biography.trim() : undefined,
    };
  } catch {
    return null;
  }
}

async function upsertPerson(name: string, photoUrl?: string) {
  const cleanedName = name.trim().replace(/\s+/g, ' ');
  if (!cleanedName || cleanedName.length < 2) return null;
  
  const lowerName = cleanedName.toLowerCase();
  if (lowerName.includes('filmflux') || lowerName.includes('iroko') || lowerName === 'actor' || lowerName === 'unknown') {
    return null;
  }

  const { data: existing } = await supabase.from('people')
    .select('id, photo_url, biography')
    .ilike('name', cleanedName);

  if (existing && existing.length > 0) {
    const person = existing[0];
    // Update if missing photo or bio
    if (!person.photo_url || !person.biography) {
      const tmdb = await lookupPersonOnTMDB(cleanedName);
      const updates: Record<string, string | number | undefined> = {};
      if (!person.photo_url && (photoUrl || tmdb?.photo_url)) updates.photo_url = photoUrl || tmdb?.photo_url;
      if (!person.biography && tmdb?.biography) updates.biography = tmdb.biography;
      if (tmdb?.tmdb_id) updates.tmdb_id = tmdb.tmdb_id;
      if (Object.keys(updates).length > 0) {
        await supabase.from('people').update(updates).eq('id', person.id);
      }
    }
    return person.id;
  }

  // New person — look up TMDB before inserting
  const tmdb = await lookupPersonOnTMDB(cleanedName);
  await new Promise(r => setTimeout(r, 150)); // small delay for TMDB rate limits

  const { data: newPerson, error } = await supabase.from('people').insert({
    name: cleanedName,
    photo_url: photoUrl || tmdb?.photo_url || null,
    biography: tmdb?.biography || null,
    tmdb_id: tmdb?.tmdb_id || null,
    source: 'filmflux'
  }).select('id').single();

  if (error) {
    console.error(`  ❌ Error inserting person ${cleanedName}:`, error.message);
    return null;
  }
  return newPerson.id;
}

async function harvestFilmflux() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    console.log('🚀 Starting Filmflux Content Harvest...');

    // 1. Discovery Phase
    console.log('Navigating to Filmflux Movies...');
    await page.goto('https://filmflux.app/movies', { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    try {
      await page.waitForSelector('a[href^="/movie/"]', { timeout: 15000 });
    } catch (e) {
      console.log('⚠️ No movie links found initially.');
    }

    console.log('Loading more movies...');
    let clicks = 0;
    while (clicks < 15) { 
      try {
        const button = await page.$('button:has-text("Load More"), button:has-text("more")');
        if (button) {
          await button.click();
          clicks++;
          console.log(`  Clicked "Load More" ${clicks}...`);
          await page.waitForTimeout(3000);
        } else {
          break;
        }
      } catch (e) {
        break;
      }
    }

    const movieLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href^="/movie/"]')).map(a => (a as HTMLAnchorElement).href);
    });

    const uniqueLinks = Array.from(new Set(movieLinks));
    console.log(`✅ Found ${uniqueLinks.length} movie links. Starting detail extraction...`);

    let inserted = 0;
    let updated = 0;
    let errors = 0;

    // 2. Extraction Phase
    for (const link of uniqueLinks) {
      try {
        console.log(`Processing Filmflux: ${link}`);
        await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // Wait for specific title selector that isn't the generic h1
        try {
          await page.waitForSelector('h1.font-bold.text-white', { timeout: 30000 });
        } catch (e) {
          console.log(`  ⚠️ Detail title not found for ${link}`);
        }

        const data = await page.evaluate(() => {
          // Use og:title meta tag — this is always the actual movie title, never the brand name
          const ogTitle = (document.querySelector('meta[property="og:title"]') as HTMLMetaElement)?.content?.trim() || '';
          // Strip " - Filmflux" suffix if present
          const title = ogTitle.replace(/\s*[-|]\s*Filmflux.*$/i, '').trim() ||
            document.querySelector('h1.text-3xl, h1.text-4xl, h2.font-bold, [class*="movie-title"], [class*="film-title"]')?.textContent?.trim() || '';

          // Synopsis: try og:description first, then DOM
          const ogDesc = (document.querySelector('meta[property="og:description"], meta[name="description"]') as HTMLMetaElement)?.content?.trim() || '';
          const synopsisEl = document.querySelector(
            'div.mt-4.text-gray-400.leading-relaxed, .browse-description p, .browse-description, .movie-details p, [class*="synopsis"], [class*="description"] p'
          );
          const synopsis = synopsisEl?.textContent?.trim() || (ogDesc.length > 40 ? ogDesc : '');

          // Poster: og:image is most reliable
          const ogImage = (document.querySelector('meta[property="og:image"]') as HTMLMetaElement)?.content?.trim() || '';
          const bannerEl = document.querySelector('img.absolute.inset-0.object-cover, .browse-item-poster img, [class*="poster"] img, [class*="banner"] img') as HTMLImageElement;
          const backdrop = ogImage || bannerEl?.src || '';

          const slug = window.location.pathname.split('/').pop();

          const ytEl = document.querySelector('a[href*="youtube.com/watch"], a[href*="youtu.be/"]');
          const youtubeLink = (ytEl as HTMLAnchorElement)?.href || null;

          const cast = Array.from(document.querySelectorAll('a[href^="/actor/"], div.flex-none')).map(item => {
            const nameEl = item.querySelector('h3, .font-semibold, .text-white');
            const charEl = item.querySelector('p, .text-gray-400, .text-xs');
            const imgEl = item.querySelector('img') as HTMLImageElement;
            
            const name = nameEl?.textContent?.trim() || '';
            const character = charEl?.textContent?.trim() || '';
            const photoUrl = imgEl?.src || '';
            
            return { name, role: 'actor', character, photoUrl };
          }).filter(c => c.name && c.name.toLowerCase() !== 'cast');

          const normalizeRole = (role: string) => {
            const r = role.toLowerCase().trim();
            if (r.includes('director of photography') || r === 'dop' || r === 'cinematographer') return 'cinematographer';
            if (r.includes('executive producer')) return 'executive producer';
            if (r.includes('associate producer')) return 'associate producer';
            if (r.includes('producer')) return 'producer';
            if (r.includes('director')) return 'director';
            if (r.includes('writer') || r.includes('screenplay')) return 'writer';
            if (r.includes('editor')) return 'editor';
            if (r.includes('composer') || r.includes('music')) return 'composer';
            if (r.includes('sound')) return 'sound recordist';
            if (r.includes('production design')) return 'production designer';
            if (r.includes('costume')) return 'costume designer';
            if (r.includes('makeup')) return 'makeup artist';
            return r;
          };

          const crew = Array.from(document.querySelectorAll('a[href^="/crew/"], section h2 + div > div, .grid-cols-2 > div')).map(item => {
            const nameEl = item.querySelector('span.font-medium, h3.font-semibold, span.text-white, h3');
            const roleEl = item.querySelector('span.text-sm, p.text-gray-400, span.text-xs, p');
            
            const name = nameEl?.textContent?.trim() || '';
            const rawRole = roleEl?.textContent?.trim() || 'crew';
            const role = normalizeRole(rawRole);
            const photoUrl = (item.querySelector('img') as HTMLImageElement)?.src || '';
            
            return { name, role, character: '', photoUrl };
          }).filter(c => c.name && c.name.toLowerCase() !== 'crew');

          return { title, synopsis, backdrop, slug, youtubeLink, cast, crew };
        });

        // Skip if title is obviously the site name or placeholder
        if (!data.title || data.title.toLowerCase() === 'filmflux' || data.title.toLowerCase() === 'nollywood movies') {
          console.log(`  ⚠️ Skipping invalid title: ${data.title}`);
          continue;
        }

        // Strict skip: missing BOTH synopsis and backdrop
        if (!data.synopsis && (!data.backdrop || data.backdrop.includes('data:image'))) {
          console.log(`  ⚠️ Skipping ${data.title}: Insufficient metadata.`);
          continue;
        }

        const cleanedTitle = cleanTitle(data.title);
        const source_video_id = `filmflux-${data.slug}`;

        console.log(`🔄 Matching: ${cleanedTitle}`);
        
        let { data: results } = await supabase.from('films').select('*').ilike('title', cleanedTitle);
        const existing = results?.[0];
        let filmId;

        const filmPayload: any = {
          title: cleanedTitle,
          synopsis: data.synopsis,
          poster_url: data.backdrop,
          backdrop_url: data.backdrop,
          source: 'filmflux',
          source_video_id,
          youtube_watch_url: data.youtubeLink || link,
          release_type: 'youtube', 
          countries: ['Nigeria'],
          needs_review: false,
          status: 'released',
          streaming_links: {
            filmflux: link,
            youtube: data.youtubeLink
          }
        };

        if (existing) {
          filmId = existing.id;
          const updatePayload: any = {
            streaming_links: { ...(existing.streaming_links || {}), filmflux: link, youtube: data.youtubeLink },
            youtube_watch_url: existing.youtube_watch_url || data.youtubeLink || link
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

        // 3. Personnel Enrichment
        const allPersonnel = [...data.cast, ...data.crew];
        if (filmId && allPersonnel.length > 0) {
          for (const personData of allPersonnel) {
            if (!personData.name) continue;
            const personId = await upsertPerson(personData.name, personData.photoUrl);
            if (personId) {
              await supabase.from('credits').upsert({
                film_id: filmId,
                person_id: personId,
                role: personData.role.toLowerCase(),
                character_name: personData.character || null
              }, { onConflict: 'film_id,person_id,role' });
            }
          }
        }
      } catch (e) {
        console.error(`  ❌ Error processing ${link}:`, e.message);
        errors++;
      }
    }

    console.log(`\n✅ Filmflux Harvest Complete!`);
    console.log(`✨ New: ${inserted}, Updated: ${updated}, Errors: ${errors}`);

  } catch (error) {
    console.error('💀 Fatal error:', error);
  } finally {
    await browser.close();
  }
}

harvestFilmflux();
