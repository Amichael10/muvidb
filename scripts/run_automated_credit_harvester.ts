/**
 * Automated 3-Worker Credit Harvester & Consensus Pipeline
 *
 * Runs continuously backwards from newest films to the beginning of the database:
 * - Worker 1: Tail video download & standard layout OCR
 * - Worker 2: High-contrast edge OCR & YouTube metadata parsing
 * - Worker 3: Consensus, zero-duplicate reconciliation & direct credit auto-commit
 *
 * Usage:
 *   npx tsx scripts/run_automated_credit_harvester.ts                  # Continuous background daemon
 *   npx tsx scripts/run_automated_credit_harvester.ts --once           # Process 1 film and stop
 *   npx tsx scripts/run_automated_credit_harvester.ts --film=<id>      # Process specific film
 *   npx tsx scripts/run_automated_credit_harvester.ts --page=1         # Start from page 1 (dashboard order)
 *   npx tsx scripts/run_automated_credit_harvester.ts --force          # Re-process films even if they already have credits
 *   npx tsx scripts/run_automated_credit_harvester.ts --min-credits=0  # Minimum credit threshold (default 4)
 *   npx tsx scripts/run_automated_credit_harvester.ts --tail=300       # 5-minute tail (default 240s)
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, readdir, mkdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import dotenv from 'dotenv';
dotenv.config();

import {
  serviceSupabase,
  reconcileAndVerifyCredits,
  commitVerifiedCredits,
  type RawCandidate,
  normalizePersonName,
  NOISE_WORDS,
} from './lib/credit_consensus_verifier';
import { parseCreditFrameWithOcr } from './lib/credit_frame_ocr';
import { consolidateCreditObservations, type CreditObservation } from './lib/credit_roll_parser';

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

const execFileAsync = promisify(execFile);
const run = (file: string, args: string[], options: any = {}) =>
  execFileAsync(file, args, { maxBuffer: 64 * 1024 * 1024, ...options });

async function runWithRetry(file: string, args: string[], options: any = {}, retries = 3): Promise<any> {
  let lastErr: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await run(file, args, options);
    } catch (err: any) {
      lastErr = err;
      const isDnsError = /getaddrinfo|ETIMEDOUT|ENOTFOUND|socket timeout|HTTPSConnection/i.test(err.message || '');
      if (isDnsError && i < retries - 1) {
        console.warn(`      ⚠️ Network/DNS error on ${file}. Retrying attempt ${i + 2}/${retries} in ${(i + 1) * 4}s...`);
        await new Promise(r => setTimeout(r, (i + 1) * 4000));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

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

const TAIL_SECONDS = Number(arg('tail')) || 240; // Default: last 4 minutes
const FRAME_EVERY_SEC = Number(arg('frame-every')) || 3; // Default: 1 frame every 3 seconds (~80 frames for 240s tail)
const ONCE = arg('once') !== undefined;
const SINGLE_FILM = arg('film');
const COOKIES_PATH = [
  arg('cookies'),
  process.env.YTDLP_COOKIES_PATH,
  join(process.cwd(), 'cookies.txt'),
  'C:\\Users\\User\\Downloads\\Cookies.txt',
  'C:\\Users\\User\\Downloads\\cookies.txt',
].find((p) => p && existsSync(p));

const configuredClient = arg('client') ?? process.env.YTDLP_YOUTUBE_CLIENT;
const YT_CLIENT = !configuredClient || configuredClient === 'default' || configuredClient === 'auto'
  ? 'android,web'
  : configuredClient;
const clientArgs = YT_CLIENT ? ['--extractor-args', `youtube:player_client=${YT_CLIENT}`] : [];

function cleanTitle(raw: string): string {
  return raw
    .replace(/–\s*Latest.*$/i, '')
    .replace(/-\s*Latest.*$/i, '')
    .replace(/\|\s*Latest.*$/i, '')
    .replace(/Latest\s+(?:Nigerian|Yoruba|Nollywood)\s+Movie.*$/i, '')
    .replace(/\|\s*Full\s+Movie.*$/i, '')
    .replace(/\/\s*Full\s+Movie.*$/i, '')
    .replace(/#\w+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function safeRm(targetPath: string) {
  for (let i = 0; i < 5; i++) {
    try {
      if (existsSync(targetPath)) {
        await rm(targetPath, { recursive: true, force: true });
      }
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 250 * (i + 1)));
    }
  }
}

/** Extracts tail frames using yt-dlp + ffmpeg at 720p resolution */
async function extractTailFrames(url: string, dir: string): Promise<{
  frames: string[];
  durationSec: number;
  startSec: number;
  youtubeTitle?: string;
  youtubeDescription?: string;
}> {
  let probe: any = {};
  try {
    const probeArgs = [
      '--dump-json', '--no-warnings', '--no-playlist', '--skip-download',
      ...clientArgs,
      ...(COOKIES_PATH ? ['--cookies', COOKIES_PATH] : []),
      url,
    ];
    const probeProc = await runWithRetry('yt-dlp', probeArgs, { timeout: 120_000, maxBuffer: 64 * 1024 * 1024 });
    const rawOutput = (probeProc.stdout || '').trim();
    const lastLine = rawOutput.split('\n').filter(Boolean).at(-1) || rawOutput;
    probe = JSON.parse(lastLine);
  } catch (err: any) {
    console.warn(`   ⚠️ Metadata probe warning: ${err.message?.slice(0, 120) || 'Unknown'}`);
  }

  const durationSec = Number(probe.duration || 0);
  if (!durationSec || durationSec < 60) {
    return { frames: [], durationSec: 0, startSec: 0, youtubeTitle: probe.title, youtubeDescription: probe.description };
  }

  const startSec = Math.max(0, Math.floor(durationSec - TAIL_SECONDS));
  const tailFile = join(dir, 'tail.mp4');

  // Request 720p HD stream with fallback
  const downloadArgs = [
    '-f', '18/22/best[height<=720]/best',
    '--download-sections', `*${startSec}-${durationSec}`,
    '--retries', '2', '--fragment-retries', '2', '--socket-timeout', '20',
    ...clientArgs,
    ...(COOKIES_PATH ? ['--cookies', COOKIES_PATH] : []),
    '-o', tailFile,
    '--no-warnings', '--no-part', '--no-playlist',
    url,
  ];

  try {
    await runWithRetry('yt-dlp', downloadArgs, { timeout: 240_000 });
  } catch (dlErr: any) {
    console.warn(`   ⚠️ Tail download failed or timed out: ${dlErr.message?.slice(0, 120) || 'Unknown'}. Skipping tail OCR.`);
    await safeRm(tailFile);
    return { frames: [], durationSec, startSec, youtubeTitle: probe.title, youtubeDescription: probe.description };
  }

  if (!existsSync(tailFile) || statSync(tailFile).size < 100_000) {
    console.warn(`   ⚠️ Downloaded tail video is empty or corrupt (${existsSync(tailFile) ? statSync(tailFile).size : 0} bytes). Skipping tail OCR.`);
    await safeRm(tailFile);
    return { frames: [], durationSec, startSec, youtubeTitle: probe.title, youtubeDescription: probe.description };
  }

  // Extract frames in 720p HD safely
  try {
    await run('ffmpeg', [
      '-i', tailFile,
      '-vf', `fps=1/${FRAME_EVERY_SEC},scale=1280:-2`,
      '-q:v', '2',
      join(dir, 'f_%03d.jpg'),
      '-hide_banner', '-loglevel', 'error', '-y',
    ], { timeout: 120_000 });
  } catch (ffErr: any) {
    console.warn(`   ⚠️ FFmpeg frame extraction warning: ${ffErr.message.slice(0, 150)}`);
  }

  await safeRm(tailFile);

  const frames = (await readdir(dir))
    .filter((f) => f.startsWith('f_') && f.endsWith('.jpg'))
    .sort()
    .map((f) => join(dir, f));

  return { frames, durationSec, startSec, youtubeTitle: probe.title, youtubeDescription: probe.description };
}

/** Extracts opening title frames (first 150s) for films with head-only credits */
async function extractHeadFrames(url: string, dir: string): Promise<{ frames: string[]; startSec: number }> {
  const headFile = join(dir, 'head.mp4');
  const headEndSec = 150; // first 2.5 minutes

  const downloadArgs = [
    '-f', '18/22/best[height<=720]/best',
    '--download-sections', `*15-${headEndSec}`,
    '--retries', '2', '--socket-timeout', '20',
    ...clientArgs,
    ...(COOKIES_PATH ? ['--cookies', COOKIES_PATH] : []),
    '-o', headFile,
    '--no-warnings', '--no-part', '--no-playlist',
    url,
  ];

  try {
    await runWithRetry('yt-dlp', downloadArgs, { timeout: 120_000 });
    if (!existsSync(headFile) || statSync(headFile).size < 100_000) {
      await safeRm(headFile);
      return { frames: [], startSec: 15 };
    }

    await run('ffmpeg', [
      '-i', headFile,
      '-vf', 'fps=1/2,scale=1280:-2', // 1 frame every 2 seconds = ~60 frames
      '-q:v', '2',
      join(dir, 'h_%03d.jpg'),
      '-hide_banner', '-loglevel', 'error', '-y',
    ], { timeout: 60_000 });

    await safeRm(headFile);

    const frames = (await readdir(dir))
      .filter((f) => f.startsWith('h_') && f.endsWith('.jpg'))
      .sort()
      .map((f) => join(dir, f));

    return { frames, startSec: 15 };
  } catch {
    await safeRm(headFile);
    return { frames: [], startSec: 15 };
  }
}

/** Worker 2: YouTube Description and Title metadata parser */
function extractMetadataCandidates(title: string, description: string | null): RawCandidate[] {
  const candidates: RawCandidate[] = [];
  const text = `${title}\n\n${description || ''}`;

  // 1. Check parenthesized cast in YouTube title: "MOVIE NAME (Actor One, Actor Two, Actor Three)"
  const titleParenMatch = title.match(/\(([^)]+)\)/);
  if (titleParenMatch) {
    const names = titleParenMatch[1].split(/[,|&•/]/).map(s => s.trim()).filter(Boolean);
    for (const raw of names) {
      const clean = normalizePersonName(raw);
      if (clean && clean.length > 3 && clean.split(' ').length >= 2 && !NOISE_WORDS.some(nw => clean.toUpperCase().includes(nw))) {
        candidates.push({
          name: clean,
          role: 'actor',
          creditType: 'actor',
          confidence: 0.92,
          sourceWorker: 'metadata',
        });
      }
    }
  }

  // 2. Multi-line & inline cast parsing from description
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let inCastSection = false;
  let castSectionLinesLeft = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect section headers (e.g. "STARRING:", "CAST:", "FEATURING:")
    if (/^(?:starring|cast|featuring|actors?|cast\s*list)\s*[:\-–]?\s*$/i.test(line)) {
      inCastSection = true;
      castSectionLinesLeft = 15; // read up to next 15 lines
      continue;
    }

    // Inline "Starring: Name 1, Name 2, Name 3"
    const inlineCast = line.match(/^(?:starring|cast|featuring)\s*[:\-–]\s*(.+)$/i);
    if (inlineCast) {
      const names = inlineCast[1].split(/[,|&•\n/]/).map(s => s.trim()).filter(Boolean);
      for (const raw of names) {
        const clean = normalizePersonName(raw.replace(/^(?:as\s+.*|[-–].*)/i, ''));
        if (clean && clean.length > 3 && clean.split(' ').length >= 2 && !NOISE_WORDS.some(nw => clean.toUpperCase().includes(nw))) {
          candidates.push({
            name: clean,
            role: 'actor',
            creditType: 'actor',
            confidence: 0.92,
            sourceWorker: 'metadata',
          });
        }
      }
      inCastSection = true;
      castSectionLinesLeft = 10;
      continue;
    }

    if (inCastSection && castSectionLinesLeft > 0) {
      if (/^(?:directed|produced|executive|written|d\.?o\.?p|cinematography|editor|sound|music|story|synopsis|about|subscribe|watch|contact|follow)/i.test(line)) {
        inCastSection = false;
      } else {
        const cleanRaw = line.replace(/^[\d\s•\-–*#.]+|\s*[-–(].*$/g, '').trim();
        const clean = normalizePersonName(cleanRaw);
        if (clean && clean.length > 3 && clean.split(' ').length >= 2 && !NOISE_WORDS.some(nw => clean.toUpperCase().includes(nw))) {
          candidates.push({
            name: clean,
            role: 'actor',
            creditType: 'actor',
            confidence: 0.90,
            sourceWorker: 'metadata',
          });
        }
        castSectionLinesLeft--;
        continue;
      }
    }

    // Crew lines: "Directed by: Name", "Producer: Name", "Written by: Name", "DOP: Name", "Editor: Name"
    const crewPatterns: Array<{ re: RegExp; role: string; type: 'actor' | 'crew' }> = [
      { re: /(?:directed\s+by|director)\s*[:\-–]\s*([^\r\n,]+)/i, role: 'director', type: 'crew' },
      { re: /(?:produced\s+by|producer|executive\s+producer)\s*[:\-–]\s*([^\r\n,]+)/i, role: 'producer', type: 'crew' },
      { re: /(?:written\s+by|writer|screenplay|story\s+by)\s*[:\-–]\s*([^\r\n,]+)/i, role: 'writer', type: 'crew' },
      { re: /(?:d\.?o\.?p\.?|cinematograph(?:er|y)|director\s+of\s+photography|camera)\s*[:\-–]\s*([^\r\n,]+)/i, role: 'cinematographer', type: 'crew' },
      { re: /(?:edited\s+by|editor)\s*[:\-–]\s*([^\r\n,]+)/i, role: 'editor', type: 'crew' },
      { re: /(?:sound\s+design(?:er)?|sound\s+engineer|audio)\s*[:\-–]\s*([^\r\n,]+)/i, role: 'sound', type: 'crew' },
      { re: /(?:costume\s+design(?:er)?|wardrobe)\s*[:\-–]\s*([^\r\n,]+)/i, role: 'costume', type: 'crew' },
      { re: /(?:make\s*up|makeup\s*artist)\s*[:\-–]\s*([^\r\n,]+)/i, role: 'makeup', type: 'crew' },
    ];

    for (const cp of crewPatterns) {
      const match = line.match(cp.re);
      if (match) {
        const clean = normalizePersonName(match[1]);
        if (clean && clean.length > 3 && clean.split(' ').length >= 2 && !NOISE_WORDS.some(nw => clean.toUpperCase().includes(nw))) {
          candidates.push({
            name: clean,
            role: cp.role,
            creditType: cp.type,
            confidence: 0.95,
            sourceWorker: 'metadata',
          });
        }
      }
    }
  }

  // Deduplicate metadata candidates by canonical name key
  const seen = new Set<string>();
  return candidates.filter(c => {
    const key = `${c.name.toLowerCase()}_${c.role}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Process a single film through the 3-Worker pipeline */
async function processFilm(film: any): Promise<boolean> {
  const filmId = film.id;
  const filmTitle = film.title || 'Untitled';
  const url = film.youtube_watch_url || (film.trailer_youtube_id ? `https://www.youtube.com/watch?v=${film.trailer_youtube_id}` : null);

  if (!url) {
    console.log(`   ⏭️  [${filmTitle}] Skipping: No YouTube URL.`);
    return false;
  }

  console.log(`\n================================================================`);
  console.log(`🎬 Processing: "${filmTitle}" (${film.year || 'N/A'}) [ID: ${filmId}]`);
  console.log(`   URL: ${url}`);

  const tempDir = await mkdtemp(join(tmpdir(), 'harvest-'));

  try {
    // 1. Download tail & extract frames
    console.log(`   ⬇️  Worker 1: Downloading tail & extracting frames...`);
    const { frames, durationSec, startSec, youtubeTitle, youtubeDescription } = await extractTailFrames(url, tempDir);

    const worker1Raw: RawCandidate[] = [];

    if (frames.length > 0) {
      console.log(`   🖼️  Extracted ${frames.length} frames.`);
      console.log(`   🔍 Worker 1: Running parallel layout-aware OCR across ${frames.length} frames...`);
      const observations: CreditObservation[] = [];
      const BATCH_SIZE = 5;
      let doneCount = 0;
      for (let i = frames.length - 1; i >= 0; i -= BATCH_SIZE) {
        const batchPromises = [];
        for (let j = 0; j < BATCH_SIZE && (i - j) >= 0; j++) {
          const idx = i - j;
          const frameSec = idx * FRAME_EVERY_SEC;
          batchPromises.push(parseCreditFrameWithOcr(frames[idx], idx, frameSec, startSec + frameSec));
        }
        const results = await Promise.all(batchPromises);
        doneCount += results.length;
        if (doneCount % 20 === 0 || doneCount <= BATCH_SIZE || doneCount >= frames.length) {
          console.log(`      ... scanned frame ${doneCount}/${frames.length}`);
        }
        for (const obs of results) {
          if (obs && obs.length > 0) observations.push(...obs);
        }
      }

      let consolidated = consolidateCreditObservations(observations);

      // If tail credits yielded very few candidates, check opening sequence (first 150s)
      if (consolidated.length < 3) {
        console.log(`   ℹ️  Tail credits sparse (${consolidated.length} found). Checking head / opening sequence...`);
        const { frames: headFrames, startSec: headStartSec } = await extractHeadFrames(url, tempDir);
        if (headFrames.length > 0) {
          console.log(`   🎬 Scanning ${headFrames.length} opening title frames...`);
          const headObs: CreditObservation[] = [];
          for (let i = 0; i < headFrames.length; i += BATCH_SIZE) {
            const batchPromises = [];
            for (let j = 0; j < BATCH_SIZE && (i + j) < headFrames.length; j++) {
              const idx = i + j;
              const frameSec = idx * 2;
              batchPromises.push(parseCreditFrameWithOcr(headFrames[idx], idx, frameSec, headStartSec + frameSec));
            }
            const results = await Promise.all(batchPromises);
            for (const obs of results) {
              if (obs && obs.length > 0) headObs.push(...obs);
            }
          }
          if (headObs.length > 0) {
            const headConsolidated = consolidateCreditObservations(headObs);
            consolidated = [...consolidated, ...headConsolidated];
          }
        }
      }

      for (const p of consolidated) {
        worker1Raw.push({
          name: p.name,
          role: p.roleOrCharacter,
          creditType: p.creditType,
          confidence: p.ocrConfidence,
          frameIndex: p.frameIndex,
          frameSec: p.frameSec,
          videoSec: p.videoSec,
          frameSupport: p.frameSupport,
          evidenceText: p.evidenceText,
          sourceWorker: 'worker1',
        });
      }

      if (worker1Raw.length > 0) {
        console.log(`   👁️  Worker 1 extracted ${worker1Raw.length} raw candidate(s) from OCR:`);
        for (const c of worker1Raw) {
          console.log(`      • ${c.creditType.toUpperCase()}: ${c.name} (Role: ${c.role}, Frames: ${c.frameSupport})`);
        }
      } else {
        console.log(`   👁️  Worker 1 extracted 0 raw candidates from OCR.`);
      }
    } else {
      console.log(`   ℹ️  Skipping Worker 1 OCR (video frames unavailable). Proceeding to Worker 2 metadata parsing...`);
    }

    // 3. Worker 2: YouTube Description and Title metadata parser
    console.log(`   🧠 Worker 2: Extracting metadata & title cast...`);
    const metadataCandidates = extractMetadataCandidates(
      youtubeTitle || filmTitle,
      youtubeDescription || film.synopsis,
    );
    if (metadataCandidates.length > 0) {
      console.log(`      Found ${metadataCandidates.length} cast/crew from official video metadata.`);
    }

    // 4. Worker 3 (The Verifier): Consensus & Zero-Duplicate Auto-Commit
    console.log(`   ⚖️  Worker 3: Reconciling consensus & verifying credits...`);
    const verifiedCredits = await reconcileAndVerifyCredits(filmId, worker1Raw, [], metadataCandidates, filmTitle);

    console.log(`   📋 Worker 3 Verified ${verifiedCredits.length} credits:`);
    for (const c of verifiedCredits) {
      console.log(`      • ${c.role.toUpperCase()}: ${c.personName} (Score: ${(c.consensusScore * 100).toFixed(0)}%, Sources: ${c.verifiedSources.join('+')})`);
    }

    if (verifiedCredits.length > 0) {
      const committed = await commitVerifiedCredits(filmId, verifiedCredits);
      console.log(`   ✅ Successfully committed ${committed} credits to database!`);
      return true;
    } else {
      console.log(`   ⚠️  No credits met the consensus verification threshold.`);
      return false;
    }
  } catch (err: any) {
    console.error(`   ❌ Error processing film ${filmTitle}:`, err.message);
    return false;
  } finally {
    await safeRm(tempDir);
  }
}

async function main() {
  console.log('================================================================');
  console.log('🚀 AUTOMATED 3-WORKER CREDIT HARVESTER & CONSENSUS DAEMON');
  console.log('================================================================');

  if (SINGLE_FILM) {
    const { data: film } = await serviceSupabase.from('films').select('*').eq('id', SINGLE_FILM).single();
    if (film) await processFilm(film);
    else console.error(`Film ID ${SINGLE_FILM} not found.`);
    return;
  }

  let processedCount = 0;
  let dbErrorCount = 0;
  const attemptedFilmIds = new Set<string>();

  const pageVal = arg('page') ? parseInt(arg('page')!, 10) : undefined;
  const offsetVal = arg('offset') ? parseInt(arg('offset')!, 10) : undefined;
  const forceReharvest = arg('force') !== undefined;
  const minCreditsThreshold = arg('min-credits') !== undefined ? parseInt(arg('min-credits')!, 10) : 7;

  let offset = offsetVal !== undefined ? offsetVal : (pageVal ? (pageVal - 1) * 20 : 0);
  const limit = 40;

  if (pageVal) {
    console.log(`📌 Configured to start from Dashboard Page ${pageVal} (offset ${offset}).`);
  }
  if (forceReharvest) {
    console.log(`⚡ Force mode enabled: processing films regardless of existing credit count.`);
  }

  while (true) {
    console.log(`\n🔎 Finding next batch of films (offset: ${offset})...`);

    const { data: films, error } = await serviceSupabase
      .from('films')
      .select('id, title, year, release_date, youtube_watch_url, trailer_youtube_id, synopsis, created_at')
      .or('youtube_watch_url.not.is.null,trailer_youtube_id.not.is.null')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      dbErrorCount++;
      console.error(`Database query error (attempt ${dbErrorCount}):`, error.message);
      if (dbErrorCount >= 3) {
        console.warn('Persistent DB connection issue. Advancing offset to prevent endless stall...');
        offset += limit;
        dbErrorCount = 0;
      }
      await new Promise(r => setTimeout(r, 10000));
      continue;
    }
    dbErrorCount = 0;

    if (!films || films.length === 0) {
      console.log('🎉 Reached end of film library. Resetting offset to 0 and sleeping for 60s...');
      offset = 0;
      attemptedFilmIds.clear();
      await new Promise(r => setTimeout(r, 60000));
      continue;
    }

    const unattempted = films.filter(f => !attemptedFilmIds.has(f.id));
    if (unattempted.length === 0) {
      offset += limit;
      continue;
    }

    const unattemptedIds = unattempted.map(f => f.id);
    const { data: existingCredits } = await serviceSupabase
      .from('credits')
      .select('film_id')
      .in('film_id', unattemptedIds);

    const creditCounts = new Map<string, number>();
    for (const row of (existingCredits || []) as any[]) {
      creditCounts.set(row.film_id, (creditCounts.get(row.film_id) || 0) + 1);
    }

    const batchFilms = [];
    for (const f of unattempted) {
      const count = creditCounts.get(f.id) || 0;
      if (forceReharvest || count < minCreditsThreshold) {
        batchFilms.push(f);
      } else {
        attemptedFilmIds.add(f.id);
      }
    }

    if (batchFilms.length === 0) {
      offset += limit;
      continue;
    }

    for (const film of batchFilms) {
      attemptedFilmIds.add(film.id);
      await processFilm(film);
      processedCount++;

      if (ONCE) {
        console.log('\n--once flag specified. Exiting cleanly.');
        return;
      }

      // Gentle pacing
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

main().catch(console.error);
