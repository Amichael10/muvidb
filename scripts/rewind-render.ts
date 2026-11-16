/**
 * Renders MuviDB Rewind 2026 videos and share stills, uploads them to Supabase
 * Storage, and writes the URLs back onto public.rewind_2026.
 *
 * Usage:
 *   npx tsx scripts/rewind-render.ts                 # every eligible row with no video yet
 *   npx tsx scripts/rewind-render.ts --slug ada-xyz  # one actor
 *   npx tsx scripts/rewind-render.ts --limit 50      # a batch
 *   npx tsx scripts/rewind-render.ts --force         # re-render rows that already have a video
 *   npx tsx scripts/rewind-render.ts --dry-run       # list what would render, touch nothing
 *
 * This NEVER runs on Vercel. It runs locally or in .github/workflows/rewind-render.yml,
 * which is the only place the service-role key is available to it.
 *
 * Why it shells out to the Remotion CLI instead of importing @remotion/renderer:
 * the compositions live in muvidb-launch-video, which has its own node_modules.
 * Installing a second copy of Remotion into the root project costs roughly a
 * gigabyte, and the machine this was built on did not have it. The bundle is
 * built ONCE per run and reused for every actor, so the per-actor cost is the
 * render itself rather than a rebuild.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { supabase } from './lib/db';

// The repo is "type": "module", so __dirname does not exist here.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const REMOTION_PROJECT = path.join(REPO_ROOT, 'muvidb-launch-video');
/**
 * The CLI's real JS entrypoint, not the node_modules/.bin shim.
 *
 * Since the fix for CVE-2024-27980, Node refuses to spawnSync a .cmd/.bat
 * without shell: true, which on Windows fails with EINVAL. Running the script
 * through process.execPath sidesteps that and behaves identically on Linux,
 * where the workflow actually runs.
 */
const REMOTION_CLI = path.join(
  REMOTION_PROJECT,
  'node_modules',
  '@remotion',
  'cli',
  'remotion-cli.js'
);
/**
 * Rewind-only bundle, kept apart from the project's default `build/`.
 *
 * Bundling from src/rewind-entry.ts excludes the actor-alert compositions,
 * which pull ~100 font files from fonts.gstatic.com at module scope on every
 * render. That CDN killed 2 of 3 actors in a test batch while their own
 * renders were fine.
 */
const BUNDLE_DIR = path.join(REMOTION_PROJECT, 'build-rewind');
const BUNDLE_ENTRY = path.join('src', 'rewind-entry.ts');
const BUCKET = 'rewind';
const YEAR = '2026';

/** Everything the compositions read. Must match RewindRow in src/lib/rewind.ts. */
const ROW_COLUMNS = [
  'slug', 'display_name', 'portrait_url', 'films_count', 'plays_count',
  'lead_count', 'support_count', 'lead_known_count', 'total_views',
  'hours_on_screen', 'top_film_title', 'top_film_views', 'top_play_title',
  'box_office_total', 'box_office_currency', 'top_costar_name', 'top_costar_films',
  'top_director_name', 'top_director_films', 'followers', 'percentile',
  'archetype', 'archetype_line', 'poster_urls',
].join(',');

interface Args {
  slug?: string;
  limit: number;
  force: boolean;
  dryRun: boolean;
  concurrency?: number;
  reuseBundle: boolean;
  /** 1-based shard N of M, for splitting a full pass across parallel runs. */
  shard?: { index: number; total: number };
}

function parseArgs(argv: string[]): Args {
  const a: Args = { limit: Number.POSITIVE_INFINITY, force: false, dryRun: false, reuseBundle: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`Missing value after ${arg}`);
      return v;
    };
    if (arg === '--slug') a.slug = next();
    else if (arg === '--limit') a.limit = Math.max(1, parseInt(next(), 10));
    else if (arg === '--concurrency') a.concurrency = Math.max(1, parseInt(next(), 10));
    else if (arg === '--force') a.force = true;
    else if (arg === '--dry-run') a.dryRun = true;
    else if (arg === '--reuse-bundle') a.reuseBundle = true;
    else if (arg === '--shard') {
      const raw = next();
      const m = /^(\d+)\s*\/\s*(\d+)$/.exec(raw.trim());
      if (!m) throw new Error(`--shard expects N/M (e.g. 2/8), got "${raw}"`);
      const index = parseInt(m[1], 10);
      const total = parseInt(m[2], 10);
      if (total < 1 || index < 1 || index > total) {
        throw new Error(`--shard ${raw} is out of range (expected 1..M of M)`);
      }
      a.shard = { index, total };
    } else throw new Error(`Unknown option: ${arg}`);
  }
  return a;
}

/**
 * Postgres numerics arrive from PostgREST as strings, and the compositions do
 * arithmetic on them. Coerce here rather than inside the video.
 */
function toProps(row: Record<string, unknown>) {
  return {
    row: {
      ...row,
      total_views: Number(row.total_views ?? 0),
      top_film_views: row.top_film_views === null ? null : Number(row.top_film_views),
      box_office_total: row.box_office_total === null ? null : Number(row.box_office_total),
      percentile: row.percentile === null ? null : Number(row.percentile),
      poster_urls: Array.isArray(row.poster_urls) ? row.poster_urls : [],
    },
  };
}

function run(args: string[], label: string): void {
  const result = spawnSync(process.execPath, [REMOTION_CLI, ...args], {
    cwd: REMOTION_PROJECT,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    // Remotion's own progress output is noisy per-frame; only failures matter.
    env: { ...process.env, CI: '1' },
  });
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim().split('\n').slice(-12).join('\n');
    throw new Error(`${label} exited ${result.status}\n${stderr}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Runs `fn`, and on failure waits and runs it once more. */
async function withRetry(label: string, fn: () => void): Promise<void> {
  try {
    fn();
  } catch (first) {
    const why = first instanceof Error ? first.message.split('\n')[0] : String(first);
    console.warn(`${label} … retrying after: ${why}`);
    await sleep(5000);
    fn();
  }
}

async function ensureBucket(): Promise<void> {
  const { data, error } = await supabase.storage.getBucket(BUCKET);
  if (data && !error) return;
  console.log(`Creating public storage bucket "${BUCKET}"…`);
  const { error: createError } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: '25MB',
    allowedMimeTypes: ['video/mp4', 'image/png'],
  });
  // A parallel run may have won the race; that is fine.
  if (createError && !/already exists/i.test(createError.message)) throw createError;
}

async function upload(localPath: string, storagePath: string, contentType: string): Promise<string> {
  const body = fs.readFileSync(localPath);
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, body, {
    contentType,
    upsert: true,
    cacheControl: '31536000',
  });
  if (error) throw new Error(`upload ${storagePath}: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let query = supabase.from('rewind_2026').select(ROW_COLUMNS).eq('eligible', true);
  if (args.slug) query = query.eq('slug', args.slug);
  else if (!args.force) query = query.is('video_url', null);
  // Biggest reach first, so a part-finished batch is still the useful half.
  // slug breaks ties so the order is identical across shards and reruns.
  query = query.order('total_views', { ascending: false }).order('slug', { ascending: true });

  const { data, error } = await query;
  if (error) throw new Error(`select: ${error.message}`);
  let rows = (data ?? []) as unknown as Record<string, unknown>[];

  // Shard before limiting: each parallel run takes a disjoint stripe of the
  // same deterministic ordering, so no two runs can claim the same actor.
  if (args.shard) {
    const { index, total } = args.shard;
    rows = rows.filter((_, i) => i % total === index - 1);
    console.log(`Shard ${index}/${total}: ${rows.length} of the matching actors.`);
  }
  if (Number.isFinite(args.limit)) rows = rows.slice(0, args.limit);

  if (rows.length === 0) {
    console.log(
      args.slug
        ? `No eligible rewind_2026 row for slug "${args.slug}".`
        : 'Nothing to render — every eligible row already has a video.'
    );
    return;
  }

  console.log(`${rows.length} actor(s) to render.`);
  if (args.dryRun) {
    rows.forEach((r, i) =>
      console.log(`  ${String(i + 1).padStart(4)}. ${r.slug} — ${r.display_name}`)
    );
    console.log('\n--dry-run: nothing rendered, nothing uploaded.');
    return;
  }

  await ensureBucket();

  if (!args.reuseBundle || !fs.existsSync(BUNDLE_DIR)) {
    console.log('Bundling Rewind compositions once for this run…');
    run(['bundle', BUNDLE_ENTRY, '--out-dir', BUNDLE_DIR], 'remotion bundle');
  } else {
    console.log(`Reusing existing bundle at ${BUNDLE_DIR}`);
  }

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'rewind-'));
  const concurrency = args.concurrency ? ['--concurrency', String(args.concurrency)] : [];
  const failures: { slug: string; reason: string }[] = [];
  let rendered = 0;

  for (const [index, row] of rows.entries()) {
    const slug = String(row.slug);
    const label = `[${index + 1}/${rows.length}] ${slug}`;
    const propsPath = path.join(work, `${slug}.json`);
    const videoPath = path.join(work, `${slug}.mp4`);
    const storyPath = path.join(work, `${slug}-story.png`);
    const feedPath = path.join(work, `${slug}-feed.png`);

    try {
      const startedAt = Date.now();
      fs.writeFileSync(propsPath, JSON.stringify(toProps(row)));

      // One retry: renders fail transiently on a slow poster host or a DNS
      // hiccup, and in an unattended 100-actor batch that should cost a few
      // seconds rather than an actor.
      await withRetry(label, () => {

      // --image-format=png: the project sets JPEG frames globally, which makes
      //   ffmpeg emit yuvj420p (full range) instead of the yuv420p we want.
      // --muted: Remotion otherwise writes a silent AAC track, which also
      //   stretches the container from 14.00s to 14.06s.
        run(
          ['render', BUNDLE_DIR, 'RewindVideo', videoPath,
           '--props', propsPath, '--codec', 'h264', '--pixel-format', 'yuv420p',
           '--image-format', 'png', '--muted', '--log', 'error', ...concurrency],
          `${label} video`
        );
        run(['still', BUNDLE_DIR, 'RewindStory', storyPath, '--props', propsPath, '--log', 'error'], `${label} story`);
        run(['still', BUNDLE_DIR, 'RewindFeed', feedPath, '--props', propsPath, '--log', 'error'], `${label} feed`);
      });

      const base = `${YEAR}/${slug}`;
      const videoUrl = await upload(videoPath, `${base}/video.mp4`, 'video/mp4');
      const storyUrl = await upload(storyPath, `${base}/story.png`, 'image/png');
      const feedUrl = await upload(feedPath, `${base}/feed.png`, 'image/png');

      const { error: updateError } = await supabase
        .from('rewind_2026')
        .update({
          video_url: videoUrl,
          story_png_url: storyUrl,
          feed_png_url: feedUrl,
          rendered_at: new Date().toISOString(),
        })
        .eq('slug', slug);
      if (updateError) throw new Error(`update: ${updateError.message}`);

      const mb = (fs.statSync(videoPath).size / 1024 / 1024).toFixed(1);
      const secs = ((Date.now() - startedAt) / 1000).toFixed(0);
      rendered++;
      console.log(`${label} ✓ ${mb}MB in ${secs}s`);
    } catch (e) {
      // Resumable by design: one bad actor must not end the batch. The row keeps
      // video_url = null, so the next run picks it up again with no bookkeeping.
      const reason = e instanceof Error ? e.message : String(e);
      failures.push({ slug, reason });
      console.error(`${label} ✗ ${reason.split('\n')[0]}`);
    } finally {
      // Delete immediately: 782 actors at ~2.5MB each would otherwise leave
      // 2GB of scratch behind, which is more headroom than the build machine has.
      for (const f of [propsPath, videoPath, storyPath, feedPath]) {
        try {
          fs.rmSync(f, { force: true });
        } catch {
          /* best effort */
        }
      }
    }
  }

  try {
    fs.rmSync(work, { recursive: true, force: true });
  } catch {
    /* best effort */
  }

  console.log(`\nRendered ${rendered}/${rows.length}.`);
  if (failures.length > 0) {
    console.log(`Skipped ${failures.length}:`);
    for (const f of failures) console.log(`  ${f.slug}: ${f.reason.split('\n')[0]}`);
    console.log('\nRe-run without --force to retry only these.');
    // Visible in the Actions UI without failing a batch that mostly worked.
    if (process.env.GITHUB_ACTIONS) {
      console.log(`::warning::${failures.length} actor(s) failed to render and were skipped`);
    }
  }
  // Only a total wipeout is a job failure; partial progress is the normal shape.
  if (rendered === 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack : e);
  process.exit(1);
});
