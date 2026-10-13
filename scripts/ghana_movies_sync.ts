import './dotenv_init.js';
import { createClient } from '@supabase/supabase-js';
import * as https from 'https';
import { mirrorImageToStorage, isOwnUrl } from '../api/_lib/image_mirror.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const GMDB_SUPABASE_URL = 'https://wehhtzuqehktpgfrrlga.supabase.co';
const GMDB_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlaGh0enVxZWhrdHBnZnJybGdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjA4MTcsImV4cCI6MjA5NTI5NjgxN30.vDfrX_2wVBaYHUe-CSFth9Boo9wy6-HzvoRIcj0QOfo';

const actorCache = new Map<string, string>(); // name.toLowerCase() -> person_id
const tmdbPersonCache = new Map<number, string>(); // tmdb_id -> person_id

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function cleanName(raw: string): string {
  if (!raw) return '';
  let name = raw.replace(/\([^)]*\)/g, '');
  name = name.replace(/[.,\s]+$/, '');
  return name.trim().replace(/\s+/g, ' ');
}

function parseRuntime(raw: string | null | undefined): number | null {
  if (!raw || raw === 'N/A') return null;
  const hMatch = raw.match(/(\d+)\s*h/i);
  const mMatch = raw.match(/(\d+)\s*m/i);
  const hours = hMatch ? parseInt(hMatch[1], 10) : 0;
  const minutes = mMatch ? parseInt(mMatch[1], 10) : 0;
  const total = hours * 60 + minutes;
  if (total > 0) return total;
  const numOnly = parseInt(raw, 10);
  return isNaN(numOnly) ? null : numOnly;
}

function parseYear(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = raw.match(/\b(19\d\d|20\d\d)\b/);
  return m ? parseInt(m[1], 10) : null;
}

function extractYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return m ? m[1] : null;
}

// Hollywood & Foreign blockbusters blocklist filter
const HOLLYWOOD_BLOCKLIST = /\b(avengers|iron man|captain america|spider-man|spiderman|batman|superman|marvel|fast & furious|jurassic|star wars|transformers|mission: impossible|harry potter|avatar|oppenheimer|barbie|black panther|aquaman|guardians of the galaxy|thor|deadpool|x-men)\b/i;

function isGarbageOrHollywood(title: string, id: string): boolean {
  const t = title.toLowerCase().trim();
  if (t === 'test movie' || t === 'test movieeee' || id.startsWith('test')) return true;
  if (HOLLYWOOD_BLOCKLIST.test(title)) return true;
  return false;
}

function isSkit(item: any): boolean {
  if (item.type === 'youtube_skit') return true;
  if (item.id && item.id.startsWith('skit-')) return true;
  const t = (item.title || '').toLowerCase();
  if (t.includes('skit') || t.includes('short comedy')) return true;
  return false;
}

async function fetchFromGmdb<T>(endpoint: string, retries = 5, delay = 2000): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await new Promise<T>((resolve, reject) => {
        const url = `${GMDB_SUPABASE_URL}${endpoint}`;
        const req = https.get(url, {
          timeout: 15000,
          headers: {
            'apikey': GMDB_ANON_KEY,
            'Authorization': `Bearer ${GMDB_ANON_KEY}`
          }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(e);
            }
          });
        });
        req.on('timeout', () => {
          req.destroy(new Error('Request timed out'));
        });
        req.on('error', reject);
      });
    } catch (err: any) {
      if (attempt === retries) throw err;
      console.warn(`⚠️ [Attempt ${attempt}/${retries}] GMDB fetch (${endpoint}) failed: ${err.message}. Retrying in ${delay / 1000}s...`);
      await sleep(delay);
      delay *= 1.5;
    }
  }
  throw new Error(`Retries exhausted for ${endpoint}`);
}

async function callSupabaseWithRetry<T>(fn: () => Promise<{ data: T | null; error: any }>, retries = 5, delay = 2000): Promise<T | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { data, error } = await fn();
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('fetch failed') || msg.includes('timeout') || error.code === '40001' || error.status === 503) {
          throw error;
        }
        console.error(`❌ DB Error: ${error.message}`);
        return null;
      }
      return data;
    } catch (e: any) {
      if (attempt === retries) throw e;
      console.warn(`⚠️ [Attempt ${attempt}/${retries}] Supabase call failed: ${e.message}. Retrying in ${delay / 1000}s...`);
      await sleep(delay);
      delay *= 1.5;
    }
  }
  throw new Error('Retries exhausted');
}

/**
 * Reconciles an actor adhering to Zero-Duplicate Actor Guarantee
 */
async function upsertPerson(
  rawName: string,
  extra?: { tmdb_id?: number | null; image?: string | null; bio?: string | null; industry?: string; gender?: string; born?: string; is_deceased?: boolean }
): Promise<string | null> {
  const clean = cleanName(rawName);
  if (!clean || clean.length < 2) return null;

  const cacheKey = clean.toLowerCase();
  if (actorCache.has(cacheKey)) {
    return actorCache.get(cacheKey)!;
  }

  // 1. Match by tmdb_id if available
  if (extra?.tmdb_id) {
    if (tmdbPersonCache.has(extra.tmdb_id)) {
      const pid = tmdbPersonCache.get(extra.tmdb_id)!;
      actorCache.set(cacheKey, pid);
      return pid;
    }

    const { data: existingTmdb } = await supabase
      .from('people')
      .select('id, name, photo_url, bio, nationality')
      .eq('tmdb_id', extra.tmdb_id)
      .limit(1);

    if (existingTmdb && existingTmdb.length > 0) {
      const person = existingTmdb[0];
      actorCache.set(cacheKey, person.id);
      tmdbPersonCache.set(extra.tmdb_id, person.id);

      // In-place enrichment
      const updates: any = {};
      if (!person.photo_url && extra.image) {
        updates.photo_url = extra.image;
      }
      if (!person.bio && extra.bio) {
        updates.bio = extra.bio;
      }
      if (!person.nationality) {
        updates.nationality = 'Ghanaian';
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from('people').update(updates).eq('id', person.id);
      }
      return person.id;
    }
  }

  // 2. Check find_person_by_name RPC (handles order swaps, aliases)
  try {
    const { data: foundId } = await supabase.rpc('find_person_by_name', { p_name: clean });
    if (foundId) {
      actorCache.set(cacheKey, foundId);
      if (extra?.tmdb_id) tmdbPersonCache.set(extra.tmdb_id, foundId);

      // Enrich in-place
      const updates: any = {};
      if (extra?.tmdb_id) updates.tmdb_id = extra.tmdb_id;
      if (extra?.image) updates.photo_url = extra.image;
      if (extra?.bio) updates.bio = extra.bio;
      if (Object.keys(updates).length > 0) {
        await supabase.from('people').update(updates).eq('id', foundId);
      }
      return foundId;
    }
  } catch (err: any) {
    // Continue to fallback
  }

  // 3. Fallback exact/ilike match
  const { data: existingName } = await supabase
    .from('people')
    .select('id, photo_url, bio, nationality')
    .ilike('name', clean)
    .limit(1);

  if (existingName && existingName.length > 0) {
    const person = existingName[0];
    actorCache.set(cacheKey, person.id);
    if (extra?.tmdb_id) tmdbPersonCache.set(extra.tmdb_id, person.id);

    const updates: any = {};
    if (extra?.tmdb_id) updates.tmdb_id = extra.tmdb_id;
    if (!person.photo_url && extra?.image) updates.photo_url = extra.image;
    if (!person.bio && extra?.bio) updates.bio = extra.bio;
    if (!person.nationality) updates.nationality = 'Ghanaian';
    if (Object.keys(updates).length > 0) {
      await supabase.from('people').update(updates).eq('id', person.id);
    }
    return person.id;
  }

  // 4. Create new person record
  let photoUrl = extra?.image || null;
  if (photoUrl && (photoUrl.includes('placehold.co') || photoUrl.includes('placeholder') || photoUrl.includes('ui-avatars.com'))) {
    photoUrl = null;
  }
  if (photoUrl && !isOwnUrl(photoUrl) && !photoUrl.includes('image.tmdb.org')) {
    try {
      photoUrl = await mirrorImageToStorage(photoUrl, 'people');
    } catch {
      // Keep original or null
    }
  }

  const { data: newPerson, error: insertErr } = await supabase
    .from('people')
    .insert({
      name: clean,
      nationality: 'Ghanaian',
      tmdb_id: extra?.tmdb_id || null,
      bio: extra?.bio || null,
      photo_url: photoUrl,
      gender: extra?.gender || null,
      is_deceased: extra?.is_deceased || false,
      source: 'ghmoviesdb',
      status: 'community',
      needs_review: false
    })
    .select('id')
    .single();

  if (insertErr || !newPerson) {
    console.error(`    ❌ Failed to insert person "${clean}":`, insertErr?.message);
    return null;
  }

  actorCache.set(cacheKey, newPerson.id);
  if (extra?.tmdb_id) tmdbPersonCache.set(extra.tmdb_id, newPerson.id);
  console.log(`    ✨ Created new Ghanaian actor record: "${clean}" (ID: ${newPerson.id})`);
  return newPerson.id;
}

/**
 * Zero-Duplicate Credit Ingestion
 */
async function attachCredit(filmId: string, personId: string, role: string, characterName?: string | null, billingOrder?: number) {
  // Check if credit row already exists for this person on this film
  const { data: existingCredit } = await supabase
    .from('credits')
    .select('id, role, character_name, billing_order')
    .eq('film_id', filmId)
    .eq('person_id', personId)
    .maybeSingle();

  if (existingCredit) {
    // Enrich in place
    const updates: any = {};
    if (
      (!existingCredit.character_name || existingCredit.character_name === 'Cast Member' || existingCredit.character_name === 'Actor') &&
      characterName &&
      characterName !== 'Cast Member' &&
      characterName !== 'Actor'
    ) {
      updates.character_name = characterName;
    }
    if (billingOrder !== undefined && !existingCredit.billing_order) {
      updates.billing_order = billingOrder;
    }
    if (Object.keys(updates).length > 0) {
      await supabase.from('credits').update(updates).eq('id', existingCredit.id);
    }
    return;
  }

  // Insert single credit row
  await supabase.from('credits').insert({
    film_id: filmId,
    person_id: personId,
    role: role,
    character_name: characterName || null,
    billing_order: billingOrder || null,
    source: 'ghmoviesdb'
  });
}

export async function syncGhanaMovies(options: { dryRun?: boolean; limit?: number; offset?: number } = {}) {
  console.log('🇬🇭 Starting Ghana Movie Database (GMDB) Synchronization...');
  console.log(`   Config: dryRun=${!!options.dryRun}, limit=${options.limit || 'ALL'}, offset=${options.offset || 0}`);

  // 1. Fetch GMDB Actors database to enrich our actor lookup map
  console.log('\n📥 Pre-fetching Ghanaian actors from GMDB...');
  const gmdbActors: any[] = await fetchFromGmdb('/rest/v1/actors?select=*');
  console.log(`   ✓ Found ${gmdbActors.length} Ghanaian actors in GMDB`);

  const gmdbActorByName = new Map<string, any>();
  for (const act of gmdbActors) {
    if (act.name) {
      gmdbActorByName.set(act.name.toLowerCase().trim(), act);
      const clean = cleanName(act.name);
      if (clean) gmdbActorByName.set(clean.toLowerCase(), act);
    }
  }

  // 2. Fetch GMDB Movies (strictly type === 'movie')
  console.log('\n📥 Fetching movies from GMDB (Filtering strictly movies, NO skits)...');
  const allMovies: any[] = await fetchFromGmdb('/rest/v1/movies?type=eq.movie');
  console.log(`   ✓ Found ${allMovies.length} total movie records in GMDB`);

  // Filter out skits, test records, and Hollywood blockbusters
  const validMovies = allMovies.filter(m => {
    if (!m.title || m.title.trim().toLowerCase() === 'untitled') return false;
    if (isSkit(m)) {
      console.log(`   ⏭️ Skipping skit: "${m.title}"`);
      return false;
    }
    if (isGarbageOrHollywood(m.title, m.id)) {
      console.log(`   ⏭️ Skipping test/Hollywood: "${m.title}"`);
      return false;
    }
    return true;
  });

  // Sort by parsed year descending so latest movies are processed first
  validMovies.sort((a, b) => {
    const ya = parseYear(a.releaseDate) || 0;
    const yb = parseYear(b.releaseDate) || 0;
    return yb - ya;
  });

  console.log(`\n🎬 ${validMovies.length} authentic Ghanaian feature films ready for ingestion.`);

  const toProcess = options.limit ? validMovies.slice(options.offset || 0, (options.offset || 0) + options.limit) : validMovies;

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const m = toProcess[i];
    const indexStr = `[${i + 1}/${toProcess.length}]`;
    const year = parseYear(m.releaseDate);
    const runtime = parseRuntime(m.runtime);

    console.log(`\n------------------------------------------------------------`);
    console.log(`${indexStr} Processing: "${m.title}" (${year || 'Year N/A'}) [${m.id}]`);

    if (options.dryRun) {
      console.log(`   [DRY RUN] Would ingest: runtime=${runtime}m, genres=${(m.genres || []).join(', ')}, cast=${(m.cast || []).length}`);
      continue;
    }

    try {
      // 1. Check if film exists in MuviDB
      let existingFilm: any = null;

      // By tmdb_id if present
      if (m.tmdb_id) {
        const { data: byTmdb } = await supabase.from('films').select('*').eq('tmdb_id', m.tmdb_id).limit(1);
        if (byTmdb && byTmdb.length > 0) existingFilm = byTmdb[0];
      }

      // By imdb_id if present
      if (!existingFilm && m.imdb_id) {
        const { data: byImdb } = await supabase.from('films').select('*').eq('imdb_id', m.imdb_id).limit(1);
        if (byImdb && byImdb.length > 0) existingFilm = byImdb[0];
      }

      // By exact title + year
      if (!existingFilm) {
        const { data: byTitle } = await supabase.from('films').select('*').ilike('title', m.title.trim());
        if (byTitle && byTitle.length > 0) {
          if (year) {
            existingFilm = byTitle.find(f => f.year === year) || byTitle.find(f => !f.year) || byTitle[0];
          } else {
            existingFilm = byTitle[0];
          }
        }
      }

      // By fuzzy title match
      if (!existingFilm) {
        const { data: fuzzy } = await supabase.rpc('match_film_fuzzy', { query_title: m.title.trim(), threshold: 0.88 }).maybeSingle();
        if (fuzzy?.id) {
          const { data: fData } = await supabase.from('films').select('*').eq('id', fuzzy.id).single();
          if (fData && (!year || !fData.year || Math.abs(fData.year - year) <= 1)) {
            existingFilm = fData;
            console.log(`   🔍 Fuzzy matched existing film: "${m.title}" ~ "${fData.title}" (ID: ${fData.id})`);
          }
        }
      }

      let filmId: string;

      // Prepare poster and backdrop
      let posterUrl = m.posterImage || null;
      let backdropUrl = m.coverImage || posterUrl;

      // If poster is hosted on GMDB storage or external domain, mirror it
      if (posterUrl && !isOwnUrl(posterUrl) && !posterUrl.includes('image.tmdb.org')) {
        try {
          posterUrl = await mirrorImageToStorage(posterUrl, 'posters');
        } catch {
          // Keep original or null
        }
      }
      if (backdropUrl && !isOwnUrl(backdropUrl) && !backdropUrl.includes('image.tmdb.org')) {
        try {
          backdropUrl = await mirrorImageToStorage(backdropUrl, 'backdrops');
        } catch {
          backdropUrl = posterUrl;
        }
      }

      const genresList = Array.isArray(m.genres) ? m.genres.filter((g: string) => g && g !== 'Kumawood' && g !== 'Ghallywood') : [];
      const streamingLinks = m.streamingLinks || {};

      if (existingFilm) {
        filmId = existingFilm.id;
        console.log(`   ✓ Found existing film (ID: ${filmId})`);

        const updates: any = {};
        const currentCountries = existingFilm.countries || [];
        if (!currentCountries.includes('Ghana')) {
          updates.countries = [...currentCountries, 'Ghana'];
        }

        if (!existingFilm.synopsis && m.plotSummary) updates.synopsis = m.plotSummary;
        if (!existingFilm.year && year) updates.year = year;
        if (!existingFilm.runtime_minutes && runtime) updates.runtime_minutes = runtime;
        if (!existingFilm.poster_url && posterUrl) updates.poster_url = posterUrl;
        if (!existingFilm.backdrop_url && backdropUrl) updates.backdrop_url = backdropUrl;
        if (!existingFilm.tmdb_id && m.tmdb_id) updates.tmdb_id = m.tmdb_id;
        if (!existingFilm.imdb_id && m.imdb_id) updates.imdb_id = m.imdb_id;
        const ytId = extractYouTubeId(m.trailerUrl);
        if (m.trailerUrl && !existingFilm.trailer_external_url) {
          updates.trailer_external_url = m.trailerUrl;
          if (ytId) updates.trailer_youtube_id = ytId;
        }

        // Merge genres
        const currentGenres = existingFilm.genres || [];
        const mergedGenres = Array.from(new Set([...currentGenres, ...genresList]));
        if (mergedGenres.length > currentGenres.length) {
          updates.genres = mergedGenres;
        }

        // Merge streaming links
        if (Object.keys(streamingLinks).length > 0) {
          updates.streaming_links = { ...(existingFilm.streaming_links || {}), ...streamingLinks };
        }

        if (Object.keys(updates).length > 0) {
          await supabase.from('films').update(updates).eq('id', filmId);
          console.log(`   ✓ Enriched existing film metadata in-place`);
        }
        updatedCount++;
      } else {
        // Insert new film record
        console.log(`   ✨ Inserting new Ghanaian film: "${m.title}"`);
        const ytId = extractYouTubeId(m.trailerUrl);
        const { data: newFilm, error: filmErr } = await supabase
          .from('films')
          .insert({
            title: m.title.trim(),
            year: year,
            runtime_minutes: runtime,
            synopsis: m.plotSummary || null,
            poster_url: posterUrl,
            backdrop_url: backdropUrl,
            countries: ['Ghana'],
            genres: genresList,
            source: 'ghmoviesdb',
            source_video_id: `gmdb-${m.id}`,
            streaming_links: streamingLinks,
            trailer_external_url: m.trailerUrl || null,
            trailer_youtube_id: ytId || null,
            status: 'released',
            needs_review: false,
            content_type: 'movie',
            release_type: 'cinema',
            is_nollywood: false,
            tmdb_id: m.tmdb_id || null,
            imdb_id: m.imdb_id || null
          })
          .select('id')
          .single();

        if (filmErr || !newFilm) {
          console.error(`   ❌ Failed to insert film "${m.title}":`, filmErr?.message);
          continue;
        }
        filmId = newFilm.id;
        createdCount++;
      }

      // Reconcile Cast Credits (Zero-Duplicate Guarantee)
      if (Array.isArray(m.cast) && m.cast.length > 0) {
        let billingOrder = 1;
        for (const castMember of m.cast) {
          const rawActorName = typeof castMember === 'string' ? castMember : castMember.name;
          const charName = typeof castMember === 'object' ? castMember.character : null;
          const actorImg = typeof castMember === 'object' ? castMember.image : null;

          if (!rawActorName) continue;

          // Check if we have GMDB actor profile info
          const gmdbActor = gmdbActorByName.get(rawActorName.toLowerCase().trim()) || gmdbActorByName.get(cleanName(rawActorName).toLowerCase());

          const personId = await upsertPerson(rawActorName, {
            tmdb_id: gmdbActor?.tmdb_id || null,
            image: actorImg || gmdbActor?.image || null,
            bio: gmdbActor?.bio || null,
            gender: gmdbActor?.gender || null,
            is_deceased: gmdbActor?.is_deceased || false
          });

          if (personId) {
            await attachCredit(filmId, personId, 'actor', charName, billingOrder++);
          }
        }
        console.log(`   ✓ Ingested ${m.cast.length} cast credits`);
      }

      // Reconcile Directors
      if (Array.isArray(m.directors) && m.directors.length > 0) {
        for (const dirName of m.directors) {
          if (!dirName) continue;
          const gmdbActor = gmdbActorByName.get(dirName.toLowerCase().trim()) || gmdbActorByName.get(cleanName(dirName).toLowerCase());
          const personId = await upsertPerson(dirName, {
            tmdb_id: gmdbActor?.tmdb_id || null,
            image: gmdbActor?.image || null,
            bio: gmdbActor?.bio || null
          });
          if (personId) {
            await attachCredit(filmId, personId, 'director');
          }
        }
        console.log(`   ✓ Ingested ${m.directors.length} director credit(s)`);
      }

      // Reconcile Writers
      if (Array.isArray(m.writers) && m.writers.length > 0) {
        for (const writerName of m.writers) {
          if (!writerName) continue;
          const gmdbActor = gmdbActorByName.get(writerName.toLowerCase().trim()) || gmdbActorByName.get(cleanName(writerName).toLowerCase());
          const personId = await upsertPerson(writerName, {
            tmdb_id: gmdbActor?.tmdb_id || null,
            image: gmdbActor?.image || null,
            bio: gmdbActor?.bio || null
          });
          if (personId) {
            await attachCredit(filmId, personId, 'writer');
          }
        }
        console.log(`   ✓ Ingested ${m.writers.length} writer credit(s)`);
      }

      // Small throttle to be courteous
      await sleep(150);

    } catch (err: any) {
      console.error(`❌ Error syncing "${m.title}":`, err.message);
    }
  }

  console.log('\n============================================================');
  console.log('🎉 GMDB Ingestion Complete!');
  console.log(`   ✨ New Films Created: ${createdCount}`);
  console.log(`   🔄 Films Enriched In-Place: ${updatedCount}`);
  console.log(`   ⏭️ Skipped: ${skippedCount}`);
  console.log('============================================================');
}

// CLI Execution Support
const isDirectRun = process.argv[1]?.includes('ghana_movies_sync');
if (isDirectRun) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : (args.includes('--all') ? undefined : 20);
  const offsetArg = args.find(a => a.startsWith('--offset='));
  const offset = offsetArg ? parseInt(offsetArg.split('=')[1], 10) : 0;

  syncGhanaMovies({ dryRun, limit, offset })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal sync error:', err);
      process.exit(1);
    });
}
