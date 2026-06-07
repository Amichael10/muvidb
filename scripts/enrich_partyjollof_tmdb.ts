import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  (process.env.VITE_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
  { auth: { persistSession: false } }
);

const TMDB_API_KEY = (process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || '').trim();

// ─── Image Mirroring Helper ──────────────────────────────────────────────────
async function mirrorImageToSupabase(externalUrl: string, bucket: string, fileName: string): Promise<string | null> {
  if (!externalUrl) return null;
  try {
    const response = await fetch(externalUrl);
    if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`);
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    let contentType = 'image/jpeg';
    if (externalUrl.endsWith('.png')) {
      contentType = 'image/png';
    } else if (externalUrl.endsWith('.webp')) {
      contentType = 'image/webp';
    }

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, buffer, {
        contentType,
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return data.publicUrl;
  } catch (err: any) {
    console.error(`  ⚠️ Failed to mirror image ${externalUrl} to ${bucket}/${fileName}:`, err.message);
    return null;
  }
}

// ─── Slug Generator ──────────────────────────────────────────────────────────
function makeSlug(text: string): string {
  if (!text) return '';
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '').trim()
    .replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// ─── TMDB Helper Operations ──────────────────────────────────────────────────
async function upsertPerson(tmdbPerson: { id: number; name: string; photoUrl: string | null }) {
  const { data: existing } = await supabase
    .from('people')
    .select('id')
    .eq('tmdb_id', tmdbPerson.id.toString())
    .maybeSingle();

  if (existing) return existing.id;

  const { data: byName } = await supabase
    .from('people')
    .select('id')
    .ilike('name', tmdbPerson.name)
    .maybeSingle();

  if (byName) {
    await supabase
      .from('people')
      .update({ tmdb_id: tmdbPerson.id.toString() })
      .eq('id', byName.id);
    return byName.id;
  }

  // Generate collision-free slug
  const baseSlug = makeSlug(tmdbPerson.name);
  let slug = baseSlug;
  let counter = 2;
  
  while (true) {
    const { data: check } = await supabase
      .from('people')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!check) break;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  const { data: newPerson, error } = await supabase
    .from('people')
    .insert({
      name: tmdbPerson.name,
      tmdb_id: tmdbPerson.id.toString(),
      photo_url: tmdbPerson.photoUrl,
      nationality: 'Nigerian',
      slug: slug,
      mubi_slug: slug
    })
    .select('id')
    .single();

  if (error) {
    console.error(`  ⚠️ Failed to create person "${tmdbPerson.name}":`, error.message);
    return null;
  }
  return newPerson.id;
}

async function linkCredit(filmId: string, personId: string, role: string, charName: string = "") {
  let query = supabase
    .from('credits')
    .select('id')
    .eq('film_id', filmId)
    .eq('person_id', personId)
    .eq('role', role);
  
  if (charName) {
    query = query.eq('character_name', charName);
  }

  const { data: check } = await query.maybeSingle();
  if (check) return; // Already linked

  await supabase.from('credits').insert({
    film_id: filmId,
    person_id: personId,
    role: role,
    character_name: charName || null,
    billing_order: 0
  });
}

// Title Clean helper for comparison
function cleanTitle(t: string): string {
  return t.toLowerCase()
    .replace(/[\u2018\u2019]/g, "'") // normalize smart single quotes
    .replace(/[\u201C\u201D]/g, '"') // normalize smart double quotes
    .replace(/\s*\[movie\]\s*$/i, '') // strip [movie] suffix
    .replace(/\s*\(movie\)\s*$/i, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

async function resolveTMDBId(title: string, year: number | null): Promise<number | null> {
  const normalizedTitle = title
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s*\[movie\]\s*$/i, '')
    .trim();

  // Try direct search first
  let searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(normalizedTitle)}&include_adult=false`;
  if (year) {
    searchUrl += `&primary_release_year=${year}`;
  }

  let res = await fetch(searchUrl).then(r => r.json());
  let results = res.results || [];

  if (results.length === 0 && year) {
    // Retry direct search without year
    const fallbackUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(normalizedTitle)}&include_adult=false`;
    res = await fetch(fallbackUrl).then(r => r.json());
    results = res.results || [];
  }

  const cleanedQuery = cleanTitle(normalizedTitle);
  let match = results.find((r: any) => 
    cleanTitle(r.title) === cleanedQuery || 
    cleanTitle(r.original_title) === cleanedQuery
  );

  if (match) return match.id;

  // Direct search failed. Try IMDb Suggestion API
  console.log(`  🔍 Direct search failed. Querying IMDb suggestions...`);
  const firstLetter = cleanedQuery.charAt(0);
  const queryUnderscored = cleanedQuery.replace(/\s+/g, '_');
  const suggestionUrl = `https://v3.sg.media-imdb.com/suggestion/${firstLetter}/${encodeURIComponent(queryUnderscored)}.json`;

  let imdbId = '';
  try {
    const suggRes = await fetch(suggestionUrl).then(r => r.json());
    const suggMatch = (suggRes.d || []).find((item: any) => 
      cleanTitle(item.l) === cleanedQuery && 
      (item.q === 'feature' || item.q === 'movie' || item.q === 'TV movie')
    );
    if (suggMatch) {
      imdbId = suggMatch.id;
      console.log(`  🌐 IMDb Suggestion Match: "${suggMatch.l}" (IMDb ID: ${imdbId})`);
    }
  } catch (err: any) {
    console.error(`  ⚠️ IMDb suggestion lookup failed:`, err.message);
  }

  if (imdbId) {
    // Search TMDB by IMDb ID
    const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
    try {
      const findRes = await fetch(findUrl).then(r => r.json());
      const findMatch = findRes.movie_results?.[0];
      if (findMatch) {
        console.log(`  🌐 TMDB Match (via IMDb Find): "${findMatch.title}" (TMDB ID: ${findMatch.id})`);
        return findMatch.id;
      }
    } catch (err: any) {
      console.error(`  ⚠️ TMDB find by IMDb ID failed:`, err.message);
    }
  }

  return null;
}

async function syncFromTMDB(filmId: string, title: string, year: number | null): Promise<boolean> {
  if (!TMDB_API_KEY) {
    console.log('  ⚠️ TMDB API Key is missing. Skipping TMDB phase.');
    return false;
  }

  try {
    const tmdbId = await resolveTMDBId(title, year);
    if (!tmdbId) {
      return false;
    }

    const detailsUrl = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits,external_ids`;
    const details = await fetch(detailsUrl).then(r => r.json());

    if (!details || !details.credits) {
      return false;
    }

    // Mirror Poster and Backdrop to internal Supabase Storage CDN
    let posterUrl: string | undefined = undefined;
    if (details.poster_path) {
      const extUrl = `https://image.tmdb.org/t/p/w500${details.poster_path}`;
      console.log(`  📸 Mirroring poster to Supabase Storage...`);
      const mirrored = await mirrorImageToSupabase(extUrl, 'posters', `${filmId}-poster.jpg`);
      posterUrl = mirrored || extUrl;
    }

    let backdropUrl: string | undefined = undefined;
    if (details.backdrop_path) {
      const extUrl = `https://image.tmdb.org/t/p/w1280${details.backdrop_path}`;
      console.log(`  📸 Mirroring backdrop to Supabase Storage...`);
      const mirrored = await mirrorImageToSupabase(extUrl, 'backdrops', `${filmId}-backdrop.jpg`);
      backdropUrl = mirrored || extUrl;
    }

    // Enrich missing movie details in the database
    await supabase.from('films').update({
      tmdb_id: tmdbId.toString(),
      poster_url: posterUrl || undefined,
      backdrop_url: backdropUrl || undefined,
      synopsis: details.overview || undefined,
      runtime_minutes: details.runtime || undefined,
      tmdb_rating: details.vote_average || undefined,
      tagline: details.tagline || undefined
    }).eq('id', filmId);

    // Sync Cast (limit to 30)
    const cast = (details.credits.cast || []).slice(0, 30);
    console.log(`  🍿 Importing ${cast.length} cast members from TMDB...`);
    for (const actor of cast) {
      let photoUrl = actor.profile_path ? `https://image.tmdb.org/t/p/w185${actor.profile_path}` : null;
      if (photoUrl) {
        console.log(`    👤 Mirroring cast photo for ${actor.name}...`);
        const mirrored = await mirrorImageToSupabase(photoUrl, 'people', `${actor.id}-person.jpg`);
        photoUrl = mirrored || photoUrl;
      }
      const personId = await upsertPerson({ id: actor.id, name: actor.name, photoUrl });
      if (personId) {
        await linkCredit(filmId, personId, 'actor', actor.character || '');
      }
    }

    // Sync Crew with custom exact jobs
    const crewJobs = [
      'Director', 'Producer', 'Executive Producer', 'Director of Photography',
      'Editor', 'Original Music Composer', 'Costume Design', 'Makeup Artist',
      'Gaffer', 'Sound Designer', 'Production Manager', 'Writer'
    ];
    const crew = (details.credits.crew || []).filter((c: any) => crewJobs.includes(c.job));
    console.log(`  🎬 Importing ${crew.length} key crew members from TMDB...`);

    for (const member of crew) {
      let photoUrl = member.profile_path ? `https://image.tmdb.org/t/p/w185${member.profile_path}` : null;
      if (photoUrl) {
        console.log(`    👤 Mirroring crew photo for ${member.name}...`);
        const mirrored = await mirrorImageToSupabase(photoUrl, 'people', `${member.id}-person.jpg`);
        photoUrl = mirrored || photoUrl;
      }
      const personId = await upsertPerson({ id: member.id, name: member.name, photoUrl });
      if (personId) {
        await linkCredit(filmId, personId, member.job);
      }
    }

    return true;
  } catch (err: any) {
    console.error('  ⚠️ Error syncing from TMDB:', err.message);
    return false;
  }
}

// ─── Main Pipeline Loop ───────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Starting TMDB Film Credit & Media Enrichment Pipeline...\n');

  if (!TMDB_API_KEY) {
    console.error('❌ TMDB_API_KEY is not defined in .env.local');
    process.exit(1);
  }

  // Fetch films missing tmdb_id, sorted by created_at DESC (so newly scraped ones go first)
  console.log('📦 Fetching films missing TMDB ID from database...');
  const { data: films, error } = await supabase
    .from('films')
    .select('id, title, year, created_at')
    .is('tmdb_id', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching films:', error.message);
    process.exit(1);
  }

  console.log(`📝 Found ${films.length} films missing TMDB ID.`);
  
  if (films.length === 0) {
    console.log('✅ All films are already enriched!');
    return;
  }

  // Process a batch of films to prevent rate-limiting or long processes
  const LIMIT = 50; 
  const toProcess = films.slice(0, LIMIT);
  console.log(`⚡ Processing a batch of ${toProcess.length} films...`);

  let successCount = 0;
  let notFoundCount = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const film = toProcess[i];
    console.log(`\n[${i + 1}/${toProcess.length}] 🎥 "${film.title}" (${film.year || 'N/A'})`);
    
    const success = await syncFromTMDB(film.id, film.title, film.year);
    if (success) {
      console.log(`✅ ENRICHED: "${film.title}"`);
      successCount++;
    } else {
      console.log(`⏭️ NOT FOUND ON TMDB/IMDb: "${film.title}"`);
      notFoundCount++;
    }

    // Small rate-limit delay
    await new Promise(res => setTimeout(res, 1000));
  }

  console.log('\n==========================================');
  console.log('🏁 Batch Enrichment Complete');
  console.log(`✅ Successes (Enriched): ${successCount}`);
  console.log(`⏭️ Not matched on TMDB/IMDb:   ${notFoundCount}`);
  console.log('==========================================\n');
}

main().catch(err => {
  console.error('💥 Critical Error in enrichment:', err);
  process.exit(1);
});
