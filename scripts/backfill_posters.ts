/**
 * backfill_posters.ts
 *
 * Recovers missing / un-mirrored film posters using a fallback ladder:
 *   1. Re-mirror the existing origin poster_url (now with the *source-site* Referer,
 *      which gets past most hotlink protection).
 *   2. If that fails and the film has a tmdb_id, pull the official TMDB poster
 *      (image.tmdb.org is hotlink-friendly + high quality) and mirror that.
 *
 * On success the film's poster_url is rewritten to our own Supabase Storage URL.
 *
 * Usage:
 *   npx tsx scripts/backfill_posters.ts                 # both passes, 500 rows each
 *   npx tsx scripts/backfill_posters.ts --limit 2000
 *   npx tsx scripts/backfill_posters.ts --mode missing  # only TMDB-fill null posters
 *   npx tsx scripts/backfill_posters.ts --mode external # only re-mirror external urls
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const TMDB_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || '';

const db = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || '');

const args = process.argv.slice(2);
const limit = Number(args[args.indexOf('--limit') + 1]) || 500;
const mode = args.includes('--mode') ? args[args.indexOf('--mode') + 1] : 'all';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function sniffImageType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp';
  return null;
}

// Fetch a remote image with the source-site Referer and upload it to Storage.
// Returns the public Supabase URL, or null on failure.
async function mirror(srcUrl: string, bucket: 'posters' | 'backdrops'): Promise<string | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15000);
    let origin = '';
    try { origin = new URL(srcUrl).origin + '/'; } catch { /* ignore */ }
    const res = await fetch(srcUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': origin,
      },
    }).finally(() => clearTimeout(t));

    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 500) return null; // tracking pixel / error page

    // Trust the bytes, not the (often wrong) content-type header.
    const headerCt = res.headers.get('content-type') || '';
    const ct = sniffImageType(buf) || (headerCt.startsWith('image/') ? headerCt : null);
    if (!ct) return null;

    const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : ct.includes('gif') ? 'gif' : 'jpg';
    const name = `${crypto.randomUUID()}.${ext}`;
    const { error } = await db.storage.from(bucket).upload(name, buf, {
      contentType: ct, upsert: true, cacheControl: '31536000',
    });
    if (error) return null;
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${name}`;
  } catch {
    return null;
  }
}

async function tmdbPoster(tmdbId: number): Promise<string | null> {
  if (!TMDB_KEY) return null;
  try {
    const r = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_KEY}`);
    if (!r.ok) return null;
    const data: any = await r.json();
    return data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null;
  } catch {
    return null;
  }
}

let mirrored = 0, fromTmdb = 0, failed = 0;

// Pass 1: re-mirror films whose poster_url is an external (non-Supabase, non-TMDB) URL.
async function passExternal() {
  const { data } = await db
    .from('films')
    .select('id, title, poster_url')
    .not('poster_url', 'is', null)
    .not('poster_url', 'ilike', '%supabase.co%')
    .not('poster_url', 'ilike', '%image.tmdb.org%')
    .limit(limit);

  console.log(`\nPass 1 (re-mirror external): ${data?.length || 0} films`);
  for (const f of data || []) {
    const url = await mirror(f.poster_url, 'posters');
    if (url) {
      await db.from('films').update({ poster_url: url }).eq('id', f.id);
      mirrored++;
    } else {
      failed++;
    }
    await sleep(120);
  }
}

// Pass 2: fill films that have NO poster but do have a tmdb_id.
async function passMissing() {
  const { data } = await db
    .from('films')
    .select('id, title, tmdb_id, poster_url')
    .is('poster_url', null)
    .not('tmdb_id', 'is', null)
    .limit(limit);

  console.log(`\nPass 2 (TMDB fill missing): ${data?.length || 0} films`);
  for (const f of data || []) {
    const tmdbUrl = await tmdbPoster(f.tmdb_id);
    if (tmdbUrl) {
      // Mirror it; if mirroring fails, store the TMDB url directly (still renders).
      const url = (await mirror(tmdbUrl, 'posters')) || tmdbUrl;
      await db.from('films').update({ poster_url: url }).eq('id', f.id);
      fromTmdb++;
    } else {
      failed++;
    }
    await sleep(120);
  }
}

async function run() {
  if (mode === 'all' || mode === 'external') await passExternal();
  if (mode === 'all' || mode === 'missing') await passMissing();
  console.log(`\nDone. mirrored=${mirrored} fromTmdb=${fromTmdb} failed=${failed}`);
}
run();
