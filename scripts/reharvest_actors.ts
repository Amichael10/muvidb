import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TMDB_KEY = process.env.VITE_TMDB_API_KEY || '4edb739fa9f16d24f0aecf6a0dbcaab8';
const YT_KEY = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

async function findOrCreatePerson(names: string[], primaryName: string): Promise<string> {
  for (const name of names) {
    const { data } = await supabase
      .from('people')
      .select('id, name, film_count')
      .ilike('name', `%${name}%`)
      .order('film_count', { ascending: false, nullsFirst: false })
      .limit(1);

    if (data && data.length > 0) {
      console.log(`Found person in DB for "${name}": ${data[0].name} (${data[0].id})`);
      return data[0].id;
    }
  }

  const slug = slugify(primaryName);
  console.log(`Creating new person in DB: "${primaryName}" (${slug})`);
  const { data, error } = await supabase
    .from('people')
    .insert({
      name: primaryName,
      slug: slug,
      source: 'reharvest_script',
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create person ${primaryName}: ${error?.message}`);
  }
  return data.id;
}

async function findOrCreateFilm(title: string, year?: number | null, posterUrl?: string | null, synopsis?: string | null, tmdbId?: number | null): Promise<string> {
  const cleaned = cleanTitle(title);
  if (!cleaned) throw new Error('Invalid title');

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

  if (byTitle && byTitle.length > 0) {
    return byTitle[0].id;
  }

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
      source: 'reharvest_script',
    })
    .select('id')
    .single();

  if (error || !newFilm) {
    const fallbackSlug = `${slug}-${Math.floor(Math.random() * 10000)}`;
    const { data: retryFilm } = await supabase
      .from('films')
      .insert({
        title: cleaned,
        year: year || new Date().getFullYear(),
        poster_url: posterUrl || null,
        synopsis: synopsis || null,
        tmdb_id: tmdbId || null,
        is_published: true,
        source: 'reharvest_script',
      })
      .select('id')
      .single();
    if (retryFilm) return retryFilm.id;
    throw new Error(`Failed to create film "${cleaned}": ${error?.message}`);
  }

  return newFilm.id;
}

async function attachCredit(filmId: string, personId: string, role: string = 'actor', characterName?: string | null) {
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
}

// -------------------------------------------------------------
// SOURCES
// -------------------------------------------------------------
async function harvestFromTMDB(searchQuery: string, personId: string) {
  console.log(`\n🔍 Harvesting TMDB for "${searchQuery}"...`);
  try {
    const searchUrl = `https://api.themoviedb.org/3/search/person?api_key=${TMDB_KEY}&query=${encodeURIComponent(searchQuery)}`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return;
    const searchData: any = await searchRes.json();

    if (!searchData.results || searchData.results.length === 0) return;

    const tmdbPerson = searchData.results[0];

    if (tmdbPerson.profile_path) {
      await supabase
        .from('people')
        .update({
          photo_url: `https://image.tmdb.org/t/p/w500${tmdbPerson.profile_path}`,
          tmdb_id: tmdbPerson.id,
        })
        .eq('id', personId);
    }

    const creditsUrl = `https://api.themoviedb.org/3/person/${tmdbPerson.id}/movie_credits?api_key=${TMDB_KEY}`;
    const creditsRes = await fetch(creditsUrl);
    if (!creditsRes.ok) return;
    const creditsData: any = await creditsRes.json();

    const castList = creditsData.cast || [];
    let addedCount = 0;

    for (const movie of castList) {
      if (!movie.title) continue;
      const releaseYear = movie.release_date ? parseInt(movie.release_date.split('-')[0]) : null;
      const poster = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null;

      try {
        const filmId = await findOrCreateFilm(movie.title, releaseYear, poster, movie.overview, movie.id);
        await attachCredit(filmId, personId, 'actor', movie.character);
        addedCount++;
      } catch (err: any) {}
    }

    console.log(`✅ Linked ${addedCount} films from TMDB`);
  } catch (err: any) {}
}

async function harvestFromPartyJollof(searchQuery: string, personId: string) {
  console.log(`\n🔍 Harvesting PartyJollofTV for "${searchQuery}"...`);
  try {
    let addedCount = 0;
    for (let page = 1; page <= 5; page++) {
      const url = `https://cms.partyjolloftv.com/api/movies?limit=100&page=${page}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) break;
      const json: any = await res.json();
      const movies = json.docs || [];

      for (const movie of movies) {
        if (!movie.title) continue;
        if (JSON.stringify(movie).toLowerCase().includes(searchQuery.toLowerCase())) {
          const year = movie.releaseDate ? parseInt(movie.releaseDate.split('-')[0]) : null;
          let posterUrl: string | null = movie.poster?._key ? `https://1s8yfxw74q.ufs.sh/f/${movie.poster._key}` : null;
          try {
            const filmId = await findOrCreateFilm(movie.title, year, posterUrl, movie.synopsis || null);
            await attachCredit(filmId, personId, 'actor', null);
            addedCount++;
          } catch (e) {}
        }
      }
    }
    console.log(`✅ Linked ${addedCount} films from PartyJollofTV`);
  } catch (err: any) {}
}

async function harvestFromFilmFlux(searchQuery: string, personId: string) {
  console.log(`\n🔍 Harvesting FilmFlux (filmflux.app) for "${searchQuery}"...`);
  try {
    const url = `https://filmflux.app/api/movies?q=${encodeURIComponent(searchQuery)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return;
    const data: any = await res.json();
    const movies = Array.isArray(data) ? data : data.movies || data.results || [];
    let addedCount = 0;
    for (const movie of movies) {
      if (!movie.title) continue;
      try {
        const filmId = await findOrCreateFilm(movie.title, movie.year || null, movie.posterUrl || null, movie.synopsis || null);
        await attachCredit(filmId, personId, 'actor', null);
        addedCount++;
      } catch (e) {}
    }
    console.log(`✅ Linked ${addedCount} films from FilmFlux`);
  } catch (err: any) {}
}

async function harvestFromAfricanMovieDB(searchQuery: string, personId: string) {
  console.log(`\n🔍 Harvesting AfricanMovieDB (africanmoviedb.com) for "${searchQuery}"...`);
  try {
    const url = `https://africanmoviedb.com/titles/type/movie?q=${encodeURIComponent(searchQuery)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' } });
    if (!res.ok) return;
    const html = await res.text();
    const titleMatches = html.match(/href=["'](\/title\/[^"']+)["']/g) || [];
    let addedCount = 0;
    for (const match of titleMatches.slice(0, 15)) {
      const rawSlug = match.replace(/href=["']\/title\//, '').replace(/["']$/, '');
      const cleanName = rawSlug.replace(/-/g, ' ').replace(/\d{4}$/, '').trim();
      if (cleanName.length > 2) {
        try {
          const filmId = await findOrCreateFilm(cleanName, null, null, null);
          await attachCredit(filmId, personId, 'actor', null);
          addedCount++;
        } catch (e) {}
      }
    }
    console.log(`✅ Linked ${addedCount} films from AfricanMovieDB`);
  } catch (err: any) {}
}

async function harvestFromYouTube(searchQuery: string, personId: string) {
  if (!YT_KEY) return;
  console.log(`\n🔍 Harvesting YouTube API for "${searchQuery}"...`);
  try {
    const query = `${searchQuery} Nollywood full movie`;
    const ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=50&key=${YT_KEY}`;
    const res = await fetch(ytUrl);
    if (!res.ok) return;
    const data: any = await res.json();
    const items = data.items || [];
    let addedCount = 0;

    for (const item of items) {
      const snippet = item.snippet;
      if (!snippet || !snippet.title) continue;
      const title = snippet.title;
      const description = snippet.description || '';
      const year = snippet.publishedAt ? parseInt(snippet.publishedAt.split('-')[0]) : null;
      const thumbnail = snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url;

      try {
        const filmId = await findOrCreateFilm(title, year, thumbnail, description);
        await attachCredit(filmId, personId, 'actor', null);
        addedCount++;
      } catch (e) {}
    }

    console.log(`✅ Linked ${addedCount} films from YouTube`);
  } catch (err: any) {}
}

async function harvestFromExistingDatabase(searchKeywords: string[], personId: string) {
  console.log(`\n🔍 Scanning existing Database films for keywords [${searchKeywords.join(', ')}]...`);
  try {
    let matchedFilmIds: string[] = [];
    for (const kw of searchKeywords) {
      const { data: titleMatches } = await supabase
        .from('films')
        .select('id, title')
        .or(`title.ilike.%${kw}%,synopsis.ilike.%${kw}%`)
        .limit(200);

      if (titleMatches) {
        for (const f of titleMatches) matchedFilmIds.push(f.id);
      }
    }

    const uniqueIds = Array.from(new Set(matchedFilmIds));
    let attached = 0;
    for (const filmId of uniqueIds) {
      await attachCredit(filmId, personId, 'actor', null);
      attached++;
    }

    console.log(`✅ Linked ${attached} existing films in DB to person.`);
  } catch (err: any) {}
}

async function updatePersonFilmCount(personId: string) {
  const { count } = await supabase
    .from('credits')
    .select('*', { count: 'exact', head: true })
    .eq('person_id', personId);

  const finalCount = count || 0;
  await supabase
    .from('people')
    .update({ film_count: finalCount, updated_at: new Date().toISOString() })
    .eq('id', personId);

  console.log(`\n📊 Updated person ID ${personId} film_count = ${finalCount}`);
  return finalCount;
}

async function main() {
  console.log('====================================================');
  console.log('🚀 10-SOURCE RE-HARVEST FOR TOYIN ABRAHAM & IBRAHIM YEKINI');
  console.log('====================================================\n');

  // 1. Ibrahim Yekini
  console.log('--- Processing: Ibrahim Yekini (Itele D Icon) ---');
  const ibrahimId = await findOrCreatePerson(
    ['Ibrahim Yekini', 'Itele D Icon', 'Itele', 'Ibrahim Yekini Itele'],
    'Ibrahim Yekini (Itele D Icon)'
  );

  await harvestFromTMDB('Ibrahim Yekini', ibrahimId);
  await harvestFromTMDB('Itele', ibrahimId);
  await harvestFromPartyJollof('Ibrahim Yekini', ibrahimId);
  await harvestFromPartyJollof('Itele', ibrahimId);
  await harvestFromPartyJollof('Koleoso', ibrahimId);
  await harvestFromFilmFlux('Ibrahim Yekini', ibrahimId);
  await harvestFromAfricanMovieDB('Ibrahim Yekini', ibrahimId);
  await harvestFromYouTube('Ibrahim Yekini Itele', ibrahimId);
  await harvestFromYouTube('Koleoso Yoruba movie', ibrahimId);
  await harvestFromExistingDatabase(['Ibrahim Yekini', 'Itele', 'Koleoso'], ibrahimId);
  const ibrahimTotal = await updatePersonFilmCount(ibrahimId);

  // 2. Toyin Abraham
  console.log('\n--- Processing: Toyin Abraham ---');
  const toyinId = await findOrCreatePerson(
    ['Toyin Abraham', 'Toyin Aimakhu', 'Toyin Abraham Ajeyemi'],
    'Toyin Abraham'
  );

  await harvestFromTMDB('Toyin Abraham', toyinId);
  await harvestFromTMDB('Toyin Aimakhu', toyinId);
  await harvestFromPartyJollof('Toyin Abraham', toyinId);
  await harvestFromPartyJollof('Toyin Aimakhu', toyinId);
  await harvestFromFilmFlux('Toyin Abraham', toyinId);
  await harvestFromAfricanMovieDB('Toyin Abraham', toyinId);
  await harvestFromYouTube('Toyin Abraham movie', toyinId);
  await harvestFromYouTube('Toyin Aimakhu movie', toyinId);
  await harvestFromExistingDatabase(['Toyin Abraham', 'Toyin Aimakhu'], toyinId);
  const toyinTotal = await updatePersonFilmCount(toyinId);

  console.log('\n====================================================');
  console.log('🎉 RE-HARVEST COMPLETE!');
  console.log(`👑 Ibrahim Yekini (Itele D Icon) Total Credits: ${ibrahimTotal}`);
  console.log(`👑 Toyin Abraham Total Credits: ${toyinTotal}`);
  console.log('====================================================');
}

main().catch((err) => {
  console.error('Fatal error during re-harvest:', err);
  process.exit(1);
});
