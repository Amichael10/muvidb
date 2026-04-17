// ─────────────────────────────────────────
// TMDB Bulk Sync Script
// Run: node tmdb_sync.cjs
// Options:
//   --year 2024        (filter by year)
//   --pages 5          (number of pages, 20 results each)
//   --dry-run          (preview without writing to DB)
//   --limit 10         (max films to import)
// ─────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const TMDB_API_KEY = process.env.VITE_TMDB_API_KEY;
const TMDB_TOKEN = process.env.TMDB_ACCESS_TOKEN;
const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Parse CLI args ──────────────────────
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};
const hasFlag = (name) => args.includes(`--${name}`);

const YEAR = getArg('year') ? parseInt(getArg('year')) : null;
const MAX_PAGES = parseInt(getArg('pages') || '3');
const LIMIT = parseInt(getArg('limit') || '100');
const DRY_RUN = hasFlag('dry-run');
const OVERWRITE = hasFlag('overwrite');
const CAST_LIMIT = parseInt(getArg('cast-limit') || '50');

// ─── TMDB Genre → Lumi Genre Mapping ────
const TMDB_GENRE_MAP = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
  80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
  14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
  9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi', 53: 'Thriller',
  10752: 'War', 37: 'Western',
};

const LANGUAGE_MAP = {
  en: 'English', yo: 'Yoruba', ig: 'Igbo', ha: 'Hausa',
  pcm: 'Pidgin', fr: 'French', pt: 'Portuguese', es: 'Spanish',
};

const STATUS_MAP = {
  'Released': 'released', 'Post Production': 'post-production',
  'In Production': 'filming', 'Planned': 'announced',
  'Rumored': 'announced', 'Canceled': 'announced',
};

// ─── Rate Limiter ────────────────────────
let requestCount = 0;
let windowStart = Date.now();

const rateLimitedFetch = async (url) => {
  // TMDB allows ~40 requests per 10 seconds
  requestCount++;
  if (requestCount >= 38) {
    const elapsed = Date.now() - windowStart;
    if (elapsed < 10000) {
      const waitMs = 10000 - elapsed + 500;
      process.stdout.write(`  ⏳ Rate limit pause (${(waitMs / 1000).toFixed(1)}s)...`);
      await new Promise(r => setTimeout(r, waitMs));
      process.stdout.write(' done\n');
    }
    requestCount = 0;
    windowStart = Date.now();
  }

  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`TMDB API ${res.status}: ${err}`);
  }
  return res.json();
};

// ─── TMDB API Functions ──────────────────
const discoverNigerian = async (page = 1) => {
  let url = `${TMDB_BASE}/discover/movie?api_key=${TMDB_API_KEY}&with_origin_country=NG&sort_by=popularity.desc&page=${page}&include_adult=false`;
  if (YEAR) url += `&primary_release_year=${YEAR}`;
  return rateLimitedFetch(url);
};

const getMovieDetails = async (tmdbId) => {
  const url = `${TMDB_BASE}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits`;
  return rateLimitedFetch(url);
};

const getPersonDetails = async (tmdbId) => {
  const url = `${TMDB_BASE}/person/${tmdbId}?api_key=${TMDB_API_KEY}`;
  return rateLimitedFetch(url);
};

// ─── Upsert Helpers ──────────────────────
const upsertPerson = async (tmdbPerson) => {
  // Check if person already exists by tmdb_id
  const { data: existing } = await supabase
    .from('people')
    .select('id, tmdb_id, bio')
    .eq('tmdb_id', tmdbPerson.id)
    .maybeSingle();

  if (existing) {
    if (OVERWRITE) {
      // Fetch full details for biography update
      let bio = existing.bio;
      try {
        const fullPerson = await getPersonDetails(tmdbPerson.id);
        bio = fullPerson.biography || null;
      } catch (err) {}

      await supabase.from('people')
        .update({
          photo_url: tmdbPerson.profile_path ? `${IMAGE_BASE}/w185${tmdbPerson.profile_path}` : existing.photo_url,
          bio: bio
        })
        .eq('id', existing.id);
    }
    return existing.id;
  }

  // Also check by exact name match (for people added manually)
  const { data: byName } = await supabase
    .from('people')
    .select('id, bio, photo_url')
    .ilike('name', tmdbPerson.name)
    .maybeSingle();

  if (byName) {
    const photoUrl = tmdbPerson.profile_path ? `${IMAGE_BASE}/w185${tmdbPerson.profile_path}` : byName.photo_url;
    
    // Update existing with tmdb_id and potentially bio
    let bio = byName.bio;
    if (OVERWRITE || !bio) {
      try {
        const fullPerson = await getPersonDetails(tmdbPerson.id);
        bio = fullPerson.biography || null;
      } catch (err) {}
    }

    await supabase.from('people')
      .update({ tmdb_id: tmdbPerson.id, photo_url: photoUrl, bio })
      .eq('id', byName.id);
    return byName.id;
  }

  // Fetch biography for new person
  let bio = null;
  try {
    const fullPerson = await getPersonDetails(tmdbPerson.id);
    bio = fullPerson.biography || null;
  } catch (err) {
    // console.warn(`    ⚠️ Failed to fetch bio for ${tmdbPerson.name}`);
  }

  // Insert new person
  const photoUrl = tmdbPerson.profile_path
    ? `${IMAGE_BASE}/w185${tmdbPerson.profile_path}`
    : null;

  const { data: newPerson, error } = await supabase
    .from('people')
    .insert({
      name: tmdbPerson.name,
      tmdb_id: tmdbPerson.id,
      photo_url: photoUrl,
      bio: bio,
      nationality: 'Nigerian', // Default for Nollywood imports
    })
    .select('id')
    .single();

  if (error) {
    console.error(`    ⚠️ Person insert error (${tmdbPerson.name}):`, error.message);
    return null;
  }
  return newPerson.id;
};

const upsertCompany = async (tmdbCompany) => {
  const { data: existing } = await supabase
    .from('companies')
    .select('id')
    .eq('tmdb_id', tmdbCompany.id)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: byName } = await supabase
    .from('companies')
    .select('id')
    .ilike('name', tmdbCompany.name)
    .maybeSingle();

  if (byName) {
    await supabase.from('companies')
      .update({ tmdb_id: tmdbCompany.id })
      .eq('id', byName.id);
    return byName.id;
  }

  const logoUrl = tmdbCompany.logo_path
    ? `${IMAGE_BASE}/w185${tmdbCompany.logo_path}`
    : null;

  const { data: newCompany, error } = await supabase
    .from('companies')
    .insert({
      name: tmdbCompany.name,
      tmdb_id: tmdbCompany.id,
    })
    .select('id')
    .single();

  if (error) {
    console.error(`    ⚠️ Company insert error (${tmdbCompany.name}):`, error.message);
    return null;
  }
  return newCompany.id;
};

// ─── Main Sync Function ─────────────────
async function sync() {
  console.log('');
  console.log('🎬 ═══════════════════════════════════════');
  console.log('   TMDB → Lumi Bulk Sync');
  console.log('═══════════════════════════════════════════');
  console.log(`   Year filter: ${YEAR || 'All years'}`);
  console.log(`   Pages to scan: ${MAX_PAGES} (${MAX_PAGES * 20} max results)`);
  console.log(`   Import limit: ${LIMIT}`);
  console.log(`   Cast limit: ${CAST_LIMIT} per film`);
  console.log(`   Mode: ${DRY_RUN ? '🏜️  DRY RUN (no DB writes)' : '💾 LIVE'}`);
  console.log('═══════════════════════════════════════════');
  console.log('');

  // Pre-load genre map from Supabase
  const { data: dbGenres } = await supabase.from('genres').select('*');
  const genreMap = {};
  (dbGenres || []).forEach(g => {
    genreMap[g.name.toLowerCase()] = g.id;
  });
  console.log(`📚 Loaded ${Object.keys(genreMap).length} genres from DB: ${Object.keys(genreMap).join(', ')}`);
  console.log('');

  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (let page = 1; page <= MAX_PAGES; page++) {
    console.log(`📄 Page ${page}/${MAX_PAGES}...`);

    let discoverData;
    try {
      discoverData = await discoverNigerian(page);
    } catch (err) {
      console.error(`  ❌ Failed to fetch page ${page}:`, err.message);
      continue;
    }

    if (!discoverData.results || discoverData.results.length === 0) {
      console.log('  📭 No more results.');
      break;
    }

    console.log(`  Found ${discoverData.results.length} films (page ${page} of ${discoverData.total_pages})`);

    for (const movie of discoverData.results) {
      if (totalImported >= LIMIT) {
        console.log(`\n🛑 Reached import limit (${LIMIT}). Stopping.`);
        break;
      }

      // Check if already imported
      const { data: existingFilm } = await supabase
        .from('films')
        .select('id, title')
        .eq('tmdb_id', movie.id)
        .maybeSingle();

      if (existingFilm && !OVERWRITE) {
        totalSkipped++;
        continue;
      }

      // Fetch full details
      let details;
      try {
        details = await getMovieDetails(movie.id);
      } catch (err) {
        console.error(`  ❌ Failed to fetch details for "${movie.title}":`, err.message);
        totalErrors++;
        continue;
      }

      console.log(`  ${existingFilm ? '🔄 Updating' : '🎬 Importing'} "${details.title}" (${details.release_date?.slice(0, 4) || '?'}) — ⭐${details.vote_average}`);

      if (DRY_RUN) {
        totalImported++;
        continue;
      }

      // ── Build Payload ──
      const posterUrl = details.poster_path ? `${IMAGE_BASE}/w500${details.poster_path}` : null;
      const backdropUrl = details.backdrop_path ? `${IMAGE_BASE}/w1280${details.backdrop_path}` : null;

      const filmPayload = {
        title: details.title,
        synopsis: details.overview || null,
        tagline: details.tagline || null,
        year: details.release_date ? new Date(details.release_date).getFullYear() : null,
        runtime_minutes: details.runtime || null,
        poster_url: posterUrl,
        backdrop_url: backdropUrl,
        status: STATUS_MAP[details.status] || 'announced',
        language: LANGUAGE_MAP[details.original_language] || details.original_language?.toUpperCase() || 'English',
        tmdb_id: details.id,
        tmdb_rating: details.vote_average || null,
        nfvcb_rating: '18',
        view_count: 0,
      };

      let filmId;
      if (existingFilm) {
        filmId = existingFilm.id;
        const { error: updateErr } = await supabase.from('films').update(filmPayload).eq('id', filmId);
        if (updateErr) {
          console.error(`  ❌ Film update error "${details.title}":`, updateErr.message);
          totalErrors++;
          continue;
        }

        // IMPORTANT: Clear credits if overwriting
        await supabase.from('credits').delete().eq('film_id', filmId);
        await supabase.from('film_genres').delete().eq('film_id', filmId);
      } else {
        const { data: insertedFilm, error: filmError } = await supabase
          .from('films')
          .insert(filmPayload)
          .select('id')
          .single();

        if (filmError) {
          console.error(`  ❌ Film insert error "${details.title}":`, filmError.message);
          totalErrors++;
          continue;
        }
        filmId = insertedFilm.id;
      }
      console.log(`  ✅ "${details.title}" (${filmPayload.year || '?'}) — ⭐${details.vote_average}`);

      // ── Link Genres ──
      const genreLinks = [];
      for (const genre of (details.genres || [])) {
        const lumiName = TMDB_GENRE_MAP[genre.id] || genre.name;
        const genreId = genreMap[lumiName.toLowerCase()];
        if (genreId) {
          genreLinks.push({ film_id: filmId, genre_id: genreId });
        }
      }
      if (genreLinks.length > 0) {
        const { error: gErr } = await supabase.from('film_genres').insert(genreLinks);
        if (gErr) console.error(`    ⚠️ Genre link error:`, gErr.message);
      }

      // ── Import Cast ──
      const castToImport = (details.credits?.cast || []).slice(0, CAST_LIMIT);
      for (const member of castToImport) {
        const personId = await upsertPerson(member);
        if (!personId) continue;

        const { error: creditErr } = await supabase.from('credits').insert({
          film_id: filmId,
          person_id: personId,
          role: 'actor',
          character_name: member.character || null,
          billing_order: member.order || 0,
        });
        if (creditErr && !creditErr.message.includes('duplicate')) {
          console.error(`    ⚠️ Credit error (${member.name}):`, creditErr.message);
        }
      }

      // ── Import Key Crew ──
      const importantJobs = [
        'Director', 'Writer', 'Screenplay', 'Producer', 'Executive Producer',
        'Director of Photography', 'Editor', 'Original Music Composer', 
        'Production Design', 'Art Direction', 'Costume Design', 'Makeup Artist', 
        'Stunt Coordinator', 'Visual Effects Supervisor', 'Casting'
      ];
      const crewToImport = (details.credits?.crew || [])
        .filter(c => importantJobs.includes(c.job));

      for (const member of crewToImport) {
        const personId = await upsertPerson(member);
        if (!personId) continue;

        const roleMap = {
          'Director': 'director',
          'Writer': 'writer',
          'Screenplay': 'writer',
          'Producer': 'producer',
          'Executive Producer': 'producer',
          'Director of Photography': 'crew',
          'Editor': 'crew',
          'Original Music Composer': 'crew',
          'Production Design': 'crew',
          'Art Direction': 'crew',
          'Costume Design': 'crew',
          'Makeup Artist': 'crew',
          'Stunt Coordinator': 'crew',
          'Visual Effects Supervisor': 'crew',
          'Casting': 'crew',
        };

        const { error: creditErr } = await supabase.from('credits').insert({
          film_id: filmId,
          person_id: personId,
          role: roleMap[member.job] || 'crew',
          billing_order: 0,
        });
        if (creditErr && !creditErr.message.includes('duplicate')) {
          console.error(`    ⚠️ Crew credit error (${member.name}):`, creditErr.message);
        }
      }

      // ── Import Companies ──
      for (const company of (details.production_companies || [])) {
        await upsertCompany(company);
      }

      totalImported++;
    }

    if (totalImported >= LIMIT) break;
  }

  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log(`  ✅ Imported: ${totalImported}`);
  console.log(`  ⏭️  Skipped (duplicates): ${totalSkipped}`);
  console.log(`  ❌ Errors: ${totalErrors}`);
  console.log('═══════════════════════════════════════════');
  console.log('');
}

sync().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
