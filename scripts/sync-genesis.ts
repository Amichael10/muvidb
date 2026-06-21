import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import { cleanTitle } from '../api/_lib/yt_service.js';
import { findAndInsertMissingFilm } from './lib/tmdb_cinema.js';
import { isOwnUrl, mirrorImageToStorage } from '../api/_lib/image_mirror.js';

// Support .env and .env.local
const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const envDefault = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const env = { ...envDefault, ...envLocal, ...process.env };

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Genesis cinema locations with their JACRO cinema_id integers (discovered via network intercept)
// and their Supabase cinema UUIDs.
// To discover a new jacroId: visit the location URL, open DevTools > Network, filter admin-ajax.php,
// and look at the POST body for `cinema_id=<number>`.
//
// Confirmed IDs (from live Playwright intercept 2026-06-06):
//   Maryland=7, Festac=5, Abuja=1, Port Harcourt=9, Lekki=11
// Unconfirmed (Owerri/Asaba/Warri) — set to 0 and will be skipped until confirmed.
const GENESIS_LOCATIONS = [
  { name: 'Genesis Maryland',      jacroId: 7,  cinemaId: '0aef7f74-d8dd-4847-b652-e167285993c0', url: 'https://genesiscinemas.com/maryland-mall-maryland/' },
  { name: 'Genesis Festac',        jacroId: 5,  cinemaId: '92ae9a89-7dfc-44fb-9240-0d6c7f1e64f7', url: 'https://genesiscinemas.com/festival-mall-festac-lagos/' },
  { name: 'Genesis Abuja',         jacroId: 1,  cinemaId: '3843be4b-7ae3-4a10-9fdf-f6b79c6ae957', url: 'https://genesiscinemas.com/ceddi-plaza-abuja/' },
  { name: 'Genesis Port Harcourt', jacroId: 9,  cinemaId: 'e25ff010-cf5e-4b99-a8fd-4f6b681dd2c1', url: 'https://genesiscinemas.com/genesis-center-port-harcourt/' },
  { name: 'Genesis Lekki',         jacroId: 11, cinemaId: 'c833f1dd-7c40-4f9a-ac31-0d8a4708caa6', url: 'https://genesiscinemas.com/freedom-way-lekki/' },
  // TODO: confirm jacroIds for Owerri, Asaba, Warri (visit their pages and inspect admin-ajax POST)
  { name: 'Genesis Owerri',        jacroId: 0,  cinemaId: '7c2945dd-b6c5-431b-81c9-b4ead987033f', url: 'https://genesiscinemas.com/owerri-mall-owerri/' },
  { name: 'Genesis Asaba',         jacroId: 0,  cinemaId: '52a0c538-1cc0-456d-afbc-f6531f8770c8', url: 'https://genesiscinemas.com/asaba-mall-delta-state/' },
  { name: 'Genesis Warri',         jacroId: 0,  cinemaId: '981bd41a-6979-4c44-aa5c-4f120e5cc568', url: 'https://genesiscinemas.com/warri-delta-mall-effurun/' },
].filter(loc => loc.jacroId > 0); // skip unconfirmed locations


const JACRO_AJAX_URL = 'https://genesiscinemas.com/wp-admin/admin-ajax.php';

interface FilmEntry {
  title: string;
  posterUrl: string | null;
  showtimes: { time: string; ticketUrl: string | null }[];
}

/**
 * Parse the JACRO HTML fragment into structured film entries.
 * We use regex instead of a DOM library to avoid extra dependencies.
 * The JACRO HTML structure is predictable:
 *   <div class="row movie-tabs ..."> ... <h3 ...><a ...>TITLE</a></h3> ... <a class="perfbtn ...">HH:MM</a> ...
 */
function parseGenesisHtml(html: string): FilmEntry[] {
  const films: FilmEntry[] = [];

  // Split into per-film blocks by the outer .movie-tabs div
  const blocks = html.split(/<div[^>]+class="[^"]*movie-tabs[^"]*"/i).slice(1);

  for (const block of blocks) {
    // Title: inside <h3 ...><a ...>TITLE</a></h3>
    const titleMatch = block.match(/<h3[^>]*>[^<]*<a[^>]*>([^<]+)<\/a>/i);
    const title = titleMatch ? titleMatch[1].trim() : null;
    if (!title) continue;

    // Poster URL
    const posterMatch = block.match(/id="jacroappimg"[^>]*src="([^"]+)"/) ||
                        block.match(/src="([^"]+)"[^>]*id="jacroappimg"/);
    const posterUrl = posterMatch ? posterMatch[1] : null;

    // Showtimes: <a class="perfbtn ...">HH:MM</a>
    const showtimes: { time: string; ticketUrl: string | null }[] = [];
    const btnRegex = /<a[^>]+class="[^"]*perfbtn[^"]*"[^>]*href="([^"]*?)"[^>]*>([^<]+)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = btnRegex.exec(block)) !== null) {
      const href = m[1].replace(/\\/g, '');
      const time = m[2].trim().replace(/\s+VIP$/i, '').trim();
      if (/^\d{1,2}:\d{2}/.test(time)) {
        showtimes.push({ time, ticketUrl: href || null });
      }
    }

    films.push({ title, posterUrl, showtimes });
  }

  return films;
}


/**
 * Calls the JACRO WordPress AJAX API directly to get films for a specific
 * cinema location and date. No browser needed — this is a plain HTTP POST.
 *
 * Discovered via Playwright network intercept on 2026-06-06:
 *   POST https://genesiscinemas.com/wp-admin/admin-ajax.php
 *   Body: action=jacro_filter_result&film_date=YYYY-MM-DD&film_type=Now+Showing&cinema_id=<jacroId>
 */
async function fetchGenesisFilms(jacroId: number, date: string): Promise<FilmEntry[]> {
  const body = new URLSearchParams({
    action: 'jacro_filter_result',
    film_date: date,
    film_type: 'Now Showing',
    cinema_id: String(jacroId),
  });

  const res = await fetch(JACRO_AJAX_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`JACRO API returned HTTP ${res.status}`);

  const json = await res.json() as { html?: string };
  if (!json.html) return [];

  return parseGenesisHtml(json.html);
}

async function scrapeGenesis() {
  const startTime = Date.now();
  console.log('🌍 Starting Genesis Scraper (JACRO direct API)...');

  const { data: logEntry } = await supabase.from('sync_logs').insert({
    source: 'genesis',
    status: 'running',
    message: 'Scraping Genesis showtimes via JACRO API...',
    details: { started_at: new Date().toISOString() }
  }).select().single();

  const logId = logEntry?.id;
  const today = new Date().toISOString().split('T')[0];
  let totalProcessed = 0;
  let totalInserted  = 0;
  let totalErrors    = 0;

  try {
    for (const loc of GENESIS_LOCATIONS) {
      console.log(`📍 Fetching ${loc.name} (jacroId=${loc.jacroId})...`);
      let films: FilmEntry[] = [];

      try {
        films = await fetchGenesisFilms(loc.jacroId, today);
        console.log(`  Found ${films.length} films`);
      } catch (err: any) {
        console.error(`  ❌ JACRO API error for ${loc.name}:`, err.message);
        totalErrors++;
        continue;
      }

      totalProcessed += films.length;

      for (const film of films) {
        // Normalize known typos in JACRO data
        const JACRO_TYPOS: Record<string, string> = {
          'Michaell':               'Michael',
          'Master of the Universe': 'Masters of the Universe',
        };
        const rawTitle = JACRO_TYPOS[film.title.trim()] ||
          film.title.replace(/\s+VIP$/i, '').replace(/\(vip\)/i, '').trim();
        const cleanTitleStr = cleanTitle(rawTitle);
        console.log(`    🎬 Processing "${cleanTitleStr}"...`);

        // ── Step 1: Exact match against is_nollywood=true films ────────────────
        let { data: dbFilm } = await supabase
          .from('films')
          .select('id, title, poster_url, backdrop_url, is_in_cinemas')
          .eq('is_nollywood', true)
          .ilike('title', cleanTitleStr)
          .maybeSingle();

        // ── Step 2: Check if a pending record was already promoted by admin ────
        if (!dbFilm) {
          const { data: promoted } = await supabase
            .from('pending_cinema_films')
            .select('promoted_film_id')
            .ilike('title', cleanTitleStr)
            .eq('admin_decision', 'promoted')
            .maybeSingle();
          if (promoted?.promoted_film_id) {
            const { data: pf } = await supabase
              .from('films')
              .select('id, title, poster_url, backdrop_url, is_in_cinemas')
              .eq('id', promoted.promoted_film_id)
              .maybeSingle();
            dbFilm = pf;
          }
        }

        // ── Step 3: TMDB verify — only auto-insert confirmed Nigerian films ────
        if (!dbFilm) {
          console.log(`      ⚠️ Not in Nollywood DB — checking TMDB origin...`);
          dbFilm = await findAndInsertMissingFilm(supabase, rawTitle);
          // findAndInsertMissingFilm returns null for non-Nigerian films
        }

        // ── Step 4: Not confirmed Nollywood → pending triage ──────────────────
        if (!dbFilm) {
          // Check if already blacklisted or pending
          const { data: existing } = await supabase
            .from('pending_cinema_films')
            .select('id, showtime_count, admin_decision')
            .ilike('title', cleanTitleStr)
            .maybeSingle();

          if (!existing) {
            await supabase.from('pending_cinema_films').insert({
              title:               rawTitle,
              poster_url:          film.posterUrl,
              source:              'genesis_jacro',
              last_seen_cinema_id: loc.cinemaId,
              showtime_count:      film.showtimes.length || 1,
            });
            console.log(`      📋 Sent to pending triage: "${rawTitle}"`);
          } else if (!existing.admin_decision || existing.admin_decision === null) {
            await supabase.from('pending_cinema_films')
              .update({ showtime_count: (existing.showtime_count ?? 0) + 1, last_seen_cinema_id: loc.cinemaId })
              .eq('id', existing.id);
            console.log(`      📋 Updated pending count: "${rawTitle}"`);
          } else if (existing.admin_decision === 'blacklisted') {
            console.log(`      🚫 Blacklisted, skipping: "${rawTitle}"`);
          }
          continue;
        }

        // ── Step 5: Confirmed Nollywood — write showtimes ─────────────────────
        if (dbFilm) {
          const hasValidPoster = dbFilm.poster_url && isOwnUrl(dbFilm.poster_url);
          const hasValidBackdrop = dbFilm.backdrop_url && isOwnUrl(dbFilm.backdrop_url);
          const updatedFields: Record<string, any> = {};

          if (!hasValidPoster && film.posterUrl) {
            console.log(`      [sync-genesis] "${dbFilm.title}" has no valid poster. Attempting to mirror scraped poster: ${film.posterUrl}`);
            const filename = `${dbFilm.id.slice(0, 8)}-${dbFilm.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`;
            const mirroredPoster = await mirrorImageToStorage(film.posterUrl, 'posters', filename);
            if (mirroredPoster) {
              updatedFields.poster_url = mirroredPoster;
              dbFilm.poster_url = mirroredPoster;
            }
          }

          if (Object.keys(updatedFields).length > 0) {
            console.log(`      [sync-genesis] Updating film "${dbFilm.title}" with mirrored images:`, updatedFields);
            await supabase.from('films').update(updatedFields).eq('id', dbFilm.id);
          }
        }
        const seen = new Set<string>();
        const uniqueShowtimes = film.showtimes.filter(s => {
          if (seen.has(s.time)) return false;
          seen.add(s.time);
          return true;
        });

        if (uniqueShowtimes.length === 0) {
          uniqueShowtimes.push({ time: '12:00', ticketUrl: loc.url });
        }

        await supabase.from('showtimes')
          .delete()
          .match({ film_id: dbFilm.id, cinema_id: loc.cinemaId, show_date: today });

        const rows = uniqueShowtimes.map(s => ({
          film_id:      dbFilm!.id,
          cinema_id:    loc.cinemaId,
          show_date:    today,
          show_time:    s.time.includes(':') ? s.time + ':00' : '12:00:00',
          format:       'Standard',
          ticket_url:   s.ticketUrl,
          source:       'genesis_jacro',
          is_available: true,
          last_seen_at: new Date().toISOString(),
        }));

        const { error: insertError } = await supabase.from('showtimes').insert(rows);
        if (insertError) {
          console.error(`      ❌ Insert error: ${insertError.message}`);
          totalErrors++;
        } else {
          console.log(`      ✅ Synced ${rows.length} showtimes for "${dbFilm.title}"`);
          totalInserted += rows.length;
        }
      }
    }

    if (logId) {
      await supabase.from('sync_logs').update({
        status:          totalErrors === 0 ? 'success' : 'partial',
        message:         `Genesis sync complete. ${totalProcessed} films, ${totalInserted} showtimes.`,
        details:         { total_processed: totalProcessed, total_inserted: totalInserted, errors: totalErrors },
        duration_ms:     Date.now() - startTime,
        items_processed: totalProcessed,
        items_updated:   totalInserted,
        items_failed:    totalErrors,
      }).eq('id', logId);
    }

    console.log(`\n✅ Genesis sync done in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    console.log(`   Processed: ${totalProcessed} | Inserted: ${totalInserted} | Errors: ${totalErrors}`);

  } catch (err: any) {
    console.error('Genesis Scraper failed:', err);
    if (logId) {
      await supabase.from('sync_logs').update({
        status:      'error',
        message:     err.message,
        details:     { error: err.stack },
        duration_ms: Date.now() - startTime,
      }).eq('id', logId);
    }
  }
}

scrapeGenesis();
