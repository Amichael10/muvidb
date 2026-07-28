/**
 * Headless credit-roll harvester. Runs unattended on a spare machine.
 *
 *   npx tsx scripts/harvest_credits.ts --enqueue-sparse     # films with < 4 credits (MAIN)
 *   npx tsx scripts/harvest_credits.ts --enqueue-sparse=2   # films with < 2 credits
 *   npx tsx scripts/harvest_credits.ts --enqueue-recon      # 3 films/channel (recon)
 *   npx tsx scripts/harvest_credits.ts --enqueue-popular=2000
 *   npx tsx scripts/harvest_credits.ts                      # run the worker loop
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
import { mkdtemp, mkdir, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { supabase } from './lib/db';

const run = promisify(execFile);

const arg = (n: string) => {
  const hit = process.argv.find((a) => a.startsWith(`--${n}`));
  if (!hit) return undefined;
  const eq = hit.indexOf('=');
  return eq === -1 ? 'true' : hit.slice(eq + 1);
};

const TAIL_PCT = 0.14;          // download the last 14% — where rolls live
const MIN_ENTRIES = 4;          // structural gate: fewer than this isn't a roll
const FRAME_EVERY_SEC = 3;      // sample cadence inside the tail

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

// yt-dlp cookies, to get past "Sign in to confirm you're not a bot". Pass a
// Netscape cookies.txt via --cookies=<path> (or YT_COOKIES env), or pull live
// from an installed browser via --cookies-from-browser=chrome|edge|firefox.
const COOKIES_FILE = arg('cookies') ?? process.env.YT_COOKIES;
const COOKIES_BROWSER = arg('cookies-from-browser');
function cookieArgs(): string[] {
  if (COOKIES_FILE) return ['--cookies', COOKIES_FILE];
  if (COOKIES_BROWSER) return ['--cookies-from-browser', COOKIES_BROWSER];
  return [];
}

// --frames-only: download the tail + extract frames, NO OCR. This validates the
// two things that actually decide the project — can we download these videos,
// and is the credit roll in the tail — before committing to an OCR engine.
const FRAMES_ONLY = arg('frames-only') !== undefined;

// ---------------------------------------------------------------- prereqs ---
async function checkPrereqs() {
  // Only require the tools the chosen mode actually uses. yt-dlp + ffmpeg are
  // always needed; tesseract only when we OCR (skipped in --frames-only).
  const need: Array<[string, string[]]> = [['yt-dlp', ['--version']], ['ffmpeg', ['-version']]];
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
 * credits (>=4) and re-harvesting them is pure waste. Ordered by view_count so
 * the films users actually land on are done first.
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
      .select('id, view_count')
      .eq('is_published', true)
      .not('youtube_watch_url', 'is', null)
      .range(from, from + 999);
    if (error) throw new Error(`films: ${error.message}`);
    if (!data?.length) break;
    for (const f of data as any[]) {
      if ((creditCount.get(f.id) ?? 0) < minCredits) {
        rows.push({ film_id: f.id, channel_id: null, priority: Math.round(Math.log10((f.view_count ?? 0) + 1) * 10) });
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

// ------------------------------------------------------------- processing ---
/** Run yt-dlp and, on failure, surface its actual stderr (not just "command failed"). */
async function ytdlp(args: string[]): Promise<{ stdout: string; stderr: string }> {
  try {
    return await run('yt-dlp', args, { timeout: 300_000, maxBuffer: 32 * 1024 * 1024 });
  } catch (e: any) {
    const detail = String(e?.stderr || e?.stdout || e?.message || '')
      .trim().split('\n').filter(Boolean).slice(-4).join('  |  ');
    throw new Error(detail || 'yt-dlp failed');
  }
}

/** Ask yt-dlp for the video duration in seconds (no download). */
async function probeDuration(url: string): Promise<number> {
  const { stdout } = await ytdlp(['--skip-download', '--no-warnings', '--print', '%(duration)s', ...cookieArgs(), url]);
  const d = parseInt(String(stdout).trim(), 10);
  return Number.isFinite(d) && d > 0 ? d : 0;
}

/**
 * Pull the tail of the video at low res. yt-dlp's --download-sections takes
 * TIMESTAMPS, not percentages (the previous *86%-100% was invalid), so we probe
 * the real duration first, fall back to the DB runtime, and section by seconds.
 */
async function downloadTail(url: string, dir: string, runtimeSecHint = 0): Promise<string> {
  const out = join(dir, 'tail.mp4');

  let duration = 0;
  try { duration = await probeDuration(url); } catch { /* fall back to hint */ }
  if (!duration) duration = runtimeSecHint;
  if (!duration) throw new Error('could not determine video duration (probe failed, no DB runtime)');

  const start = Math.max(0, Math.floor(duration * (1 - TAIL_PCT)));
  const end = Math.ceil(duration) + 5; // a hair past the end; explicit beats "inf"

  // worst video that's still >=360p keeps text legible while staying tiny.
  await ytdlp([
    '-f', 'worstvideo[height>=360]/worst',
    '--download-sections', `*${start}-${end}`,
    '--force-keyframes-at-cuts',
    ...cookieArgs(),
    '-o', out,
    '--no-playlist', '--no-warnings',
    url,
  ]);
  return out;
}

/** Extract sampled frames from the tail. */
async function extractFrames(video: string, dir: string): Promise<string[]> {
  await run('ffmpeg', [
    '-i', video,
    '-vf', `fps=1/${FRAME_EVERY_SEC},scale=960:-1`,
    '-q:v', '3',
    join(dir, 'f_%03d.jpg'),
    '-hide_banner', '-loglevel', 'error',
  ], { timeout: 300_000 });
  return (await readdir(dir)).filter((f) => f.startsWith('f_')).sort().map((f) => join(dir, f));
}

/** Local OCR — no API tokens. */
async function ocr(frame: string): Promise<string> {
  try {
    const { stdout } = await run('tesseract', [frame, 'stdout', '--psm', '6'], { timeout: 60_000 });
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

  if (!film?.youtube_watch_url) {
    await finish(job, 'unavailable', 0, 'no youtube url');
    return;
  }

  // --frames-only: write to a durable, inspectable folder in the project so you
  // can open it and SEE whether the tail actually contains the credit roll.
  const dir = FRAMES_ONLY
    ? join(process.cwd(), 'harvest_frames', job.film_id)
    : await mkdtemp(join(tmpdir(), 'harvest-'));
  if (FRAMES_ONLY) await mkdir(dir, { recursive: true });

  try {
    console.log(`   ⬇️  downloading tail of "${film.title?.slice(0, 45)}"…`);
    const video = await downloadTail(film.youtube_watch_url, dir, (film.runtime_minutes ?? 0) * 60);
    const frames = await extractFrames(video, dir);
    if (!frames.length) { await finish(job, 'no_credits', 0, 'no frames'); return; }

    if (FRAMES_ONLY) {
      // Stop here — no OCR, no DB writes. Just prove download+frames work.
      await rm(video, { force: true }); // drop the video, keep the frames
      console.log(`   🖼️  ${frames.length} frames saved → ${dir}`);
      console.log('       Open that folder: the last few frames should show the credit roll.');
      return;
    }

    // OCR frames from the END backwards — rolls sit at the very end, and this
    // finds them with the fewest OCR calls.
    const found = new Map<string, Parsed & { frameSec: number }>();
    let rollFrames = 0;
    for (let i = frames.length - 1; i >= 0; i--) {
      const parsed = parseCredits(await ocr(frames[i]));
      if (!parsed) continue;
      rollFrames++;
      const sec = i * FRAME_EVERY_SEC;
      for (const p of parsed) {
        const key = p.name.toLowerCase();
        if (!found.has(key)) found.set(key, { ...p, frameSec: sec });
      }
    }

    if (!found.size) { await finish(job, 'no_credits', 0); return; }

    // Resolve names against existing people so the reviewer sees matches, and
    // so confidence reflects "this is a person we already know".
    const rows = [];
    for (const p of found.values()) {
      let matched: string | null = null;
      try {
        const { data } = await supabase.rpc('find_person_by_name', { p_name: p.name });
        matched = (data as string) || null;
      } catch { /* matcher optional */ }
      const conf = Math.min(1,
        0.35                              // base: survived the structural gate
        + (matched ? 0.35 : 0)            // resolves to a known person
        + (p.role ? 0.15 : 0)             // had an explicit role label
        + Math.min(0.15, rollFrames * 0.03), // appeared across several roll frames
      );
      rows.push({
        film_id: job.film_id, job_id: job.id,
        raw_name: p.name, role_or_character: p.role,
        credit_type: p.type, confidence: Number(conf.toFixed(2)),
        matched_person_id: matched, source_frame_sec: p.frameSec,
      });
    }

    const { error } = await supabase.from('credit_candidates').insert(rows);
    if (error) throw new Error(error.message);
    await finish(job, 'credits_found', rows.length);
    console.log(`   ✅ ${film.title?.slice(0, 45)} → ${rows.length} candidates`);
  } catch (e: any) {
    await finish(job, 'error', 0, String(e?.message ?? e).slice(0, 300));
    console.log(`   ❌ ${film.title?.slice(0, 45)} → ${String(e?.message ?? e).slice(0, 80)}`);
  } finally {
    // Keep frames-only output (that's the whole point) and honour --keep;
    // otherwise wipe the temp dir.
    if (!FRAMES_ONLY && arg('keep') === undefined) await rm(dir, { recursive: true, force: true });
  }
}

async function finish(job: Job, outcome: string, candidates: number, error?: string) {
  // --film debug mode has no queue row to update.
  if (!job.id) { console.log(`   [debug] outcome=${outcome} candidates=${candidates}${error ? ` error=${error}` : ''}`); return; }
  await supabase.from('credit_harvest_jobs').update({
    status: outcome === 'error' ? 'failed' : 'done',
    outcome, candidates_found: candidates, error: error ?? null,
    processed_at: new Date().toISOString(),
  }).eq('id', job.id);
}

/** Claim the next pending job (highest priority first). */
async function claim(): Promise<Job | null> {
  const { data } = await supabase
    .from('credit_harvest_jobs')
    .select('id, film_id, channel_id, attempts')
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1);
  const job = data?.[0] as Job | undefined;
  if (!job) return null;
  const { error } = await supabase
    .from('credit_harvest_jobs')
    .update({ status: 'running', attempts: job.attempts + 1, started_at: new Date().toISOString() })
    .eq('id', job.id)
    .eq('status', 'pending'); // guard against a second worker taking it
  if (error) return null;
  return job;
}

async function main() {
  if (arg('enqueue-recon') !== undefined) { await enqueueRecon(Number(arg('enqueue-recon')) || 3); return; }
  if (arg('enqueue-popular') !== undefined) { await enqueuePopular(Number(arg('enqueue-popular')) || 2000); return; }
  if (arg('enqueue-sparse') !== undefined) { await enqueueSparse(Number(arg('enqueue-sparse')) || 4); return; }

  await checkPrereqs();

  const single = arg('film');
  if (single) {
    await processJob({ id: null, film_id: single, channel_id: null, attempts: 0 });
    return;
  }

  console.log('👷 Worker started. Ctrl-C to stop; progress is saved per film.\n');
  let done = 0;
  for (;;) {
    const job = await claim();
    if (!job) {
      if (arg('once') !== undefined) break;
      console.log('   …queue empty, sleeping 60s');
      await new Promise((r) => setTimeout(r, 60_000));
      continue;
    }
    await processJob(job);
    done++;
    if (done % 25 === 0) console.log(`— ${done} films processed —`);
    if (arg('once') !== undefined) break;
    // Gentle pacing so we don't look like a scraper.
    await new Promise((r) => setTimeout(r, 2000 + Math.random() * 3000));
  }
}

main().catch((e) => { console.error('💀 harvest_credits failed:', e); process.exit(1); });
