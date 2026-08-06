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
  consolidateCreditObservations,
  parseCreditFrame,
  parseTesseractTsv,
  type CreditObservation,
} from './lib/credit_roll_parser';

const run = promisify(execFile);
const directory = process.argv[2] ? resolve(process.argv[2]) : '';
const frameEverySec = Number(process.argv[3]) || 3;

if (!directory) {
  console.error('Usage: npx tsx scripts/validate_credit_frames.ts <frame-directory> [seconds-per-frame]');
  process.exit(1);
}

const frames = (await readdir(directory))
  .filter((name) => /^f_\d+\.(jpg|jpeg|png)$/i.test(name))
  .sort()
  .map((name) => join(directory, name));

const observations: CreditObservation[] = [];
for (let index = 0; index < frames.length; index++) {
  const { stdout } = await run(
    'tesseract',
    [frames[index], 'stdout', '--psm', '6', 'tsv'],
    { timeout: 60_000, maxBuffer: 16 * 1024 * 1024 },
  );
  observations.push(
    ...parseCreditFrame(
      parseTesseractTsv(stdout),
      index,
      index * frameEverySec,
      index * frameEverySec,
    ),
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

