import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { spawn } from 'child_process';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TMDB_API_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;

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

  const { data: newPerson, error } = await supabase
    .from('people')
    .insert({
      name: tmdbPerson.name,
      tmdb_id: tmdbPerson.id.toString(),
      photo_url: tmdbPerson.photoUrl,
      nationality: 'Nigerian'
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

async function syncFromTMDB(filmId: string, title: string, year: number | null): Promise<boolean> {
  if (!TMDB_API_KEY) {
    console.log('  ⚠️ TMDB API Key is missing. Skipping TMDB phase.');
    return false;
  }

  try {
    let searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&include_adult=false`;
    if (year) {
      searchUrl += `&primary_release_year=${year}`;
    }
    
    const searchRes = await fetch(searchUrl).then(r => r.json());
    const results = searchRes.results || [];
    
    if (results.length === 0) {
      return false; // No matches found on TMDB
    }

    // Match closely by title
    const match = results.find((r: any) => 
      r.title.toLowerCase() === title.toLowerCase() || 
      r.original_title?.toLowerCase() === title.toLowerCase()
    ) || results[0];

    // Check year difference to prevent false positives
    if (year && match.release_date) {
      const matchYear = new Date(match.release_date).getFullYear();
      if (Math.abs(matchYear - year) > 2) {
        console.log(`  🔍 TMDB match year mismatch (wanted ${year}, got ${matchYear}). Skipping TMDB.`);
        return false;
      }
    }

    console.log(`  🌐 TMDB Match Found: "${match.title}" (TMDB ID: ${match.id})`);

    const detailsUrl = `https://api.themoviedb.org/3/movie/${match.id}?api_key=${TMDB_API_KEY}&append_to_response=credits`;
    const details = await fetch(detailsUrl).then(r => r.json());

    if (!details || !details.credits) {
      return false;
    }

    // Enrich missing movie details in the database
    await supabase.from('films').update({
      tmdb_id: match.id.toString(),
      poster_url: match.poster_path ? `https://image.tmdb.org/t/p/w500${match.poster_path}` : undefined,
      backdrop_url: match.backdrop_path ? `https://image.tmdb.org/t/p/w1280${match.backdrop_path}` : undefined,
      synopsis: details.overview || undefined,
      runtime_minutes: details.runtime || undefined,
      tmdb_rating: details.vote_average || undefined
    }).eq('id', filmId);

    // Sync Cast
    const cast = (details.credits.cast || []).slice(0, 30);
    console.log(`  🍿 Importing ${cast.length} cast members from TMDB...`);
    for (const actor of cast) {
      const photoUrl = actor.profile_path ? `https://image.tmdb.org/t/p/w185${actor.profile_path}` : null;
      const personId = await upsertPerson({ id: actor.id, name: actor.name, photoUrl });
      if (personId) {
        await linkCredit(filmId, personId, 'actor', actor.character || '');
      }
    }

    // Sync Crew with custom exact jobs
    const crewJobs = [
      'Director', 'Producer', 'Executive Producer', 'Director of Photography',
      'Editor', 'Original Music Composer', 'Costume Design', 'Makeup Artist',
      'Gaffer', 'Sound Designer', 'Production Manager'
    ];
    const crew = (details.credits.crew || []).filter((c: any) => crewJobs.includes(c.job));
    console.log(`  🎬 Importing ${crew.length} key crew members from TMDB...`);

    for (const member of crew) {
      const photoUrl = member.profile_path ? `https://image.tmdb.org/t/p/w185${member.profile_path}` : null;
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

// ─── AI Vision Extractor Phase ───────────────────────────────────────────────

async function runCastExtractor(url: string, timeoutMs: number = 600000): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(`\n🎬 Starting AI extraction for: ${url}`);
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    
    const extractor = spawn(pythonCmd, ['cast_extractor.py', url], {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' }
    });

    const timeout = setTimeout(() => {
      console.log(`⚠️ Process timed out after ${timeoutMs/1000}s. Killing...`);
      extractor.kill('SIGTERM');
      resolve(false);
    }, timeoutMs);

    extractor.on('close', (code) => {
      clearTimeout(timeout);
      resolve(code === 0);
    });

    extractor.on('error', (err) => {
      console.error('❌ Failed to start extractor:', err);
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

// ─── Main Pipeline Loop ───────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Starting Hybrid Credit Enrichment (TMDB + AI Vision Fallback)...\n');

  console.log('📦 Fetching YouTube films from database...');
  const { data: films, error } = await supabase
    .from('films')
    .select('id, title, youtube_watch_url, year')
    .eq('source', 'youtube')
    .not('youtube_watch_url', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching films:', error.message);
    return;
  }

  console.log('🔍 Analyzing credit counts...');
  const { data: credits } = await supabase
    .from('credits')
    .select('film_id');

  const creditCounts: Record<string, number> = {};
  credits?.forEach(c => {
    creditCounts[c.film_id] = (creditCounts[c.film_id] || 0) + 1;
  });

  const targets = films.filter(f => (creditCounts[f.id] || 0) <= 1);
  console.log(`\n📝 Found ${targets.length} candidates needing credit enrichment.`);

  if (targets.length === 0) {
    console.log('✅ No films need enrichment at this time.');
    return;
  }

  const LIMIT = 25; 
  const toProcess = targets.slice(0, LIMIT);
  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const film = toProcess[i];
    console.log(`\n[${i + 1}/${toProcess.length}] 🎥 "${film.title}"`);
    console.log(`🔗 URL: ${film.youtube_watch_url}`);
    
    // --- Step 1: TMDB Sync ---
    console.log(`  🌐 Step 1: Searching for "${film.title}" on TMDB...`);
    const tmdbSuccess = await syncFromTMDB(film.id, film.title, film.year ? Number(film.year) : null);
    
    if (tmdbSuccess) {
      console.log(`✅ SUCCESS: Synced from TMDB for ${film.title}`);
      successCount++;
    } else {
      // --- Step 2: Fallback to AI Vision Frame Extractor ---
      console.log(`  ❌ No TMDB match found. Step 2: Falling back to AI Vision frame capture...`);
      let success = false;
      for (let attempt = 1; attempt <= 2; attempt++) {
        if (attempt > 1) console.log(`   🔄 Retry attempt ${attempt}...`);
        success = await runCastExtractor(film.youtube_watch_url!);
        if (success) break;
        if (attempt < 2) await delay(5000); 
      }
      
      if (success) {
        console.log(`✅ SUCCESS: Finished visual extraction for ${film.title}`);
        successCount++;
      } else {
        console.log(`❌ FAILURE: Failed to process ${film.title} after all attempts.`);
        failCount++;
        console.log(`\n⏳ Extra rate-limit recovery cooldown for 60s...`);
        await delay(60000);
      }
    }

    if (i < toProcess.length - 1) {
      console.log(`\n⏳ Cooling down for 45s...`);
      await delay(45000);
    }
  }

  console.log('\n==========================================');
  console.log('🏁 Batch Processing Complete');
  console.log(`✅ Successes: ${successCount}`);
  console.log(`❌ Failures:  ${failCount}`);
  console.log('==========================================\n');
}

main().catch(err => {
  console.error('💥 Critical Error in main loop:', err);
  process.exit(1);
});
