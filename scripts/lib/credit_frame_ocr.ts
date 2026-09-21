import { spawn, execFile, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  parseCreditFrame,
  parseTesseractTsv,
  groupWordsIntoOcrLines,
  type CreditObservation,
} from './credit_roll_parser';

const localTessdata = join(process.cwd(), 'tessdata');
if (existsSync(join(localTessdata, 'eng.traineddata'))) {
  process.env.TESSDATA_PREFIX = localTessdata;
} else if (process.platform === 'win32') {
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

function getTesseractFlags(): { langs: string } {
  const activeTessdata = (process.env.TESSDATA_PREFIX && existsSync(process.env.TESSDATA_PREFIX))
    ? process.env.TESSDATA_PREFIX
    : join(process.cwd(), 'tessdata');
  const langs = ['eng'];
  if (existsSync(join(activeTessdata, 'yor.traineddata'))) langs.push('yor');
  if (existsSync(join(activeTessdata, 'ibo.traineddata'))) langs.push('ibo');
  return { langs: langs.join('+') };
}

function run(command: string, args: string[], timeoutMs = 60_000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const stdoutBuf = execFileSync(command, args, {
        cwd: process.cwd(),
        maxBuffer: 32 * 1024 * 1024,
        windowsHide: true,
      });
      resolve(stdoutBuf);
    } catch (err: any) {
      if (err.stdout && err.stdout.length > 0) {
        resolve(err.stdout);
      } else {
        reject(err);
      }
    }
  });
}

export async function prepareCreditFrame(frame: string): Promise<string> {
  return frame;
}

export async function runPaddleOcrBatch(framePaths: string[]): Promise<Map<string, OcrWord[]>> {
  const result = new Map<string, OcrWord[]>();
  if (framePaths.length === 0) return result;

  const normalizedPaths = framePaths.map(p => p.replace(/\\/g, '/'));

  try {
    const pythonExe = process.platform === 'win32'
      ? [
          'C:\\Python313\\python.exe',
          join(process.env.LOCALAPPDATA || '', 'Programs\\Python\\Python313\\python.exe'),
          'C:\\Program Files\\Python313\\python.exe',
          'python',
        ].find(p => p && (p === 'python' || existsSync(p))) || 'python'
      : 'python3';
    const scriptPath = 'scripts/paddle_frame_ocr.py';
    const stdoutBuf = await run(pythonExe, [scriptPath, ...normalizedPaths], 120_000);
    const rawStr = stdoutBuf.toString('utf-8').trim();
    if (!rawStr) return result;

    const jsonStart = rawStr.indexOf('{');
    const jsonEnd = rawStr.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      console.log('No JSON found in rawStr:', rawStr.slice(0, 300));
      return result;
    }

    const jsonStr = rawStr.substring(jsonStart, jsonEnd + 1);
    const data = JSON.parse(jsonStr);
    console.log('runPaddleOcrBatch parsed data keys:', Object.keys(data));

    for (const p of framePaths) {
      const normP = p.replace(/\\/g, '/');
      const matchingKey = Object.keys(data).find(k => {
        const normK = k.replace(/\\/g, '/');
        return normK === normP || normK.endsWith(normP) || normP.endsWith(normK);
      });
      const rawWords = matchingKey ? data[matchingKey] : (data[Object.keys(data)[0]] || []);
      if (Array.isArray(rawWords) && rawWords.length > 0) {
        const sorted = [...rawWords].sort((a, b) => a.top - b.top || a.left - b.left);
        let currentLineY = -1;
        let lineIdx = 0;
        const words: OcrWord[] = sorted.map((w: any) => {
          if (currentLineY === -1 || Math.abs(w.top - currentLineY) > 15) {
            currentLineY = w.top;
            lineIdx++;
          }
          return {
            text: String(w.text || ''),
            left: Number(w.left || 0),
            top: Number(w.top || 0),
            width: Number(w.width || 0),
            height: Number(w.height || 0),
            confidence: Number(w.confidence || 0),
            lineKey: `line_${lineIdx}`,
          };
        });
        result.set(p, words);
      } else {
        result.set(p, []);
      }
    }
    return result;
  } catch (err: any) {
    console.error('runPaddleOcrBatch error details:', err?.stack || err, 'stderr:', err?.stderr?.toString());
    return result;
  }
}

async function runPaddleOcr(framePath: string): Promise<OcrWord[]> {
  const map = await runPaddleOcrBatch([framePath]);
  return map.get(framePath) || [];
}

// Remove repeated tiny connected components (leader dots), keeping the tall
// strokes of names intact. Morphological erosion also damages thin credit fonts.
function removeDottedLeaders(pixels: Buffer, width: number, height: number): boolean {
  const visited = new Uint8Array(pixels.length);
  const queue = new Int32Array(pixels.length);
  const dots: number[][] = [];
  for (let start = 0; start < pixels.length; start++) {
    if (visited[start] || pixels[start] < 55) continue;
    let head = 0;
    let tail = 1;
    queue[0] = start;
    visited[start] = 1;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const neighbor = ny * width + nx;
          if (!visited[neighbor] && pixels[neighbor] >= 55) {
            visited[neighbor] = 1;
            queue[tail++] = neighbor;
          }
        }
      }
    }
    if (maxY - minY + 1 <= Math.max(3, height / 200) && maxX - minX + 1 <= Math.max(3, width / 250)) {
      dots.push(Array.from(queue.subarray(0, tail)));
    }
  }
  if (dots.length < 25) return false;
  for (const dot of dots) for (const index of dot) pixels[index] = 0;
  return true;
}

function passScore(credits: CreditObservation[]): number {
  const crewRoles = new Set(credits.filter((credit) => credit.creditType === 'crew')
    .map((credit) => credit.roleOrCharacter));
  const castPairs = credits.filter((credit) => credit.layout.mode === 'two-column-cast').length;
  const confidence = credits.reduce((total, credit) => total + credit.ocrConfidence, 0);
  return crewRoles.size * 4 + castPairs * 2 + confidence;
}

/** Dual OCR engine (PaddleOCR primary for video cards, Tesseract fallback) */
export async function parseCreditFrameWithOcr(
  frame: string,
  frameIndex: number,
  frameSec: number,
  videoSec: number,
): Promise<CreditObservation[]> {
  // 1. Try PaddleOCR first
  const paddleWords = await runPaddleOcr(frame);
  if (paddleWords.length > 0) {
    const paddleLines = groupWordsIntoOcrLines(paddleWords);
    const obsPaddle = parseCreditFrame(paddleLines, frameIndex, frameSec, videoSec);
    if (obsPaddle.length > 0) return obsPaddle;
  }

  // 2. Fallback to Tesseract
  const { langs } = getTesseractFlags();
  try {
    const tsv11 = await run('tesseract', [frame, 'stdout', '-l', langs, '--psm', '11', 'tsv']);
    const obs11 = parseCreditFrame(parseTesseractTsv(tsv11.toString()), frameIndex, frameSec, videoSec);
    if (obs11.length > 0) return obs11;

    const tsv6 = await run('tesseract', [frame, 'stdout', '-l', langs, '--psm', '6', 'tsv']);
    return parseCreditFrame(parseTesseractTsv(tsv6.toString()), frameIndex, frameSec, videoSec);
  } catch {
    return [];
  }
}

export async function parseCreditFramesBatchWithOcr(
  items: Array<{ frame: string; frameIndex: number; frameSec: number; videoSec: number }>
): Promise<CreditObservation[]> {
  if (items.length === 0) return [];
  const observations: CreditObservation[] = [];
  const paths = items.map(item => item.frame);

  // 1. Run PaddleOCR batch across all frames in a single Python invocation
  const paddleMap = await runPaddleOcrBatch(paths);
  const fallbackItems: Array<{ frame: string; frameIndex: number; frameSec: number; videoSec: number }> = [];

  for (const item of items) {
    const paddleWords = paddleMap.get(item.frame) || [];
    if (paddleWords.length > 0) {
      const paddleLines = groupWordsIntoOcrLines(paddleWords);
      const obsPaddle = parseCreditFrame(paddleLines, item.frameIndex, item.frameSec, item.videoSec);
      if (obsPaddle.length > 0) {
        observations.push(...obsPaddle);
        continue;
      }
    }
    fallbackItems.push(item);
  }

  // 2. Fallback to Tesseract ONLY if PaddleOCR yielded zero observations for the entire batch
  if (observations.length === 0 && fallbackItems.length > 0) {
    const { langs } = getTesseractFlags();
    for (const item of fallbackItems) {
      try {
        const tsv11 = await run('tesseract', [item.frame, 'stdout', '-l', langs, '--psm', '11', 'tsv']);
        const obs11 = parseCreditFrame(parseTesseractTsv(tsv11.toString()), item.frameIndex, item.frameSec, item.videoSec);
        if (obs11.length > 0) {
          observations.push(...obs11);
          continue;
        }

        const tsv6 = await run('tesseract', [item.frame, 'stdout', '-l', langs, '--psm', '6', 'tsv']);
        const obs6 = parseCreditFrame(parseTesseractTsv(tsv6.toString()), item.frameIndex, item.frameSec, item.videoSec);
        if (obs6.length > 0) {
          observations.push(...obs6);
        }
      } catch {
        // ignore individual tesseract failures
      }
    }
  }

  return observations;
}

export function reconcileCreditPasses(passes: CreditObservation[][]): CreditObservation[] {
  const chosen = [...passes].sort((a, b) => passScore(b) - passScore(a))[0] ?? [];
  return chosen.map((credit) => {
    const key = credit.name.toUpperCase().replace(/[^\p{L}\p{N}]/gu, '');
    const [x, y, width, height] = credit.layout.personBox;
    const agreed = passes.flat().filter((other) => {
      if (other.creditType !== credit.creditType
        || other.name.toUpperCase().replace(/[^\p{L}\p{N}]/gu, '') !== key) return false;
      const [ox, oy, ow, oh] = other.layout.personBox;
      const overlap = Math.max(0, Math.min(x + width, ox + ow) - Math.max(x, ox))
        * Math.max(0, Math.min(y + height, oy + oh) - Math.max(y, oy));
      return overlap >= Math.min(width * height, ow * oh) * 0.5;
    });
    // Agreement can strengthen the name reading, but cannot add another role,
    // another person, or another supporting video frame.
    return { ...credit, ocrConfidence: Math.max(credit.ocrConfidence, ...agreed.map((other) => other.ocrConfidence)) };
  });
}
