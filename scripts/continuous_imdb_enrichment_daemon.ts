import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import { supabase } from './lib/db';

dotenv.config({ path: '.env.local' });
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_FILE = path.resolve(__dirname, '..', 'scratch', 'imdb_continuous_enrichment.log');
const STATE_FILE = path.resolve(__dirname, '..', 'scratch', 'imdb_continuous_state.json');

// Ensure scratch directory exists
const scratchDir = path.dirname(LOG_FILE);
if (!fs.existsSync(scratchDir)) {
  fs.mkdirSync(scratchDir, { recursive: true });
}

function log(msg: string) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n', 'utf8');
  } catch (e) {
    // ignore logging errors
  }
}

const FIRECRAWL_KEYS = [
  process.env.FIRECRAWL_API_KEY,
  process.env.FIRECRAWL_API_KEY_2,
  process.env.FIRECRAWL_API_KEY_3,
  process.env.FIRECRAWL_API_KEY_4,
  process.env.FIRECRAWL_API_KEY_5,
  process.env.FIRECRAWL_KEY,
].filter(Boolean) as string[];

const TMDB_KEY = process.env.VITE_TMDB_API_KEY || process.env.TMDB_API_KEY || '';

let fcIndex = 0;
function getNextFirecrawlKey(): string {
  if (FIRECRAWL_KEYS.length === 0) return '';
  const key = FIRECRAWL_KEYS[fcIndex % FIRECRAWL_KEYS.length];
  fcIndex++;
  return key;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

async function updateDaemonStatus(status: string, message: string, meta: Record<string, any> = {}) {
  try {
    await supabase.from('automation_jobs').upsert({
      id: 'imdb_continuous_enricher',
      status,
      last_message: message,
      last_run: new Date().toISOString(),
      metadata: meta,
    });
  } catch (e) {
    // ignore
  }
}

async function firecrawlScrape(url: string): Promise<{ markdown: string; html: string; links: string[] } | null> {
  if (FIRECRAWL_KEYS.length === 0) {
    return null;
  }

  for (let attempt = 0; attempt < FIRECRAWL_KEYS.length * 2; attempt++) {
    const key = getNextFirecrawlKey();
    try {
      const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          url,
          formats: ['markdown', 'html', 'links'],
          waitFor: 1500,
        }),
        signal: AbortSignal.timeout(15000),
      });

      const data: any = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        return {
          markdown: data.data?.markdown || '',
          html: data.data?.html || '',
          links: data.data?.links || [],
        };
      }

      if (res.status === 402 || res.status === 429 || res.status === 401) {
        continue;
      }
    } catch (e: any) {
      // try next key
    }
    await sleep(1000);
  }
  return null;
}

async function fetchTmdbDetails(title: string, year?: number | null) {
  if (!TMDB_KEY) return null;
  try {
    const query = encodeURIComponent(title);
    const yearParam = year ? `&year=${year}` : '';
    const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${query}${yearParam}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      const match = data.results[0];
      return {
        tmdb_id: String(match.id),
        synopsis: match.overview?.trim() || null,
        poster_url: match.poster_path ? `https://image.tmdb.org/t/p/w500${match.poster_path}` : null,
        backdrop_url: match.backdrop_path ? `https://image.tmdb.org/t/p/w1280${match.backdrop_path}` : null,
        tmdb_rating: match.vote_average || null,
        year: match.release_date ? parseInt(match.release_date.slice(0, 4), 10) : year,
      };
    }
  } catch (e) {
    // ignore
  }
  return null;
}

async function fetchTmdbPerson(name: string) {
  if (!TMDB_KEY) return null;
  try {
    const query = encodeURIComponent(name);
    const res = await fetch(`https://api.themoviedb.org/3/search/person?api_key=${TMDB_KEY}&query=${query}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      const match = data.results[0];
      const detailRes = await fetch(`https://api.themoviedb.org/3/person/${match.id}?api_key=${TMDB_KEY}&append_to_response=combined_credits,external_ids`, {
        signal: AbortSignal.timeout(4000),
      });
      if (detailRes.ok) {
        return await detailRes.json();
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

async function getOrCreateFilm(filmData: {
  title: string;
  year?: number | null;
  synopsis?: string | null;
  poster_url?: string | null;
  backdrop_url?: string | null;
  imdb_id?: string | null;
  tmdb_id?: string | null;
  tmdb_rating?: number | null;
  genres?: string[];
}): Promise<string | null> {
  const cleanTitle = filmData.title.trim();
  const slug = slugify(`${cleanTitle}-${filmData.year || 2024}`);

  const { data: existingList } = await supabase
    .from('films')
    .select('id, poster_url, backdrop_url, synopsis, imdb_id, tmdb_id, genres, source, youtube_watch_url, source_video_id, streaming_links')
    .ilike('title', cleanTitle)
    .limit(1);

  const existing = existingList?.[0];

  if (existing) {
    const isYoutube =
      existing.source === 'youtube' ||
      !!existing.youtube_watch_url ||
      !!existing.source_video_id ||
      (Array.isArray(existing.streaming_links) &&
        existing.streaming_links.some((l: any) => l?.platform?.toLowerCase?.().includes('youtube') || l?.url?.includes('youtu')));

    // If existing film is a YouTube upload and we don't have matching explicit IDs,
    // do NOT hijack the YouTube indie film for IMDb/TMDB credits or metadata!
    if (isYoutube) {
      const matchesExplicitId =
        (filmData.tmdb_id && existing.tmdb_id === filmData.tmdb_id) ||
        (filmData.imdb_id && existing.imdb_id === filmData.imdb_id);

      if (!matchesExplicitId) {
        // Fall through to insert a separate film entry for the IMDb title
        // instead of attaching foreign credits to the YouTube indie film
      } else {
        return existing.id;
      }
    } else {
      const updates: Record<string, any> = {};
      if (!existing.poster_url && filmData.poster_url) updates.poster_url = filmData.poster_url;
      if (!existing.backdrop_url && filmData.backdrop_url) updates.backdrop_url = filmData.backdrop_url;
      if (!existing.synopsis && filmData.synopsis) updates.synopsis = filmData.synopsis;
      if (!existing.imdb_id && filmData.imdb_id) updates.imdb_id = filmData.imdb_id;
      if (!existing.tmdb_id && filmData.tmdb_id) updates.tmdb_id = filmData.tmdb_id;
      if (filmData.genres && (!existing.genres || existing.genres.length === 0)) updates.genres = filmData.genres;

      if (Object.keys(updates).length > 0) {
        await supabase.from('films').update(updates).eq('id', existing.id);
      }
      return existing.id;
    }
  }

  const { data: created, error } = await supabase
    .from('films')
    .insert({
      title: cleanTitle,
      slug,
      year: filmData.year || 2024,
      synopsis: filmData.synopsis || `${cleanTitle} is a notable Nigerian film production.`,
      poster_url: filmData.poster_url || null,
      backdrop_url: filmData.backdrop_url || null,
      imdb_id: filmData.imdb_id || null,
      tmdb_id: filmData.tmdb_id || null,
      tmdb_rating: filmData.tmdb_rating || null,
      genres: filmData.genres || ['Drama'],
      source: 'imdb_continuous_sync',
      status: 'released',
      is_published: true,
      is_nollywood: true,
    })
    .select('id')
    .single();

  if (error) {
    const { data: retry } = await supabase.from('films').select('id').ilike('title', cleanTitle).limit(1);
    return retry?.[0]?.id || null;
  }
  return created.id;
}

export async function enrichSinglePerson(person: {
  id: string;
  name: string;
  bio?: string | null;
  photo_url?: string | null;
  date_of_birth?: string | null;
  birthplace?: string | null;
  awards?: any;
  tmdb_id?: string | null;
}) {
  log(`👤 Enriching: "${person.name}" (ID: ${person.id})`);

  let imdbId = '';
  let markdown = '';
  let html = '';

  // 1. Fetch TMDB profile if available
  const tmdbPerson = await fetchTmdbPerson(person.name);
  if (tmdbPerson?.external_ids?.imdb_id) {
    imdbId = tmdbPerson.external_ids.imdb_id;
  }

  // 2. Fetch IMDb data via Firecrawl if we have an IMDb ID or search for it
  if (imdbId) {
    const scrapeResult = await firecrawlScrape(`https://www.imdb.com/name/${imdbId}/`);
    if (scrapeResult) {
      markdown = scrapeResult.markdown;
      html = scrapeResult.html;
    }
  }

  // Extract details from IMDb HTML / markdown or TMDB
  const updates: Record<string, any> = {
    is_verified: true,
    nationality: 'Nigerian',
  };

  if (tmdbPerson?.id) {
    updates.tmdb_id = String(tmdbPerson.id);
  }

  // Photo URL
  if (!person.photo_url) {
    if (html) {
      const $ = cheerio.load(html);
      const img = $('img.ipc-image').first().attr('src') || $('img[class*="avatar"]').first().attr('src');
      if (img && !img.includes('nopicture')) updates.photo_url = img;
    }
    if (!updates.photo_url && tmdbPerson?.profile_path) {
      updates.photo_url = `https://image.tmdb.org/t/p/w500${tmdbPerson.profile_path}`;
    }
  }

  // DOB & Birthplace
  if (!person.date_of_birth && tmdbPerson?.birthday) {
    updates.date_of_birth = tmdbPerson.birthday;
  }
  if (!person.birthplace && tmdbPerson?.place_of_birth) {
    updates.birthplace = tmdbPerson.place_of_birth;
  }

  // Bio & Aliases
  if (!person.bio || person.bio.length < 50) {
    let extractedBio = '';
    if (tmdbPerson?.biography && tmdbPerson.biography.trim().length > 40) {
      extractedBio = tmdbPerson.biography.trim();
    } else if (markdown) {
      const bioSection = markdown.match(/(?:Biography|Overview|Mini Bio)[\s\S]*?(?=\n##|\n###|Filmography|$)/i);
      if (bioSection) {
        extractedBio = bioSection[0].replace(/^#+.*$/gm, '').trim();
      }
    }
    if (extractedBio) updates.bio = extractedBio;
  }

  // Update Person in DB
  if (Object.keys(updates).length > 0) {
    await supabase.from('people').update(updates).eq('id', person.id);
    log(`  ✅ Updated profile metadata (DOB, Photo, Bio, TMDB ID)`);
  }

  // Ingest Filmography & Credits
  const titlesToIngest: Array<{ title: string; year?: number | null; role: string; character?: string | null }> = [];
  const seenTitles = new Set<string>();

  // From TMDB Credits
  if (tmdbPerson?.combined_credits?.cast) {
    for (const c of tmdbPerson.combined_credits.cast) {
      const title = c.title || c.name;
      if (title && !seenTitles.has(title.toLowerCase())) {
        seenTitles.add(title.toLowerCase());
        const y = c.release_date || c.first_air_date ? parseInt((c.release_date || c.first_air_date).slice(0, 4), 10) : null;
        titlesToIngest.push({ title, year: y, role: 'actor', character: c.character || null });
      }
    }
  }
  if (tmdbPerson?.combined_credits?.crew) {
    for (const c of tmdbPerson.combined_credits.crew) {
      const title = c.title || c.name;
      if (title && !seenTitles.has(title.toLowerCase())) {
        seenTitles.add(title.toLowerCase());
        const y = c.release_date || c.first_air_date ? parseInt((c.release_date || c.first_air_date).slice(0, 4), 10) : null;
        const dep = (c.job || c.department || 'Crew').toLowerCase();
        const role = /direct/i.test(dep) ? 'director' : /produc/i.test(dep) ? 'producer' : /writ/i.test(dep) ? 'writer' : 'crew';
        titlesToIngest.push({ title, year: y, role, character: null });
      }
    }
  }

  // From IMDb Markdown
  if (markdown) {
    const titleRegex = /\[(.*?)\]\(https:\/\/www\.imdb\.com\/title\/(tt\d+)[^)]*\)/g;
    let match;
    while ((match = titleRegex.exec(markdown)) !== null) {
      let rawTitle = match[1].trim().replace(/\s*\(\d{4}\)$/, '').replace(/^[A-Za-z\s]+ in /, '').trim();
      if (!rawTitle || rawTitle.includes('Release calendar') || rawTitle.includes('Top 250') || rawTitle.includes('IMDbPro')) continue;
      if (!seenTitles.has(rawTitle.toLowerCase())) {
        seenTitles.add(rawTitle.toLowerCase());
        titlesToIngest.push({ title: rawTitle, role: 'actor' });
      }
    }
  }

  let linkedCount = 0;
  for (const item of titlesToIngest.slice(0, 25)) {
    const tmdbData = await fetchTmdbDetails(item.title, item.year);
    const filmId = await getOrCreateFilm({
      title: item.title,
      year: tmdbData?.year || item.year || 2024,
      synopsis: tmdbData?.synopsis,
      poster_url: tmdbData?.poster_url,
      backdrop_url: tmdbData?.backdrop_url,
      tmdb_id: tmdbData?.tmdb_id,
      tmdb_rating: tmdbData?.tmdb_rating,
    });

    if (filmId) {
      const { data: existingCredit } = await supabase
        .from('credits')
        .select('id')
        .eq('film_id', filmId)
        .eq('person_id', person.id)
        .eq('role', item.role)
        .limit(1);

      if (!existingCredit || existingCredit.length === 0) {
        await supabase.from('credits').insert({
          film_id: filmId,
          person_id: person.id,
          role: item.role,
          character_name: item.character || null,
          billing_order: 1,
          source: 'imdb_continuous_sync',
        });
      }
      linkedCount++;
    }
    await sleep(150);
  }

  // Update total film count on person
  const { count: totalCredits } = await supabase
    .from('credits')
    .select('id', { count: 'exact', head: true })
    .eq('person_id', person.id);

  await supabase.from('people').update({ film_count: totalCredits || linkedCount }).eq('id', person.id);
  log(`  🎉 Finished "${person.name}": +${linkedCount} credits processed (total ${totalCredits || linkedCount} in DB).`);
}

export async function runContinuousEnrichmentDaemon() {
  log('====================================================');
  log('🚀 Starting Continuous IMDb & TMDB Enrichment Daemon');
  log('====================================================');

  let processedCount = 0;
  let offset = 0;

  if (fs.existsSync(STATE_FILE)) {
    try {
      const st = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      offset = st.offset || 0;
      processedCount = st.processedCount || 0;
      log(`Resuming from checkpoint: offset=${offset}, total_processed=${processedCount}`);
    } catch (e) {
      // ignore
    }
  }

  while (true) {
    try {
      await updateDaemonStatus('running', `Enriching batch (offset: ${offset}, processed: ${processedCount})...`, {
        offset,
        processedCount,
      });

      // Fetch batch of people needing enrichment ordered by low film count
      const { data: peopleBatch, error } = await supabase
        .from('people')
        .select('id, name, bio, photo_url, date_of_birth, birthplace, awards, film_count, tmdb_id')
        .order('film_count', { ascending: true })
        .range(offset, offset + 9);

      if (error) {
        log(`❌ Database error fetching batch: ${error.message}`);
        await sleep(5000);
        continue;
      }

      if (!peopleBatch || peopleBatch.length === 0) {
        log('✅ Reached end of current people roster. Cycling back to beginning for deep maintenance...');
        offset = 0;
        await sleep(30000);
        continue;
      }

      for (const person of peopleBatch) {
        try {
          await enrichSinglePerson(person);
          processedCount++;

          fs.writeFileSync(
            STATE_FILE,
            JSON.stringify({ offset, processedCount, lastPerson: person.name, timestamp: new Date().toISOString() }, null, 2),
            'utf8'
          );

          await updateDaemonStatus('running', `Enriched ${processedCount} profiles. Currently at: "${person.name}"`, {
            offset,
            processedCount,
            lastPerson: person.name,
          });
        } catch (err: any) {
          log(`⚠️ Error enriching "${person.name}": ${err.message}`);
        }
        await sleep(2000);
      }

      offset += peopleBatch.length;
      await sleep(3000);
    } catch (daemonErr: any) {
      log(`❌ Critical daemon error: ${daemonErr.message}`);
      await updateDaemonStatus('error', `Daemon error: ${daemonErr.message}`);
      await sleep(10000);
    }
  }
}

if (process.argv[1] && process.argv[1].includes('continuous_imdb_enrichment_daemon')) {
  runContinuousEnrichmentDaemon().catch((err) => {
    log(`Fatal daemon crash: ${err.message}`);
    process.exit(1);
  });
}
