/**
 * One-time local dump of PartyJollof HD posters by streaming platform.
 *
 * Uses cms.partyjolloftv.com (not www — that rejects JSON).
 * Downloads ORIGINAL Uploadthing assets via poster._key (not sizes.og,
 * which is often a 1200x630 landscape social crop).
 *
 * Output: scratch/pj-posters/{platform}/{slug}__{WxH}.{ext}
 *         scratch/pj-posters/manifest.json
 *
 * Run: npx tsx scripts/dump_pj_posters.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'scratch', 'pj-posters');

const CMS = 'https://cms.partyjolloftv.com';
const UFS = 'https://1s8yfxw74q.ufs.sh/f';
const LIMIT = 100;
const DELAY_MS = 250;

const PLATFORMS = [
  'Kava',
  'Netflix',
  'EbonyLife ON Plus',
  'Circuits',
  'YouTube',
  'Prime Video',
] as const;

type Poster = {
  id?: number;
  _key?: string;
  url?: string;
  filename?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  filesize?: number;
  sizes?: Record<string, { _key?: string; url?: string; width?: number; height?: number }>;
};

type FilmDoc = {
  id: number | string;
  title?: string;
  slug?: string;
  releaseDate?: string;
  countryOfOrigin?: string;
  poster?: Poster | null;
  watchAvailability?: {
    streaming?: Array<{ platform?: { name?: string } | string; url?: string }>;
  };
};

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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function platformFolder(name: string) {
  return name.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
}

function safeSlug(text: string) {
  return (text || 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'untitled';
}

function extFromMime(mime?: string, filename?: string) {
  if (filename && /\.(jpe?g|png|webp|gif)$/i.test(filename)) {
    return filename.match(/\.(jpe?g|png|webp|gif)$/i)![0].toLowerCase().replace('jpeg', 'jpg');
  }
  if (mime?.includes('png')) return '.png';
  if (mime?.includes('webp')) return '.webp';
  if (mime?.includes('gif')) return '.gif';
  return '.jpg';
}

async function fetchJSON(url: string, retries = 4): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 30000);
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e: any) {
      if (attempt === retries) throw e;
      await sleep(1000 * attempt);
    }
  }
}

async function downloadBinary(url: string, dest: string, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 45000);
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buf);
      return buf.length;
    } catch (e: any) {
      if (attempt === retries) throw e;
      await sleep(1000 * attempt);
    }
  }
  return 0;
}

async function collectPlatform(platform: string): Promise<FilmDoc[]> {
  const films: FilmDoc[] = [];
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    const params = new URLSearchParams({
      pagination: 'true',
      page: String(page),
      limit: String(LIMIT),
      sort: '-releaseDate',
      depth: '1',
    });
    params.append('where[and][0][watchAvailability.streaming.platform.name][equals]', platform);

    const url = `${CMS}/api/movies?${params.toString()}`;
    const data = await fetchJSON(url);
    const docs: FilmDoc[] = data?.docs || [];
    films.push(...docs);

    console.log(
      `  [${platform}] page ${page}: +${docs.length} (running ${films.length}/${data?.totalDocs ?? '?'})`
    );

    hasNext = Boolean(data?.hasNextPage);
    page += 1;
    await sleep(DELAY_MS);
  }

  return films;
}

function bestPosterKey(poster?: Poster | null): string | null {
  // Prefer original full asset — NOT sizes.og (often 1200x630 landscape crop)
  if (poster?._key) return poster._key;
  if (poster?.sizes?.og?._key) return poster.sizes.og._key;
  if (poster?.sizes?.thumbnail?._key) return poster.sizes.thumbnail._key;
  return null;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const cacheDir = path.join(OUT_DIR, '_cache');
  fs.mkdirSync(cacheDir, { recursive: true });

  const manifest: ManifestRow[] = [];
  const seenKeys = new Map<string, string>(); // posterKey -> cache filepath
  let downloaded = 0;
  let reused = 0;
  let skipped = 0;
  let failed = 0;

  for (const platform of PLATFORMS) {
    console.log(`\n══ ${platform} ══`);
    const folder = path.join(OUT_DIR, platformFolder(platform));
    fs.mkdirSync(folder, { recursive: true });

    let films: FilmDoc[];
    try {
      films = await collectPlatform(platform);
    } catch (e: any) {
      console.error(`  ❌ Failed listing ${platform}:`, e.message);
      continue;
    }

    for (const film of films) {
      const title = (film.title || '').trim() || 'Untitled';
      const slug = safeSlug(film.slug || title);
      const filmId = String(film.id);
      const year = film.releaseDate ? film.releaseDate.slice(0, 4) : null;
      const poster = film.poster;
      const key = bestPosterKey(poster);

      if (!key) {
        skipped++;
        manifest.push({
          platform,
          filmId,
          title,
          slug,
          year,
          country: film.countryOfOrigin || null,
          width: null,
          height: null,
          filesize: null,
          posterKey: '',
          sourceUrl: '',
          localPath: '',
          skipped: 'no-poster',
        });
        continue;
      }

      const w = poster?.width ?? null;
      const h = poster?.height ?? null;
      const ext = extFromMime(poster?.mimeType, poster?.filename);
      const dimTag = w && h ? `__${w}x${h}` : '';
      const destName = `${slug}${dimTag}${ext}`;
      const destPath = path.join(folder, destName);
      const relPath = path.relative(OUT_DIR, destPath).replace(/\\/g, '/');
      const sourceUrl = `${UFS}/${key}`;
      const cachePath = path.join(cacheDir, `${key}${ext}`);

      try {
        if (!seenKeys.has(key)) {
          if (!fs.existsSync(cachePath)) {
            await downloadBinary(sourceUrl, cachePath);
            downloaded++;
            await sleep(DELAY_MS);
          } else {
            reused++;
          }
          seenKeys.set(key, cachePath);
        } else {
          reused++;
        }

        // Copy into platform folder (same film can appear on multiple platforms)
        fs.copyFileSync(seenKeys.get(key)!, destPath);

        manifest.push({
          platform,
          filmId,
          title,
          slug,
          year,
          country: film.countryOfOrigin || null,
          width: w,
          height: h,
          filesize: poster?.filesize ?? null,
          posterKey: key,
          sourceUrl,
          localPath: relPath,
        });
      } catch (e: any) {
        failed++;
        console.warn(`  ⚠ ${title}: ${e.message}`);
        manifest.push({
          platform,
          filmId,
          title,
          slug,
          year,
          country: film.countryOfOrigin || null,
          width: w,
          height: h,
          filesize: poster?.filesize ?? null,
          posterKey: key,
          sourceUrl,
          localPath: '',
          skipped: e.message,
        });
      }
    }
  }

  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  const summary = {
    generatedAt: new Date().toISOString(),
    platforms: PLATFORMS,
    totals: {
      rows: manifest.length,
      withPoster: manifest.filter((m) => m.localPath).length,
      skipped,
      failed,
      uniqueAssetsDownloaded: downloaded,
      cacheHits: reused,
    },
    byPlatform: Object.fromEntries(
      PLATFORMS.map((p) => [
        p,
        {
          total: manifest.filter((m) => m.platform === p).length,
          saved: manifest.filter((m) => m.platform === p && m.localPath).length,
          missing: manifest.filter((m) => m.platform === p && !m.localPath).length,
        },
      ])
    ),
    films: manifest,
  };

  fs.writeFileSync(manifestPath, JSON.stringify(summary, null, 2));

  console.log('\n────────────────────────────────────────');
  console.log(`✅ Dump complete → ${OUT_DIR}`);
  console.log(`   Unique downloads: ${downloaded}`);
  console.log(`   Cache/reuse:      ${reused}`);
  console.log(`   Missing poster:  ${skipped}`);
  console.log(`   Failed:          ${failed}`);
  console.log(`   Manifest:        ${manifestPath}`);
  for (const [name, stats] of Object.entries(summary.byPlatform)) {
    console.log(`   ${name}: ${stats.saved}/${stats.total}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
