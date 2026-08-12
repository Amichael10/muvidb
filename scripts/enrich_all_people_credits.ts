import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TMDB_KEY = process.env.VITE_TMDB_API_KEY || '4edb739fa9f16d24f0aecf6a0dbcaab8';
const YT_KEY = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY;
const OMDB_KEY = process.env.OMDb_API || '20ab3fe8';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const PROGRESS_FILE = path.resolve(process.cwd(), 'scratch', 'all_people_enrich_progress.json');

if (!fs.existsSync(path.resolve(process.cwd(), 'scratch'))) {
  fs.mkdirSync(path.resolve(process.cwd(), 'scratch'), { recursive: true });
}

function loadProgress(): Set<string> {
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
      return new Set(data.processedPersonIds || []);
    } catch {
      return new Set();
    }
  }
  return new Set();
}

function saveProgress(processedIds: Set<string>) {
  fs.writeFileSync(
    PROGRESS_FILE,
    JSON.stringify({
      lastUpdated: new Date().toISOString(),
      count: processedIds.size,
      processedPersonIds: Array.from(processedIds),
    }, null, 2),
    'utf-8'
  );
}

function cleanTitle(title: string): string {
  return title
    .replace(/\[.*?\]|\(.*?\)/g, '')
    .replace(/Nollywood Movie|Latest Yoruba Movie|Yoruba Movie \d+|Full Movie/gi, '')
    .replace(/season\s+\d+|part\s+\d+|ep\s+\d+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function findOrCreateFilm(
  title: string,
  year?: number | null,
  posterUrl?: string | null,
  synopsis?: string | null,
  tmdbId?: number | null
): Promise<string | null> {
  const cleaned = cleanTitle(title);
  if (!cleaned || cleaned.length < 2) return null;

  if (tmdbId) {
    const { data: byTmdb } = await supabase
      .from('films')
      .select('id')
      .eq('tmdb_id', tmdbId)
      .limit(1);
    if (byTmdb && byTmdb.length > 0) return byTmdb[0].id;
  }

  const { data: byTitle } = await supabase
    .from('films')
    .select('id')
    .ilike('title', cleaned)
    .limit(1);

  if (byTitle && byTitle.length > 0) return byTitle[0].id;

  const slug = slugify(cleaned);
  const { data: newFilm, error } = await supabase
    .from('films')
    .insert({
      title: cleaned,
      year: year || new Date().getFullYear(),
      poster_url: posterUrl || null,
      synopsis: synopsis || null,
      tmdb_id: tmdbId || null,
      is_published: true,
      source: 'full_catalog_enrichment',
    })
    .select('id')
    .single();

  if (error || !newFilm) {
    const fallbackSlug = `${slug}-${Math.floor(Math.random() * 100000)}`;
    const { data: retryFilm } = await supabase
      .from('films')
      .insert({
        title: cleaned,
        year: year || new Date().getFullYear(),
        poster_url: posterUrl || null,
        synopsis: synopsis || null,
        tmdb_id: tmdbId || null,
        is_published: true,
        source: 'full_catalog_enrichment',
      })
      .select('id')
      .single();
    return retryFilm ? retryFilm.id : null;
  }

  return newFilm.id;
}

async function attachCredit(filmId: string, personId: string, role: string = 'actor', characterName?: string | null): Promise<boolean> {
  const { error } = await supabase
    .from('credits')
    .upsert(
      {
        film_id: filmId,
        person_id: personId,
        role: role,
        character_name: characterName || null,
      },
      { onConflict: 'film_id,person_id,role' }
    );

  return !error;
}

// SOURCE 1: TMDB API
async function enrichFromTMDB(name: string, personId: string): Promise<number> {
  let added = 0;
  try {
    const searchUrl = `https://api.themoviedb.org/3/search/person?api_key=${TMDB_KEY}&query=${encodeURIComponent(name)}`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return 0;
    const searchData: any = await searchRes.json();

    if (!searchData.results || searchData.results.length === 0) return 0;

    const tmdbPerson = searchData.results[0];

    // Check existing person photo_url before touching it — NEVER overwrite existing photo!
    const { data: currentPerson } = await supabase
      .from('people')
      .select('photo_url')
      .eq('id', personId)
      .single();

    const updates: any = { tmdb_id: tmdbPerson.id };
    if (!currentPerson?.photo_url && tmdbPerson.profile_path) {
      updates.photo_url = `https://image.tmdb.org/t/p/w500${tmdbPerson.profile_path}`;
    }
    await supabase.from('people').update(updates).eq('id', personId);

    const creditsUrl = `https://api.themoviedb.org/3/person/${tmdbPerson.id}/movie_credits?api_key=${TMDB_KEY}`;
    const creditsRes = await fetch(creditsUrl);
    if (!creditsRes.ok) return 0;
    const creditsData: any = await creditsRes.json();

    const castList = creditsData.cast || [];
    const crewList = creditsData.crew || [];

    for (const movie of castList) {
      if (!movie.title) continue;
      const releaseYear = movie.release_date ? parseInt(movie.release_date.split('-')[0]) : null;
      const poster = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null;

      const filmId = await findOrCreateFilm(movie.title, releaseYear, poster, movie.overview, movie.id);
      if (filmId) {
        const ok = await attachCredit(filmId, personId, 'actor', movie.character);
        if (ok) added++;
      }
    }

    for (const movie of crewList) {
      if (!movie.title) continue;
      const releaseYear = movie.release_date ? parseInt(movie.release_date.split('-')[0]) : null;
      const poster = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null;

      const filmId = await findOrCreateFilm(movie.title, releaseYear, poster, movie.overview, movie.id);
      if (filmId) {
        const role = (movie.job || 'crew').toLowerCase();
        const normRole = role.includes('director') ? 'director' : role.includes('producer') ? 'producer' : 'crew';
        const ok = await attachCredit(filmId, personId, normRole, null);
        if (ok) added++;
      }
    }
  } catch {}
  return added;
}

// SOURCE 2: PartyJollofTV CMS API
async function enrichFromPartyJollof(name: string, personId: string): Promise<number> {
  let added = 0;
  try {
    const url = `https://cms.partyjolloftv.com/api/movies?limit=100`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return 0;
    const json: any = await res.json();

    const movies = json.docs || [];
    for (const movie of movies) {
      if (!movie.title) continue;
      const movieStr = JSON.stringify(movie).toLowerCase();
      if (movieStr.includes(name.toLowerCase())) {
        const year = movie.releaseDate ? parseInt(movie.releaseDate.split('-')[0]) : null;
        let posterUrl: string | null = null;
        if (movie.poster?._key) {
          posterUrl = `https://1s8yfxw74q.ufs.sh/f/${movie.poster._key}`;
        }
        const filmId = await findOrCreateFilm(movie.title, year, posterUrl, movie.synopsis || null);
        if (filmId) {
          const ok = await attachCredit(filmId, personId, 'actor', null);
          if (ok) added++;
        }
      }
    }
  } catch {}
  return added;
}

// SOURCE 3: FilmFlux (https://filmflux.app)
async function enrichFromFilmFlux(name: string, personId: string): Promise<number> {
  let added = 0;
  try {
    const url = `https://filmflux.app/api/movies?q=${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return 0;
    const data: any = await res.json();

    const movies = Array.isArray(data) ? data : data.movies || data.results || [];
    for (const movie of movies) {
      if (!movie.title) continue;
      const filmId = await findOrCreateFilm(movie.title, movie.year || null, movie.posterUrl || movie.poster_url || null, movie.synopsis || null);
      if (filmId) {
        const ok = await attachCredit(filmId, personId, 'actor', null);
        if (ok) added++;
      }
    }
  } catch {}
  return added;
}

// SOURCE 4: AfricanMovieDB (https://africanmoviedb.com)
async function enrichFromAfricanMovieDB(name: string, personId: string): Promise<number> {
  let added = 0;
  try {
    const url = `https://africanmoviedb.com/titles/type/movie?q=${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' } });
    if (!res.ok) return 0;
    const html = await res.text();

    const titleMatches = html.match(/href=["'](\/title\/[^"']+)["']/g) || [];
    for (const match of titleMatches.slice(0, 10)) {
      const rawSlug = match.replace(/href=["']\/title\//, '').replace(/["']$/, '');
      const cleanName = rawSlug.replace(/-/g, ' ').replace(/\d{4}$/, '').trim();
      if (cleanName.length > 2) {
        const filmId = await findOrCreateFilm(cleanName, null, null, null);
        if (filmId) {
          const ok = await attachCredit(filmId, personId, 'actor', null);
          if (ok) added++;
        }
      }
    }
  } catch {}
  return added;
}

// SOURCE 5: AfricanMovieDatabase (https://africanmoviedatabase.com)
async function enrichFromAfricanMovieDatabase(name: string, personId: string): Promise<number> {
  let added = 0;
  try {
    const url = `https://africanmoviedatabase.com/?s=${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return 0;
    const html = await res.text();

    const articleMatches = html.match(/<h2 class="[^"]*entry-title[^"]*"><a href="[^"]+">([^<]+)<\/a>/g) || [];
    for (const match of articleMatches.slice(0, 10)) {
      const title = match.replace(/<[^>]+>/g, '').trim();
      if (title.length > 2) {
        const filmId = await findOrCreateFilm(title, null, null, null);
        if (filmId) {
          const ok = await attachCredit(filmId, personId, 'actor', null);
          if (ok) added++;
        }
      }
    }
  } catch {}
  return added;
}

// SOURCE 6: AfricanMovies.net (https://africanmovies.net)
async function enrichFromAfricanMoviesNet(name: string, personId: string): Promise<number> {
  let added = 0;
  try {
    const url = `https://africanmovies.net/?s=${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return 0;
    const html = await res.text();

    const matches = html.match(/<a class="[^"]*movie-title[^"]*"[^>]*>([^<]+)<\/a>/g) || [];
    for (const match of matches.slice(0, 10)) {
      const title = match.replace(/<[^>]+>/g, '').trim();
      if (title.length > 2) {
        const filmId = await findOrCreateFilm(title, null, null, null);
        if (filmId) {
          const ok = await attachCredit(filmId, personId, 'actor', null);
          if (ok) added++;
        }
      }
    }
  } catch {}
  return added;
}

// SOURCE 7: MuvieStars (https://muviestars.com)
async function enrichFromMuvieStars(name: string, personId: string): Promise<number> {
  let added = 0;
  try {
    const url = `https://muviestars.com/api/search?q=${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
    if (!res.ok) return 0;
    const data: any = await res.json();

    const movies = data.movies || data.results || Array.isArray(data) ? data : [];
    for (const movie of movies.slice(0, 10)) {
      if (!movie.title) continue;
      const filmId = await findOrCreateFilm(movie.title, movie.year || null, movie.poster || null, movie.synopsis || null);
      if (filmId) {
        const ok = await attachCredit(filmId, personId, 'actor', null);
        if (ok) added++;
      }
    }
  } catch {}
  return added;
}

// SOURCE 8: YouTube API
async function enrichFromYouTube(name: string, personId: string): Promise<number> {
  if (!YT_KEY) return 0;
  let added = 0;
  try {
    const query = `${name} Nollywood full movie`;
    const ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=20&key=${YT_KEY}`;
    const res = await fetch(ytUrl);
    if (!res.ok) return 0;
    const data: any = await res.json();

    const items = data.items || [];
    for (const item of items) {
      const snippet = item.snippet;
      if (!snippet || !snippet.title) continue;
      const title = snippet.title;
      const description = snippet.description || '';
      const year = snippet.publishedAt ? parseInt(snippet.publishedAt.split('-')[0]) : null;
      const thumbnail = snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url;

      const filmId = await findOrCreateFilm(title, year, thumbnail, description);
      if (filmId) {
        const ok = await attachCredit(filmId, personId, 'actor', null);
        if (ok) added++;
      }
    }
  } catch {}
  return added;
}

// SOURCE 9: OMDb / IMDb API
async function enrichFromOMDb(name: string, personId: string): Promise<number> {
  if (!OMDB_KEY) return 0;
  let added = 0;
  try {
    const url = `http://www.omdbapi.com/?apikey=${OMDB_KEY}&s=${encodeURIComponent(name)}&type=movie`;
    const res = await fetch(url);
    if (!res.ok) return 0;
    const data: any = await res.json();

    if (data.Search) {
      for (const movie of data.Search) {
        if (!movie.Title) continue;
        const year = movie.Year ? parseInt(movie.Year) : null;
        const poster = movie.Poster && movie.Poster !== 'N/A' ? movie.Poster : null;
        const filmId = await findOrCreateFilm(movie.Title, year, poster, null);
        if (filmId) {
          const ok = await attachCredit(filmId, personId, 'actor', null);
          if (ok) added++;
        }
      }
    }
  } catch {}
  return added;
}

// SOURCE 10: Local DB Catalog Cross-Reference
async function enrichFromExistingDB(name: string, personId: string): Promise<number> {
  let added = 0;
  if (!name || name.length < 3) return 0;
  try {
    const { data: titleMatches } = await supabase
      .from('films')
      .select('id')
      .or(`title.ilike.%${name}%,synopsis.ilike.%${name}%`)
      .limit(100);

    if (titleMatches && titleMatches.length > 0) {
      for (const f of titleMatches) {
        const ok = await attachCredit(f.id, personId, 'actor', null);
        if (ok) added++;
      }
    }
  } catch {}
  return added;
}

async function updatePersonFilmCount(personId: string): Promise<number> {
  const { count } = await supabase
    .from('credits')
    .select('*', { count: 'exact', head: true })
    .eq('person_id', personId);

  const finalCount = count || 0;
  await supabase
    .from('people')
    .update({ film_count: finalCount, updated_at: new Date().toISOString() })
    .eq('id', personId);

  return finalCount;
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const maxToProcess = limitArg ? parseInt(limitArg.split('=')[1]) : 200;

  console.log('====================================================');
  console.log(`🌐 10-SOURCE CATALOG CREDIT ENRICHMENT (Limit: ${maxToProcess})`);
  console.log('Sources: TMDB | PartyJollof | FilmFlux | AfricanMovieDB | AfricanMovieDatabase | AfricanMoviesNet | MuvieStars | YouTube | IMDb | Local DB');
  console.log('====================================================\n');

  const processed = loadProgress();
  console.log(`Loaded progress: ${processed.size} people previously processed.\n`);

  const { data: people, error } = await supabase
    .from('people')
    .select('id, name, film_count')
    .order('film_count', { ascending: true, nullsFirst: true })
    .limit(maxToProcess * 2);

  if (error || !people) {
    console.error('Error fetching people list:', error?.message);
    process.exit(1);
  }

  const pending = people.filter((p) => !processed.has(p.id)).slice(0, maxToProcess);
  console.log(`Found ${pending.length} people queued for enrichment in this batch.\n`);

  let count = 0;
  for (const person of pending) {
    count++;
    console.log(`[${count}/${pending.length}] Enriching "${person.name}" (Current credits: ${person.film_count || 0})...`);

    const tmdbAdded = await enrichFromTMDB(person.name, person.id);
    const pjAdded = await enrichFromPartyJollof(person.name, person.id);
    const fluxAdded = await enrichFromFilmFlux(person.name, person.id);
    const amdbAdded = await enrichFromAfricanMovieDB(person.name, person.id);
    const amdbaseAdded = await enrichFromAfricanMovieDatabase(person.name, person.id);
    const amnetAdded = await enrichFromAfricanMoviesNet(person.name, person.id);
    const msAdded = await enrichFromMuvieStars(person.name, person.id);
    const ytAdded = await enrichFromYouTube(person.name, person.id);
    const omdbAdded = await enrichFromOMDb(person.name, person.id);
    const dbAdded = await enrichFromExistingDB(person.name, person.id);

    const totalCredits = await updatePersonFilmCount(person.id);
    const totalAdded = tmdbAdded + pjAdded + fluxAdded + amdbAdded + amdbaseAdded + amnetAdded + msAdded + ytAdded + omdbAdded + dbAdded;

    console.log(`   └─ Added +${totalAdded} credits across 10 sources => Total Credits: ${totalCredits}`);

    processed.add(person.id);
    saveProgress(processed);

    await new Promise((r) => setTimeout(r, 250));
  }

  console.log('\n====================================================');
  console.log(`🎉 BATCH ENRICHMENT COMPLETE! Processed ${pending.length} people.`);
  console.log(`Total processed across all runs: ${processed.size}`);
  console.log('Run the script again to continue with the next batch!');
  console.log('====================================================');
}

main().catch((err) => {
  console.error('Fatal error in catalog enrichment:', err);
  process.exit(1);
});
