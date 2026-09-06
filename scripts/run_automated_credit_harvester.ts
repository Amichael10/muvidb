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
 *   npx tsx scripts/run_automated_credit_harvester.ts --tail=300       # 5-minute tail (default 240s)
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
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
} from './lib/credit_consensus_verifier';
import { parseCreditFrameWithOcr } from './lib/credit_frame_ocr';
import { consolidateCreditObservations } from './lib/credit_roll_parser';

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

const TAIL_SECONDS = Number(arg('tail')) || 240; // Default: last 4 minutes
const ONCE = arg('once') !== undefined;
const SINGLE_FILM = arg('film');
const COOKIES_PATH = arg('cookies') || (existsSync('C:\\Users\\User\\Downloads\\Cookies.txt') ? 'C:\\Users\\User\\Downloads\\Cookies.txt' : undefined);

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

/** Extracts tail frames using yt-dlp + ffmpeg */
async function extractTailFrames(url: string, dir: string): Promise<{ frames: string[]; durationSec: number; startSec: number }> {
  const probeArgs = [
    '--dump-json', '--no-warnings', '--skip-download',
    ...(COOKIES_PATH ? ['--cookies', COOKIES_PATH] : []),
    url,
  ];

  const probe = JSON.parse((await run('yt-dlp', probeArgs, { timeout: 60_000 })).stdout);
  const durationSec = Number(probe.duration || 0);

  if (!durationSec || durationSec < 60) {
    return { frames: [], durationSec: 0, startSec: 0 };
  }

  const startSec = Math.max(0, Math.floor(durationSec - TAIL_SECONDS));
  const tailFile = join(dir, 'tail.mp4');

  const downloadArgs = [
    ...(COOKIES_PATH ? ['--cookies', COOKIES_PATH] : []),
    '--download-sections', `*${startSec}-inf`,
    '-f', '18/134/135/bestvideo[height<=480]/best[height<=480]',
    '-o', tailFile,
    '--no-warnings', '--no-part',
    url,
  ];

  await run('yt-dlp', downloadArgs, { timeout: 480_000 });

  if (!existsSync(tailFile)) {
    return { frames: [], durationSec, startSec };
  }

  // Extract frames at 1 frame per second
  await run('ffmpeg', [
    '-i', tailFile,
    '-vf', 'fps=1,scale=960:-2',
    '-q:v', '3',
    join(dir, 'f_%03d.jpg'),
    '-hide_banner', '-loglevel', 'error', '-y',
  ], { timeout: 120_000 });

  await rm(tailFile, { force: true });

  const frames = (await readdir(dir))
    .filter((f) => f.startsWith('f_') && f.endsWith('.jpg'))
    .sort()
    .map((f) => join(dir, f));

  return { frames, durationSec, startSec };
}

/** Worker 2: YouTube Description and Title metadata parser */
function extractMetadataCandidates(title: string, description: string | null): RawCandidate[] {
  const candidates: RawCandidate[] = [];
  const text = `${title} ${description || ''}`;

  // Known patterns in descriptions: "Starring: Name, Name", "Cast: Name, Name", "Directed by: Name"
  const castMatch = text.match(/(?:starring|cast|featuring)\s*[:\-–]\s*([^\n\r]+)/i);
  if (castMatch) {
    const names = castMatch[1].split(/[,|&•\n]/).map(s => s.trim()).filter(Boolean);
    for (const raw of names) {
      const clean = normalizePersonName(raw);
      if (clean && clean.length > 3 && clean.split(' ').length >= 2) {
        candidates.push({
          name: clean,
          role: 'actor',
          creditType: 'actor',
          confidence: 0.90,
          sourceWorker: 'metadata',
        });
      }
    }
  }

  const dirMatch = text.match(/(?:directed\s+by|director)\s*[:\-–]\s*([^\n\r,]+)/i);
  if (dirMatch) {
    const clean = normalizePersonName(dirMatch[1]);
    if (clean && clean.length > 3 && clean.split(' ').length >= 2) {
      candidates.push({
        name: clean,
        role: 'director',
        creditType: 'crew',
        confidence: 0.95,
        sourceWorker: 'metadata',
      });
    }
  }

  const prodMatch = text.match(/(?:produced\s+by|producer)\s*[:\-–]\s*([^\n\r,]+)/i);
  if (prodMatch) {
    const clean = normalizePersonName(prodMatch[1]);
    if (clean && clean.length > 3 && clean.split(' ').length >= 2) {
      candidates.push({
        name: clean,
        role: 'producer',
        creditType: 'crew',
        confidence: 0.95,
        sourceWorker: 'metadata',
      });
    }
  }

  return candidates;
}

/** Process a single film through the 3-Worker pipeline */
async function processFilm(film: any): Promise<boolean> {
  const filmId = film.id;
  const filmTitle = film.title || 'Untitled';
  const url = film.youtube_watch_url || (film.youtube_id ? `https://www.youtube.com/watch?v=${film.youtube_id}` : null);

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
    const { frames, durationSec, startSec } = await extractTailFrames(url, tempDir);

    if (!frames.length) {
      console.log(`   ⚠️  No frames extracted (video unavailable or too short).`);
      return false;
    }
    console.log(`   🖼️  Extracted ${frames.length} frames.`);

    // 2. Worker 1 (Pass A): Standard Layout OCR
    console.log(`   🔍 Worker 1: Running layout-aware OCR across ${frames.length} frames...`);
    const worker1Raw: RawCandidate[] = [];
    for (let i = frames.length - 1; i >= 0; i--) {
      const frameSec = i;
      const obs = await parseCreditFrameWithOcr(frames[i], i, frameSec, startSec + frameSec);
      for (const o of obs) {
        worker1Raw.push({
          name: o.name,
          role: o.roleOrCharacter,
          creditType: o.creditType,
          confidence: o.ocrConfidence,
          frameIndex: o.frameIndex,
          frameSec: o.frameSec,
          videoSec: o.videoSec,
          frameSupport: 1,
          evidenceText: o.evidenceText,
          sourceWorker: 'worker1',
        });
      }
    }

    // 3. Worker 2 (Pass B): Metadata + High-confidence pass
    console.log(`   🧠 Worker 2: Extracting metadata & title cast...`);
    const metadataCandidates = extractMetadataCandidates(filmTitle, film.synopsis);

    // 4. Worker 3 (The Verifier): Consensus & Zero-Duplicate Auto-Commit
    console.log(`   ⚖️  Worker 3: Reconciling consensus & verifying credits...`);
    const verifiedCredits = await reconcileAndVerifyCredits(filmId, worker1Raw, [], metadataCandidates);

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
    await rm(tempDir, { recursive: true, force: true });
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

  while (true) {
    // Fetch films ordered from newest / today backwards where credits < 4
    console.log('\n🔎 Finding next batch of films needing credits (newest first)...');

    const { data: films, error } = await serviceSupabase
      .from('films')
      .select('id, title, year, release_date, youtube_watch_url, youtube_id, synopsis, created_at')
      .not('youtube_watch_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      console.error('Database query error:', error.message);
      await new Promise(r => setTimeout(r, 10000));
      continue;
    }

    if (!films || films.length === 0) {
      console.log('🎉 No outstanding films found needing credit harvesting. Sleeping for 60s...');
      await new Promise(r => setTimeout(r, 60000));
      continue;
    }

    // Filter films with < 4 existing credits
    let batchFilms = [];
    for (const f of films) {
      const { count } = await serviceSupabase
        .from('credits')
        .select('*', { count: 'exact', head: true })
        .eq('film_id', f.id);

      if ((count ?? 0) < 4) {
        batchFilms.push(f);
      }
    }

    if (batchFilms.length === 0) {
      console.log('All checked films in current window have full credits. Scanning older records...');
      break;
    }

    for (const film of batchFilms) {
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
