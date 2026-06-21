import './dotenv_init.js';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import * as https from 'https';
import { mirrorImageToStorage } from '../api/_lib/image_mirror.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

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

async function callSupabaseWithRetry<T>(fn: () => Promise<{ data: T | null; error: any }>, retries = 5, delay = 2000): Promise<T | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { data, error } = await fn();
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('fetch failed') || msg.includes('timeout') || error.code === '40001' || error.status === 503) {
          throw error;
        }
        console.error(`❌ DB Error: ${error.message}`);
        return null;
      }
      return data;
    } catch (e: any) {
      if (attempt === retries) throw e;
      console.warn(`⚠️ [Attempt ${attempt}/${retries}] Supabase call failed: ${e.message}. Retrying in ${delay / 1000}s...`);
      await sleep(delay);
      delay *= 1.5;
    }
  }
  throw new Error('Retries exhausted');
}

function stripParentheses(str: string): string {
  let res = str.replace(/\([^)]*\)/g, '');
  res = res.replace(/[()]/g, '');
  return res.trim();
}

function cleanName(raw: string): string {
  let name = stripParentheses(raw);
  name = name.replace(/[.,\s]+$/, '');
  return name.trim().replace(/\s+/g, ' ');
}

function parseNames(raw: string): string[] {
  const cleanRaw = stripParentheses(raw);
  const parts = cleanRaw.split(/,|\b&\b|\band\b/i);
  return parts.map(p => cleanName(p)).filter(name => name.length > 1);
}

function mapRole(roleStr: string): string {
  const r = roleStr.toLowerCase().trim();
  if (r.includes('director of photography') || r.includes('cinematographer')) return 'cinematographer';
  if (r.includes('director')) return 'director';
  if (r.includes('writer')) return 'writer';
  if (r.includes('producer')) return 'producer';
  if (r.includes('editor')) return 'editor';
  if (r.includes('composer') || r.includes('music')) return 'composer';
  if (r.includes('actor') || r.includes('actress') || r.includes('cast')) return 'actor';
  return 'crew';
}

function isSectionHeader(line: string): boolean {
  const l = line.trim();
  return (
    l.startsWith('The FILM:') ||
    l.startsWith('The CAST:') ||
    l.startsWith('The CREW:') ||
    l.startsWith('PHOTOS:') ||
    l.startsWith('AWARDS:') ||
    l.startsWith('NEWS:') ||
    l.startsWith('WATCH:') ||
    l.startsWith('Country of Origin:')
  );
}

async function fetchWithHttps(url: string, retries = 3): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await new Promise<string>((resolve, reject) => {
        https.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
          }
        }, (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP Status ${res.statusCode}`));
            return;
          }
          let data = '';
          res.on('data', chunk => {
            data += chunk;
          });
          res.on('end', () => {
            resolve(data);
          });
        }).on('error', (err) => {
          reject(err);
        });
      });
    } catch (e: any) {
      if (attempt === retries) throw e;
      console.warn(`⚠️ [Attempt ${attempt}/${retries}] Fetch failed for ${url}: ${e.message}. Retrying in 3s...`);
      await sleep(3000);
    }
  }
  throw new Error(`Failed to fetch ${url} after ${retries} retries`);
}

async function upsertPerson(name: string): Promise<string | null> {
  const clean = cleanName(name);
  if (!clean || clean.length < 2) return null;

  if (actorCache.has(clean)) {
    return actorCache.get(clean)!;
  }

  try {
    // 1. Check exact name match (case-insensitive)
    let existing = await callSupabaseWithRetry<any[]>(async () => {
      return await supabase
        .from('people')
        .select('id')
        .ilike('name', clean)
        .limit(1);
    });

    let personId: string | null = null;
    let existingPerson = existing?.[0];

    // 2. Try fuzzy match RPC
    if (!existingPerson) {
      const fuzzy = await callSupabaseWithRetry<any>(async () => {
        return await supabase.rpc('match_person_fuzzy', { query_name: clean, threshold: 0.85 }).maybeSingle();
      });
      if (fuzzy?.id) {
        personId = fuzzy.id;
        console.log(`    ✓ Matched existing person fuzzy: "${clean}" (ID: ${personId})`);
      }
    } else {
      personId = existingPerson.id;
      console.log(`    ✓ Matched existing person exact: "${clean}" (ID: ${personId})`);
    }

    // 3. Create if not found
    if (!personId) {
      const newPerson = await callSupabaseWithRetry<any>(async () => {
        return await supabase
          .from('people')
          .insert({
            name: clean,
            source: 'accesskla',
            nationality: 'Ugandan',
            needs_review: true,
            status: 'community'
          })
          .select('id')
          .single();
      });

      if (!newPerson) {
        console.error(`    ❌ Failed to insert person "${clean}"`);
        return null;
      }

      personId = newPerson.id;
      console.log(`    ✨ Created new person record: "${clean}"`);
    }

    if (personId) {
      actorCache.set(clean, personId);
    }
    return personId;
  } catch (e: any) {
    console.error(`    ❌ Error in upsertPerson for "${clean}": ${e.message}`);
    return null;
  }
}

interface ScrapedMovie {
  title: string;
  year: number | null;
  genres: string[];
  runtimeMinutes: number | null;
  synopsis: string;
  posterUrl: string | null;
  cast: Array<{ character: string; actorName: string }>;
  crew: Array<{ job: string; names: string[] }>;
}

function parseMovieHtml(html: string): ScrapedMovie | null {
  const $ = cheerio.load(html);
  const originalPostBody = $('.post-body');
  if (!originalPostBody.length) return null;

  const posterUrl = originalPostBody.find('img').first().attr('src') || null;
  
  // Clone to avoid mutating original DOM and replace line break / block tags with newlines
  const postBody = originalPostBody.clone();
  postBody.find('script, style').remove();
  postBody.find('br').replaceWith('\n');
  postBody.find('p, div, h1, h2, h3, h4, h5, h6, li, tr').prepend('\n').append('\n');
  
  const lines = postBody.text().split('\n').map(l => l.trim()).filter(Boolean);

  let title = '';
  let year: number | null = null;
  let genres: string[] = [];
  let runtimeMinutes: number | null = null;
  let synopsisLines: string[] = [];

  let currentSection: 'film' | 'cast' | 'crew' | 'none' = 'none';
  const cast: ScrapedMovie['cast'] = [];
  const crew: ScrapedMovie['crew'] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('The FILM:')) {
      currentSection = 'film';
      const filmLine = line.replace('The FILM:', '').trim();
      const yearMatch = filmLine.match(/\((\d{4})\)/);
      if (yearMatch) {
        year = parseInt(yearMatch[1]);
        const index = filmLine.indexOf(yearMatch[0]);
        title = filmLine.substring(0, index).trim();

        const rest = filmLine.substring(index + yearMatch[0].length).trim();
        const cleanRest = rest.replace(/^\(|\)$/g, '');
        const parts = cleanRest.split('|').map(s => s.trim()).filter(Boolean);

        for (const part of parts) {
          if (part.toLowerCase().includes('min')) {
            const minMatch = part.match(/(\d+)/);
            if (minMatch) {
              runtimeMinutes = parseInt(minMatch[1]);
            }
          } else {
            const g = part.trim();
            if (g && !g.toLowerCase().includes('tv series') && !g.toLowerCase().includes('series')) {
              genres.push(g);
            }
          }
        }
      } else {
        title = filmLine;
      }
      continue;
    }

    if (line.startsWith('The CAST:')) {
      currentSection = 'cast';
      continue;
    }

    if (line.startsWith('The CREW:')) {
      currentSection = 'crew';
      continue;
    }

    if (isSectionHeader(line)) {
      currentSection = 'none';
      continue;
    }

    if (currentSection === 'film') {
      synopsisLines.push(line);
    } else if (currentSection === 'cast') {
      if (line.includes('-')) {
        let [charPart, actorPart] = line.split('-').map(s => s.trim());
        if (!actorPart && i + 1 < lines.length && !lines[i + 1].includes('-') && !isSectionHeader(lines[i + 1])) {
          actorPart = lines[i + 1].trim();
          i++;
        }
        if (i + 1 < lines.length && lines[i + 1].startsWith('(')) {
          actorPart += ' ' + lines[i + 1];
          i++;
        }
        const cleanedActor = cleanName(actorPart);
        if (cleanedActor) {
          cast.push({
            character: cleanName(charPart) || 'Actor',
            actorName: cleanedActor
          });
        }
      }
    } else if (currentSection === 'crew') {
      if (line.includes(':')) {
        const colonIndex = line.indexOf(':');
        const job = line.substring(0, colonIndex).trim();
        let val = line.substring(colonIndex + 1).trim();

        if (!val && i + 1 < lines.length && !lines[i + 1].includes(':') && !isSectionHeader(lines[i + 1])) {
          val = lines[i + 1].trim();
          i++;
        }
        if (i + 1 < lines.length && lines[i + 1].startsWith('(')) {
          val += ' ' + lines[i + 1];
          i++;
        }

        const names = parseNames(val);
        if (job && names.length > 0) {
          crew.push({ job, names });
        }
      }
    }
  }

  if (!title) return null;

  return {
    title,
    year,
    genres,
    runtimeMinutes,
    synopsis: synopsisLines.join('\n').trim(),
    posterUrl,
    cast,
    crew
  };
}

async function syncMovie(movieUrl: string) {
  console.log(`\n----------------------------------------`);
  console.log(`🍿 Scraping details: ${movieUrl}`);

  try {
    const html = await fetchWithHttps(movieUrl);
    const scraped = parseMovieHtml(html);
    if (!scraped) {
      console.error(`❌ Failed to parse movie content from ${movieUrl}`);
      return;
    }

    const isSeries = html.toLowerCase().includes('tv series') || html.toLowerCase().includes('episodes') || scraped.title.toLowerCase().includes('tv series');
    const contentType = isSeries ? 'series' : 'movie';

    console.log(`🎬 Title: "${scraped.title}" [${contentType}]`);
    console.log(`   - Year: ${scraped.year ?? 'N/A'}`);
    console.log(`   - Genres: ${scraped.genres.join(', ') || 'None'}`);
    console.log(`   - Runtime: ${scraped.runtimeMinutes ?? 'N/A'} mins`);
    console.log(`   - Cast size: ${scraped.cast.length}`);
    console.log(`   - Crew size: ${scraped.crew.length}`);

    let ownPosterUrl: string | null = null;
    if (scraped.posterUrl) {
      console.log(`   - Mirroring poster: ${scraped.posterUrl}`);
      ownPosterUrl = await mirrorImageToStorage(scraped.posterUrl, 'posters');
    }

    // 1. Match Film in DB (exact and then fuzzy)
    const existing = await callSupabaseWithRetry<any[]>(async () => {
      return await supabase
        .from('films')
        .select('*')
        .ilike('title', scraped.title);
    });

    let filmId: string | null = null;
    let film: any = null;

    if (existing && existing.length > 0) {
      if (scraped.year) {
        const exactMatch = existing.find(f => f.year === scraped.year);
        if (exactMatch) {
          film = exactMatch;
        } else {
          const noYearMatch = existing.find(f => !f.year);
          if (noYearMatch) {
            film = noYearMatch;
          }
        }
      } else {
        film = existing[0];
      }
    }

    if (!film) {
      const fuzzy = await callSupabaseWithRetry<any>(async () => {
        return await supabase.rpc('match_film_fuzzy', { query_title: scraped.title, threshold: 0.85 }).maybeSingle();
      });
      if (fuzzy?.id) {
        const data = await callSupabaseWithRetry<any>(async () => {
          return await supabase
            .from('films')
            .select('*')
            .eq('id', fuzzy.id)
            .single();
        });
        if (data) {
          if (!scraped.year || !data.year || data.year === scraped.year) {
            film = data;
            console.log(`   🔍 Fuzzy matched existing film by title: "${scraped.title}" ~ "${data.title}" (ID: ${film.id})`);
          }
        }
      }
    }

    const accessklaLink = { accesskla: movieUrl };

    if (film) {
      filmId = film.id;
      console.log(`   ✓ Found existing film (ID: ${filmId})`);

      const updatePayload: any = {
        streaming_links: { ...(film.streaming_links || {}), ...accessklaLink }
      };

      if (!film.synopsis && scraped.synopsis) updatePayload.synopsis = scraped.synopsis;
      if (!film.year && scraped.year) updatePayload.year = scraped.year;
      if (!film.runtime_minutes && scraped.runtimeMinutes) updatePayload.runtime_minutes = scraped.runtimeMinutes;
      
      const countriesList = film.countries || [];
      if (!countriesList.includes('Uganda')) {
        updatePayload.countries = [...countriesList, 'Uganda'];
      }

      const genresList = film.genres || [];
      const newGenres = Array.from(new Set([...genresList, ...scraped.genres]));
      if (newGenres.length > genresList.length) {
        updatePayload.genres = newGenres;
      }

      if (!film.poster_url && ownPosterUrl) {
        updatePayload.poster_url = ownPosterUrl;
        updatePayload.backdrop_url = ownPosterUrl;
      }

      await callSupabaseWithRetry(async () => {
        return await supabase.from('films').update(updatePayload).eq('id', filmId);
      });
      console.log(`   ✓ Updated existing film metadata`);
    } else {
      console.log(`   ✨ Creating new film in database`);
      const inserted = await callSupabaseWithRetry<any>(async () => {
        return await supabase
          .from('films')
          .insert({
            title: scraped.title,
            year: scraped.year,
            runtime_minutes: scraped.runtimeMinutes,
            synopsis: scraped.synopsis,
            poster_url: ownPosterUrl,
            backdrop_url: ownPosterUrl,
            countries: ['Uganda'],
            genres: scraped.genres,
            source: 'accesskla',
            source_video_id: `accesskla-${generateSlug(scraped.title)}${scraped.year ? `-${scraped.year}` : ''}-${Math.random().toString(36).substring(2, 6)}`,
            streaming_links: accessklaLink,
            status: 'released',
            needs_review: true,
            content_type: contentType,
            release_type: 'cinema',
            is_nollywood: false
          })
          .select('id')
          .single();
      });

      if (!inserted) {
        console.error(`   ❌ Failed to insert film: "${scraped.title}"`);
        return;
      }

      filmId = inserted.id;
      console.log(`   ✓ Inserted new film: "${scraped.title}"`);
    }

    if (filmId) {
      // Ingest Cast credits
      for (const castMember of scraped.cast) {
        const personId = await upsertPerson(castMember.actorName);
        if (personId) {
          await callSupabaseWithRetry(async () => {
            return await supabase.from('credits').upsert({
              film_id: filmId,
              person_id: personId,
              role: 'actor',
              character_name: castMember.character
            }, { onConflict: 'film_id,person_id,role' });
          });
        }
      }

      // Ingest Crew credits
      for (const crewMember of scraped.crew) {
        const role = mapRole(crewMember.job);
        for (const name of crewMember.names) {
          const personId = await upsertPerson(name);
          if (personId) {
            await callSupabaseWithRetry(async () => {
              return await supabase.from('credits').upsert({
                film_id: filmId,
                person_id: personId,
                role,
                character_name: null
              }, { onConflict: 'film_id,person_id,role' });
            });
          }
        }
      }

      console.log(`   ✓ Ingested all credits for "${scraped.title}"`);
    }

  } catch (e: any) {
    console.error(`❌ Error syncing movie ${movieUrl}: ${e.message}`);
  }
}

async function run() {
  const args = process.argv.slice(2);
  let limit = 0;
  let offset = 0;
  let delayMs = 1500;
  let singleUrl = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--offset' && args[i + 1]) {
      offset = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--delay' && args[i + 1]) {
      delayMs = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--url' && args[i + 1]) {
      singleUrl = args[i + 1];
      i++;
    }
  }

  if (singleUrl) {
    console.log(`🚀 Starting Ugandan Sync for single URL: ${singleUrl}`);
    await syncMovie(singleUrl);
    console.log(`🎉 Single URL sync complete.`);
    return;
  }

  console.log(`🚀 Starting AccessKla Ugandan Sync...`);
  console.log(`   - Limit: ${limit || 'No limit'}`);
  console.log(`   - Offset: ${offset}`);
  console.log(`   - Request Delay: ${delayMs}ms\n`);

  const listUrl = 'https://www.accesskla.com/2024/01/list-of-all-ugandan-movies-z.html?m=1';
  console.log(`📋 Fetching Ugandan Movies list: ${listUrl}`);

  try {
    const html = await fetchWithHttps(listUrl);
    const $ = cheerio.load(html);

    const movieUrls: string[] = [];
    $('.post-body a').each((_, el) => {
      const href = $(el).attr('href');
      if (href && /\/\d{4}\/\d{2}\//.test(href) && !href.includes('list-of-all-ugandan-movies')) {
        movieUrls.push(href);
      }
    });

    console.log(`🔍 Found ${movieUrls.length} movies in list.`);

    let targetUrls = movieUrls.slice(offset);
    if (limit > 0) {
      targetUrls = targetUrls.slice(0, limit);
    }

    console.log(`🏃 Processing ${targetUrls.length} movies...`);

    for (const url of targetUrls) {
      await syncMovie(url);
      await sleep(delayMs);
    }

  } catch (e: any) {
    console.error(`❌ Error fetching/parsing movie list: ${e.message}`);
  }

  console.log(`\n🎉 Ugandan movies scraping and sync complete.`);
}

run().catch(e => {
  console.error('💀 Fatal execution error:', e);
  process.exit(1);
});
