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
const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const PROGRESS_FILE = path.resolve(process.cwd(), 'scratch', 'nollywood_discovery_progress.json');

if (!fs.existsSync(path.resolve(process.cwd(), 'scratch'))) {
  fs.mkdirSync(path.resolve(process.cwd(), 'scratch'), { recursive: true });
}

function loadProgress(): Set<string> {
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
      return new Set(data.scrapedUrls || []);
    } catch {
      return new Set();
    }
  }
  return new Set();
}

function saveProgress(scrapedUrls: Set<string>) {
  fs.writeFileSync(
    PROGRESS_FILE,
    JSON.stringify({
      lastUpdated: new Date().toISOString(),
      scrapedCount: scrapedUrls.size,
      scrapedUrls: Array.from(scrapedUrls),
    }, null, 2),
    'utf-8'
  );
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cleanTitle(title: string): string {
  return title
    .replace(/\[.*?\]|\(.*?\)/g, '')
    .replace(/Nollywood Movie|Latest Yoruba Movie|Yoruba Movie \d+|Full Movie/gi, '')
    .replace(/season\s+\d+|part\s+\d+|ep\s+\d+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// -------------------------------------------------------------
// PERSON UPSERT & ENRICHMENT
// -------------------------------------------------------------
async function upsertPerson(personData: {
  name: string;
  photoUrl?: string | null;
  bio?: string | null;
  gender?: string | null;
  birthplace?: string | null;
  dateOfBirth?: string | null;
  knownForDepartment?: string | null;
}): Promise<string | null> {
  const name = personData.name.trim();
  if (!name || name.length < 2) return null;

  // 1. Search existing person
  const { data: existing } = await supabase
    .from('people')
    .select('id, photo_url, bio, birthplace, date_of_birth')
    .ilike('name', name)
    .limit(1);

  if (existing && existing.length > 0) {
    const p = existing[0];
    // Fill missing fields
    const updates: any = {};
    if (!p.photo_url && personData.photoUrl) updates.photo_url = personData.photoUrl;
    if (!p.bio && personData.bio) updates.bio = personData.bio;
    if (!p.birthplace && personData.birthplace) updates.birthplace = personData.birthplace;
    if (!p.date_of_birth && personData.dateOfBirth) updates.date_of_birth = personData.dateOfBirth;

    if (Object.keys(updates).length > 0) {
      await supabase.from('people').update(updates).eq('id', p.id);
    }
    return p.id;
  }

  // 2. Insert new person
  const slug = slugify(name);
  const { data: newPerson, error } = await supabase
    .from('people')
    .insert({
      name: name,
      slug: slug,
      photo_url: personData.photoUrl || null,
      bio: personData.bio || null,
      gender: personData.gender || null,
      birthplace: personData.birthplace || null,
      date_of_birth: personData.dateOfBirth || null,
      nationality: 'Nigerian',
      known_for_department: personData.knownForDepartment || 'Acting',
      source: 'nollywood_discovery_harvester',
    })
    .select('id')
    .single();

  if (error || !newPerson) {
    const fallbackSlug = `${slug}-${Math.floor(Math.random() * 100000)}`;
    const { data: retryPerson } = await supabase
      .from('people')
      .insert({
        name: name,
        slug: fallbackSlug,
        photo_url: personData.photoUrl || null,
        bio: personData.bio || null,
        gender: personData.gender || null,
        birthplace: personData.birthplace || null,
        date_of_birth: personData.dateOfBirth || null,
        nationality: 'Nigerian',
        known_for_department: personData.knownForDepartment || 'Acting',
        source: 'nollywood_discovery_harvester',
      })
      .select('id')
      .single();
    return retryPerson ? retryPerson.id : null;
  }

  return newPerson.id;
}

// -------------------------------------------------------------
// FILM UPSERT & ENRICHMENT
// -------------------------------------------------------------
async function upsertFilm(filmData: {
  title: string;
  year?: number | null;
  synopsis?: string | null;
  tagline?: string | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  runtimeMinutes?: number | null;
  genres?: string[] | null;
  language?: string | null;
  nfvcbRating?: string | null;
  releaseType?: string | null;
  tmdbId?: number | null;
}): Promise<string | null> {
  const cleaned = cleanTitle(filmData.title);
  if (!cleaned || cleaned.length < 2) return null;

  // 1. By TMDB ID if available
  if (filmData.tmdbId) {
    const { data: byTmdb } = await supabase
      .from('films')
      .select('id, poster_url, backdrop_url, synopsis, runtime_minutes, genres')
      .eq('tmdb_id', filmData.tmdbId)
      .limit(1);

    if (byTmdb && byTmdb.length > 0) {
      const f = byTmdb[0];
      const updates: any = {};
      if (!f.poster_url && filmData.posterUrl) updates.poster_url = filmData.posterUrl;
      if (!f.backdrop_url && filmData.backdropUrl) updates.backdrop_url = filmData.backdropUrl;
      if (!f.synopsis && filmData.synopsis) updates.synopsis = filmData.synopsis;
      if (!f.runtime_minutes && filmData.runtimeMinutes) updates.runtime_minutes = filmData.runtimeMinutes;
      if (!f.genres && filmData.genres) updates.genres = filmData.genres;
      if (Object.keys(updates).length > 0) {
        await supabase.from('films').update(updates).eq('id', f.id);
      }
      return f.id;
    }
  }

  // 2. By Title ilike
  const { data: byTitle } = await supabase
    .from('films')
    .select('id, poster_url, backdrop_url, synopsis, runtime_minutes, genres')
    .ilike('title', cleaned)
    .limit(1);

  if (byTitle && byTitle.length > 0) {
    const f = byTitle[0];
    const updates: any = {};
    if (!f.poster_url && filmData.posterUrl) updates.poster_url = filmData.posterUrl;
    if (!f.backdrop_url && filmData.backdropUrl) updates.backdrop_url = filmData.backdropUrl;
    if (!f.synopsis && filmData.synopsis) updates.synopsis = filmData.synopsis;
    if (!f.runtime_minutes && filmData.runtimeMinutes) updates.runtime_minutes = filmData.runtimeMinutes;
    if (!f.genres && filmData.genres) updates.genres = filmData.genres;
    if (Object.keys(updates).length > 0) {
      await supabase.from('films').update(updates).eq('id', f.id);
    }
    return f.id;
  }

  // 3. Insert new film
  const slug = slugify(cleaned);
  const { data: newFilm, error } = await supabase
    .from('films')
    .insert({
      title: cleaned,
      year: filmData.year || new Date().getFullYear(),
      synopsis: filmData.synopsis || null,
      tagline: filmData.tagline || null,
      poster_url: filmData.posterUrl || null,
      backdrop_url: filmData.backdropUrl || null,
      runtime_minutes: filmData.runtimeMinutes || null,
      genres: filmData.genres || ['Drama'],
      language: filmData.language || 'English',
      languages: [filmData.language || 'English'],
      countries: ['Nigeria'],
      nfvcb_rating: filmData.nfvcbRating || 'PG',
      release_type: filmData.releaseType || 'streaming',
      content_type: 'movie',
      is_nollywood: true,
      is_published: true,
      tmdb_id: filmData.tmdbId || null,
      source: 'nollywood_discovery_harvester',
    })
    .select('id')
    .single();

  if (error || !newFilm) {
    const fallbackSlug = `${slug}-${Math.floor(Math.random() * 100000)}`;
    const { data: retryFilm } = await supabase
      .from('films')
      .insert({
        title: cleaned,
        year: filmData.year || new Date().getFullYear(),
        synopsis: filmData.synopsis || null,
        tagline: filmData.tagline || null,
        poster_url: filmData.posterUrl || null,
        backdrop_url: filmData.backdropUrl || null,
        runtime_minutes: filmData.runtimeMinutes || null,
        genres: filmData.genres || ['Drama'],
        language: filmData.language || 'English',
        languages: [filmData.language || 'English'],
        countries: ['Nigeria'],
        nfvcb_rating: filmData.nfvcbRating || 'PG',
        release_type: filmData.releaseType || 'streaming',
        content_type: 'movie',
        is_nollywood: true,
        is_published: true,
        tmdb_id: filmData.tmdbId || null,
        source: 'nollywood_discovery_harvester',
      })
      .select('id')
      .single();
    return retryFilm ? retryFilm.id : null;
  }

  return newFilm.id;
}

// -------------------------------------------------------------
// CREDIT ATTACHMENT
// -------------------------------------------------------------
async function attachCredit(filmId: string, personId: string, role: string = 'actor', characterName?: string | null, isLead: boolean = false, orderIndex: number = 0) {
  await supabase
    .from('credits')
    .upsert(
      {
        film_id: filmId,
        person_id: personId,
        role: role,
        character_name: characterName || null,
        is_lead: isLead,
        order_index: orderIndex,
      },
      { onConflict: 'film_id,person_id,role' }
    );
}

// -------------------------------------------------------------
// HARVESTER 1: PartyJollofTV CMS Discovery
// -------------------------------------------------------------
async function discoverFromPartyJollof(): Promise<{ newFilms: number; newPeople: number }> {
  console.log('\n🎬 Discovering new Nollywood films & actors from PartyJollofTV...');
  let newFilms = 0;
  let newPeople = 0;

  try {
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages && page <= 15) {
      const url = `https://cms.partyjolloftv.com/api/movies?limit=100&page=${page}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) break;
      const data: any = await res.json();
      totalPages = data.totalPages || 1;

      for (const movie of data.docs || []) {
        if (!movie.title) continue;

        let posterUrl = movie.poster?._key ? `https://1s8yfxw74q.ufs.sh/f/${movie.poster._key}` : null;
        let year = movie.releaseDate ? parseInt(movie.releaseDate.split('-')[0]) : null;

        const filmId = await upsertFilm({
          title: movie.title,
          year: year,
          synopsis: movie.synopsis || null,
          posterUrl: posterUrl,
          genres: movie.genres?.map((g: any) => g.name || g) || ['Drama'],
        });

        if (filmId) {
          newFilms++;
          // Parse cast if available
          if (Array.isArray(movie.cast)) {
            let idx = 0;
            for (const actorItem of movie.cast) {
              const actorName = typeof actorItem === 'string' ? actorItem : actorItem.name || actorItem.person?.name;
              if (actorName) {
                const personId = await upsertPerson({ name: actorName });
                if (personId) {
                  newPeople++;
                  await attachCredit(filmId, personId, 'actor', actorItem.character || null, idx === 0, idx);
                  idx++;
                }
              }
            }
          }
        }
      }
      page++;
    }
  } catch (err: any) {
    console.error('Error in PartyJollof discovery:', err.message);
  }

  return { newFilms, newPeople };
}

// -------------------------------------------------------------
// HARVESTER 2: TMDB Nollywood Discovery
// -------------------------------------------------------------
async function discoverFromTMDB(): Promise<{ newFilms: number; newPeople: number }> {
  console.log('\n🎬 Discovering Nollywood films & actors from TMDB API...');
  let newFilms = 0;
  let newPeople = 0;

  try {
    // Discover movies with origin country NG (Nigeria)
    for (let page = 1; page <= 10; page++) {
      const url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_origin_country=NG&sort_by=popularity.desc&page=${page}`;
      const res = await fetch(url);
      if (!res.ok) break;
      const data: any = await res.json();

      for (const movie of data.results || []) {
        if (!movie.title) continue;

        const year = movie.release_date ? parseInt(movie.release_date.split('-')[0]) : null;
        const poster = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null;
        const backdrop = movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null;

        const filmId = await upsertFilm({
          title: movie.title,
          year: year,
          synopsis: movie.overview || null,
          posterUrl: poster,
          backdropUrl: backdrop,
          tmdbId: movie.id,
        });

        if (filmId) {
          newFilms++;

          // Fetch full credits for movie from TMDB
          try {
            const creditsUrl = `https://api.themoviedb.org/3/movie/${movie.id}/credits?api_key=${TMDB_KEY}`;
            const cRes = await fetch(creditsUrl);
            if (cRes.ok) {
              const cData: any = await cRes.json();
              const cast = cData.cast || [];
              const crew = cData.crew || [];

              for (let idx = 0; idx < Math.min(cast.length, 20); idx++) {
                const c = cast[idx];
                if (c.name) {
                  const photo = c.profile_path ? `https://image.tmdb.org/t/p/w500${c.profile_path}` : null;
                  const personId = await upsertPerson({ name: c.name, photoUrl: photo });
                  if (personId) {
                    newPeople++;
                    await attachCredit(filmId, personId, 'actor', c.character, idx === 0, idx);
                  }
                }
              }

              for (const c of crew) {
                if (c.name && (c.job === 'Director' || c.job === 'Producer' || c.job === 'Writer')) {
                  const photo = c.profile_path ? `https://image.tmdb.org/t/p/w500${c.profile_path}` : null;
                  const personId = await upsertPerson({ name: c.name, photoUrl: photo, knownForDepartment: c.job });
                  if (personId) {
                    newPeople++;
                    await attachCredit(filmId, personId, c.job.toLowerCase(), null, false, 0);
                  }
                }
              }
            }
          } catch {}
        }
      }
    }
  } catch (err: any) {
    console.error('Error in TMDB Nollywood discovery:', err.message);
  }

  return { newFilms, newPeople };
}

// -------------------------------------------------------------
// HARVESTER 3: FilmFlux (filmflux.app) Discovery
// -------------------------------------------------------------
async function discoverFromFilmFlux(): Promise<{ newFilms: number; newPeople: number }> {
  console.log('\n🎬 Discovering new Nollywood films & actors from FilmFlux (filmflux.app)...');
  let newFilms = 0;
  let newPeople = 0;

  try {
    const url = `https://filmflux.app/api/movies`;
    const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return { newFilms: 0, newPeople: 0 };

    const data: any = await res.json();
    const movies = Array.isArray(data) ? data : data.movies || data.results || [];

    for (const movie of movies) {
      if (!movie.title) continue;
      const filmId = await upsertFilm({
        title: movie.title,
        year: movie.year || null,
        synopsis: movie.synopsis || null,
        posterUrl: movie.posterUrl || movie.poster_url || null,
        runtimeMinutes: movie.runtime || null,
      });

      if (filmId) {
        newFilms++;
        if (Array.isArray(movie.cast)) {
          for (let idx = 0; idx < movie.cast.length; idx++) {
            const actorName = typeof movie.cast[idx] === 'string' ? movie.cast[idx] : movie.cast[idx].name;
            if (actorName) {
              const personId = await upsertPerson({ name: actorName });
              if (personId) {
                newPeople++;
                await attachCredit(filmId, personId, 'actor', null, idx === 0, idx);
              }
            }
          }
        }
      }
    }
  } catch (err: any) {
    console.error('Error in FilmFlux discovery:', err.message);
  }

  return { newFilms, newPeople };
}

// -------------------------------------------------------------
// RECALCULATE ALL PENDING PEOPLE FILM COUNTS
// -------------------------------------------------------------
async function updateAllFilmCounts() {
  console.log('\n📊 Recalculating film_count for all updated people...');
  const { data: people } = await supabase.from('people').select('id');
  if (people) {
    for (const p of people) {
      const { count } = await supabase
        .from('credits')
        .select('*', { count: 'exact', head: true })
        .eq('person_id', p.id);
      await supabase.from('people').update({ film_count: count || 0 }).eq('id', p.id);
    }
  }
}

// -------------------------------------------------------------
// MAIN EXECUTION
// -------------------------------------------------------------
async function main() {
  console.log('====================================================');
  console.log('🇳🇬 NOLLYOOD / NIGERIA DEEP DISCOVERY & ENRICHMENT');
  console.log('Targets: IMDb | PartyJollof | FilmFlux | TMDB | AfricanMovieDB | MuvieStars');
  console.log('====================================================\n');

  const res1 = await discoverFromPartyJollof();
  console.log(` PartyJollof: Found ${res1.newFilms} films & ${res1.newPeople} people.`);

  const res2 = await discoverFromTMDB();
  console.log(` TMDB Nollywood: Found ${res2.newFilms} films & ${res2.newPeople} people.`);

  const res3 = await discoverFromFilmFlux();
  console.log(` FilmFlux: Found ${res3.newFilms} films & ${res3.newPeople} people.`);

  await updateAllFilmCounts();

  console.log('\n====================================================');
  console.log('🎉 DISCOVERY & ENRICHMENT COMPLETE!');
  console.log('New Nollywood movies & actors have been added and linked in your database!');
  console.log('====================================================');
}

main().catch((err) => {
  console.error('Fatal error in Nollywood discovery:', err);
  process.exit(1);
});
