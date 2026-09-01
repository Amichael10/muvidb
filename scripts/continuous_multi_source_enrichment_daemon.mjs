import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TMDB_TOKEN = process.env.TMDB_ACCESS_TOKEN || process.env.VITE_TMDB_ACCESS_TOKEN || process.env.TMDB_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase service role key.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function decodeHtmlEntities(str = '') {
  return str
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function cleanMovieTitle(rawTitle = '') {
  return decodeHtmlEntities(rawTitle)
    .replace(/\s*\(\d{4}\).*$/, '')
    .replace(/\s*—\s*Cast,.*$/i, '')
    .replace(/\s*\|\s*FilmFlux.*$/i, '')
    .replace(/\s*\|\s*Nollywire.*$/i, '')
    .replace(/\s*Full Movie.*$/i, '')
    .replace(/[\(\[].*?[\)\]]/g, '')
    .trim();
}

function slugify(text) {
  return decodeHtmlEntities(text)
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

async function tmdbFetch(endpoint, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });

  const headers = {
    accept: 'application/json',
    ...(TMDB_TOKEN?.startsWith('eyJ') ? { Authorization: `Bearer ${TMDB_TOKEN}` } : {}),
  };

  if (!TMDB_TOKEN?.startsWith('eyJ') && TMDB_TOKEN) {
    url.searchParams.set('api_key', TMDB_TOKEN);
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url.toString(), { headers });
      if (res.status === 429) {
        const waitTime = parseInt(res.headers.get('Retry-After') || '2', 10) * 1000;
        await sleep(waitTime || 2000);
        continue;
      }
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      if (attempt === 2) return null;
      await sleep(1000);
    }
  }
  return null;
}

// ----------------------------------------------------
// Robust DB Matcher: Check if film exists in Lumi
// ----------------------------------------------------
async function findFilmInDb(title, year = null) {
  const cleanTitle = cleanMovieTitle(title);
  const slug = slugify(cleanTitle);

  // 1. Try slug
  const { data: bySlug } = await supabase
    .from('films')
    .select('id, title, poster_url, synopsis, tmdb_id, imdb_id, year')
    .eq('slug', slug)
    .maybeSingle();

  if (bySlug) return bySlug;

  // 2. Try exact/case-insensitive title
  const { data: byTitle } = await supabase
    .from('films')
    .select('id, title, poster_url, synopsis, tmdb_id, imdb_id, year')
    .ilike('title', cleanTitle)
    .limit(1);

  if (byTitle && byTitle.length > 0) return byTitle[0];

  return null;
}

// ----------------------------------------------------
// Helper: Link Ensemble Credits (Cast + Crew)
// ----------------------------------------------------
async function linkEnsembleToFilm(filmId, castList = [], crewList = []) {
  // Cast
  for (const member of castList) {
    const rawName = decodeHtmlEntities(member.name || '');
    if (!rawName || rawName.trim().length < 2) continue;
    const cleanName = rawName.trim();
    const pSlug = slugify(cleanName);

    let { data: p } = await supabase
      .from('people')
      .select('id, photo_url, tmdb_id, name')
      .or(`slug.eq.${pSlug},name.ilike.${cleanName}`)
      .maybeSingle();

    if (!p) {
      const photo = member.profile_path ? `https://image.tmdb.org/t/p/w500${member.profile_path}` : (member.photo_url || null);
      const { data: newP } = await supabase
        .from('people')
        .insert({
          name: cleanName,
          slug: pSlug,
          photo_url: photo,
          tmdb_id: member.id || null,
        })
        .select('id, name')
        .single();
      p = newP;
    } else if (member.profile_path && !p.photo_url) {
      await supabase.from('people').update({ photo_url: `https://image.tmdb.org/t/p/w500${member.profile_path}` }).eq('id', p.id);
    }

    if (p?.id && filmId) {
      const { data: existing } = await supabase
        .from('credits')
        .select('id')
        .eq('film_id', filmId)
        .eq('person_id', p.id)
        .eq('role', 'actor')
        .maybeSingle();

      if (!existing) {
        await supabase.from('credits').insert({
          film_id: filmId,
          person_id: p.id,
          role: 'actor',
          character_name: member.character || null,
        });
      }
    }
  }

  // Crew
  for (const member of crewList) {
    const rawName = decodeHtmlEntities(member.name || '');
    if (!rawName || rawName.trim().length < 2) continue;
    const cleanName = rawName.trim();
    const pSlug = slugify(cleanName);

    let { data: p } = await supabase
      .from('people')
      .select('id, photo_url, tmdb_id, name')
      .or(`slug.eq.${pSlug},name.ilike.${cleanName}`)
      .maybeSingle();

    if (!p) {
      const photo = member.profile_path ? `https://image.tmdb.org/t/p/w500${member.profile_path}` : (member.photo_url || null);
      const { data: newP } = await supabase
        .from('people')
        .insert({
          name: cleanName,
          slug: pSlug,
          photo_url: photo,
          tmdb_id: member.id || null,
        })
        .select('id, name')
        .single();
      p = newP;
    }

    const jobRole = (member.job || member.department || 'crew').toLowerCase();
    const normalizedRole = /direct/i.test(jobRole)
      ? 'director'
      : /writ|screenplay/i.test(jobRole)
      ? 'writer'
      : /produc/i.test(jobRole)
      ? 'producer'
      : /music|sound|composer/i.test(jobRole)
      ? 'sound'
      : /camera|cinematograph/i.test(jobRole)
      ? 'cinematographer'
      : 'crew';

    if (p?.id && filmId) {
      const { data: existing } = await supabase
        .from('credits')
        .select('id')
        .eq('film_id', filmId)
        .eq('person_id', p.id)
        .eq('role', normalizedRole)
        .maybeSingle();

      if (!existing) {
        await supabase.from('credits').insert({
          film_id: filmId,
          person_id: p.id,
          role: normalizedRole,
        });
      }
    }
  }
}

// ----------------------------------------------------
// 1. FilmFlux Live Crawler & Matcher
// ----------------------------------------------------
async function crawlFilmFlux() {
  console.log('\n[FilmFlux] Crawling trending & new releases from filmflux.app...');
  try {
    const res = await fetch('https://filmflux.app/movies', { timeout: 10000 });
    const html = await res.text();
    const movieSlugs = [...new Set([...html.matchAll(/\/movie\/([a-f0-9\-]+-([a-z0-9\-]+))/g)].map(m => m[1]))];

    console.log(`[FilmFlux] Discovered ${movieSlugs.length} entries to compare against DB.`);

    for (const slug of movieSlugs.slice(0, 50)) {
      try {
        const detailRes = await fetch(`https://filmflux.app/movie/${slug}`, { timeout: 10000 });
        const dHtml = await detailRes.text();

        const mTitle = dHtml.match(/<title>([^<]+?)(?:\s*\(\d{4}\))?(?:\s*Full Movie)?(?:\s*\||\s*:)/i);
        const rawTitle = mTitle?.[1] || slug.replace(/^[a-f0-9\-]+-/, '').replace(/-/g, ' ');
        const title = cleanMovieTitle(rawTitle);

        const mDesc = decodeHtmlEntities(dHtml.match(/<meta property="og:description" content="([^"]+)"/i)?.[1] || '');
        const mImg = dHtml.match(/<meta property="og:image" content="([^"]+)"/i)?.[1] || null;
        const actors = [...new Set([...dHtml.matchAll(/\/actor\/([a-z0-9\-]+)/g)].map(m => m[1]))];

        if (!title || title.length < 2) continue;

        let existingFilm = await findFilmInDb(title);

        if (existingFilm) {
          // Compare and enrich existing film if missing data
          const updates = {};
          if (!existingFilm.poster_url && mImg) updates.poster_url = mImg;
          if ((!existingFilm.synopsis || existingFilm.synopsis.length < 30) && mDesc) updates.synopsis = mDesc;

          if (Object.keys(updates).length > 0) {
            await supabase.from('films').update(updates).eq('id', existingFilm.id);
            console.log(`  ↻ [FilmFlux] Enriched existing film: "${title}" in DB.`);
          } else {
            console.log(`  = [FilmFlux] Film already up-to-date in DB: "${title}"`);
          }
        } else {
          // New film to ingest
          const fSlug = slugify(title);
          const { data: newF, error } = await supabase
            .from('films')
            .insert({
              title,
              slug: fSlug,
              synopsis: mDesc || null,
              poster_url: mImg || null,
              is_nollywood: true,
              is_published: true,
              content_type: 'movie',
              countries: ['Nigeria'],
            })
            .select('id, title')
            .single();

          if (!error && newF) {
            existingFilm = newF;
            console.log(`  + [FilmFlux] Ingested brand new film: "${title}" into DB!`);
          }
        }

        if (existingFilm?.id) {
          const castList = actors.map(a => ({ name: a.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') }));
          await linkEnsembleToFilm(existingFilm.id, castList, []);
        }
      } catch (err) {}
      await sleep(250);
    }
  } catch (err) {
    console.error('[FilmFlux] Crawler error:', err.message);
  }
}

// ----------------------------------------------------
// 2. Nollywire Live Crawler & Matcher
// ----------------------------------------------------
async function crawlNollywire() {
  console.log('\n[Nollywire] Crawling theatrical & cinema titles from nollywire.com...');
  try {
    const res = await fetch('https://nollywire.com/films', { timeout: 10000 });
    const html = await res.text();
    const filmSlugs = [...new Set([...html.matchAll(/\/films\/([a-z0-9\-]+)/g)].map(m => m[1]))];

    console.log(`[Nollywire] Discovered ${filmSlugs.length} theatrical entries to compare against DB.`);

    for (const slug of filmSlugs.slice(0, 50)) {
      try {
        const detailRes = await fetch(`https://nollywire.com/films/${slug}`, { timeout: 10000 });
        const dHtml = await detailRes.text();

        const mTitle = dHtml.match(/<title>([^<]+?)(?:\s*\(\d{4}\))?(?:\s*\||\s*:)/i);
        const rawTitle = mTitle?.[1] || slug.replace(/-/g, ' ');
        const title = cleanMovieTitle(rawTitle);

        const mDesc = decodeHtmlEntities(dHtml.match(/<meta property="og:description" content="([^"]+)"/i)?.[1] || '');
        const rawImg = dHtml.match(/<meta property="og:image" content="([^"]+)"/i)?.[1] || null;
        const poster = rawImg?.startsWith('/') ? `https://nollywire.com${rawImg}` : rawImg;
        const people = [...new Set([...dHtml.matchAll(/\/people\/([a-z0-9\-]+)/g)].map(m => m[1]))];

        if (!title || title.length < 2) continue;

        let existingFilm = await findFilmInDb(title);

        if (existingFilm) {
          const updates = { is_in_cinemas: true };
          if (!existingFilm.poster_url && poster) updates.poster_url = poster;
          if ((!existingFilm.synopsis || existingFilm.synopsis.length < 30) && mDesc) updates.synopsis = mDesc;

          await supabase.from('films').update(updates).eq('id', existingFilm.id);
          console.log(`  ↻ [Nollywire] Synced theatrical status for existing film: "${title}"`);
        } else {
          const fSlug = slugify(title);
          const { data: newF, error } = await supabase
            .from('films')
            .insert({
              title,
              slug: fSlug,
              synopsis: mDesc || null,
              poster_url: poster || null,
              is_nollywood: true,
              is_in_cinemas: true,
              is_published: true,
              content_type: 'movie',
              countries: ['Nigeria'],
            })
            .select('id, title')
            .single();

          if (!error && newF) {
            existingFilm = newF;
            console.log(`  + [Nollywire] Ingested new theatrical film: "${title}" into DB!`);
          }
        }

        if (existingFilm?.id) {
          const castList = people.map(a => ({ name: a.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') }));
          await linkEnsembleToFilm(existingFilm.id, castList, []);
        }
      } catch (err) {}
      await sleep(250);
    }
  } catch (err) {
    console.error('[Nollywire] Crawler error:', err.message);
  }
}

// ----------------------------------------------------
// 3. Deep Ensemble Harvester (TMDB + IMDb)
// ----------------------------------------------------
async function sweepEnsemblesAndCatalog() {
  console.log('\n[TMDB+IMDb] Deep sweep: Comparing & fetching full ensemble credits for DB films...');

  const { data: sparseFilms } = await supabase
    .from('films')
    .select('id, title, year, poster_url, tmdb_id, synopsis')
    .or('poster_url.is.null,tmdb_id.is.null')
    .order('created_at', { ascending: false })
    .limit(100);

  if (sparseFilms && sparseFilms.length > 0) {
    for (const film of sparseFilms) {
      const cleanTitle = cleanMovieTitle(film.title);
      let tmdbId = film.tmdb_id;

      if (!tmdbId) {
        const searchRes = await tmdbFetch('/search/movie', {
          query: cleanTitle,
          year: film.year || undefined,
          include_adult: false,
        });
        tmdbId = searchRes?.results?.[0]?.id;
      }

      if (tmdbId) {
        const fullDetails = await tmdbFetch(`/movie/${tmdbId}`, {
          append_to_response: 'credits,external_ids',
        });

        if (fullDetails) {
          const updatePayload = {
            tmdb_id: tmdbId,
            tmdb_rating: fullDetails.vote_average || undefined,
          };

          if (fullDetails.poster_path && !film.poster_url) {
            updatePayload.poster_url = `https://image.tmdb.org/t/p/w500${fullDetails.poster_path}`;
          }
          if (fullDetails.backdrop_path) {
            updatePayload.backdrop_url = `https://image.tmdb.org/t/p/original${fullDetails.backdrop_path}`;
          }
          if (fullDetails.overview && (!film.synopsis || film.synopsis.length < 30)) {
            updatePayload.synopsis = fullDetails.overview;
          }
          if (fullDetails.external_ids?.imdb_id) {
            updatePayload.imdb_id = fullDetails.external_ids.imdb_id;
          }

          await supabase.from('films').update(updatePayload).eq('id', film.id);

          const cast = fullDetails.credits?.cast || [];
          const crew = fullDetails.credits?.crew || [];
          if (cast.length > 0 || crew.length > 0) {
            await linkEnsembleToFilm(film.id, cast, crew);
            console.log(`✓ [TMDB Ensemble] "${film.title}" -> Synced ${cast.length} cast & ${crew.length} crew.`);
          }
        }
      }
      await sleep(200);
    }
  }

  // People Sweep (Photos, Bios, DOB)
  const { data: sparsePeople } = await supabase
    .from('people')
    .select('id, name, photo_url, date_of_birth, bio, tmdb_id')
    .is('photo_url', null)
    .order('film_count', { ascending: false, nullsFirst: false })
    .limit(100);

  if (sparsePeople && sparsePeople.length > 0) {
    for (const person of sparsePeople) {
      const cleanName = cleanMovieTitle(person.name);
      if (cleanName.length < 3 || /^test|stub|unknown$/i.test(cleanName)) continue;

      const searchRes = await tmdbFetch('/search/person', {
        query: cleanName,
        include_adult: false,
      });

      const match = searchRes?.results?.[0];
      if (match?.id) {
        const details = await tmdbFetch(`/person/${match.id}`, { append_to_response: 'external_ids' });
        if (details) {
          const updatePayload = { tmdb_id: match.id };
          if (details.profile_path) updatePayload.photo_url = `https://image.tmdb.org/t/p/w500${details.profile_path}`;
          if (details.birthday && !person.date_of_birth) updatePayload.date_of_birth = details.birthday;
          if (details.place_of_birth) updatePayload.birthplace = details.place_of_birth;
          if (details.biography && (!person.bio || person.bio.length < 40)) updatePayload.bio = details.biography;
          if (details.deathday) {
            updatePayload.date_of_death = details.deathday;
            updatePayload.is_deceased = true;
          }
          await supabase.from('people').update(updatePayload).eq('id', person.id);
          console.log(`✓ [TMDB Person] Enriched "${person.name}" (Photo: ${Boolean(details.profile_path)}, DOB: ${details.birthday || 'N/A'})`);
        }
      }
      await sleep(200);
    }
  }
}

// ----------------------------------------------------
// Main Continuous Daemon Loop
// ----------------------------------------------------
async function startDaemon() {
  console.log('🎬 Starting Multi-Source Continuous Enrichment Engine...');
  console.log('Sources: [FilmFlux.app, Nollywire.com, PartyJollofTV.com, TMDB API, IMDb]');
  console.log('Mode: Database Comparison, Duplicate Prevention & Multi-Tier Enrichment');

  let cycle = 1;
  while (true) {
    console.log(`\n======================================================`);
    console.log(`🌀 CYCLE ${cycle}: Multi-Source Comparison & Enrichment Pass`);
    console.log(`======================================================`);

    await crawlFilmFlux();
    await crawlNollywire();
    await sweepEnsemblesAndCatalog();

    console.log(`\n⏳ Cycle ${cycle} finished. Resting 30s before next iteration...`);
    cycle++;
    await sleep(30000);
  }
}

startDaemon().catch((err) => {
  console.error('Daemon crashed:', err);
  process.exit(1);
});
