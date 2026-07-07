import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import crypto from 'crypto';
import https from 'https';
import { cleanTitle } from '../api/_lib/yt_service.js';
import { sweepStaleCinemas } from '../api/_lib/cinema-adapters/index.js';
import { findAndInsertMissingFilm } from './lib/tmdb_cinema.js';

// Support .env and .env.local
const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const envDefault = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const env = { ...envDefault, ...envLocal, ...process.env };

// Inject all loaded variables into process.env so imported modules (like tmdb_cinema) can access them
Object.assign(process.env, env);

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const ENCRYPTION_KEY = "ascvdWD34_GKIbnDVBONKE23GZLpMgA34567890";

// Helper to encrypt payloads like CryptoJS.AES.encrypt
function encryptCryptoJS(plainText: string, passphrase: string): string {
    const salt = crypto.randomBytes(8);
    let md5 = crypto.createHash('md5');
    md5.update(Buffer.concat([Buffer.from(passphrase, 'utf8'), salt]));
    let currentHash = md5.digest();
    let md5s = [currentHash];
    while (Buffer.concat(md5s).length < 48) {
        md5 = crypto.createHash('md5');
        md5.update(Buffer.concat([currentHash, Buffer.from(passphrase, 'utf8'), salt]));
        currentHash = md5.digest();
        md5s.push(currentHash);
    }
    const keyMaterial = Buffer.concat(md5s);
    const key = keyMaterial.slice(0, 32);
    const iv = keyMaterial.slice(32, 48);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(plainText, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return Buffer.concat([Buffer.from('Salted__', 'utf8'), salt, encrypted]).toString('base64');
}

// HTTP request helper to communicate with Filmhouse API
function apiRequest(reqData: any): Promise<any> {
    return new Promise((resolve, reject) => {
        const payload = encryptCryptoJS(JSON.stringify(reqData), ENCRYPTION_KEY);
        const postData = JSON.stringify({ payload });
        
        const req = https.request('https://www.filmhouseng.com/api/external', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error("Failed to parse API response: " + data));
                }
            });
        });
        
        req.on('error', (e) => reject(e));
        req.write(postData);
        req.end();
    });
}

// Convert "12:00PM" to "12:00:00"
function convertTimeTo24h(timeStr: string): string {
  const match = timeStr.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!match) return '12:00:00';
  let hours = parseInt(match[1]);
  const minutes = match[2];
  const ampm = match[3].toUpperCase();
  
  if (ampm === 'PM' && hours < 12) {
    hours += 12;
  } else if (ampm === 'AM' && hours === 12) {
    hours = 0;
  }
  
  const paddedHours = String(hours).padStart(2, '0');
  return `${paddedHours}:${minutes}:00`;
}

// Filmhouse location to DB cinema mapping configuration
const LOCATION_MAPPINGS = [
  { id: "6", slug: "lekki", dbNamePattern: "imax lekki" },
  { id: "5", slug: "landmark", dbNamePattern: "landmark" },
  { id: "7", slug: "surulere", dbNamePattern: "surulere" },
  { id: "8", slug: "circlemall", dbNamePattern: "circle mall" },
  { id: "14", slug: "akure", dbNamePattern: "akure" },
  { id: "13", slug: "samonda", dbNamePattern: "samonda" },
  { id: "19", slug: "ilorin", dbNamePattern: "ilorin" },
  { id: "10", slug: "oniru", dbNamePattern: "oniru" },
  { id: "11", slug: "palmslekki", dbNamePattern: "palms lekki" },
  { id: "12", slug: "benin", dbNamePattern: "benin" },
  { id: "4", slug: "dugbe", dbNamePattern: "dugbe" } // Dugbe Ibadan
];

async function scrapeFilmhouse() {
  const startTime = Date.now();
  console.log('🔄 Starting Filmhouse API Sync Scraper...');

  // 1. Create a "running" log entry
  const { data: logEntry } = await supabase.from('sync_logs').insert({
    source: 'filmhouse',
    status: 'running',
    message: 'Syncing Filmhouse API showtimes...',
    details: { started_at: new Date().toISOString() }
  }).select().single();
  
  const logId = logEntry?.id;

  let totalProcessed = 0;
  let totalInserted = 0;
  let totalErrors = 0;

  try {
    // Fetch DB cinemas containing "Filmhouse"
    const { data: dbCinemas, error: dbCinemasErr } = await supabase
      .from('cinemas')
      .select('*')
      .ilike('name', '%filmhouse%');

    if (dbCinemasErr) throw dbCinemasErr;
    console.log(`Fetched ${dbCinemas?.length || 0} Filmhouse cinemas from DB.`);

    // Map DB Cinemas to Cinesync IDs
    const activeMappings = LOCATION_MAPPINGS.map(mapping => {
      // Prioritize scrape_enabled = true
      let dbCinema = dbCinemas?.find(c => c.scrape_enabled && c.name.toLowerCase().includes(mapping.dbNamePattern));
      if (!dbCinema) {
        dbCinema = dbCinemas?.find(c => c.name.toLowerCase().includes(mapping.dbNamePattern));
      }
      return {
        ...mapping,
        dbCinemaId: dbCinema?.id,
        dbCinemaName: dbCinema?.name
      };
    }).filter(m => m.dbCinemaId);

    console.log(`Mapped ${activeMappings.length} active locations:`, activeMappings.map(m => `${m.slug} -> ${m.dbCinemaName}`));

    // Fetch active dates from Lekki (id "6")
    console.log("📡 Fetching active showtime dates...");
    const datesRes = await apiRequest({
        "endpoint": "cms_widget/index",
        "method": "POST",
        "data": {
          "api": "dates",
          "sales_channel_id": 1,
          "cinema_location_id": "6",
          "page_number": "1",
          "url_key": "",
          "widget_id": "movie_calendar",
          "calendar_date_picker_option": "2"
        },
        "headers": {},
        "langId": "1"
    });

    if (!datesRes || !datesRes.status || !datesRes.data || !datesRes.data.date_start) {
        throw new Error("Failed to fetch active dates range from Cinesync API.");
    }

    const { date_start, date_end, date_disabled } = datesRes.data;
    const disabledDates = new Set((date_disabled || []).map((d: any) => d.date));
    console.log(`Active date range: ${date_start} to ${date_end}. Disabled:`, Array.from(disabledDates));

    const datesToSync: string[] = [];
    let curr = new Date(date_start);
    const end = new Date(date_end);
    
    // Safety guard to avoid endless loops or excessive queries (max 10 days)
    let limitDays = 10;
    while (curr <= end && limitDays > 0) {
      const dateStr = curr.toISOString().split('T')[0];
      if (!disabledDates.has(dateStr)) {
          datesToSync.push(dateStr);
      }
      curr.setDate(curr.getDate() + 1);
      limitDays--;
    }
    
    console.log(`Syncing showtimes for dates:`, datesToSync);

    for (const mapping of activeMappings) {
        console.log(`\n🏢 Syncing location: ${mapping.dbCinemaName} (Cinesync ID: ${mapping.id})...`);
        
        // Accumulate showtimes rows for this cinema across all dates
        const showtimeRows: any[] = [];
        const processedFilms = new Set<string>();

        for (const date of datesToSync) {
            console.log(`  📅 Fetching movies for date: ${date}...`);
            const moviesRes = await apiRequest({
              "endpoint": "cms_widget/index",
              "method": "POST",
              "data": {
                "api": "list",
                "sales_channel_id": 1,
                "cinema_location_id": mapping.id,
                "widget_id": "movie_calendar",
                "session_date": date,
                "has_limit": 0,
                "per_page": 100,
                "page_number": 1,
                "url_key": "",
                "theater_experiance": "",
                "group_to_theater_experiance": false,
                "sort_by": ""
              },
              "headers": {},
              "langId": "1"
            });

            if (!moviesRes || !moviesRes.status || !moviesRes.data || !moviesRes.data.movies) {
                console.log(`    ⚠️ No movies or failed response for ${date}`);
                continue;
            }

            const movies = moviesRes.data.movies;
            console.log(`    Found ${movies.length} movies showing.`);

            for (const movie of movies) {
                const rawTitle = movie.movie_name || movie.title;
                if (!rawTitle) continue;
                const cleanedTitle = cleanTitle(rawTitle);
                
                processedFilms.add(cleanedTitle);

                // ── Step 1: Match Nollywood DB ──
                let dbFilm = await supabase
                  .from('films')
                  .select('id, title, is_in_cinemas')
                  .eq('is_nollywood', true)
                  .ilike('title', cleanedTitle)
                  .maybeSingle()
                  .then(r => r.data);

                // ── Step 2: promoted record triage ──
                if (!dbFilm) {
                  const promoted = await supabase
                    .from('pending_cinema_films')
                    .select('promoted_film_id')
                    .ilike('title', cleanedTitle)
                    .eq('admin_decision', 'promoted')
                    .maybeSingle()
                    .then(r => r.data);
                  if (promoted?.promoted_film_id) {
                    dbFilm = await supabase
                      .from('films')
                      .select('id, title, is_in_cinemas')
                      .eq('id', promoted.promoted_film_id)
                      .maybeSingle()
                      .then(r => r.data);
                  }
                }

                // ── Step 3: TMDB check ──
                if (!dbFilm) {
                  const newFilm = await findAndInsertMissingFilm(supabase, cleanedTitle);
                  if (newFilm) dbFilm = newFilm;
                }

                // ── Step 4: Pending triage fallback ──
                if (!dbFilm) {
                  const existing = await supabase
                    .from('pending_cinema_films')
                    .select('id, showtime_count, admin_decision')
                    .ilike('title', cleanedTitle)
                    .maybeSingle()
                    .then(r => r.data);

                  if (!existing) {
                    await supabase.from('pending_cinema_films').insert({
                      title:               rawTitle,
                      source:              'filmhouse_cinesync',
                      last_seen_cinema_id: mapping.dbCinemaId,
                      showtime_count:      1,
                    });
                  } else if (!existing.admin_decision) {
                    await supabase.from('pending_cinema_films')
                      .update({ showtime_count: (existing.showtime_count ?? 0) + 1, last_seen_cinema_id: mapping.dbCinemaId })
                      .eq('id', existing.id);
                  }
                  continue;
                }

                // ── Step 5: Confirmed Movie showtimes ──
                if (!dbFilm.is_in_cinemas) {
                  await supabase.from('films').update({ is_in_cinemas: true }).eq('id', dbFilm.id);
                }

                const showtimes = movie.show_times || movie.showtimes || [];
                showtimes.forEach((st: any) => {
                    const time24h = convertTimeTo24h(st.show_time_slots || '');
                    const ticketUrl = st.show_time_uuid 
                        ? `https://www.filmhouseng.com/buy-tickets?showtime=${st.show_time_uuid}`
                        : `https://www.filmhouseng.com/buy-tickets`;

                    showtimeRows.push({
                      film_id:      dbFilm!.id,
                      cinema_id:    mapping.dbCinemaId,
                      show_date:    date,
                      show_time:    time24h,
                      format:       'Standard', // Hardcode to 'Standard' to satisfy database showtimes_format_check
                      ticket_url:   ticketUrl,
                      source:       'filmhouse_cinesync',
                      is_available: true,
                      last_seen_at: new Date().toISOString()
                    });
                });
            }
        }

        totalProcessed += processedFilms.size;

        // Clear existing showtimes for this cinema for the synced dates
        for (const date of datesToSync) {
            await supabase.from('showtimes')
              .delete()
              .match({ cinema_id: mapping.dbCinemaId, show_date: date, source: 'filmhouse_cinesync' });
        }

        if (showtimeRows.length > 0) {
            // Deduplicate showtime rows to avoid Postgres primary key constraints
            const seenRows = new Set<string>();
            const uniqueRows = showtimeRows.filter(r => {
                const key = `${r.film_id}_${r.cinema_id}_${r.show_date}_${r.show_time}`;
                if (seenRows.has(key)) return false;
                seenRows.add(key);
                return true;
            });

            console.log(`    Syncing ${uniqueRows.length} showtimes into database...`);
            const { error: insertErr } = await supabase.from('showtimes').insert(uniqueRows);
            if (insertErr) {
                console.error(`    ❌ Insert error for ${mapping.dbCinemaName}:`, insertErr.message);
                totalErrors++;
            } else {
                console.log(`    ✅ Synced ${uniqueRows.length} showtimes!`);
                totalInserted += uniqueRows.length;
            }
        } else {
            console.log(`    ⚠️ No showtimes to sync.`);
        }
    }

    // 6. Expire old showtimes and demote stale films
    try {
      const sweep = await sweepStaleCinemas();
      console.log(`🧹 Cinema sweep: expired ${sweep.expired_showtimes} showtimes, dropped ${sweep.dropped_films} stale films.`);
    } catch (e: any) {
      console.error('⚠️ Cinema sweep failed:', e.message);
    }

    if (logId) {
      await supabase.from('sync_logs').update({
        status: totalErrors === 0 ? 'success' : 'partial',
        message: `Filmhouse sync complete. Processed ${totalProcessed} films, synced ${totalInserted} showtimes.`,
        details: { total_processed: totalProcessed, total_inserted: totalInserted, errors: totalErrors },
        duration_ms: Date.now() - startTime,
        items_processed: totalProcessed,
        items_updated: totalInserted,
        items_failed: totalErrors
      }).eq('id', logId);
    }

    console.log(`\n🎉 Filmhouse sync finished in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

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
