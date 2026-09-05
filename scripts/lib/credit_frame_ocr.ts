import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseCreditFrame,
  parseTesseractTsv,
  type CreditObservation,
} from './credit_roll_parser';

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

function run(command: string, args: string[], input?: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = execFile(command, args, {
      encoding: 'buffer', timeout: 60_000, maxBuffer: 32 * 1024 * 1024, windowsHide: true,
    }, (error, stdout, stderr) => {
      if (error) reject(new Error(`${command}: ${stderr.toString().trim() || error.message}`));
      else resolve(stdout);
    });
    child.stdin?.on('error', () => { /* The process callback reports early exits. */ });
    child.stdin?.end(input);
  });
}

export async function prepareCreditFrame(frame: string): Promise<Buffer> {
  const metadata = JSON.parse((await run('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', frame,
  ])).toString());
  const { width, height } = metadata.streams[0];
  const pixels = await run('ffmpeg', [
    '-i', frame, '-vf', 'format=gray', '-frames:v', '1',
    '-f', 'rawvideo', '-pix_fmt', 'gray', '-hide_banner', '-loglevel', 'error', 'pipe:1',
  ]);
  const darkPixels = pixels.filter((value) => value < 45).length / pixels.length;
  // On black credit cards, dim watermarks otherwise merge into the white names.
  // Keep midtones on other backgrounds, where thresholding can erase the text.
  const dottedCard = darkPixels > 0.7 && removeDottedLeaders(pixels, width, height);
  const contrast = darkPixels > 0.7 && !dottedCard ? 'lut=y=if(lt(val\\,110)\\,0\\,val),' : '';
  return run('ffmpeg', [
    '-f', 'rawvideo', '-pixel_format', 'gray', '-video_size', `${width}x${height}`, '-i', 'pipe:0',
    '-vf', `${contrast}scale=w='min(iw*3,max(iw,1920))':h=-1:flags=lanczos`,
    '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png',
    '-hide_banner', '-loglevel', 'error', 'pipe:1',
  ], pixels);
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

/** One authoritative layout per frame; disagreeing OCR passes are never pooled. */
export async function parseCreditFrameWithOcr(
  frame: string,
  frameIndex: number,
  frameSec: number,
  videoSec: number,
): Promise<CreditObservation[]> {
  const image = await prepareCreditFrame(frame);
  const read = async (mode: string) => {
    const tsv = await run('tesseract', ['stdin', 'stdout', '-l', 'eng', '--psm', mode, 'tsv'], image);
    return parseCreditFrame(parseTesseractTsv(tsv.toString()), frameIndex, frameSec, videoSec);
  };
  const block = await read('6');
  const sparse = await read('11');
  const passes = [block, sparse];
  if (passes.some((pass) => pass.some((credit) => credit.creditType === 'crew'))) {
    passes.push(await read('3'));
  }
  return reconcileCreditPasses(passes);
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
