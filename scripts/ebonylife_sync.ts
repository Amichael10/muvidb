import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { cleanTitle } from '../api/_lib/yt_service.js';
import { detectAndNormalizeSeries } from '../api/_lib/series_utils.js';

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

const EBONY_URL = 'https://ebonylifeonplus.com/category/nollywood-gold';

async function scrapeEbonyLife() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  let moviesData = [];

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('ebonylifeapi.muvi.com/content')) {
      try {
        const json = await response.json();
        if (json?.data?.categoryContentList?.categories) {
           const list = json.data.categoryContentList.categories[0]?.category_content_list?.content_list;
           if (list && list.length > 0) {
             moviesData = list;
             console.log(`✅ Intercepted ${moviesData.length} movies from API.`);
           }
        }
      } catch (e) {}
    }
  });

  console.log(`🚀 Navigating to EbonyLife ON Plus: ${EBONY_URL}`);
  await page.goto(EBONY_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(5000); 

  await browser.close();
  return moviesData;
}

async function upsertPerson(name) {
  if (!name) return null;
  // // Shared matcher (migration 20260723112408): exact name, else
  // people.name_key (order-insensitive + honorific-stripped), so
  // "Kosoko Jide" / "Prince Jide Kosoko" resolve to the existing person.
  const { data: id, error } = await supabase.rpc('upsert_person_by_name', {
    p_name: name,
    p_extra: { nationality: 'Nigerian', source: 'ebonylife' },
  });
  if (error || !id) return null;
  return id;
}

function parseDurationStr(durationStr) {
  if (!durationStr) return null;
  // e.g. "01:54:47"
  const parts = durationStr.split(':');
  if (parts.length === 3) {
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    return hours * 60 + minutes;
  } else if (parts.length === 2) {
    const minutes = parseInt(parts[0]);
    return minutes;
  }
  return null;
}

async function syncToDatabase(scrapedMovies) {
  let updatedCount = 0; let newCount = 0; let errorCount = 0;

  for (const movie of scrapedMovies) {
    const rawTitle = movie.content_name || movie.title;
    const { isSeries, baseTitle, episodeNum, seasonNum } = detectAndNormalizeSeries(rawTitle);
    const cleanedTitle = cleanTitle(baseTitle);
    if (!cleanedTitle) continue;
    
    // year from tags if present, or leave null
    let movieYear = null;
    
    const runtimeMinutes = parseDurationStr(movie.video_details?.duration);
    
    // get poster and backdrop
    let poster_url = null;
    let backdrop_url = null;
    if (movie.posters?.website && movie.posters.website.length > 0) {
        poster_url = movie.posters.website[0].file_url;
    }
    if (movie.banners?.website && movie.banners.website.length > 0) {
        backdrop_url = movie.banners.website[0].file_url;
    }
    if (!poster_url && backdrop_url) poster_url = backdrop_url;

    // construct the movie URL
    const watchUrl = `https://ebonylifeonplus.com/content/${movie.content_permalink}`;

    console.log(`🔄 Processing: ${cleanedTitle} ${episodeNum ? `(Episode ${episodeNum})` : ''}`);

    try {
      let filmId;

      if (isSeries) {
        // Find or create parent series record
        const cleanedBase = cleanTitle(baseTitle);
        let parentRecord;

        // Search for existing parent series record in DB
        let { data: parentResults } = await supabase.from('films')
          .select('id, poster_url, backdrop_url, streaming_links')
          .ilike('title', cleanedBase)
          .eq('content_type', 'series')
          .is('series_id', null);

        let parentExisting = parentResults?.[0];

        if (parentExisting) {
          parentRecord = parentExisting;
          // Update parent poster / backdrop if missing
          const parentUpdate: any = {};
          if (!parentExisting.poster_url && poster_url) parentUpdate.poster_url = poster_url;
          if (!parentExisting.backdrop_url && (backdrop_url || poster_url)) parentUpdate.backdrop_url = backdrop_url || poster_url;
          
          const existingLinks = parentExisting.streaming_links || {};
          if (!existingLinks.ebonylife) {
            parentUpdate.streaming_links = { ...existingLinks, ebonylife: watchUrl };
          }
          if (Object.keys(parentUpdate).length > 0) {
            await supabase.from('films').update(parentUpdate).eq('id', parentExisting.id);
          }
        } else {
          // Create new parent series record
          const { data: newParent, error: parentError } = await supabase.from('films').insert({
            title: cleanedBase,
            year: movieYear,
            release_type: 'ebonylife',
            source: 'ebonylife',
            content_type: 'series',
            poster_url: poster_url,
            backdrop_url: backdrop_url || poster_url,
            synopsis: movie.content_desc || null,
            needs_review: true,
            status: 'released',
            countries: ['Nigeria']
          }).select('id').single();

          if (parentError) throw parentError;
          parentRecord = newParent;
          console.log(`  🎦 Created series parent: "${cleanedBase}"`);
          newCount++;
        }

        const parentId = parentRecord.id;

        // If it's a specific episode
        if (episodeNum !== null) {
          // Find if this specific episode record exists
          let { data: epResults } = await supabase.from('films')
            .select('*')
            .eq('series_id', parentId)
            .eq('episode_number', episodeNum)
            .eq('season_number', seasonNum || 1);

          const epExisting = epResults?.[0];

          if (epExisting) {
            filmId = epExisting.id;
            const updatePayload: any = {
              streaming_links: { ...(epExisting.streaming_links || {}), ebonylife: watchUrl },
              synopsis: epExisting.synopsis || movie.content_desc,
              runtime_minutes: epExisting.runtime_minutes || runtimeMinutes,
              poster_url: epExisting.poster_url || poster_url,
              backdrop_url: epExisting.backdrop_url || backdrop_url || poster_url
            };
            await supabase.from('films').update(updatePayload).eq('id', epExisting.id);
            updatedCount++;
          } else {
            // Create new episode record
            const { data: insertedEp, error: epError } = await supabase.from('films').insert({
              title: movie.content_name || movie.title,
              year: movieYear,
              release_type: 'ebonylife',
              source: 'ebonylife',
              content_type: 'series',
              series_id: parentId,
              episode_number: episodeNum,
              season_number: seasonNum || 1,
              streaming_links: { ebonylife: watchUrl },
              runtime_minutes: runtimeMinutes,
              poster_url: poster_url,
              backdrop_url: backdrop_url || poster_url,
              synopsis: movie.content_desc || null,
              status: 'released',
              countries: ['Nigeria'],
              needs_review: true
            }).select('id').single();

            if (epError) throw epError;
            filmId = insertedEp.id;
            newCount++;
            console.log(`  ✨ Created episode ${episodeNum} for series: "${cleanedBase}"`);
          }
        } else {
          filmId = parentId;
        }

      } else {
        let { data: results } = await supabase.from('films').select('*').ilike('title', cleanedTitle);
        const existing = results?.[0];

        if (existing) {
          filmId = existing.id;
          const updatePayload: any = {
            streaming_links: { ...(existing.streaming_links || {}), ebonylife: watchUrl },
            synopsis: existing.synopsis || movie.content_desc,
          };
          if (!existing.runtime_minutes && runtimeMinutes) updatePayload.runtime_minutes = runtimeMinutes;
          if (!existing.poster_url && poster_url) updatePayload.poster_url = poster_url;
          if (!existing.backdrop_url && backdrop_url) updatePayload.backdrop_url = backdrop_url;
          
          const isSuperPrimary = existing.youtube_watch_url || ['kava', 'ironflix', 'prime_video'].includes(existing.release_type);
          if (!isSuperPrimary) updatePayload.release_type = 'ebonylife';

          await supabase.from('films').update(updatePayload).eq('id', existing.id);
          updatedCount++;
        } else {
          const { data: inserted, error } = await supabase.from('films').insert({
            title: cleanedTitle, 
            year: movieYear, 
            synopsis: movie.content_desc, 
            runtime_minutes: runtimeMinutes,
            poster_url: poster_url, 
            backdrop_url: backdrop_url || poster_url,
            release_type: 'ebonylife',
            streaming_links: { ebonylife: watchUrl }, 
            source: 'ebonylife',
            status: 'released', 
            countries: ['Nigeria'], 
            needs_review: true,
            content_type: 'movie'
          }).select('id').single();
          
          if (error) throw error;
          filmId = inserted.id;
          newCount++;
        }
      }

      // Sync Cast
      if (movie.cast_details) {
        for (const cast of movie.cast_details) {
            const roleName = cast.cast_type_details?.cast_type_name?.toLowerCase();
            const role = roleName === 'actor' || roleName === 'cast' ? 'actor' : roleName === 'director' ? 'director' : 'writer';
            const pId = await upsertPerson(cast.cast_name);
            if (pId) {
                await supabase.from('credits').upsert({ film_id: filmId, person_id: pId, role: role }, { onConflict: 'film_id,person_id,role' });
            }
        }
      }

    } catch (e) {
      console.error(`  ❌ Error processing ${cleanedTitle}:`, e.message);
      errorCount++;
    }
  }
  console.log(`\n📊 EbonyLife Sync Complete: Updated: ${updatedCount}, New: ${newCount}, Errors: ${errorCount}`);
}

async function run() {
  try {
    const movies = await scrapeEbonyLife();
    if (movies.length > 0) {
        await syncToDatabase(movies);
    } else {
        console.log('No movies found.');
    }
  } catch (e) {
    console.error('💀 Fatal error:', e);
    process.exit(1);
  }
}

run();
