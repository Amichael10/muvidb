/**
 * Read an existing frame folder without downloading or writing to Supabase.
 *
 *   npx tsx scripts/validate_credit_frames.ts C:\path\to\harvest-frames
 */
import { execFile } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import {
  cleanCreditPersonName,
  consolidateCreditObservations,
  parseCreditFrame,
  parseTesseractTsv,
  type CreditObservation,
  type OcrLine,
} from './lib/credit_roll_parser';

const run = promisify(execFile);
const directory = process.argv[2] ? resolve(process.argv[2]) : '';
const frameEverySec = Number(process.argv[3]) || 3;

if (!directory) {
  console.error('Usage: npx tsx scripts/validate_credit_frames.ts <frame-directory> [seconds-per-frame]');
  process.exit(1);
}

async function ocrLines(frame: string, pageSegMode = '6') {
  const { stdout } = await run(
    'tesseract',
    [frame, 'stdout', '--psm', pageSegMode, 'tsv'],
    { timeout: 60_000, maxBuffer: 16 * 1024 * 1024 },
  );
  return parseTesseractTsv(stdout);
}

function hasLeaderOcrArtifacts(lines: OcrLine[]): boolean {
  return lines.some((line) => /[.:]{3,}|[a-z]{4,}(?=[A-Z])/u.test(line.text));
}

function shouldRunSparseOcr(lines: Awaited<ReturnType<typeof ocrLines>>, parsed: CreditObservation[]): boolean {
  const hasLeaderArtifacts = hasLeaderOcrArtifacts(lines);
  if (hasLeaderArtifacts) return true;
  if (parsed.some((credit) => credit.creditType === 'crew')) return true;
  const readableLines = lines.filter((line) => line.confidence >= 0.35 && /[\p{L}\p{N}]/u.test(line.text));
  return parsed.length < 4 && readableLines.length >= 6;
}

function sparseCastNameObservations(
  lines: OcrLine[],
  frameIndex: number,
  frameSec: number,
  videoSec: number,
): CreditObservation[] {
  const castIndex = lines.findIndex((line) => line.text.toUpperCase().replace(/[^A-Z]+/g, ' ').trim() === 'CAST');
  if (castIndex < 0) return [];

  return lines.slice(castIndex + 1).flatMap((line): CreditObservation[] => {
    if (/\d/.test(line.text) || /(?:'|’)S\b/i.test(line.text)) return [];
    if (/\b(?:BOYFRIEND|GIRLFRIEND|DETECTIVE|BARRISTER|GATEMAN|GATE MAN|MAN|WOMAN|MOTHER|FATHER|OFFICER|DOCTOR|FRIEND|NEIGHBOU?R)\b/i.test(line.text)) {
      return [];
    }
    const name = cleanCreditPersonName(line.text);
    if (!name) return [];
    return [{
      name,
      roleOrCharacter: 'Actor',
      creditType: 'actor',
      frameIndex,
      frameSec,
      videoSec,
      ocrConfidence: line.confidence,
      evidenceText: line.text,
      layout: {
        mode: 'grouped-cast',
        personBox: [line.left, line.top, line.right - line.left, line.bottom - line.top],
      },
    }];
  });
}

const frames = (await readdir(directory))
  .filter((name) => /^f_\d+\.(jpg|jpeg|png)$/i.test(name))
  .sort()
  .map((name) => join(directory, name));

const observations: CreditObservation[] = [];
for (let index = 0; index < frames.length; index++) {
  const primaryLines = await ocrLines(frames[index], '6');
  const primary = parseCreditFrame(
    primaryLines,
    index,
    index * frameEverySec,
    index * frameEverySec,
  );
  let sparse: CreditObservation[] = [];
  if (shouldRunSparseOcr(primaryLines, primary)) {
    const sparseLines = await ocrLines(frames[index], '11');
    sparse = hasLeaderOcrArtifacts(primaryLines)
      ? sparseCastNameObservations(sparseLines, index, index * frameEverySec, index * frameEverySec)
      : parseCreditFrame(
        sparseLines,
        index,
        index * frameEverySec,
        index * frameEverySec,
      ).filter((credit) => credit.creditType === 'crew');
  }
  observations.push(
    ...primary,
    ...sparse,
  );
  if ((index + 1) % 10 === 0) console.error(`OCR ${index + 1}/${frames.length}`);
}

const credits = consolidateCreditObservations(observations)
  .filter((credit) => credit.frameSupport >= 2)
  .sort((a, b) => a.creditType.localeCompare(b.creditType)
    || a.roleOrCharacter.localeCompare(b.roleOrCharacter)
    || a.name.localeCompare(b.name));

console.table(credits.map((credit) => ({
  type: credit.creditType,
  name: credit.name,
  character_or_role: credit.roleOrCharacter,
  frames: credit.frameSupport,
  ocr: `${Math.round(credit.ocrConfidence * 100)}%`,
  source: credit.evidenceText,
})));
console.error(`${credits.length} validated credits from ${frames.length} frames`);

