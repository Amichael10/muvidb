/**
 * Enrich DB posters from the local PartyJollof dump in scratch/pj-posters/.
 *
 * - Reads manifest.json
 * - Picks the highest-res asset per PJ film id
 * - Matches films by normalized title (+ year when available)
 * - Uploads local files to Supabase Storage `posters`
 * - Updates poster_url when missing or when the current source looks low-res
 *
 * Run:
 *   npx tsx scripts/enrich_from_pj_posters.ts
 *   npx tsx scripts/enrich_from_pj_posters.ts --dry-run
 *   npx tsx scripts/enrich_from_pj_posters.ts --min-width 500
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DUMP_DIR = path.join(ROOT, 'scratch', 'pj-posters');
const MANIFEST_PATH = path.join(DUMP_DIR, 'manifest.json');
const KEEP_EXISTING_WIDTH = 600;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const MIN_WIDTH = Number(args[args.indexOf('--min-width') + 1]) || 400;

type ManifestRow = {
  platform: string;
  filmId: string;
  title: string;
  slug: string;
  year: string | null;
  country: string | null;
  width: number | null;
  height: number | null;
  filesize: number | null;
  posterKey: string;
  sourceUrl: string;
  localPath: string;
  skipped?: string;
};

type FilmRow = {
  id: string;
  title: string;
  year: number | null;
  slug: string | null;
  poster_url: string | null;
  source: string | null;
  release_type: string | null;
  streaming_links: Record<string, unknown> | null;
};

type EnrichStatus =
  | 'no-match'
  | 'skip-pj-too-small'
  | 'keep-existing'
  | 'missing-file'
  | 'dry-run-would-update'
  | 'upload-failed'
  | 'db-update-failed'
  | 'updated';

type ReportRow = {
  title: string;
  status: EnrichStatus;
  year?: string | null;
  platform?: string;
  filmId?: string;
  pjSize?: string;
  existing?: string | null;
  path?: string;
  newUrl?: string;
  previous?: string | null;
  error?: string;
};

type Stats = {
  matched: number;
  updated: number;
  skippedLowRes: number;
  skippedNoMatch: number;
  skippedKeep: number;
  failed: number;
};

const PLATFORM_SOURCE_KEYS: Record<string, string[]> = {
  Kava: ['kava'],
  Netflix: ['netflix'],
  'Prime Video': ['prime_video', 'prime', 'amazon'],
  YouTube: ['youtube'],
  'EbonyLife ON Plus': ['ebonylife', 'ebony'],
  Circuits: ['circuits'],
};

function normalizeTitle(title: string): string {
  return (title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function posterArea(w?: number | null, h?: number | null): number {
  return (w || 0) * (h || 0);
}

function pjSizeTag(pj: ManifestRow): string {
  return `${pj.width}x${pj.height}`;
}

function sniffImageType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return 'image/webp';
  return null;
}

function extFromContentType(ct: string): string {
  if (ct.includes('png')) return 'png';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('gif')) return 'gif';
  return 'jpg';
}

/** Current poster looks like a known low-res / platform-thumb source */
function isLowQualitySource(url: string | null | undefined): boolean {
  if (!url) return true;
  const u = url.toLowerCase();
  if (u.includes('288x424') || u.includes('webposters/')) return true;
  if (u.includes('d3ggjyip6a9ibw.cloudfront.net')) return true; // Kava Muvi CDN
  if (u.includes('i.ytimg.com') || u.includes('img.youtube.com')) return true;
  if (u.includes('media-amazon.com') || u.includes('images-amazon.com')) return true;
  if (u.includes('occ-0-') || u.includes('nflxso.net') || u.includes('netflix')) return true;
  if (/[_-](sx|ux|us)\d{2,3}[_.]/i.test(u)) return true; // amazon size tokens
  return false;
}

function platformSourceKeys(platform: string): string[] {
  return PLATFORM_SOURCE_KEYS[platform] || [platform.toLowerCase().replace(/\s+/g, '_')];
}

function filmTouchesPlatform(film: FilmRow, platform: string): boolean {
  const keys = platformSourceKeys(platform);
  const src = `${film.source || ''} ${film.release_type || ''}`.toLowerCase();
  if (keys.some((k) => src.includes(k))) return true;

  const links = film.streaming_links;
  if (!links || typeof links !== 'object') return false;

  const linkKeys = Object.keys(links).map((k) => k.toLowerCase());
  const linkVals = Object.values(links).map((v) => String(v || '').toLowerCase());
  const platformLower = platform.toLowerCase();
  return keys.some(
    (k) =>
      linkKeys.some((lk) => lk.includes(k)) ||
      linkVals.some((lv) => lv.includes(k) || lv.includes(platformLower))
  );
}

function scoreMatch(film: FilmRow, pj: ManifestRow): number {
  let score = 10;
  if (pj.year && film.year && String(film.year) === pj.year) score += 50;
  if (filmTouchesPlatform(film, pj.platform)) score += 30;
  if (isLowQualitySource(film.poster_url)) score += 20;
  if (!film.poster_url) score += 25;
  return score;
}

function skipReason(film: FilmRow, pj: ManifestRow): 'skip-pj-too-small' | 'keep-existing' | null {
  const width = pj.width || 0;
  const lowSrc = isLowQualitySource(film.poster_url);

  if (width < MIN_WIDTH && !lowSrc && film.poster_url) {
    return 'skip-pj-too-small';
  }
  if (film.poster_url && !lowSrc && width < KEEP_EXISTING_WIDTH) {
    return 'keep-existing';
  }
  return null;
}

function indexFilmsByTitle(films: FilmRow[]): Map<string, FilmRow[]> {
  const byNorm = new Map<string, FilmRow[]>();
  for (const film of films) {
    const key = normalizeTitle(film.title);
    if (!key) continue;
    const bucket = byNorm.get(key);
    if (bucket) bucket.push(film);
    else byNorm.set(key, [film]);
  }
  return byNorm;
}

function pickBestPerFilmId(rows: ManifestRow[]): ManifestRow[] {
  const best = new Map<string, ManifestRow>();
  for (const row of rows) {
    if (!row.localPath || !row.posterKey) continue;
    const prev = best.get(row.filmId);
    if (!prev || posterArea(row.width, row.height) > posterArea(prev.width, prev.height)) {
      best.set(row.filmId, row);
    }
  }
  return [...best.values()];
}

function readManifestRows(): ManifestRow[] {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`❌ Missing manifest: ${MANIFEST_PATH}`);
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  return (manifest.films || []).filter((f: ManifestRow) => f.localPath);
}

async function uploadLocalPoster(localAbs: string, filmId: string): Promise<string | null> {
  const buf = fs.readFileSync(localAbs);
  if (buf.byteLength < 500) return null;
  const ct = sniffImageType(buf);
  if (!ct) return null;

  const name = `pj-${filmId}.${extFromContentType(ct)}`;
  const { error } = await db.storage.from('posters').upload(name, buf, {
    contentType: ct,
    upsert: true,
    cacheControl: '31536000',
  });
  if (error) {
    console.warn(`  upload fail ${name}: ${error.message}`);
    return null;
  }
  return `${SUPABASE_URL}/storage/v1/object/public/posters/${name}`;
}

async function loadAllFilms(): Promise<FilmRow[]> {
  const pageSize = 1000;
  let from = 0;
  const all: FilmRow[] = [];
  for (;;) {
    const { data, error } = await db
      .from('films')
      .select('id, title, year, slug, poster_url, source, release_type, streaming_links')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...(data as FilmRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function enrichPoster(
  pj: ManifestRow,
  byNorm: Map<string, FilmRow[]>,
  stats: Stats,
  report: ReportRow[]
): Promise<void> {
  const candidates = byNorm.get(normalizeTitle(pj.title)) || [];
  if (!candidates.length) {
    stats.skippedNoMatch++;
    report.push({ title: pj.title, year: pj.year, platform: pj.platform, status: 'no-match' });
    return;
  }

  stats.matched++;
  candidates.sort((a, b) => scoreMatch(b, pj) - scoreMatch(a, pj));
  const film = candidates[0];
  const skip = skipReason(film, pj);

  if (skip === 'skip-pj-too-small') {
    stats.skippedLowRes++;
    report.push({
      title: pj.title,
      filmId: film.id,
      status: skip,
      pjSize: pjSizeTag(pj),
      existing: film.poster_url,
    });
    return;
  }

  if (skip === 'keep-existing') {
    stats.skippedKeep++;
    report.push({
      title: pj.title,
      filmId: film.id,
      status: skip,
      pjSize: pjSizeTag(pj),
      existing: film.poster_url,
    });
    return;
  }

  const abs = path.join(DUMP_DIR, pj.localPath);
  if (!fs.existsSync(abs)) {
    stats.failed++;
    report.push({ title: pj.title, status: 'missing-file', path: pj.localPath });
    return;
  }

  if (DRY_RUN) {
    stats.updated++;
    report.push({
      title: pj.title,
      filmId: film.id,
      status: 'dry-run-would-update',
      pjSize: pjSizeTag(pj),
      existing: film.poster_url,
      platform: pj.platform,
    });
    return;
  }

  const publicUrl = await uploadLocalPoster(abs, film.id);
  if (!publicUrl) {
    stats.failed++;
    report.push({ title: pj.title, filmId: film.id, status: 'upload-failed' });
    return;
  }

  const { error } = await db.from('films').update({ poster_url: publicUrl }).eq('id', film.id);
  if (error) {
    stats.failed++;
    report.push({ title: pj.title, filmId: film.id, status: 'db-update-failed', error: error.message });
    return;
  }

  stats.updated++;
  console.log(`  ✓ ${film.title} ← ${pjSizeTag(pj)} (${pj.platform})`);
  report.push({
    title: pj.title,
    filmId: film.id,
    status: 'updated',
    pjSize: pjSizeTag(pj),
    newUrl: publicUrl,
    previous: film.poster_url,
    platform: pj.platform,
  });
}

function writeReport(stats: Stats, report: ReportRow[]): string {
  const reportPath = path.join(DUMP_DIR, 'enrich-report.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        dryRun: DRY_RUN,
        minWidth: MIN_WIDTH,
        stats: {
          matched: stats.matched,
          updated: stats.updated,
          skippedNoMatch: stats.skippedNoMatch,
          skippedLowRes: stats.skippedLowRes,
          skippedKeep: stats.skippedKeep,
          failed: stats.failed,
        },
        rows: report,
      },
      null,
      2
    )
  );
  return reportPath;
}

async function main() {
  const rows = readManifestRows();
  const unique = pickBestPerFilmId(rows);

  console.log(`📦 Manifest posters: ${rows.length} rows → ${unique.length} unique films`);
  console.log(`   min-width gate: ${MIN_WIDTH} · dry-run: ${DRY_RUN}`);

  console.log('\n📥 Loading films from DB...');
  const films = await loadAllFilms();
  console.log(`   ${films.length} films loaded`);

  const byNorm = indexFilmsByTitle(films);
  const stats: Stats = {
    matched: 0,
    updated: 0,
    skippedLowRes: 0,
    skippedNoMatch: 0,
    skippedKeep: 0,
    failed: 0,
  };
  const report: ReportRow[] = [];

  for (const pj of unique) {
    await enrichPoster(pj, byNorm, stats, report);
  }

  const reportPath = writeReport(stats, report);

  console.log('\n────────────────────────────────────────');
  console.log(`Matched titles:     ${stats.matched}`);
  console.log(`Updated posters:    ${stats.updated}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`No DB match:        ${stats.skippedNoMatch}`);
  console.log(`PJ too small:       ${stats.skippedLowRes}`);
  console.log(`Kept existing:      ${stats.skippedKeep}`);
  console.log(`Failed:             ${stats.failed}`);
  console.log(`Report: ${reportPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
