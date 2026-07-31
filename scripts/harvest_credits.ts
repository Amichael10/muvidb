/**
 * Headless credit-roll harvester. Runs unattended on a spare machine.
 *
 *   npx tsx scripts/harvest_credits.ts --enqueue-sparse     # films with < 4 credits (MAIN)
 *   npx tsx scripts/harvest_credits.ts --enqueue-sparse=2   # films with < 2 credits
 *   npx tsx scripts/harvest_credits.ts --enqueue-recon      # 3 films/channel (recon)
 *   npx tsx scripts/harvest_credits.ts --enqueue-popular=2000
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
 * PREREQS on the worker machine: yt-dlp, ffmpeg, tesseract (all on PATH).
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, rm, readdir, writeFile, stat } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { supabase } from './lib/db';
import {
  consolidateCreditObservations,
  parseCreditFrame,
  parseTesseractTsv,
  type CreditObservation,
} from './lib/credit_roll_parser';

const run = promisify(execFile);

const arg = (n: string) => {
  const hit = process.argv.find((a) => a.startsWith(`--${n}`));
  if (!hit) return undefined;
  const eq = hit.indexOf('=');
  return eq === -1 ? 'true' : hit.slice(eq + 1);
};

// Credit rolls sit in the final minutes. Use explicit positive timestamps for
// --download-sections; the negative form (`*-300-inf`) produced empty stubs on
// this source even though yt-dlp exited successfully.
const TAIL_SECONDS = Number(arg('tail')) || 300; // last 5 min (override: --tail=420)
const MIN_ENTRIES = 4;          // structural gate: fewer than this isn't a roll
const FRAME_EVERY_SEC = Number(arg('frame-every')) || 1; // sample cadence inside the tail
const SINGLE_FRAME_MIN_OCR_CONFIDENCE = Number(arg('single-frame-min-ocr')) || 0.65;
const REHARVEST_EXISTING = arg('reharvest-existing') !== undefined;
const YTDLP_TIMEOUT = 900_000;  // 15 min ceiling for a throttled tail
const DEFAULT_VIDEO_FORMAT =
  // 240p avc1 first: android_vr section downloads are heavily throttled, and
  // direct recon showed 480p can time out while 240p still leaves credits legible.
  '133/134/135/160/bv*[height<=360][vcodec^=avc1]/bv*[height<=360]/bv*[height<=480][vcodec^=avc1]/bv*[height<=480]/best[height<=480]/best';
const VIDEO_FORMAT = arg('format') ?? process.env.YTDLP_FORMAT ?? DEFAULT_VIDEO_FORMAT;

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

type Job = {
  // null in --film debug mode: there's no queue row, and job_id is a FK, so it
  // must be null rather than a fabricated uuid (which would fail the constraint).
  id: string | null;
  film_id: string;
  channel_id: string | null;
  attempts: number;
};

type WorkerStatus =
  | 'starting'
  | 'idle'
  | 'running'
  | 'paused'
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

function monitorWarning(label: string, error: unknown) {
  if (monitorWarningShown) return;
  monitorWarningShown = true;
  console.warn(`   ⚠️  Worker monitor ${label} failed; harvesting will continue: ${String(error)}`);
}

async function writeWorkerRow() {
  const { error } = await supabase
    .from('credit_harvest_workers')
    .upsert({
      worker_id: WORKER_ID,
      machine_name: WORKER_MACHINE,
      process_id: process.pid,
      status: workerStatus,
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

process.on('SIGINT', () => requestGracefulStop('Ctrl-C'));
process.on('SIGTERM', () => requestGracefulStop('termination signal'));

// Cookies are what UNLOCK the good (un-throttled, non-DRM) formats — a prior
// recon found guest downloads get only a throttled android_vr stream (~7 KiB/s),
// tv formats are DRM'd, and ios needs a PO token. Pass a Netscape cookies.txt
// via --cookies=<path> (or COOKIES_FILE/YT_COOKIES env), or pull from a browser
// via --cookies-from-browser=chrome|edge|firefox.
const COOKIES_FILE = arg('cookies') ?? process.env.COOKIES_FILE ?? process.env.YT_COOKIES;
const COOKIES_BROWSER = arg('cookies-from-browser');
function cookieArgs(): string[] {
  if (COOKIES_FILE) return ['--cookies', COOKIES_FILE];
  if (COOKIES_BROWSER) return ['--cookies-from-browser', COOKIES_BROWSER];
  return [];
}

// Player client. Default = don't force one, so cookies can unlock the default
// client's good formats. Forcing tv/ios is a dead end (DRM / PO-token). Override
// with --client=android_vr as a last resort.
const YT_CLIENT = arg('client') || '';
function clientArgs(): string[] {
  return YT_CLIENT ? ['--extractor-args', `youtube:player_client=${YT_CLIENT}`] : [];
}

// --frames-only: download the tail + extract frames, NO OCR. This validates the
// two things that actually decide the project — can we download these videos,
// and is the credit roll in the tail — before committing to an OCR engine.
const FRAMES_ONLY = arg('frames-only') !== undefined;
const EXISTING_FRAMES_DIR = arg('frames-dir');

// ---------------------------------------------------------------- prereqs ---
async function checkPrereqs() {
  // Only require the tools the chosen mode actually uses. yt-dlp + ffmpeg are
  // always needed; tesseract only when we OCR (skipped in --frames-only).
  const need: Array<[string, string[]]> = EXISTING_FRAMES_DIR
    ? []
    : [['yt-dlp', ['--version']], ['ffmpeg', ['-version']]];
  if (!FRAMES_ONLY) need.push(['tesseract', ['--version']]);
  const missing: string[] = [];
  for (const [bin, args] of need) {
    try { await run(bin, args); } catch { missing.push(bin); }
  }
  if (missing.length) {
    console.error(`\n💀 Missing required tools on PATH: ${missing.join(', ')}`);
    console.error('   Windows:  winget install yt-dlp.yt-dlp  |  winget install Gyan.FFmpeg  |  winget install UB-Mannheim.TesseractOCR');
    console.error('   NOTE: open a NEW terminal after winget installs — PATH only refreshes in new shells.');
    process.exit(1);
  }
}

// --------------------------------------------------------------- enqueue ----
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
      .select('film_id, channel_id, films!inner(id, view_count, youtube_watch_url, is_published)')
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
      rows.push({ film_id: r.film_id, channel_id: r.channel_id, priority: Math.round(Math.log10((f.view_count ?? 0) + 1) * 10) });
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
    .select('id, view_count')
    .eq('is_published', true)
    .not('youtube_watch_url', 'is', null)
    .order('view_count', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  await insertJobs((data ?? []).map((f: any) => ({
    film_id: f.id, channel_id: null, priority: Math.round(Math.log10((f.view_count ?? 0) + 1) * 10),
  })));
}

/**
 * Enqueue films that AREN'T already enriched — fewer than `minCredits` existing
 * cast+crew rows. This is the main targeting mode: ~5k films already have full
 * credits (>=4) and re-harvesting them is pure waste. Ordered like the Films
 * admin page ("Recently Added" first) so page-1 movies become approvable first.
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
      .order('created_at', { ascending: false })
      .range(from, from + 999);
    if (error) throw new Error(`films: ${error.message}`);
    if (!data?.length) break;
    for (const f of data as any[]) {
      if ((creditCount.get(f.id) ?? 0) < minCredits) {
        const createdPriority = Math.floor(Date.parse(f.created_at || '') / 1000);
        rows.push({
          film_id: f.id,
          channel_id: null,
          priority: Number.isFinite(createdPriority)
            ? Math.min(createdPriority, 2_000_000_000)
            : Math.round(Math.log10((f.view_count ?? 0) + 1) * 10),
        });
      }
    }
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`   ${rows.length} films under the ${minCredits}-credit threshold`);
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
  const end = duration + 5;

  const t0 = Date.now();
  await ytdlp([
    '-f', VIDEO_FORMAT,
    '--download-sections', `*${start}-${end}`,
    '--retries', 'infinite', '--fragment-retries', 'infinite', '--socket-timeout', '30',
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

/** Local OCR — no API tokens. */
async function ocrTsv(frame: string): Promise<string> {
  try {
    const { stdout } = await run(
      'tesseract',
      [frame, 'stdout', '--psm', '6', 'tsv'],
      { timeout: 60_000, maxBuffer: 16 * 1024 * 1024 },
    );
    return stdout;
  } catch { return ''; }
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
    .select('id, title, youtube_watch_url, runtime_minutes')
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
      const parsed = parseCreditFrame(
        parseTesseractTsv(await ocrTsv(frames[i])),
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
      String(e?.message ?? e).slice(0, 300),
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
  const { error: finishError } = await supabase.from('credit_harvest_jobs').update({
    status: outcome === 'error' ? 'failed' : 'done',
    outcome, candidates_found: candidates, error: error ?? null,
    processed_at: new Date().toISOString(),
    heartbeat_at: new Date().toISOString(),
  }).eq('id', job.id);
  if (finishError) throw new Error(`finish job: ${finishError.message}`);

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
  await setWorkerActivity(
    stopRequested ? 'stopping' : 'idle',
    resultMessage,
    null,
  );
}

/** Claim the next pending job (highest priority first). */
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
  if (arg('enqueue-sparse') !== undefined) { await enqueueSparse(Number(arg('enqueue-sparse')) || 4); return; }
  if (arg('requeue-low-coverage') !== undefined) { await requeueLowCoverage(Number(arg('requeue-low-coverage')) || 12); return; }

  await checkPrereqs();

  const single = arg('film');
  if (single) {
    await processJob({ id: null, film_id: single, channel_id: null, attempts: 0 });
    return;
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
      const paused = await isHarvestPaused();
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

      const job = await claim();
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
