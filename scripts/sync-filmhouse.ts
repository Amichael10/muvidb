import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import { cleanTitle } from '../api/_lib/yt_service.js';
import { sweepStaleCinemas } from '../api/_lib/cinema-adapters/index.js';
import { findAndInsertMissingFilm } from './lib/tmdb_cinema.js';

// Support .env and .env.local
const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const envDefault = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const env = { ...envDefault, ...envLocal, ...process.env };

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function scrapeFilmhouse() {
  const startTime = Date.now();
  console.log('🔄 Starting Filmhouse Scraper...');

  // 1. Create a "running" log entry
  const { data: logEntry } = await supabase.from('sync_logs').insert({
    source: 'filmhouse',
    status: 'running',
    message: 'Scraping Filmhouse showtimes...',
    details: { started_at: new Date().toISOString() }
  }).select().single();
  
  const logId = logEntry?.id;

  const defaultCinemaId = '6c9c38f0-f790-4573-aaa0-483d96ccaa43'; // Lekki IMAX as default fallback
  const today = new Date().toISOString().split('T')[0];
  let totalProcessed = 0;
  let totalInserted = 0;
  let totalErrors = 0;

  try {
    // Use Scrapling to fetch the homepage — it renders the React SPA and returns clean text.
    // We proved this works: the homepage at filmhouseng.com/ shows all current films.
    console.log('📡 Fetching Filmhouse homepage via Scrapling...');
    const { spawn } = await import('child_process');
    const path = await import('path');
    const bridgePath = path.resolve('./scripts/scrapling_bridge.py');

    const pageText: string = await new Promise((resolve, reject) => {
      const child = spawn('python', [
        '-u', bridgePath,
        '--url', 'https://www.filmhouseng.com/',
        '--wait', '6000',
        '--timeout', '90000'
      ], { shell: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' } });

      let out = '', err = '';
      child.stdout.on('data', (d: any) => { out += d.toString(); });
      child.stderr.on('data', (d: any) => { err += d.toString(); });
      const timer = setTimeout(() => { child.kill(); reject(new Error('Scrapling timed out')); }, 120000);
      child.on('close', (code: number) => {
        clearTimeout(timer);
        try {
          const parsed = JSON.parse(out.trim());
          if (parsed.error) reject(new Error(parsed.error));
          else resolve(parsed.text || '');
        } catch (e) {
          reject(new Error(`Scrapling parse failed (code ${code}): ${err.slice(0, 300)}`));
        }
      });
    });

    // Extract film titles from the page text.
    // Filmhouse homepage renders films as:   "Film Title\nXh Ym\nBuy Tickets\n..."
    // We find every line followed by a runtime line like "1h 45m" or "2h 0m".
    const lines = pageText.split('\n').map((l: string) => l.trim()).filter(Boolean);
    const filmTitles: string[] = [];
    for (let i = 0; i < lines.length - 1; i++) {
      if (/^\d+h\s+\d+m$/.test(lines[i + 1]) && lines[i].length > 2 && lines[i].length < 80) {
        const candidate = lines[i];
        // Skip nav/UI noise
        if (!['Now Showing', 'Coming Soon', 'Buy Tickets', 'More Info', 'Play Trailer',
              'Sign In', 'Login', 'Home Page', 'Food & Drinks', 'Gift Cards'].includes(candidate)) {
          if (!filmTitles.includes(candidate)) filmTitles.push(candidate);
        }
      }
    }

    console.log(`Found ${filmTitles.length} films on homepage:`, filmTitles);
    totalProcessed = filmTitles.length;

    for (const title of filmTitles) {
      const cleanedTitle = cleanTitle(title);
      console.log(`  🎬 Processing ${cleanedTitle}...`);

      // ── Step 1: Exact match against is_nollywood=true films ──────────────────
      let { data: dbFilm } = await supabase
        .from('films')
        .select('id, title, is_in_cinemas')
        .eq('is_nollywood', true)
        .ilike('title', cleanedTitle)
        .maybeSingle();

      // ── Step 2: Check if admin already promoted a pending record ─────────────
      if (!dbFilm) {
        const { data: promoted } = await supabase
          .from('pending_cinema_films')
          .select('promoted_film_id')
          .ilike('title', cleanedTitle)
          .eq('admin_decision', 'promoted')
          .maybeSingle();
        if (promoted?.promoted_film_id) {
          const { data: pf } = await supabase
            .from('films').select('id, title, is_in_cinemas').eq('id', promoted.promoted_film_id).maybeSingle();
          dbFilm = pf;
        }
      }

      // ── Step 3: TMDB verify — only auto-insert confirmed Nigerian films ───────
      if (!dbFilm) {
        console.log(`    ⚠️ Not in Nollywood DB — checking TMDB origin...`);
        const newFilm = await findAndInsertMissingFilm(supabase, cleanedTitle);
        if (newFilm) dbFilm = newFilm;
      }

      // ── Step 4: Not confirmed Nollywood → pending triage ─────────────────────
      if (!dbFilm) {
        const { data: existing } = await supabase
          .from('pending_cinema_films')
          .select('id, showtime_count, admin_decision')
          .ilike('title', cleanedTitle)
          .maybeSingle();

        if (!existing) {
          await supabase.from('pending_cinema_films').insert({
            title:               title,
            source:              'filmhouse_scrapling',
            last_seen_cinema_id: defaultCinemaId,
            showtime_count:      1,
          });
          console.log(`    📋 Sent to pending triage: "${cleanedTitle}"`);
        } else if (!existing.admin_decision || existing.admin_decision === null) {
          await supabase.from('pending_cinema_films')
            .update({ showtime_count: (existing.showtime_count ?? 0) + 1, last_seen_cinema_id: defaultCinemaId })
            .eq('id', existing.id);
          console.log(`    📋 Updated pending count: "${cleanedTitle}"`);
        } else if (existing.admin_decision === 'blacklisted') {
          console.log(`    🚫 Blacklisted, skipping: "${cleanedTitle}"`);
        }
        continue;
      }

      // ── Step 5: Confirmed Nollywood — write showtime ──────────────────────────
      if (!dbFilm.is_in_cinemas) {
        await supabase.from('films').update({ is_in_cinemas: true }).eq('id', dbFilm.id);
      }

      await supabase.from('showtimes').delete()
        .match({ film_id: dbFilm.id, cinema_id: defaultCinemaId, show_date: today });

      const { error } = await supabase.from('showtimes').insert({
        film_id:      dbFilm.id,
        cinema_id:    defaultCinemaId,
        show_date:    today,
        show_time:    '12:00:00',
        format:       'Standard',
        source:       'filmhouse_scrapling',
        is_available: true,
        last_seen_at: new Date().toISOString(),
      });

      if (error) {
        console.error(`    ❌ Error: ${error.message}`);
        totalErrors++;
      } else {
        console.log(`    ✅ Synced showtime for "${dbFilm.title}"`);
        totalInserted++;
      }
    }
    
    // Hygiene sweep: expire past showtimes and demote titles no longer showing
    // so they drop from "In Cinemas Now" into "Leaving Cinemas Soon" and off.
    try {
      const sweep = await sweepStaleCinemas();
      console.log(`🧹 Cinema sweep: expired ${sweep.expired_showtimes} showtimes, dropped ${sweep.dropped_films} stale films.`);
    } catch (e: any) {
      console.error('⚠️ Cinema sweep failed:', e.message);
    }

    if (logId) {
      await supabase.from('sync_logs').update({
        status: totalErrors === 0 ? 'success' : 'partial',
        message: `Filmhouse sync complete. Processed ${totalProcessed} films, synced ${totalInserted} entries.`,
        details: { total_processed: totalProcessed, total_inserted: totalInserted, errors: totalErrors },
        duration_ms: Date.now() - startTime,
        items_processed: totalProcessed,
        items_updated: totalInserted,
        items_failed: totalErrors
      }).eq('id', logId);
    }

  } catch (err: any) {
    console.error("Filmhouse Scraper failed:", err);
    if (logId) {
      await supabase.from('sync_logs').update({
        status: 'error',
        message: err.message,
        details: { error: err.stack },
        duration_ms: Date.now() - startTime
      }).eq('id', logId);
    }
  }
}

scrapeFilmhouse();
