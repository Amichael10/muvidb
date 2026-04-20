/**
 * Data Enrichment Script — naijawood_master.xlsx → Supabase
 *
 * Reads every sheet from the master spreadsheet and upserts the data
 * to Supabase using the existing UUIDs. Safe to run multiple times —
 * existing records are updated (not duplicated), missing records are inserted.
 *
 * Run:  npx tsx scripts/enrich-from-master.ts
 *
 * Requires .env with:
 *   SUPABASE_URL (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import XLSXDefault from 'xlsx';
const XLSX = XLSXDefault as any;
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { existsSync } from 'fs';
const _masterCandidates = [
  path.resolve(__dirname, '../src/data/naijawood_master.xlsx'),
  path.resolve(__dirname, '../../src/data/naijawood_master.xlsx'),
  path.resolve(process.cwd(), 'src/data/naijawood_master.xlsx'),
  'C:/Users/User/lumi/src/data/naijawood_master.xlsx',
];
const MASTER_PATH_RESOLVED = _masterCandidates.find(p => existsSync(p)) ?? _masterCandidates[0];
const BATCH_SIZE = 200;

const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ────────────────────────────────────────────────────────────────

function readSheet<T = Record<string, unknown>>(wb: XLSX.WorkBook, name: string): T[] {
  const ws = wb.Sheets[name];
  if (!ws) { console.warn(`  Sheet "${name}" not found — skipping`); return []; }
  return XLSX.utils.sheet_to_json<T>(ws, { defval: null });
}

function clean(val: unknown): unknown {
  if (val === '' || val === undefined) return null;
  if (typeof val === 'string') return val.trim() || null;
  return val;
}

function cleanRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, clean(v)]));
}

async function upsertBatched(
  table: string,
  rows: Record<string, unknown>[],
  conflictCol = 'id'
) {
  let done = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).upsert(batch, { onConflict: conflictCol });
    if (error) console.error(`  [${table}] batch ${i / BATCH_SIZE + 1} error:`, error.message);
    done += batch.length;
  }
  console.log(`  ✓ ${table}: ${done} rows upserted`);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('Reading master spreadsheet from:', MASTER_PATH_RESOLVED);
  const wb = XLSX.readFile(MASTER_PATH_RESOLVED);
  console.log('Sheets found:', wb.SheetNames.join(', '));
  console.log();

  // ── Films ──────────────────────────────────────────────────────────────
  console.log('▸ Films');
  const VALID_STATUS = ['released', 'pre-production', 'production', 'post-production', 'cancelled'];
  const films = readSheet<any>(wb, 'Films').map(r => {
    const c = cleanRow(r);
    if (!c.id) return null;
    // Skip rows missing year (NOT NULL in some DBs); default language
    const year = c.year ? Number(c.year) : null;
    const language = (c.language as string) || 'English';
    // Normalise status to valid enum values
    let status = (c.status as string) || 'released';
    if (!VALID_STATUS.includes(status)) status = 'released';
    return {
      id:                 c.id,
      title:              c.title,
      year,
      runtime_minutes:    c.runtime_minutes ? Number(c.runtime_minutes) : null,
      language,
      status,
      release_type:       c.release_type,
      synopsis:           c.synopsis,
      tagline:            c.tagline,
      poster_url:         c.poster_url,
      backdrop_url:       c.backdrop_url,
      trailer_youtube_id: c.trailer_youtube_id,
      is_featured:        c.is_featured === 't' || c.is_featured === true,
      is_trending:        c.is_trending === 't' || c.is_trending === true,
      tmdb_id:            c.tmdb_id ? Number(c.tmdb_id) : null,
      tmdb_rating:        c.tmdb_rating ? Number(c.tmdb_rating) : null,
    };
  }).filter(Boolean) as Record<string, unknown>[];
  await upsertBatched('films', films);

  // ── People ─────────────────────────────────────────────────────────────
  console.log('▸ People');
  const people = readSheet<any>(wb, 'People').map(r => {
    const c = cleanRow(r);
    if (!c.id) return null;
    return {
      id:                    c.id,
      name:                  c.name,
      biography:             c.biography,   // added via setup-youtube.sql
      photo_url:             c.photo_url,
      known_for_department:  c.known_for_department,
      popularity_score:      c.popularity_score ? Number(c.popularity_score) : null,
      is_spotlight:          c.is_spotlight === 't' || c.is_spotlight === true,
      birth_date:            c.birth_date,
      birthplace:            c.birthplace,
    };
  }).filter(Boolean) as Record<string, unknown>[];
  await upsertBatched('people', people);

  // ── Credits ────────────────────────────────────────────────────────────
  console.log('▸ Credits');
  const credits = readSheet<any>(wb, 'Credits').map(r => {
    const c = cleanRow(r);
    if (!c.id || !c.film_id || !c.person_id) return null;
    return {
      id:             c.id,
      film_id:        c.film_id,
      person_id:      c.person_id,
      role:           c.role,
      character_name: c.character_name,
      billing_order:  c.billing_order != null ? Number(c.billing_order) : 0,
    };
  }).filter(Boolean) as Record<string, unknown>[];
  await upsertBatched('credits', credits);

  // ── Channels ───────────────────────────────────────────────────────────
  console.log('▸ Channels');
  const channels = readSheet<any>(wb, 'Channels').map(r => {
    const c = cleanRow(r);
    return {
      id:                     c.id,
      name:                   c.name,
      channel_handle:         c.channel_handle,
      channel_url:            c.channel_url,
      description:            c.description,
      category:               c.category,
      country:                c.country,
      subscriber_count:       c.subscriber_count ? Number(c.subscriber_count) : null,
      thumbnail_url:          c.thumbnail_url,
      banner_url:             c.banner_url,
      is_featured:            c.is_featured === 't' || c.is_featured === true,
      owner_person_id:        c.owner_person_id,
      owner_name:             c.owner_name,
      videos_last_fetched_at: c.videos_last_fetched_at,
    };
  }).filter(r => r.id);
  await upsertBatched('channels', channels);

  // ── Channel_Owners (people → channels) ────────────────────────────────
  console.log('▸ Channel_Owners → updating channels.owner_person_id');
  const owners = readSheet<any>(wb, 'Channel_Owners');
  for (const o of owners) {
    if (!o.channel_id || !o.person_id) continue;
    await supabase
      .from('channels')
      .update({ owner_person_id: o.person_id, owner_name: o.person_name || null })
      .eq('id', o.channel_id);
  }
  console.log(`  ✓ channel_owners: ${owners.length} rows processed`);

  // ── Channel_Videos ─────────────────────────────────────────────────────
  console.log('▸ Channel_Videos');
  const videos = readSheet<any>(wb, 'Channel_Videos').map(r => {
    const c = cleanRow(r);
    if (!c.id || !c.channel_id || !c.video_id) return null;
    return {
      id:               c.id,
      channel_id:       c.channel_id,
      video_id:         c.video_id,
      title:            c.title,
      thumbnail_url:    c.thumbnail_url,
      published_at:     c.published_at,
      duration_seconds: c.duration_seconds ? Number(c.duration_seconds) : null,
      film_id:          c.film_id || null,
      match_status:     c.match_status || 'unmatched',
      // match_confidence added via setup-youtube.sql migration — omit until applied
      // match_confidence: c.match_confidence ? Number(c.match_confidence) : null,
    };
  }).filter(Boolean) as Record<string, unknown>[];
  await upsertBatched('channel_videos', videos);

  // ── Cinemas ────────────────────────────────────────────────────────────
  console.log('▸ Cinemas');
  const cinemas = readSheet<any>(wb, 'Cinemas').map(r => {
    const c = cleanRow(r);
    if (!c.id) return null;
    return {
      id:          c.id,
      name:        c.name,
      city:        c.city,
      location:    c.location,
      is_active:   c.is_active === 't' || c.is_active === true,
      // booking_url added via setup-youtube.sql migration — include once applied
      // booking_url: c.booking_url,
    };
  }).filter(Boolean) as Record<string, unknown>[];
  await upsertBatched('cinemas', cinemas);

  // ── Film_Watch_Links ───────────────────────────────────────────────────
  console.log('▸ Film_Watch_Links');
  const watchLinks = readSheet<any>(wb, 'Film_Watch_Links').map(r => {
    const c = cleanRow(r);
    if (!c.url || typeof c.url !== 'string') return null;
    // Normalise dirty distributor values
    const raw = (c.distributor as string || '').toLowerCase();
    let distributor = c.distributor as string;
    if (raw.includes('youtube')) distributor = 'YouTube';
    else if (raw.includes('netflix')) distributor = 'Netflix';
    else if (raw.includes('prime') || raw.includes('amazon')) distributor = 'Prime Video';
    else if (raw.includes('showmax')) distributor = 'Showmax';
    else if (raw.includes('cinema')) distributor = 'Cinema';
    else if (raw.includes('tv')) distributor = 'TV';
    return {
      id:          c.id,
      film_id:     c.film_id,
      distributor,
      url:         (c.url as string).trim(),
    };
  }).filter(Boolean) as Record<string, unknown>[];
  await upsertBatched('film_watch_links', watchLinks);

  console.log('\n✅ Enrichment complete.');
}

main().catch(err => { console.error(err); process.exit(1); });
