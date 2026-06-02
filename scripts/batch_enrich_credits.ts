import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { spawn } from 'child_process';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TMDB_API_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;

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

    // Mirror Poster and Backdrop to internal Supabase Storage CDN
    let posterUrl: string | undefined = undefined;
    if (match.poster_path) {
      const extUrl = `https://image.tmdb.org/t/p/w500${match.poster_path}`;
      console.log(`  📸 Mirroring poster to Supabase Storage...`);
      const mirrored = await mirrorImageToSupabase(extUrl, 'posters', `${filmId}-poster.jpg`);
      posterUrl = mirrored || extUrl;
    }

    let backdropUrl: string | undefined = undefined;
    if (match.backdrop_path) {
      const extUrl = `https://image.tmdb.org/t/p/w1280${match.backdrop_path}`;
      console.log(`  📸 Mirroring backdrop to Supabase Storage...`);
      const mirrored = await mirrorImageToSupabase(extUrl, 'backdrops', `${filmId}-backdrop.jpg`);
      backdropUrl = mirrored || extUrl;
    }

    // Enrich missing movie details in the database with mirrored URLs
    await supabase.from('films').update({
      tmdb_id: match.id.toString(),
      poster_url: posterUrl || undefined,
      backdrop_url: backdropUrl || undefined,
      synopsis: details.overview || undefined,
      runtime_minutes: details.runtime || undefined,
      tmdb_rating: details.vote_average || undefined
    }).eq('id', filmId);

    // Sync Cast
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
      'Gaffer', 'Sound Designer', 'Production Manager'
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

// ─── AI Vision Extractor Phase ───────────────────────────────────────────────

async function runCastExtractor(url: string, timeoutMs: number = 600000): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(`\n🎬 Starting AI extraction for: ${url}`);
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    
    const extractor = spawn(pythonCmd, ['local_ocr_extractor.py', url], {
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
  const startTime = Date.now();
  console.log('🚀 Starting Hybrid Credit Enrichment (TMDB + AI Vision Fallback)...\n');

  // 1. Create a "running" log entry
  const { data: logEntry } = await supabase.from('sync_logs').insert({
    source: 'cast_vision_sync',
    status: 'running',
    message: 'Starting batch credit enrichment (TMDB & OCR Tesseract)...',
    details: { started_at: new Date().toISOString() }
  }).select().single();
  
  const logId = logEntry?.id;
  const runReport: any[] = [];

  try {
    console.log('📦 Fetching YouTube films from database...');
    const { data: films, error } = await supabase
      .from('films')
      .select('id, title, youtube_watch_url, year')
      .eq('source', 'youtube')
      .not('youtube_watch_url', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching films:', error.message);
      if (logId) {
        await supabase.from('sync_logs').update({
          status: 'error',
          message: `Database query failed: ${error.message}`,
          duration_ms: Date.now() - startTime
        }).eq('id', logId);
      }
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

    const targets = films.filter(f => (creditCounts[f.id] || 0) <= 10);
    console.log(`\n📝 Found ${targets.length} candidates needing credit enrichment.`);

    if (targets.length === 0) {
      console.log('✅ No films need enrichment at this time.');
      if (logId) {
        await supabase.from('sync_logs').update({
          status: 'success',
          message: 'No films need enrichment at this time.',
          details: { completed_at: new Date().toISOString(), total_processed: 0 },
          duration_ms: Date.now() - startTime
        }).eq('id', logId);
      }
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
      
      let ocrSuccess = false;
      let runMethod = 'TMDB';
      let runMessage = 'Credits successfully enriched from TMDB API';

      if (tmdbSuccess) {
        console.log(`✅ SUCCESS: Synced from TMDB for ${film.title}`);
        successCount++;
      }

      // Query database for current credit count to determine if page remains sparse
      const { count: currentCreditsCount } = await supabase
        .from('credits')
        .select('*', { count: 'exact', head: true })
        .eq('film_id', film.id);

      const creditsAfterTMDB = currentCreditsCount || 0;
      console.log(`  📊 Credit count after TMDB sync: ${creditsAfterTMDB}`);

      // If TMDB failed OR it yielded a very sparse credit list (< 8 credits), trigger the OCR Tesseract engine!
      if (!tmdbSuccess || creditsAfterTMDB < 8) {
        if (tmdbSuccess) {
          console.log(`  ⚠️ TMDB sync succeeded but only yielded ${creditsAfterTMDB} credits. Proceeding to OCR for full crew enrichment...`);
          runMethod = 'TMDB + OCR_Tesseract';
        } else {
          console.log(`  ❌ No TMDB match found. Step 2: Falling back to AI Vision frame capture...`);
          runMethod = 'OCR_Tesseract';
        }

        let success = false;
        for (let attempt = 1; attempt <= 2; attempt++) {
          if (attempt > 1) console.log(`   🔄 Retry attempt ${attempt}...`);
          success = await runCastExtractor(film.youtube_watch_url!);
          if (success) break;
          if (attempt < 2) await delay(5000);
        }
        
        ocrSuccess = success;

        if (success) {
          console.log(`✅ SUCCESS: Finished visual extraction for ${film.title}`);
          if (!tmdbSuccess) successCount++;
          runMessage = tmdbSuccess
            ? 'Enriched first via TMDB, then full crew list extracted from video frames via local Tesseract OCR'
            : 'Credits extracted from video frames via local Tesseract OCR engine';
        } else {
          if (!tmdbSuccess) {
            console.log(`❌ FAILURE: Failed to process ${film.title} after all attempts.`);
            failCount++;
            runMessage = 'Failed to extract credits (no text detected or extraction failed)';
            console.log(`\n⏳ Extra rate-limit recovery cooldown for 60s...`);
            await delay(60000);
          } else {
            runMessage = 'Enriched via TMDB; local OCR fallback was attempted but failed to extract extra details';
          }
        }
      }

      runReport.push({
        film_id: film.id,
        title: film.title,
        status: (tmdbSuccess || ocrSuccess) ? 'success' : 'failed',
        method: runMethod,
        message: runMessage
      });

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

    if (logId) {
      await supabase.from('sync_logs').update({
        status: failCount === 0 ? 'success' : 'partial',
        message: `Enrichment complete. Successfully synced ${successCount} films, failed ${failCount} films.`,
        details: { 
          completed_at: new Date().toISOString(),
          total_processed: toProcess.length,
          success_count: successCount,
          failure_count: failCount,
          runs: runReport
        },
        duration_ms: Date.now() - startTime,
        items_processed: toProcess.length,
        items_updated: successCount,
        items_failed: failCount
      }).eq('id', logId);
    }

  } catch (err: any) {
    console.error('💥 Critical Error in main loop:', err);
    if (logId) {
      await supabase.from('sync_logs').update({
        status: 'error',
        message: err.message,
        details: { error: err.stack, runs: runReport },
        duration_ms: Date.now() - startTime
      }).eq('id', logId);
    }
    throw err;
  }
}

main().catch(err => {
  console.error('💥 Critical Error in main loop:', err);
  process.exit(1);
});
