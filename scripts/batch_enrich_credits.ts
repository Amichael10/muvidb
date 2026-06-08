import * as dns from 'dns';dns.setDefaultResultOrder('ipv4first');

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

// ─── Proxy Configuration (SmartProxy Integration) ───────────────────────────
// We bypass proxy for Node database and API operations because Supabase does not block the VPS
// and residential proxies are unstable for high-frequency database connections.
// YouTube downloads (which require proxy) are handled separately in the Python extractor script.

const supabase = createClient(
  (process.env.VITE_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
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
    
    let pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const venvPythonLinux = path.join(process.cwd(), 'venv', 'bin', 'python3');
    const venvPythonWin = path.join(process.cwd(), 'venv', 'Scripts', 'python.exe');
    
    if (process.platform === 'win32' && fs.existsSync(venvPythonWin)) {
      pythonCmd = venvPythonWin;
    } else if (process.platform !== 'win32' && fs.existsSync(venvPythonLinux)) {
      pythonCmd = venvPythonLinux;
    }
    
    console.log(`🔍 Using Python executable: ${pythonCmd}`);
    
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
  console.log('🚀 Starting Hybrid Credit Enrichment (TMDB + AI Vision Fallback)...\n');
  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
  const targetUrlArg = process.argv[2]?.trim();

  while (true) {
    const startTime = Date.now();
    
    // 1. Create a "running" log entry
    const { data: logEntry } = await supabase.from('sync_logs').insert({
      source: 'cast_vision_sync',
      status: 'running',
      message: `Starting batch credit enrichment (TMDB & OCR Tesseract)...${targetUrlArg ? ' Target: ' + targetUrlArg : ''}`,
      details: { started_at: new Date().toISOString() }
    }).select().single();
    
    const logId = logEntry?.id;
    const runReport: any[] = [];

    try {
      let films: any[] = [];
      if (targetUrlArg) {
        console.log(`🎯 Targeting specific URL from command line: ${targetUrlArg}`);
        let videoId = '';
        if (targetUrlArg.includes('v=')) {
          videoId = targetUrlArg.split('v=')[1]?.split('&')[0];
        } else if (targetUrlArg.includes('youtu.be/')) {
          videoId = targetUrlArg.split('youtu.be/')[1]?.split('?')[0];
        }
        
        let query = supabase
          .from('films')
          .select('id, title, youtube_watch_url, year');
          
        if (videoId) {
          query = query.or(`youtube_watch_url.eq.${targetUrlArg},source_video_id.eq.${videoId}`);
        } else {
          query = query.eq('youtube_watch_url', targetUrlArg);
        }
        
        const { data, error } = await query;
        if (error) {
          console.error('❌ Error fetching target film:', error.message);
          if (logId) {
            await supabase.from('sync_logs').update({
              status: 'error',
              message: `Database query failed: ${error.message}`,
              duration_ms: Date.now() - startTime
            }).eq('id', logId);
          }
          break; // Exit loop on specific target error
        }
        films = data || [];
      } else {
        console.log('📦 Fetching YouTube films from database with credit counts...');
        const { data, error } = await supabase
          .from('films')
          .select('id, title, youtube_watch_url, year, credits(count)')
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
          console.log('⏳ Error fetching from DB. Retrying in 1 minute...');
          await delay(60000);
          continue;
        }
        films = data || [];
      }

      const targets = targetUrlArg 
        ? films 
        : films.filter(f => {
            const count = (f.credits as any)?.[0]?.count ?? 0;
            return count <= 10;
          });
      
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
        if (targetUrlArg) break; // End if specific target was done
        console.log('💤 Sleeping for 10 minutes before next batch check...');
        await delay(10 * 60 * 1000);
        continue;
      }

      const LIMIT = 25; 
      const toProcess = targets.slice(0, LIMIT);

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < toProcess.length; i++) {
        const film = toProcess[i];
        console.log(`\n[${i + 1}/${toProcess.length}] 🎥 "${film.title}"`);
        console.log(`🔗 URL: ${film.youtube_watch_url}`);
        
        let ocrSuccess = false;
        const runMethod = 'OCR_Tesseract';
        let runMessage = '';

        console.log(`🚀 Starting AI Vision frame capture and OCR extraction...`);

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
          successCount++;
          runMessage = 'Credits successfully extracted from video frames via local Tesseract OCR';
        } else {
          console.log(`❌ FAILURE: Failed to process ${film.title} after all attempts.`);
          failCount++;
          runMessage = 'Failed to extract credits (no text detected or extraction failed)';
          console.log(`\n⏳ Extra rate-limit recovery cooldown for 60s...`);
          await delay(60000);
        }

        runReport.push({
          film_id: film.id,
          title: film.title,
          status: ocrSuccess ? 'success' : 'failed',
          method: runMethod,
          message: runMessage
        });

        if (i < toProcess.length - 1) {
          const cooldown = process.env.SMARTPROXY_USER ? 3000 : 45000;
          console.log(`\n⏳ Cooling down for ${cooldown / 1000}s...`);
          await delay(cooldown);
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

      if (targetUrlArg) {
        console.log('🎯 Specific target processed. Exiting.');
        break;
      }
      
      console.log('🔄 Moving to next batch in 30 seconds...');
      await delay(30000);

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
      if (targetUrlArg) break;
      console.log('⏳ Sleeping for 5 minutes after error before retrying...');
      await delay(5 * 60 * 1000);
    }
  }
}

main().catch(err => {
  console.error('💥 Critical Error in main loop:', err);
  process.exit(1);
});
