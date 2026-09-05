/**
 * Headless credit-roll harvester. Runs unattended on a spare machine.
 *
 *   npx tsx scripts/harvest_credits.ts --enqueue-sparse     # films with < 4 credits (MAIN)
 *   npx tsx scripts/harvest_credits.ts --enqueue-sparse=2   # films with < 2 credits
 *   npx tsx scripts/harvest_credits.ts --enqueue-recon      # 3 films/channel (recon)
 *   npx tsx scripts/harvest_credits.ts --enqueue-popular=2000
 *   npx tsx scripts/harvest_credits.ts --enqueue-latest-sparse=1000 # seed newest frontend-order YouTube films
 *   npx tsx scripts/harvest_credits.ts --requeue-low-coverage=12
 *   npx tsx scripts/harvest_credits.ts                      # run the worker loop
 *   npx tsx scripts/harvest_credits.ts --reharvest-existing  # second pass; append new, skip duplicates
 *   npx tsx scripts/harvest_credits.ts --once               # single job (debugging)
 *   npx tsx scripts/harvest_credits.ts --film=<uuid> --keep  # one film, keep frames
 *
 * WHY THIS SHAPE (see docs/WORK_LOG.md):
 *  - Nollywood YouTube films aren't on IMDB and their descriptions are hashtag
 *    spam, so the end-of-video credit roll is the only full cast/crew source.
 *  - Vision-LLM on sampled frames is expensive and hallucinates cast from
 *    end-of-video adverts. Here ffmpeg finds the roll and LOCAL OCR reads it —
 *    no image tokens at all.
 *  - Only the tail of the video is downloaded, at low resolution.
 *  - Nothing is written to `credits`. Everything lands in credit_candidates for
 *    human approval in the admin UI.
 *
 * PREREQS on the worker machine: yt-dlp, ffmpeg, ffprobe, tesseract (all on PATH).
 */
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, rm, readdir, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { supabase } from './lib/db';
import {
  consolidateCreditObservations,
  type CreditObservation,
} from './lib/credit_roll_parser';
import { parseCreditFrameWithOcr } from './lib/credit_frame_ocr';

if (process.platform === 'win32') {
  const extraPaths = [
    'C:\\Program Files\\Tesseract-OCR',
    join(process.env.LOCALAPPDATA || '', 'Programs\\Tesseract-OCR'),
    join(process.env.APPDATA || '', 'Python\\Python313\\Scripts'),
    join(process.env.LOCALAPPDATA || '', 'Programs\\Python\\Python313\\Scripts'),
    'C:\\Python313\\Scripts',
    join(process.cwd(), '.local-clipper-venv\\Scripts'),
    'C:\\ffmpeg\\ffmpeg-8.1.1-essentials_build\\bin',
    'C:\\ffmpeg\\bin',
  ].filter((p) => p && existsSync(p));

  if (extraPaths.length > 0) {
    process.env.PATH = `${extraPaths.join(';')};${process.env.PATH || ''}`;
  }
}

const run = promisify(execFile);

const arg = (n: string) => {
  const index = process.argv.findIndex((a) => a === `--${n}` || a.startsWith(`--${n}=`));
  if (index === -1) return undefined;
  const hit = process.argv[index];
  const eq = hit.indexOf('=');
  if (eq !== -1) return hit.slice(eq + 1);
  const next = process.argv[index + 1];
  if (next && !next.startsWith('--')) return next;
  return 'true';
};

function numberSetting(name: string, envName: string, fallback: number) {
  const raw = arg(name) ?? process.env[envName];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

// Credit rolls sit in the final minutes. Use explicit positive timestamps for
// --download-sections; the negative form (`*-300-inf`) produced empty stubs on
// this source even though yt-dlp exited successfully.
const TAIL_SECONDS = Number(arg('tail')) || 240; // last 4 min default (override: --tail=180 for 3 min)
const MIN_ENTRIES = 4;          // structural gate: fewer than this isn't a roll
const MIN_ACTOR_CANDIDATES = Math.max(0, Math.floor(numberSetting('min-actors', 'CREDIT_HARVEST_MIN_ACTORS', 3)));
const ALLOW_CREW_ONLY = arg('allow-crew-only') !== undefined || process.env.CREDIT_HARVEST_ALLOW_CREW_ONLY === '1';
const FRAME_EVERY_SEC = Number(arg('frame-every')) || 1; // sample cadence inside the tail
const SINGLE_FRAME_MIN_OCR_CONFIDENCE = Number(arg('single-frame-min-ocr')) || 0.65;
const REHARVEST_EXISTING = arg('reharvest-existing') !== undefined;
const YTDLP_TIMEOUT = 900_000;  // 15 min ceiling for a throttled tail
const DEFAULT_VIDEO_FORMAT =
  '18/134/135/bestvideo[height<=480][vcodec^=avc1]/bestvideo[height<=480]/best[height<=480]/136/best';
const VIDEO_FORMAT = arg('format') ?? process.env.YTDLP_FORMAT ?? DEFAULT_VIDEO_FORMAT;
const AUTO_ENQUEUE_LATEST_LIMIT = Math.max(0, Math.floor(numberSetting('auto-enqueue-latest', 'CREDIT_HARVEST_AUTO_ENQUEUE_LATEST', 1000)));
const AUTO_ENQUEUE_MIN_CREDITS = Math.max(0, Math.floor(numberSetting('auto-enqueue-min-credits', 'CREDIT_HARVEST_AUTO_ENQUEUE_MIN_CREDITS', 4)));
const SKIP_AUTO_ENQUEUE = arg('skip-auto-enqueue') !== undefined;
const WORKER_CHILD = arg('worker-child') !== undefined;
const WORKER_COUNT = Math.max(1, Math.floor(numberSetting('workers', 'CREDIT_HARVEST_WORKERS', 2)));

/**
 * Anything at/after these markers is promo, not credits. This is the direct fix
 * for "it scrapes actor names out of the advert for the next movie" — those
 * blocks are discarded wholesale rather than mined for names.
 */
const STOP_MARKERS = [
  'coming soon', 'next week', 'next on', 'watch part', 'part 2 loading',
  'to be continued', 'subscribe', 'like and share', 'don\'t forget to',
  'click the link', 'bell icon', 'turn on notification', 'now showing',
  'stay tuned', 'up next', 'trailer',
];

/** Lines that are structure/noise, never a person's name. */
const NOISE_LINE = /^(the end|end|thanks for watching|©|copyright|all rights|www\.|http|@|#|\d+$)/i;

/** Role labels that mark a real credit line ("DIRECTOR: X", "Produced by Y"). */
const ROLE_HINT =
  /\b(directed|produced|written|screenplay|story|editor|edited|camera|cinematograph|dop|d\.o\.p|sound|music|makeup|make-up|costume|wardrobe|continuity|starring|featuring|cast|crew|production manager|executive|assistant|art director|location)\b/i;

// These channels routinely append adverts/promos, so skip them in automation.
const IGNORED_CHANNEL_PATTERNS = [/apatatv/i, /yorubahood/i];
function ignoredChannel(name: string | null | undefined): boolean {
  return !!name && IGNORED_CHANNEL_PATTERNS.some((pattern) => pattern.test(name));
}

type Job = {
  // null in --film debug mode: there's no queue row, and job_id is a FK, so it
  // must be null rather than a fabricated uuid (which would fail the constraint).
  id: string | null;
  film_id: string;
  channel_id: string | null;
  attempts: number;
};

type FilmSnapshot = {
  id: string;
  title: string | null;
  youtube_watch_url: string | null;
  runtime_minutes: number | null;
  synopsis: string | null;
  year: number | null;
  language: string | null;
  languages: string[] | null;
  nfvcb_rating: string | null;
};

type YoutubeMetadata = {
  title?: string;
  fulltitle?: string;
  description?: string;
  channel?: string;
  uploader?: string;
  webpage_url?: string;
};

type WorkerStatus =
  | 'starting'
  | 'idle'
  | 'running'
  | 'paused'
  | 'cooling_down'
  | 'stopping'
  | 'stopped'
  | 'failed';

type WorkerLogLevel = 'info' | 'success' | 'warning' | 'error';

const WORKER_MACHINE = hostname() || 'unknown-machine';
const WORKER_ID = `${WORKER_MACHINE}-${process.pid}-${Date.now().toString(36)}`;
const WORKER_STARTED_AT = new Date().toISOString();
const HEARTBEAT_MS = 15_000;
const PAUSE_POLL_MS = 5_000;

let workerStatus: WorkerStatus = 'starting';
let workerMessage = 'Worker is starting';
let workerProcessed = 0;
let workerFailures = 0;
let activeJobId: string | null = null;
let activeFilmId: string | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatBusy = false;
let stopRequested = false;
let monitorWarningShown = false;
let supervisorStopAll: ((signal: NodeJS.Signals, requested?: boolean) => void) | null = null;
function isTransientSupabaseError(error: unknown) {
  const message = String(error instanceof Error ? error.message : error).toLowerCase();
  return [
    'fetch failed',
    'upstream request timeout',
    'timeout',
    'cloudflare',
    '522',
    'connection terminated',
    'pgrst002',
  ].some((needle) => message.includes(needle));
}

function monitorWarning(label: string, error: unknown) {
  if (monitorWarningShown) return;
  monitorWarningShown = true;
  console.warn(`   ⚠️  Worker monitor ${label} failed; harvesting will continue: ${String(error)}`);
}

async function writeWorkerRow() {
  const dbStatus = (workerStatus as string) === 'cooling_down' ? 'idle' : workerStatus;
  const { error } = await supabase
    .from('credit_harvest_workers')
    .upsert({
      worker_id: WORKER_ID,
      machine_name: WORKER_MACHINE,
      process_id: process.pid,
      status: dbStatus,
      current_job_id: activeJobId,
      current_film_id: activeFilmId,
      processed_count: workerProcessed,
      failure_count: workerFailures,
      last_message: workerMessage,
      started_at: WORKER_STARTED_AT,
      last_seen_at: new Date().toISOString(),
      stopped_at: ['stopped', 'failed'].includes(workerStatus)
        ? new Date().toISOString()
        : null,
    }, { onConflict: 'worker_id' });
  if (error) throw new Error(error.message);
}

async function heartbeat() {
  if (heartbeatBusy) return;
  heartbeatBusy = true;
  try {
    await writeWorkerRow();
    if (activeJobId) {
      const { error } = await supabase
        .from('credit_harvest_jobs')
        .update({
          heartbeat_at: new Date().toISOString(),
          worker_id: WORKER_ID,
        })
        .eq('id', activeJobId)
        .eq('status', 'running');
      if (error) throw new Error(error.message);
    }
    monitorWarningShown = false;
  } catch (error) {
    monitorWarning('heartbeat', error);
  } finally {
    heartbeatBusy = false;
  }
}

async function setWorkerActivity(
  status: WorkerStatus,
  message: string,
  job?: Job | null,
) {
  workerStatus = status;
  workerMessage = message;
  if (job !== undefined) {
    activeJobId = job?.id || null;
    activeFilmId = job?.film_id || null;
  }
  await heartbeat();
}

async function writeWorkerLog(
  level: WorkerLogLevel,
  eventType: string,
  message: string,
  job?: Job | null,
  details?: Record<string, unknown>,
) {
  try {
    const { error } = await supabase
      .from('credit_harvest_logs')
      .insert({
        worker_id: WORKER_ID,
        level,
        event_type: eventType,
        message,
        job_id: job?.id || null,
        film_id: job?.film_id || null,
        details: details || null,
      });
    if (error) throw new Error(error.message);
  } catch (error) {
    monitorWarning('log write', error);
  }
}

function startHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => { void heartbeat(); }, HEARTBEAT_MS);
}

function stopHeartbeat() {
  if (!heartbeatTimer) return;
  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

async function isHarvestPaused() {
  const { data, error } = await supabase
    .from('credit_harvest_control')
    .select('paused')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw new Error(`read pause state: ${error.message}`);
  return data?.paused === true;
}

async function waitInterruptibly(milliseconds: number) {
  const deadline = Date.now() + milliseconds;
  while (!stopRequested && Date.now() < deadline) {
    await new Promise((resolveWait) => {
      setTimeout(resolveWait, Math.min(1000, Math.max(0, deadline - Date.now())));
    });
  }
}

function requestGracefulStop(signal: string) {
  if (stopRequested) return;
  stopRequested = true;
  workerStatus = 'stopping';
  workerMessage = activeJobId
    ? `Stopping after the current movie (${signal})`
    : `Stopping before the next movie (${signal})`;
  console.log(`\n🛑 ${workerMessage}`);
  void heartbeat();
  void writeWorkerLog('warning', 'stop_requested', workerMessage);
}

process.on('SIGINT', () => {
  if (supervisorStopAll) supervisorStopAll('SIGINT', true);
  else requestGracefulStop('Ctrl-C');
});
process.on('SIGTERM', () => {
  if (supervisorStopAll) supervisorStopAll('SIGTERM', true);
  else requestGracefulStop('termination signal');
});

// Cookies are what UNLOCK the good (un-throttled, non-DRM) formats — a prior
// recon found guest downloads get only a throttled android_vr stream (~7 KiB/s),
// tv formats are DRM'd, and ios needs a PO token. Pass a Netscape cookies.txt
// via --cookies=<path> (or COOKIES_FILE/YT_COOKIES env), or pull from a browser
// via --cookies-from-browser=chrome|edge|firefox.
const configuredCookies = arg('cookies') ?? process.env.COOKIES_FILE ?? process.env.YT_COOKIES;
// Prefer the repository's checked-out cookie file when no explicit path is
// supplied. This keeps the worker reproducible on a fresh laptop while still
// allowing --cookies or an environment variable to override it.
const COOKIES_FILE = configuredCookies || [
  resolve(process.cwd(), 'Cookies.txt'),
  resolve(process.cwd(), 'cookies.txt'),
  resolve(process.cwd(), 'cookies.txt.txt'),
  resolve(process.cwd(), 'services/media-extractor/cookies.txt'),
].find((path) => existsSync(path));
const COOKIES_BROWSER = arg('cookies-from-browser');
function cookieArgs(): string[] {
  if (COOKIES_FILE) return ['--cookies', COOKIES_FILE];
  if (COOKIES_BROWSER) return ['--cookies-from-browser', COOKIES_BROWSER];
  return [];
}

// Player client. yt-dlp's automatic choice can drift to android_vr, whose
// signed googlevideo URLs are currently rejected with HTTP 403 during tail cuts.
// Desktop web can expose only storyboards for some videos. Mobile web usually
// gives a stable progressive MP4 that is enough for OCR. Use --client=default
// or --client=auto to let yt-dlp choose, or override with --client=web.
const configuredClient = arg('client') ?? process.env.YTDLP_YOUTUBE_CLIENT;
const YT_CLIENT = !configuredClient || configuredClient === 'default' || configuredClient === 'auto'
  ? 'android,web'
  : configuredClient;
function clientArgs(): string[] {
  return YT_CLIENT ? ['--extractor-args', `youtube:player_client=${YT_CLIENT}`] : [];
}

// --frames-only: download the tail + extract frames, NO OCR. This validates the
// two things that actually decide the project — can we download these videos,
// and is the credit roll in the tail — before committing to an OCR engine.
const FRAMES_ONLY = arg('frames-only') !== undefined;
const EXISTING_FRAMES_DIR = arg('frames-dir');

// ---------------------------------------------------------------- prereqs ---
if (process.platform === 'win32') {
  const tesseractDir = existsSync('C:\\Program Files\\Tesseract-OCR')
    ? 'C:\\Program Files\\Tesseract-OCR'
    : existsSync(join(process.env.LOCALAPPDATA || '', 'Programs\\Tesseract-OCR'))
      ? join(process.env.LOCALAPPDATA || '', 'Programs\\Tesseract-OCR')
      : null;

  if (tesseractDir && !process.env.TESSDATA_PREFIX) {
    const tessdata = join(tesseractDir, 'tessdata');
    if (existsSync(tessdata)) process.env.TESSDATA_PREFIX = tessdata;
  }

  const extraPaths = [
    'C:\\Program Files\\Tesseract-OCR',
    join(process.env.LOCALAPPDATA || '', 'Programs\\Tesseract-OCR'),
    join(process.env.APPDATA || '', 'Python\\Python313\\Scripts'),
    join(process.env.LOCALAPPDATA || '', 'Programs\\Python\\Python313\\Scripts'),
    'C:\\Python313\\Scripts',
    join(process.cwd(), '.local-clipper-venv\\Scripts'),
    'C:\\ffmpeg\\ffmpeg-8.1.1-essentials_build\\bin',
    'C:\\ffmpeg\\bin',
  ].filter((p) => p && existsSync(p));

  if (extraPaths.length > 0) {
    process.env.PATH = `${extraPaths.join(';')};${process.env.PATH || ''}`;
  }
}

async function checkPrereqs() {
  const need: Array<[string, string[]]> = [['ffmpeg', ['-version']]];
  if (!EXISTING_FRAMES_DIR) need.push(['yt-dlp', ['--version']]);
  if (!FRAMES_ONLY) need.push(['ffprobe', ['-version']], ['tesseract', ['--version']]);
  const missing: string[] = [];
  for (const [bin, args] of need) {
    try {
      await run(bin, args, { timeout: 30_000, maxBuffer: 1024 * 1024 });
    } catch (error: any) {
      const timedOut = error?.killed || error?.signal || /timeout|timed out/i.test(String(error?.message ?? error));
      if (timedOut) {
        console.warn(`   ⚠️  ${bin} prereq check timed out; continuing because the real command will report a concrete error if it cannot run.`);
        continue;
      }
      missing.push(bin);
    }
  }
  if (missing.length) {
    console.error(`\n💀 Missing required tools on PATH: ${missing.join(', ')}`);
    console.error('   Windows:  winget install yt-dlp.yt-dlp  |  winget install Gyan.FFmpeg  |  winget install UB-Mannheim.TesseractOCR');
    console.error('   NOTE: open a NEW terminal after winget installs — PATH only refreshes in new shells.');
    process.exit(1);
  }
}

// --------------------------------------------------------------- enqueue ----
type EnqueueFilmPriorityInput = {
  created_at?: string | null;
  view_count?: number | null;
};

function recentlyAddedFilmPriority(f: EnqueueFilmPriorityInput) {
  const timestampPriority = Math.floor(Date.parse(f.created_at || '') / 1000);
  return Number.isFinite(timestampPriority)
    ? Math.min(timestampPriority, 2_000_000_000)
    : Math.round(Math.log10((f.view_count ?? 0) + 1) * 10);
}

async function enqueueRecon(perChannel: number) {
  console.log(`📋 Recon enqueue: up to ${perChannel} films per channel…`);
  // Sample a few films per channel to learn WHICH CHANNELS EVEN HAVE CREDITS.
  // Channels that never do can then be skipped wholesale — the big cost saver.
  const seen = new Map<string, number>();
  const rows: { film_id: string; channel_id: string | null; priority: number }[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('channel_videos')
      .select('film_id, channel_id, films!inner(id, view_count, created_at, youtube_watch_url, is_published)')
      .not('film_id', 'is', null)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const r of data as any[]) {
      const f = r.films;
      if (!f?.is_published || !f?.youtube_watch_url) continue;
      const ch = r.channel_id ?? 'none';
      const n = seen.get(ch) ?? 0;
      if (n >= perChannel) continue;
      seen.set(ch, n + 1);
      rows.push({ film_id: r.film_id, channel_id: r.channel_id, priority: recentlyAddedFilmPriority(f) });
    }
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`   ${rows.length} films across ${seen.size} channels`);
  await insertJobs(rows);
}

async function enqueuePopular(limit: number) {
  console.log(`📋 Popularity enqueue: top ${limit} YouTube films…`);
  const { data, error } = await supabase
    .from('films')
    .select('id, view_count, created_at')
    .eq('is_published', true)
    .not('youtube_watch_url', 'is', null)
    .order('view_count', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  await insertJobs((data ?? []).map((f: any) => ({
    film_id: f.id, channel_id: null, priority: recentlyAddedFilmPriority(f),
  })));
}

/**
 * Enqueue films that AREN'T already enriched — fewer than `minCredits` existing
 * cast+crew rows. This is the main targeting mode: ~5k films already have full
 * credits (>=4) and re-harvesting them is pure waste. Ordered by the same
 * Recently Added order as the frontend: newest created YouTube films first.
 */
async function enqueueSparse(minCredits: number) {
  console.log(`📋 Sparse enqueue: published YouTube films with < ${minCredits} existing credits…`);

  // Count credits per film in one pass (95k rows fits comfortably in memory).
  const creditCount = new Map<string, number>();
  let from = 0;
  for (;;) {
    const { data, error } = await supabase.from('credits').select('film_id').range(from, from + 999);
    if (error) throw new Error(`credits: ${error.message}`);
    if (!data?.length) break;
    for (const r of data as any[]) creditCount.set(r.film_id, (creditCount.get(r.film_id) ?? 0) + 1);
    if (data.length < 1000) break;
    from += 1000;
  }

  // Walk published YouTube films, keep those below the threshold.
  const rows: { film_id: string; channel_id: string | null; priority: number }[] = [];
  from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('films')
      .select('id, view_count, created_at')
      .eq('is_published', true)
      .not('youtube_watch_url', 'is', null)
      .order('created_at', { ascending: false, nullsFirst: false })
      .range(from, from + 999);
    if (error) throw new Error(`films: ${error.message}`);
    if (!data?.length) break;
    for (const f of data as any[]) {
      if ((creditCount.get(f.id) ?? 0) < minCredits) {
        rows.push({
          film_id: f.id,
          channel_id: null,
          priority: recentlyAddedFilmPriority(f),
        });
      }
    }
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`   ${rows.length} films under the ${minCredits}-credit threshold`);
  await insertJobs(rows);
}

async function countCreditsForFilmIds(filmIds: string[]) {
  const creditCount = new Map<string, number>();
  for (let i = 0; i < filmIds.length; i += 100) {
    const batch = filmIds.slice(i, i + 100);
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from('credits')
        .select('film_id')
        .in('film_id', batch)
        .range(from, from + 999);
      if (error) throw new Error(`credits: ${error.message}`);
      if (!data?.length) break;
      for (const row of data as any[]) {
        creditCount.set(row.film_id, (creditCount.get(row.film_id) ?? 0) + 1);
      }
      if (data.length < 1000) break;
      from += 1000;
    }
  }
  return creditCount;
}

async function enqueueLatestSparse(limit: number, minCredits: number) {
  if (limit <= 0) return;
  console.log(`📋 Latest sparse seed: newest ${limit} published YouTube films with < ${minCredits} existing credits...`);
  const { data, error } = await supabase
    .from('films')
    .select('id, view_count, created_at')
    .eq('is_published', true)
    .not('youtube_watch_url', 'is', null)
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(`films: ${error.message}`);

  const films = (data ?? []) as any[];
  if (!films.length) {
    console.log('   No published YouTube films matched the latest seed window.');
    return;
  }

  const creditCount = await countCreditsForFilmIds(films.map((film) => film.id));
  const rows = films
    .filter((film) => (creditCount.get(film.id) ?? 0) < minCredits)
    .map((film) => ({
      film_id: film.id,
      channel_id: null,
      priority: recentlyAddedFilmPriority(film),
    }));

  if (!rows.length) {
    console.log(`   No newest films were below the ${minCredits}-credit threshold.`);
    return;
  }

  await insertJobs(rows);
}

async function insertJobs(rows: { film_id: string; channel_id: string | null; priority: number }[]) {
  let added = 0;
  for (let i = 0; i < rows.length; i += 500) {
    // upsert on the unique film_id so re-running enqueue is idempotent.
    const { error, count } = await supabase
      .from('credit_harvest_jobs')
      .upsert(rows.slice(i, i + 500), { onConflict: 'film_id', ignoreDuplicates: true, count: 'exact' });
    if (error) throw new Error(error.message);
    added += count ?? 0;
  }
  console.log(`✅ Enqueued ${added} new jobs (duplicates ignored).`);
}

async function requeueLowCoverage(maxCandidates: number) {
  const limit = Number(arg('limit')) || 500;
  console.log(`Requeue: done credit-found jobs with <= ${maxCandidates} candidates (limit ${limit})...`);
  const { data, error } = await supabase
    .from('credit_harvest_jobs')
    .select('id, film_id, candidates_found, processed_at')
    .eq('status', 'done')
    .eq('outcome', 'credits_found')
    .lte('candidates_found', maxCandidates)
    .order('processed_at', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  if (!rows.length) {
    console.log('   No low-coverage jobs matched.');
    return;
  }

  for (let i = 0; i < rows.length; i += 200) {
    const ids = rows.slice(i, i + 200).map((row: any) => row.id);
    const { error: updateError } = await supabase
      .from('credit_harvest_jobs')
      .update({
        status: 'pending',
        outcome: null,
        error: null,
        started_at: null,
        processed_at: null,
      })
      .in('id', ids);
    if (updateError) throw new Error(updateError.message);
  }

  console.log(`Requeued ${rows.length} low-coverage jobs.`);
  console.log('   Start workers with --reharvest-existing so existing pending candidates are kept and only new rows are appended.');
}

async function requeueFailed() {
  console.log('🔄 Requeueing all failed jobs back to pending status...');
  const { data, error } = await supabase
    .from('credit_harvest_jobs')
    .update({
      status: 'pending',
      outcome: null,
      error: null,
      started_at: null,
      processed_at: null,
      attempts: 0
    })
    .eq('status', 'failed')
    .select('id');

  if (error) {
    console.error('❌ Failed to requeue failed jobs:', error.message);
    return;
  }

  console.log(`✅ Requeued ${(data || []).length} failed jobs back to pending queue.`);
}

function normalizeCandidateValue(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

function candidateKey(row: { raw_name: string; role_or_character?: string | null; credit_type: string }) {
  return [
    normalizeCandidateValue(row.raw_name),
    normalizeCandidateValue(row.role_or_character),
    normalizeCandidateValue(row.credit_type),
  ].join('|');
}

/** Collapse exact OCR repeats while retaining a person in distinct roles. */
function dedupeCandidateRows(rows: Array<Record<string, any>>) {
  const unique = new Map<string, Record<string, any>>();
  for (const row of rows) {
    const key = candidateKey(row as any);
    const previous = unique.get(key);
    if (!previous) { unique.set(key, row); continue; }
    const prevScore = Number(previous.ocr_confidence ?? 0) + Number(previous.frame_support ?? 0) * 0.05;
    const nextScore = Number(row.ocr_confidence ?? 0) + Number(row.frame_support ?? 0) * 0.05;
    if (nextScore > prevScore) unique.set(key, row);
  }
  return [...unique.values()];
}


// ------------------------------------------------------------- metadata ----
// Text-only metadata extraction from the YouTube title/description. This avoids
// frame/video storage and paid model calls; admins still approve before live data
// changes.
const METADATA_SOURCE = 'youtube_metadata';
const METADATA_DESCRIPTION_LIMIT = 12_000;
const METADATA_SYNOPSIS_LIMIT = 1_000;
const METADATA_TIMEOUT = 120_000;
const LANGUAGE_ALIASES: Array<[string, RegExp]> = [
  ['English', /\benglish\b/i],
  ['Pidgin', /\bpidgin\b/i],
  ['Yoruba', /\byoruba\b/i],
  ['Igbo', /\bigbo\b/i],
  ['Hausa', /\bhausa\b/i],
  ['Edo', /\bedo\b/i],
  ['Ibibio', /\bibibio\b/i],
  ['Efik', /\befik\b/i],
  ['Twi', /\btwi\b/i],
  ['Akan', /\bakan\b/i],
  ['Swahili', /\bswahili\b/i],
  ['French', /\bfrench\b/i],
];

function compactWhitespace(value: unknown): string {
  return String(value ?? '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanMetadataLine(line: string): string {
  return line
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\bwww\.\S+/gi, ' ')
    .replace(/(^|\s)[#@][\w.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPromoMetadataLine(line: string): boolean {
  const low = line.toLowerCase();
  return [
    'subscribe', 'follow us', 'follow me', 'click', 'download', 'watch more',
    'latest nollywood', 'new nollywood', 'full movie', 'official trailer',
    'like and share', 'turn on notification', 'youtube channel',
  ].some((needle) => low.includes(needle));
}

function extractSynopsis(description: string): string | null {
  const paragraphs = compactWhitespace(description)
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph
      .split('\n')
      .map(cleanMetadataLine)
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim())
    .filter(Boolean);

  const usable: string[] = [];
  for (const paragraph of paragraphs) {
    if (/^(starring|cast|featuring|producer|produced by|director|directed by|screenplay|crew|production company|music|editor)\b/i.test(paragraph)) break;
    if (isPromoMetadataLine(paragraph)) continue;
    if (paragraph.length < 80) continue;
    if ((paragraph.match(/[.!?]/g) || []).length === 0 && paragraph.length < 160) continue;
    usable.push(paragraph);
    if (usable.join(' ').length >= METADATA_SYNOPSIS_LIMIT) break;
  }

  const synopsis = usable.join('\n\n').slice(0, METADATA_SYNOPSIS_LIMIT).trim();
  return synopsis.length >= 80 ? synopsis : null;
}

function extractReleaseYear(text: string): number | null {
  const currentYear = new Date().getFullYear();
  const explicit = text.match(/\b(?:release(?:d)?|premiere(?:d)?|year|date)\D{0,20}((?:19|20)\d{2})\b/i);
  const raw = explicit?.[1] || text.match(/\b((?:19|20)\d{2})\b/)?.[1];
  const year = raw ? Number(raw) : NaN;
  return Number.isInteger(year) && year >= 1888 && year <= currentYear + 2 ? year : null;
}

function extractAgeRating(text: string): string | null {
  const match = text.match(/\b(?:nfvcb|rated|rating|age rating|content rating|classified)\D{0,16}(PG-13|PG|G|15|18)\b/i);
  return match ? match[1].toUpperCase() : null;
}

function extractLanguage(text: string): string | null {
  const found: string[] = [];
  const explicit = text.match(/\b(?:language|languages)\s*[:\-]\s*([^\n.;]+)/i)?.[1] || '';
  const haystacks = [explicit, text].filter(Boolean);
  for (const haystack of haystacks) {
    for (const [label, pattern] of LANGUAGE_ALIASES) {
      if (pattern.test(haystack) && !found.includes(label)) found.push(label);
    }
    if (found.length) break;
  }
  return found.slice(0, 3).join(', ') || null;
}

function cleanCompanyName(value: string | null | undefined): string | null {
  let name = cleanMetadataLine(String(value ?? ''))
    .replace(/\b(?:presents|present|production company|official)\b.*$/i, '')
    .replace(/\b(?:produced by|production by|a film by)\b/i, '')
    .replace(/[|,.;:]+$/g, '')
    .trim();
  if (!name || name.length < 3 || name.length > 90) return null;
  if (/\b(subscribe|watch|latest|full movie|nollywood movie|trailer)\b/i.test(name)) return null;
  if (/^\d+$/.test(name)) return null;
  return name.replace(/\s+/g, ' ');
}

function extractProductionCompany(text: string): string | null {
  const lines = compactWhitespace(text).split('\n').map(cleanMetadataLine).filter(Boolean);
  const patterns = [
    /\b(?:production company|company)\s*[:\-]\s*(.+)$/i,
    /\b(?:produced by|production by)\s+(.+?(?:productions?|pictures|films?|studios?|tv|media|entertainment|motion pictures)?)(?:$|[|,.;])/i,
    /^(.+?(?:productions?|pictures|films?|studios?|tv|media|entertainment|motion pictures))\s+(?:presents|present|production)\b/i,
    /\b([A-Z][A-Za-z0-9&'. -]{2,70}\s+(?:Productions?|Pictures|Films?|Studios?|TV|Media|Entertainment|Motion Pictures))\b/,
  ];

  for (const line of lines) {
    if (isPromoMetadataLine(line)) continue;
    for (const pattern of patterns) {
      const match = line.match(pattern);
      const company = cleanCompanyName(match?.[1]);
      if (company) return company;
    }
  }
  return null;
}

async function fetchYoutubeMetadata(url: string): Promise<YoutubeMetadata | null> {
  const { stdout } = await run('yt-dlp', [
    '--dump-json',
    '--skip-download',
    '--no-playlist',
    '--no-warnings',
    ...clientArgs(),
    ...cookieArgs(),
    url,
  ], { timeout: METADATA_TIMEOUT, maxBuffer: 16 * 1024 * 1024 });

  const text = stdout.trim();
  if (!text) return null;
  return JSON.parse(text.split('\n').at(-1) || text);
}

function buildMetadataCandidate(
  job: Job,
  film: FilmSnapshot,
  metadata: YoutubeMetadata,
): Record<string, any> | null {
  const title = compactWhitespace(metadata.fulltitle || metadata.title || '');
  const description = compactWhitespace(metadata.description || '');
  const sourceText = [title, description].filter(Boolean).join('\n\n');
  const synopsis = extractSynopsis(description);
  const language = extractLanguage(sourceText);
  const releaseYear = extractReleaseYear(sourceText);
  const ageRating = extractAgeRating(sourceText);
  const productionCompany = extractProductionCompany(sourceText);
  const fields = [synopsis, language, releaseYear, ageRating, productionCompany]
    .filter((value) => value !== null && value !== undefined && String(value).trim() !== '');

  if (!fields.length) return null;

  const confidence = Math.min(
    0.9,
    0.35
      + (synopsis ? 0.22 : 0)
      + (language ? 0.08 : 0)
      + (releaseYear ? 0.08 : 0)
      + (ageRating ? 0.08 : 0)
      + (productionCompany ? 0.12 : 0),
  );

  return {
    film_id: film.id,
    job_id: job.id,
    source: METADATA_SOURCE,
    source_url: metadata.webpage_url || film.youtube_watch_url,
    source_title: title || null,
    source_description: description.slice(0, METADATA_DESCRIPTION_LIMIT) || null,
    source_evidence: {
      channel: metadata.channel || metadata.uploader || null,
      had_description: Boolean(description),
      extracted_fields: fields.length,
    },
    synopsis,
    language,
    release_year: releaseYear,
    age_rating: ageRating,
    production_company: productionCompany,
    confidence: Number(confidence.toFixed(2)),
    status: 'pending',
    updated_at: new Date().toISOString(),
  };
}

async function saveMetadataCandidate(job: Job, film: FilmSnapshot) {
  if (FRAMES_ONLY || !film.youtube_watch_url) return;

  try {
    const metadata = await fetchYoutubeMetadata(film.youtube_watch_url);
    if (!metadata) return;

    const draft = buildMetadataCandidate(job, film, metadata);
    if (!draft) return;

    const { data: existing, error: existingError } = await supabase
      .from('credit_metadata_candidates')
      .select('id')
      .eq('film_id', film.id)
      .eq('source', METADATA_SOURCE)
      .eq('status', 'pending')
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    const result = existing?.id
      ? await supabase
        .from('credit_metadata_candidates')
        .update(draft)
        .eq('id', existing.id)
      : await supabase
        .from('credit_metadata_candidates')
        .insert(draft);
    if (result.error) throw new Error(result.error.message);

    console.log(`   metadata suggestion queued (${Object.keys(draft).filter((key) => ['synopsis', 'language', 'release_year', 'age_rating', 'production_company'].includes(key) && draft[key]).length} fields)`);
    if (job.id) {
      await writeWorkerLog(
        'info',
        'metadata_candidate',
        `${film.title || film.id}: metadata suggestion queued`,
        job,
        { fields: draft.source_evidence.extracted_fields },
      );
    }
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error);
    console.warn(`   metadata skipped: ${message}`);
    if (job.id) {
      await writeWorkerLog(
        'warning',
        'metadata_skipped',
        `${film.title || film.id}: metadata extraction skipped`,
        job,
        { error: message.slice(0, 300) },
      );
    }
  }
}
// ------------------------------------------------------------- processing ---
/** Run yt-dlp and, on failure, surface its actual stderr (not just "command failed"). */
async function ytdlp(args: string[]): Promise<{ stdout: string; stderr: string }> {
  try {
    return await run('yt-dlp', args, { timeout: YTDLP_TIMEOUT, maxBuffer: 32 * 1024 * 1024 });
  } catch (e: any) {
    // A timeout/kill shows up as killed/signal, NOT as stderr text, so report it
    // explicitly — otherwise the message ends mid-download with no visible cause.
    const reasons: string[] = [];
    if (e?.killed || e?.signal) reasons.push(`process KILLED (timeout ${YTDLP_TIMEOUT / 1000}s or OOM; signal=${e?.signal ?? 'n/a'})`);
    if (typeof e?.code === 'number') reasons.push(`exit code ${e.code}`);
    const full = String(e?.stderr || '') + (e?.stdout ? '\n' + e.stdout : '');
    const tail = full.trim().split('\n').filter(Boolean).slice(-8).join('\n       ');
    const msg = [reasons.join(', '), tail].filter(Boolean).join('\n       ');
    const err = new Error(msg || e?.message || 'yt-dlp failed');
    (err as any).full = `${reasons.join(', ')}\n${full}` || String(e?.message ?? '');
    throw err;
  }
}

/**
 * Download only the tail (last TAIL_SECONDS) via yt-dlp, then extract frames from
 * it locally.
 *
 * Key choices (from the recon documented in the header):
 *  - probe duration, then use explicit positive `*<start>-<end>` sections.
 *  - prefer a low-res avc1 DASH VIDEO-ONLY format (small, legible, no audio);
 *    cookies are what make these available. Override with --format=134/135
 *    if a faster YouTube client or PO-token path is available.
 *  - resilience flags so a Lagos-connection blip retries instead of writing a
 *    corrupt partial (the android_vr stream was resetting mid-download).
 *  - let yt-dlp drive the download so it passes ffmpeg the required UA header.
 */
/** Video duration in seconds via yt-dlp (no download). */
async function probeDuration(url: string): Promise<number> {
  const { stdout } = await ytdlp(['--skip-download', '--no-warnings', '--print', '%(duration)s', ...clientArgs(), ...cookieArgs(), url]);
  const d = parseInt(String(stdout).trim(), 10);
  return Number.isFinite(d) && d > 0 ? d : 0;
}

async function extractTailFrames(
  url: string,
  dir: string,
): Promise<{ frames: string[]; videoStartSec: number }> {
  const tail = join(dir, 'tail.mp4');

  // POSITIVE timestamps only. The negative form (`*-300-inf`) produced a 262-byte
  // empty stub with these DASH formats; explicit `*<start>-<end>` computed from the
  // real duration is what actually downloaded data (confirmed: ffmpeg decoded it).
  const duration = await probeDuration(url);
  if (!duration) throw new Error('could not determine video duration');
  const start = Math.max(0, duration - TAIL_SECONDS);
  const end = duration;

  const t0 = Date.now();
  await ytdlp([
    '-f', VIDEO_FORMAT,
    '--download-sections', `*${start}-${end}`,
    '--retries', '3', '--fragment-retries', '3', '--socket-timeout', '30',
    ...clientArgs(),
    ...cookieArgs(),
    '-o', tail,
    '--no-playlist', '--no-warnings',
    url,
  ]);
  // Guard: a "successful" yt-dlp exit can still write an empty stub when the
  // chosen format is SABR/DRM (no downloadable URL). Catch that explicitly
  // instead of handing ffmpeg an empty file and getting a cryptic "no stream".
  const { size } = await stat(tail);
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  if (size < 50_000) {
    throw new Error(
      `downloaded only ${size} bytes in ${secs}s — the selected format has no data ` +
      `(SABR/DRM). Run:  yt-dlp --cookies <path> -F "${url}"  and pick a format with a real filesize.`,
    );
  }
  console.log(`   ⏱️  tail (${TAIL_SECONDS}s) = ${(size / 1024 / 1024).toFixed(1)}MB in ${secs}s`);

  // Extract frames from the small local file (fast, no network).
  await run('ffmpeg', [
    '-i', tail, '-an',
    '-vf', `fps=1/${FRAME_EVERY_SEC},scale=960:-2`,
    '-q:v', '3',
    join(dir, 'f_%03d.jpg'),
    '-hide_banner', '-loglevel', 'error', '-y',
  ], { timeout: 120_000, maxBuffer: 32 * 1024 * 1024 });

  await rm(tail, { force: true }); // keep frames, drop the video
  const frames = (await readdir(dir))
    .filter((f) => f.startsWith('f_'))
    .sort()
    .map((f) => join(dir, f));
  return { frames, videoStartSec: start };
}

type Parsed = { name: string; role: string | null; type: 'cast' | 'crew' };

/**
 * Turn OCR text into credit lines, rejecting promo blocks and noise.
 * Returns null when the text doesn't look like a credit roll at all.
 */
function parseCredits(text: string): Parsed[] | null {
  const lines = text.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const out: Parsed[] = [];
  for (const line of lines) {
    const low = line.toLowerCase();
    // Hard stop: everything from a promo marker onward is advertising.
    if (STOP_MARKERS.some((m) => low.includes(m))) break;
    if (NOISE_LINE.test(line)) continue;
    if (line.length < 3 || line.length > 80) continue;

    // "ROLE: Name" / "Role - Name"
    const m = line.match(/^(.{2,40}?)\s*[:\-–]\s*(.+)$/);
    if (m) {
      const [, left, right] = m;
      const isRoleLeft = ROLE_HINT.test(left);
      const name = (isRoleLeft ? right : left).trim();
      const role = (isRoleLeft ? left : right).trim();
      if (looksLikeName(name)) out.push({ name, role, type: ROLE_HINT.test(role) && !/starring|featuring|cast/i.test(role) ? 'crew' : 'cast' });
      continue;
    }
    if (looksLikeName(line)) out.push({ name: line, role: null, type: 'cast' });
  }

  // Structural gate: a real roll is a dense list. A stray couple of names inside
  // promo text is NOT a credit roll — reject rather than harvest it.
  if (out.length < MIN_ENTRIES) return null;
  return out;
}

function looksLikeName(s: string): boolean {
  const t = s.trim();
  if (t.length < 4 || t.length > 45) return false;
  if (/\d/.test(t)) return false;
  if (!/^[A-Za-zÀ-ÿ'’.\- ]+$/.test(t)) return false;
  const words = t.split(/\s+/).filter(Boolean);
  return words.length >= 2 && words.length <= 5;
}

async function processJob(job: Job) {
  const { data: film } = await supabase
    .from('films')
    .select('id, title, youtube_watch_url, runtime_minutes, synopsis, year, language, languages, nfvcb_rating')
    .eq('id', job.film_id)
    .single();

  const filmLabel = film?.title?.trim() || job.film_id;
  if (job.id) {
    await setWorkerActivity('running', `Processing ${filmLabel}`, job);
    await writeWorkerLog('info', 'job_started', `Started ${filmLabel}`, job);
  }

  if (!film?.youtube_watch_url) {
    await finish(job, 'unavailable', 0, 'no youtube url', filmLabel);
    return;
  }

  // Enforce the channel exclusion at execution time as well as enqueue time.
  // Jobs can be left over from an older queue, and some enqueue modes do not
  // carry channel metadata on the job row.
  const channelLabels: string[] = [];
  if (job.channel_id) {
    const { data: channel } = await supabase
      .from('channels')
      .select('name, slug')
      .eq('id', job.channel_id)
      .maybeSingle();
    if (channel?.name) channelLabels.push(channel.name);
    if (channel?.slug) channelLabels.push(channel.slug);
  } else {
    // Most automatic enqueue modes only store film_id. Resolve its source
    // channel here so the ignore list still applies to those jobs.
    const { data: sources } = await supabase
      .from('channel_videos')
      .select('channels(name, slug)')
      .eq('film_id', job.film_id)
      .limit(10);
    for (const source of (sources ?? []) as any[]) {
      if (source.channels?.name) channelLabels.push(source.channels.name);
      if (source.channels?.slug) channelLabels.push(source.channels.slug);
    }
  }
  const ignoredLabel = channelLabels.find((label) => ignoredChannel(label));
  if (ignoredLabel) {
    await finish(job, 'unavailable', 0, `ignored channel: ${ignoredLabel}`, filmLabel);
    console.log(`   ⏭️  ${filmLabel.slice(0, 45)} → ignored channel ${ignoredLabel}`);
    return;
  }

  await saveMetadataCandidate(job, film as FilmSnapshot);

  // Queue runs are resumable and may be re-enqueued while an earlier debug run
  // already has candidates awaiting review. Do not download/OCR the same film
  // again in that case; keep the existing review set and close the queue job.
  // `--film` debug runs intentionally bypass this guard so they remain useful
  // for OCR/parser experiments.
  if (job.id) {
    const { count, error } = await supabase
      .from('credit_candidates')
      .select('id', { count: 'exact', head: true })
      .eq('film_id', job.film_id)
      .eq('status', 'pending');
    if (error) throw new Error(`existing candidates: ${error.message}`);
    if ((count ?? 0) > 0 && !REHARVEST_EXISTING) {
      await finish(job, 'credits_found', count ?? 0, undefined, filmLabel);
      console.log(`   ⏭️  ${film.title?.slice(0, 45)} → ${count} pending candidates already exist`);
      return;
    }
  }

  // --frames-only: write to a durable, inspectable folder in the project so you
  // can open it and SEE whether the tail actually contains the credit roll.
  const dir = EXISTING_FRAMES_DIR
    ? resolve(EXISTING_FRAMES_DIR)
    : FRAMES_ONLY
      ? join(process.cwd(), 'harvest_frames', job.film_id)
      : await mkdtemp(join(tmpdir(), 'harvest-'));
  if (FRAMES_ONLY) await mkdir(dir, { recursive: true });

  try {
    console.log(`   ⬇️  grabbing tail frames of "${film.title?.slice(0, 45)}"…`);
    let frames: string[];
    let videoStartSec: number;
    if (EXISTING_FRAMES_DIR) {
      frames = (await readdir(dir))
        .filter((name) => /^f_\d+\.(jpg|jpeg|png)$/i.test(name))
        .sort()
        .map((name) => join(dir, name));
      const sampledSeconds = frames.length * FRAME_EVERY_SEC;
      videoStartSec = Number(arg('video-start'))
        || Math.max(0, Number(film.runtime_minutes || 0) * 60 - sampledSeconds);
      console.log(`   using ${frames.length} existing frames`);
    } else {
      ({ frames, videoStartSec } = await extractTailFrames(film.youtube_watch_url, dir));
    }
    if (!frames.length) {
      await finish(job, 'no_credits', 0, 'no frames', filmLabel);
      return;
    }

    if (FRAMES_ONLY) {
      // Stop here — no OCR, no DB writes. Just prove download+frames work.
      console.log(`   🖼️  ${frames.length} frames saved → ${dir}`);
      console.log('       Open that folder: the last few frames should show the credit roll.');
      return;
    }

    // OCR frames from the END backwards — rolls sit at the very end, and this
    // finds them with the fewest OCR calls.
    const observations: CreditObservation[] = [];
    let rollFrames = 0;
    for (let i = frames.length - 1; i >= 0; i--) {
      const frameSec = i * FRAME_EVERY_SEC;
      const parsed = await parseCreditFrameWithOcr(
        frames[i],
        i,
        frameSec,
        videoStartSec + frameSec,
      );
      if (!parsed.length) continue;
      rollFrames++;
      observations.push(...parsed);
    }

    const found = consolidateCreditObservations(observations);
    if (!found.length) {
      await finish(job, 'no_credits', 0, undefined, filmLabel);
      return;
    }

    // Name resolution happens at approval time. Doing one remote matcher call
    // per OCR candidate made the worker slower than OCR itself and did not
    // improve extraction quality. Fast end-roll cards can appear for only a
    // second, so keep strong one-frame observations for human approval.
    let rows: Array<Record<string, any>> = [];
    for (const p of found) {
      const strongSingleFrame = p.frameSupport === 1 && p.ocrConfidence >= SINGLE_FRAME_MIN_OCR_CONFIDENCE;
      if (p.frameSupport < 2 && !strongSingleFrame) continue;
      const repeated = p.frameSupport >= 2;
      const conf = Math.min(1,
        (repeated ? 0.45 : 0.34)
        + Math.min(0.25, Math.max(0, p.frameSupport - 1) * 0.07)
        + p.ocrConfidence * (repeated ? 0.25 : 0.35),
      );
      rows.push({
        film_id: job.film_id, job_id: job.id,
        raw_name: p.name,
        role_or_character: p.roleOrCharacter,
        credit_type: p.creditType,
        confidence: Number(conf.toFixed(2)),
        ocr_confidence: Number(p.ocrConfidence.toFixed(3)),
        frame_support: p.frameSupport,
        matched_person_id: null,
        source_frame_sec: p.frameSec,
        source_video_sec: p.videoSec,
        source_frame_index: p.frameIndex,
        source_ocr_text: p.evidenceText,
        source_layout: p.layout,
      });
    }

    if (rows.length < MIN_ENTRIES && !REHARVEST_EXISTING) {
      await finish(
        job,
        'no_credits',
        0,
        `only ${rows.length} validated candidates across ${rollFrames} frames`,
        filmLabel,
      );
      return;
    }

    // A name can be visible on several adjacent OCR frames. Consolidation
    // normally handles this, but exact duplicate rows can still be emitted by
    // different layout detectors. Remove those repeats without collapsing
    // distinct role/character entries (including Extras).
    rows = dedupeCandidateRows(rows);
    const actorRows = rows.filter((row) => row.credit_type === 'actor');
    if (!ALLOW_CREW_ONLY && actorRows.length < MIN_ACTOR_CANDIDATES && !REHARVEST_EXISTING) {
      await finish(
        job,
        'no_credits',
        0,
        `only ${actorRows.length} actor candidates; refusing low-cast OCR output`,
        filmLabel,
      );
      console.log(`   ⏭️  ${film.title?.slice(0, 45)} → only ${actorRows.length} actor candidates; skipped noisy crew-only output`);
      return;
    }

    const { data: existingRows, error: existingRowsError } = await supabase
      .from('credit_candidates')
      .select('raw_name, role_or_character, credit_type')
      .eq('film_id', job.film_id);
    if (existingRowsError) throw new Error(`existing candidate rows: ${existingRowsError.message}`);

    const existingKeys = new Set((existingRows ?? []).map((row: any) => candidateKey(row)));
    rows = rows.filter((row) => !existingKeys.has(candidateKey(row as any)));

    if (!rows.length) {
      await finish(job, 'credits_found', existingRows?.length ?? 0, undefined, filmLabel);
      console.log(`   no new unique candidates for ${film.title?.slice(0, 45)} (${existingRows?.length ?? 0} existing kept)`);
      return;
    }

    const { error } = await supabase.from('credit_candidates').insert(rows);
    if (error) throw new Error(error.message);
    await finish(job, 'credits_found', rows.length, undefined, filmLabel);
    console.log(`   ✅ ${film.title?.slice(0, 45)} → ${rows.length} candidates`);
  } catch (e: any) {
    await finish(
      job,
      'error',
      0,
      String(e?.message ?? e).slice(0, 1200),
      filmLabel,
    );
    // Print the full (multi-line) message, and dump everything to a log file so
    // nothing is lost to terminal truncation.
    console.log(`   ❌ ${film.title?.slice(0, 45)}:\n       ${String(e?.message ?? e)}`);
    try {
      const logPath = join(dir, 'error.log');
      await mkdir(dir, { recursive: true });
      await writeFile(logPath, String((e as any)?.full ?? e?.stack ?? e?.message ?? e));
      console.log(`   📝 full error → ${logPath}`);
    } catch { /* best effort */ }
  } finally {
    // Keep frames-only output (that's the whole point) and honour --keep;
    // otherwise wipe the temp dir.
    if (!EXISTING_FRAMES_DIR && !FRAMES_ONLY && arg('keep') === undefined) {
      await rm(dir, { recursive: true, force: true });
    }
  }
}

async function finish(
  job: Job,
  outcome: string,
  candidates: number,
  error?: string,
  filmLabel?: string,
) {
  // --film debug mode has no queue row to update.
  if (!job.id) { console.log(`   [debug] outcome=${outcome} candidates=${candidates}${error ? ` error=${error}` : ''}`); return; }
  try {
    const { error: finishError } = await supabase.from('credit_harvest_jobs').update({
      status: outcome === 'error' ? 'failed' : 'done',
      outcome, candidates_found: candidates, error: error ?? null,
      processed_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
    }).eq('id', job.id);
    if (finishError) console.warn(`   ⚠️  finish job DB notice: ${finishError.message}`);
  } catch (err) {
    console.warn(`   ⚠️  finish job network error ignored: ${String(err)}`);
  }

  workerProcessed++;
  if (outcome === 'error') workerFailures++;
  const label = filmLabel || job.film_id;
  const level: WorkerLogLevel = outcome === 'error'
    ? 'error'
    : outcome === 'credits_found'
      ? 'success'
      : outcome === 'unavailable'
        ? 'warning'
        : 'info';
  const resultMessage = outcome === 'credits_found'
    ? `${label}: found ${candidates} candidate${candidates === 1 ? '' : 's'}`
    : outcome === 'no_credits'
      ? `${label}: no usable credit roll found`
      : outcome === 'unavailable'
        ? `${label}: source video unavailable`
        : `${label}: ${error || 'harvest failed'}`;

  await writeWorkerLog(
    level,
    outcome === 'error' ? 'job_failed' : 'job_completed',
    resultMessage,
    job,
    error ? { error } : undefined,
  );

  const isTimeoutError = outcome === 'error' && (
    String(error || '').toLowerCase().includes('timeout') ||
    String(error || '').toLowerCase().includes('killed')
  );

  if (isTimeoutError) {
    consecutiveTimeouts++;
    const cooldownSecs = Math.min(300, Math.floor(60 * Math.pow(1.5, Math.min(consecutiveTimeouts - 1, 5))));
    const coolMsg = `🧊 YouTube throttling detected (${consecutiveTimeouts} streak). Cooling down for ${cooldownSecs}s before refiring...`;
    console.log(`   ${coolMsg}`);
    await writeWorkerLog('warning', 'worker_cooldown', coolMsg, job, { consecutiveTimeouts, cooldownSecs });
    await setWorkerActivity('cooling_down', coolMsg, null);
    await waitInterruptibly(cooldownSecs * 1000);
  } else if (outcome === 'credits_found' || outcome === 'no_credits') {
    consecutiveTimeouts = 0;
    await setWorkerActivity(
      stopRequested ? 'stopping' : 'idle',
      resultMessage,
      null,
    );
  } else {
    await setWorkerActivity(
      stopRequested ? 'stopping' : 'idle',
      resultMessage,
      null,
    );
  }
}

let consecutiveTimeouts = 0;

function supervisorChildArgs(): string[] {
  const args = process.argv
    .slice(2)
    .filter((value) => value !== '--worker-child' && !value.startsWith('--workers'));

  if (!args.includes('--skip-auto-enqueue')) args.push('--skip-auto-enqueue');
  args.push('--worker-child');
  return args;
}

async function runWorkerSupervisor(workerCount: number) {
  if (!SKIP_AUTO_ENQUEUE) {
    await enqueueLatestSparse(AUTO_ENQUEUE_LATEST_LIMIT, AUTO_ENQUEUE_MIN_CREDITS);
  }

  const scriptPath = resolve(process.cwd(), 'scripts/harvest_credits.ts');
  const tsxCli = resolve(process.cwd(), 'node_modules/tsx/dist/cli.mjs');
  const useLocalTsx = existsSync(tsxCli);
  const command = useLocalTsx ? process.execPath : (process.platform === 'win32' ? 'npx.cmd' : 'npx');
  const commandPrefix = useLocalTsx ? [tsxCli, scriptPath] : ['tsx', scriptPath];
  const childArgs = supervisorChildArgs();
  const children: ReturnType<typeof spawn>[] = [];
  let stopping = false;
  let requestedStop = false;

  supervisorStopAll = (signal, requested = false) => {
    if (stopping) return;
    stopping = true;
    requestedStop = requested;
    console.log(`\nStopping ${children.length} credit harvest workers...`);
    for (const child of children) {
      if (child.exitCode === null && !child.killed) child.kill(signal);
    }
  };

  console.log(`Starting ${workerCount} credit harvest workers...`);
  const exits = Array.from({ length: workerCount }, (_, index) => new Promise<number>((resolveExit) => {
    const workerNumber = index + 1;
    const child = spawn(command, [...commandPrefix, ...childArgs], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CREDIT_HARVEST_WORKER_SLOT: String(workerNumber),
      },
      stdio: 'inherit',
    });
    children.push(child);
    console.log(`   worker ${workerNumber}/${workerCount} started${child.pid ? ` (pid ${child.pid})` : ''}`);

    child.once('error', (error) => {
      console.error(`Worker ${workerNumber} failed to start: ${error.message}`);
      resolveExit(1);
    });

    child.once('exit', (code, signal) => {
      const exitCode = code ?? (signal ? 130 : 0);
      if (!stopping && exitCode !== 0) {
        console.error(`Worker ${workerNumber} exited with ${signal || exitCode}; stopping the other workers.`);
        supervisorStopAll?.('SIGTERM', false);
      }
      resolveExit(exitCode);
    });
  }));

  const exitCodes = await Promise.all(exits);
  supervisorStopAll = null;
  const failedCode = requestedStop ? 0 : exitCodes.find((code) => code !== 0);
  if (failedCode) process.exitCode = failedCode;
}

/** Claim the next pending job (newest created YouTube film first). */
async function claim(): Promise<Job | null> {
  const { data, error } = await supabase.rpc('claim_credit_harvest_job', {
    p_worker_id: WORKER_ID,
  });
  if (error) throw new Error(`claim job: ${error.message}`);
  return (data?.[0] as Job | undefined) ?? null;
}

async function main() {
  if (arg('enqueue-recon') !== undefined) { await enqueueRecon(Number(arg('enqueue-recon')) || 3); return; }
  if (arg('enqueue-popular') !== undefined) { await enqueuePopular(Number(arg('enqueue-popular')) || 2000); return; }
  if (arg('enqueue-latest-sparse') !== undefined) { await enqueueLatestSparse(Number(arg('enqueue-latest-sparse')) || AUTO_ENQUEUE_LATEST_LIMIT, AUTO_ENQUEUE_MIN_CREDITS); return; }
  if (arg('requeue-sparse') !== undefined) { await enqueueSparse(Number(arg('enqueue-sparse')) || 4); return; }
  if (arg('requeue-low-coverage') !== undefined) { await requeueLowCoverage(Number(arg('requeue-low-coverage')) || 12); return; }
  if (arg('requeue-failed') !== undefined) { await requeueFailed(); return; }

  await checkPrereqs();

  const single = arg('film');
  if (single) {
    await processJob({ id: null, film_id: single, channel_id: null, attempts: 0 });
    return;
  }

  if (!WORKER_CHILD && WORKER_COUNT > 1) {
    await runWorkerSupervisor(WORKER_COUNT);
    return;
  }

  if (!SKIP_AUTO_ENQUEUE) {
    await enqueueLatestSparse(AUTO_ENQUEUE_LATEST_LIMIT, AUTO_ENQUEUE_MIN_CREDITS);
  }

  await setWorkerActivity('starting', `Worker started on ${WORKER_MACHINE}`, null);
  await writeWorkerLog(
    'info',
    'worker_started',
    `Worker ${WORKER_ID} started on ${WORKER_MACHINE}`,
  );
  startHeartbeat();

  console.log('👷 Worker started. Ctrl-C to stop; progress is saved per film.\n');
  let done = 0;
  let wasPaused = false;
  try {
    while (!stopRequested) {
      let paused = false;
      try {
        paused = await isHarvestPaused();
      } catch (error) {
        if (!isTransientSupabaseError(error)) throw error;
        const message = `Monitor database timeout; retrying in ${Math.round(PAUSE_POLL_MS / 1000)} seconds`;
        console.warn(`   ⚠️  ${message}: ${String(error)}`);
        await setWorkerActivity('idle', message, null);
        await waitInterruptibly(PAUSE_POLL_MS);
        continue;
      }
      if (paused) {
        if (!wasPaused) {
          const message = 'Paused by the admin dashboard; waiting to resume';
          console.log(`   ⏸️  ${message}`);
          await setWorkerActivity('paused', message, null);
          await writeWorkerLog('warning', 'worker_paused', message);
          wasPaused = true;
        }
        await waitInterruptibly(PAUSE_POLL_MS);
        continue;
      }

      if (wasPaused) {
        const message = 'Resumed by the admin dashboard';
        console.log(`   ▶️  ${message}`);
        await setWorkerActivity('idle', message, null);
        await writeWorkerLog('info', 'worker_resumed', message);
        wasPaused = false;
      } else {
        await setWorkerActivity('idle', 'Waiting for the next movie', null);
      }

      let job: Job | null = null;
      try {
        job = await claim();
      } catch (error) {
        if (!isTransientSupabaseError(error)) throw error;
        const message = 'Database timeout while claiming a movie; checking again in 60 seconds';
        console.warn(`   ⚠️  ${message}: ${String(error)}`);
        await setWorkerActivity('idle', message, null);
        await writeWorkerLog('warning', 'claim_retry', message, null, { error: String(error) });
        await waitInterruptibly(60_000);
        continue;
      }
      if (!job) {
        if (arg('once') !== undefined) break;
        const message = 'Queue empty; checking again in 60 seconds';
        console.log(`   …${message.toLowerCase()}`);
        await setWorkerActivity('idle', message, null);
        await waitInterruptibly(60_000);
        continue;
      }

      await processJob(job);
      done++;
      if (done % 25 === 0) console.log(`— ${done} films processed —`);
      if (arg('once') !== undefined) break;
      // Gentle pacing so we don't look like a scraper.
      await waitInterruptibly(2000 + Math.random() * 3000);
    }
  } catch (error) {
    const message = `Worker stopped after an unexpected failure: ${String(error)}`;
    await setWorkerActivity('failed', message, null);
    await writeWorkerLog('error', 'worker_failed', message);
    throw error;
  } finally {
    stopHeartbeat();
    if (workerStatus !== 'failed') {
      const message = stopRequested
        ? 'Worker stopped safely after the current movie'
        : 'Worker stopped';
      await setWorkerActivity('stopped', message, null);
      await writeWorkerLog('info', 'worker_stopped', message);
    }
  }
}

main().catch((e) => { console.error('💀 harvest_credits failed:', e); process.exit(1); });
