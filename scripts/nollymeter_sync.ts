import './dotenv_init.js';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { mirrorImageToStorage } from '../api/_lib/image_mirror.js';
import { cleanTitle } from '../api/_lib/yt_service.js';
import { detectAndNormalizeSeries } from '../api/_lib/series_utils.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const BASE = 'https://www.nollymeter.com';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
};

// Simple in-memory cache for actor resolution to avoid duplicate database queries and fetching
const actorCache = new Map<string, string>();

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function mapRole(roleStr: string): string {
  const r = roleStr.toLowerCase();
  if (r.includes('director')) return 'director';
  if (r.includes('writer')) return 'writer';
  if (r.includes('producer')) return 'producer';
  if (r.includes('actor') || r.includes('actress') || r.includes('cast')) return 'actor';
  return 'actor';
}

async function fetchWithRetry(url: string, retries = 3): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) {
        throw new Error(`HTTP status ${res.status}`);
      }
      return await res.text();
    } catch (e: any) {
      if (attempt === retries) throw e;
      console.warn(`⚠️ [Attempt ${attempt}/${retries}] Fetch failed for ${url}: ${e.message}. Retrying in 2s...`);
      await sleep(2000);
    }
  }
  throw new Error(`Failed to fetch ${url} after ${retries} retries`);
}

interface ScrapedActor {
  bio: string | null;
  photoUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  twitterUrl: string | null;
}

async function fetchAndParseActor(actorUrl: string): Promise<ScrapedActor | null> {
  try {
    const html = await fetchWithRetry(actorUrl);
    const $ = cheerio.load(html);
    
    const bio = $('.actor-profile p').text().trim() || null;
    const photoUrl = $('.actor-profile img').attr('src') || null;
    
    const instagramUrl = $('.actor-social a[href*="instagram.com"]').attr('href') || null;
    const facebookUrl = $('.actor-social a[href*="facebook.com"]').attr('href') || null;
    const twitterUrl = $('.actor-social a[href*="twitter.com"], .actor-social a[href*="x.com"]').attr('href') || null;
    
    return { bio, photoUrl, instagramUrl, facebookUrl, twitterUrl };
  } catch (e: any) {
    console.error(`  ❌ Error fetching actor page ${actorUrl}: ${e.message}`);
    return null;
  }
}

async function upsertPerson(name: string, actorPageUrl: string, initialPhotoUrl: string | null): Promise<string | null> {
  const cleanName = name.trim().replace(/\s+/g, ' ');
  if (!cleanName || cleanName.length < 2) return null;

  // Check in-memory cache first
  if (actorCache.has(cleanName)) {
    return actorCache.get(cleanName)!;
  }

  try {
    // 1. Search for existing person in database (case-insensitive name check)
    let { data: existing } = await supabase
      .from('people')
      .select('id, photo_url, bio, instagram_url, facebook_url, twitter_url')
      .ilike('name', cleanName)
      .limit(1);

    let personId: string | null = null;
    let existingPerson = existing?.[0];

    // 2. If not found by exact name, try fuzzy match RPC
    if (!existingPerson) {
      const { data: fuzzy } = await supabase.rpc('match_person_fuzzy', { query_name: cleanName, threshold: 0.85 }).maybeSingle();
      if (fuzzy?.id) {
        const { data } = await supabase
          .from('people')
          .select('id, photo_url, bio, instagram_url, facebook_url, twitter_url')
          .eq('id', fuzzy.id)
          .single();
        existingPerson = data;
      }
    }

    if (existingPerson) {
      personId = existingPerson.id;
      // If the record is incomplete (missing photo or biography), enrich it by fetching details page
      if (!existingPerson.photo_url || !existingPerson.bio || !existingPerson.instagram_url) {
        console.log(`  🔍 Enriching existing actor: "${cleanName}"`);
        const scraped = await fetchAndParseActor(actorPageUrl);
        await sleep(400);

        if (scraped) {
          const updatePayload: any = {};
          
          if (!existingPerson.bio && scraped.bio) {
            updatePayload.bio = scraped.bio;
          }
          
          if (!existingPerson.photo_url && (scraped.photoUrl || initialPhotoUrl)) {
            const photoToMirror = scraped.photoUrl || initialPhotoUrl;
            const ownPhotoUrl = await mirrorImageToStorage(photoToMirror, 'people');
            if (ownPhotoUrl) {
              updatePayload.photo_url = ownPhotoUrl;
            }
          }
          
          if (!existingPerson.instagram_url && scraped.instagramUrl) {
            updatePayload.instagram_url = scraped.instagramUrl;
          }
          if (!existingPerson.facebook_url && scraped.facebookUrl) {
            updatePayload.facebook_url = scraped.facebookUrl;
          }
          if (!existingPerson.twitter_url && scraped.twitterUrl) {
            updatePayload.twitter_url = scraped.twitterUrl;
          }

          if (Object.keys(updatePayload).length > 0) {
            await supabase.from('people').update(updatePayload).eq('id', personId);
            console.log(`    ✓ Enriched details for "${cleanName}"`);
          }
        }
      }
    } else {
      // 3. New actor: Fetch detail page, mirror image, and insert
      console.log(`  ✨ Scraping new actor page: "${cleanName}"`);
      const scraped = await fetchAndParseActor(actorPageUrl);
      await sleep(400);

      const photoToMirror = scraped?.photoUrl || initialPhotoUrl;
      const ownPhotoUrl = photoToMirror ? await mirrorImageToStorage(photoToMirror, 'people') : null;

      const { data: newPerson, error: insertErr } = await supabase
        .from('people')
        .insert({
          name: cleanName,
          bio: scraped?.bio || null,
          photo_url: ownPhotoUrl,
          instagram_url: scraped?.instagramUrl || null,
          facebook_url: scraped?.facebookUrl || null,
          twitter_url: scraped?.twitterUrl || null,
          source: 'nollymeter',
          nationality: 'Nigerian',
        })
        .select('id')
        .single();

      if (insertErr) {
        console.error(`  ❌ Error inserting person "${cleanName}": ${insertErr.message}`);
        return null;
      }

      personId = newPerson.id;
      console.log(`    ✓ Inserted new actor "${cleanName}"`);
    }

    if (personId) {
      actorCache.set(cleanName, personId);
    }
    return personId;

  } catch (e: any) {
    console.error(`  ❌ Error in upsertPerson for "${cleanName}": ${e.message}`);
    return null;
  }
}

interface ScrapedMovie {
  title: string;
  genres: string[];
  synopsis: string;
  posterUrl: string | null;
  countries: string[];
  year: number | null;
  runtimeMinutes: number | null;
  youtubeWatchUrl: string | null;
  sourceVideoId: string | null;
  cast: Array<{
    name: string;
    actorPageUrl: string;
    imageUrl: string | null;
    role: string;
  }>;
}

function parseMovieHtml(html: string): ScrapedMovie | null {
  const $ = cheerio.load(html);
  
  // Title
  let title = $('div.movie-details h1').text().trim();
  if (!title) return null;
  
  // Genres
  const genresText = $('p.type').text();
  const genres = genresText
    ? genresText.split('|').map(s => s.trim()).filter(Boolean)
    : [];
    
  // Synopsis
  const descClone = $('p.description').clone();
  descClone.find('button').remove();
  const synopsis = descClone.text().trim();
  
  // Poster URL
  const posterUrl = $('img.movie-poster').attr('src') || null;
  
  // Details box
  let countries = ['Nigeria'];
  let year: number | null = null;
  let runtimeMinutes: number | null = null;
  
  $('.info-box p').each((_, el) => {
    const text = $(el).text().trim();
    if (text.startsWith('Country:')) {
      const val = text.replace('Country:', '').trim();
      if (val) {
        countries = val.split(',').map(s => s.trim()).filter(Boolean);
      }
    } else if (text.startsWith('Date Released:')) {
      const val = text.replace('Date Released:', '').trim();
      const yearMatch = val.match(/\b\d{4}\b/);
      if (yearMatch) {
        year = parseInt(yearMatch[0]);
      }
    } else if (text.startsWith('Duration:')) {
      const val = text.replace('Duration:', '').trim().toLowerCase();
      let hours = 0;
      let minutes = 0;
      const hourMatch = val.match(/(\d+)\s*(?:hour|hours|h)/);
      const minMatch = val.match(/(\d+)\s*(?:minute|minutes|min|mins|m)/);
      if (hourMatch) hours = parseInt(hourMatch[1]);
      if (minMatch) minutes = parseInt(minMatch[1]);
      if (!hourMatch && !minMatch) {
        const numMatch = val.match(/^(\d+)$/);
        if (numMatch) minutes = parseInt(numMatch[1]);
      }
      if (hours > 0 || minutes > 0) {
        runtimeMinutes = hours * 60 + minutes;
      }
    }
  });
  
  // YouTube watch URL / video ID
  const playerSrc = $('#movie-player').attr('src');
  let youtubeWatchUrl: string | null = null;
  let sourceVideoId: string | null = null;
  if (playerSrc) {
    const m = playerSrc.match(/\/embed\/([^?#/]+)/);
    if (m) {
      sourceVideoId = m[1];
      youtubeWatchUrl = `https://www.youtube.com/watch?v=${sourceVideoId}`;
    }
  }
  
  // Cast
  const cast: ScrapedMovie['cast'] = [];
  $('.cast-member').each((_, el) => {
    const link = $(el).find('a').attr('href');
    const img = $(el).find('img').attr('src');
    
    const pText = $(el).find('p').text().trim();
    const strongRole = $(el).find('p strong').text().trim();
    const name = pText.replace(strongRole, '').trim();
    
    if (name && link) {
      cast.push({
        name,
        actorPageUrl: link.startsWith('http') ? link : `${BASE}${link}`,
        imageUrl: img || null,
        role: strongRole || 'actor'
      });
    }
  });
  
  return {
    title,
    genres,
    synopsis,
    posterUrl,
    countries,
    year,
    runtimeMinutes,
    youtubeWatchUrl,
    sourceVideoId,
    cast
  };
}

async function scrapeMoviePage(movieUrl: string): Promise<ScrapedMovie | null> {
  try {
    const html = await fetchWithRetry(movieUrl);
    return parseMovieHtml(html);
  } catch (e: any) {
    console.error(`❌ Error scraping movie page ${movieUrl}: ${e.message}`);
    return null;
  }
}

async function syncMovie(movieUrl: string) {
  console.log(`\n----------------------------------------`);
  console.log(`🍿 Scraping details: ${movieUrl}`);
  
  const scraped = await scrapeMoviePage(movieUrl);
  if (!scraped) return;

  const { isSeries, baseTitle, episodeNum, seasonNum } = detectAndNormalizeSeries(scraped.title);
  const normalizedTitle = cleanTitle(baseTitle);

  console.log(`🎬 Title: "${normalizedTitle}" ${episodeNum ? `(Episode ${episodeNum})` : ''}`);
  console.log(`   - Year: ${scraped.year ?? 'N/A'}`);
  console.log(`   - Country: ${scraped.countries.join(', ')}`);
  console.log(`   - Runtime: ${scraped.runtimeMinutes ?? 'N/A'} mins`);
  console.log(`   - Watch link: ${scraped.youtubeWatchUrl ?? 'None'}`);
  console.log(`   - Cast size: ${scraped.cast.length}`);

  try {
    // 1. Match Movie in Database
    let { data: existing } = await supabase
      .from('films')
      .select('*')
      .ilike('title', normalizedTitle);

    // Narrow down by year if multiple matches exist
    if (existing && existing.length > 1 && scraped.year) {
      const matchWithYear = existing.filter(f => f.year === scraped.year);
      if (matchWithYear.length > 0) existing = matchWithYear;
    }

    let filmId: string | null = null;
    const movieDetailUrl = movieUrl;
    const nollymeterLink = { nollymeter: movieDetailUrl };

    if (existing && existing.length > 0) {
      const film = existing[0];
      filmId = film.id;
      console.log(`  ✓ Found existing movie (ID: ${filmId})`);

      const updatePayload: any = {
        streaming_links: { ...(film.streaming_links || {}), ...nollymeterLink },
      };

      if (!film.synopsis && scraped.synopsis) updatePayload.synopsis = scraped.synopsis;
      if (!film.year && scraped.year) updatePayload.year = scraped.year;
      if (!film.runtime_minutes && scraped.runtimeMinutes) updatePayload.runtime_minutes = scraped.runtimeMinutes;
      if ((!film.countries || film.countries.length === 0) && scraped.countries.length > 0) {
        updatePayload.countries = scraped.countries;
      }
      if ((!film.genres || film.genres.length === 0) && scraped.genres.length > 0) {
        updatePayload.genres = scraped.genres;
      }

      // Re-host and enrich poster/backdrop if missing
      if (!film.poster_url && scraped.posterUrl) {
        const ownPosterUrl = await mirrorImageToStorage(scraped.posterUrl, 'posters');
        if (ownPosterUrl) {
          updatePayload.poster_url = ownPosterUrl;
          updatePayload.backdrop_url = ownPosterUrl;
        }
      }

      // If YouTube watch URL is available and missing in db, enrich it
      if (!film.youtube_watch_url && scraped.youtubeWatchUrl) {
        updatePayload.youtube_watch_url = scraped.youtubeWatchUrl;
        updatePayload.source_video_id = scraped.sourceVideoId;
        
        const isSuperPrimary = film.youtube_watch_url || ['kava', 'ironflix', 'prime_video'].includes(film.release_type);
        if (!isSuperPrimary) {
          updatePayload.release_type = 'youtube';
          updatePayload.source = 'nollymeter';
        }
      }

      await supabase.from('films').update(updatePayload).eq('id', filmId);
      console.log(`  ✓ Updated existing movie metadata`);

    } else {
      // Create new movie
      console.log(`  ✨ Creating new movie in database`);
      
      const ownPosterUrl = scraped.posterUrl
        ? await mirrorImageToStorage(scraped.posterUrl, 'posters')
        : null;

      const { data: inserted, error: insertErr } = await supabase
        .from('films')
        .insert({
          title: normalizedTitle,
          year: scraped.year,
          runtime_minutes: scraped.runtimeMinutes,
          synopsis: scraped.synopsis,
          poster_url: ownPosterUrl,
          backdrop_url: ownPosterUrl,
          countries: scraped.countries.length > 0 ? scraped.countries : ['Nigeria'],
          genres: scraped.genres,
          source: 'nollymeter',
          source_video_id: scraped.sourceVideoId || `nollymeter-${generateSlug(scraped.title)}`,
          streaming_links: nollymeterLink,
          status: 'released',
          needs_review: true,
          content_type: 'movie',
          release_type: scraped.youtubeWatchUrl ? 'youtube' : 'cinema',
          youtube_watch_url: scraped.youtubeWatchUrl || null
        })
        .select('id')
        .single();

      if (insertErr) {
        console.error(`  ❌ Error inserting movie: ${insertErr.message}`);
        return;
      }

      filmId = inserted.id;
      console.log(`  ✓ Inserted new movie: "${normalizedTitle}"`);
    }

    // 2. Ingest Credits (Cast & Crew)
    if (filmId) {
      for (const castMember of scraped.cast) {
        const personId = await upsertPerson(castMember.name, castMember.actorPageUrl, castMember.imageUrl);
        if (personId) {
          const role = mapRole(castMember.role);
          await supabase.from('credits').upsert({
            film_id: filmId,
            person_id: personId,
            role,
            character_name: null
          }, { onConflict: 'film_id,person_id,role' });
        }
      }
      console.log(`  ✓ Cast & Crew credits linked successfully`);
    }

  } catch (e: any) {
    console.error(`  ❌ Error syncing movie to DB: ${e.message}`);
  }
}

async function run() {
  const args = process.argv.slice(2);
  let startPage = 1;
  let endPage = 1;
  let delayMs = 1000;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--start-page' && args[i + 1]) {
      startPage = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--end-page' && args[i + 1]) {
      endPage = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--delay' && args[i + 1]) {
      delayMs = parseInt(args[i + 1]);
      i++;
    }
  }

  console.log(`🚀 Starting Nollymeter Scraper...`);
  console.log(`   - Start Page: ${startPage}`);
  console.log(`   - End Page: ${endPage}`);
  console.log(`   - Request Delay: ${delayMs}ms\n`);

  for (let page = startPage; page <= endPage; page++) {
    const listUrl = `${BASE}/movies?page=${page}`;
    console.log(`📋 Fetching Movies List Page ${page}: ${listUrl}`);
    
    try {
      const html = await fetchWithRetry(listUrl);
      const $ = cheerio.load(html);
      
      const movieUrls: string[] = [];
      $('.movie a').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
          movieUrls.push(href.startsWith('http') ? href : `${BASE}${href}`);
        }
      });
      
      console.log(`🔍 Found ${movieUrls.length} movies on Page ${page}`);
      
      for (const movieUrl of movieUrls) {
        await syncMovie(movieUrl);
        await sleep(delayMs);
      }
    } catch (e: any) {
      console.error(`❌ Error fetching list page ${page}: ${e.message}`);
    }
  }

  console.log(`\n🎉 Nollymeter scraping and sync complete.`);
}

run().catch(e => {
  console.error('💀 Fatal execution error:', e);
  process.exit(1);
});
