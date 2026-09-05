/** Read saved frames or individual screenshots without downloading or database writes. */
import { readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { consolidateCreditObservations, type CreditObservation } from './lib/credit_roll_parser';
import { parseCreditFrameWithOcr } from './lib/credit_frame_ocr';

const args = process.argv.slice(2);
const frameEverySec = Number(args.find((arg) => arg.startsWith('--frame-every='))?.split('=')[1]) || 1;
const minSupport = Number(args.find((arg) => arg.startsWith('--min-support='))?.split('=')[1]) || 1;
const inputs = args.filter((arg) => !arg.startsWith('--'));
if (!inputs.length) {
  console.error('Usage: npx tsx scripts/validate_credit_frames.ts <frame-directory|image> [...] [--min-support=1] [--frame-every=1]');
  process.exit(1);
}

const frames: string[] = [];
for (const input of inputs) {
  const path = resolve(input);
  if ((await stat(path)).isDirectory()) {
    frames.push(...(await readdir(path)).filter((name) => /^f_\d+\.(jpg|jpeg|png)$/i.test(name))
      .sort().map((name) => join(path, name)));
  } else {
    frames.push(path);
  }
}

const observations: CreditObservation[] = [];
for (let index = 0; index < frames.length; index++) {
  observations.push(...await parseCreditFrameWithOcr(frames[index], index, index * frameEverySec, index * frameEverySec));
  console.error(`OCR ${index + 1}/${frames.length}`);
}

const credits = consolidateCreditObservations(observations)
  .filter((credit) => credit.frameSupport >= minSupport)
  .sort((a, b) => a.creditType.localeCompare(b.creditType)
    || a.roleOrCharacter.localeCompare(b.roleOrCharacter) || a.name.localeCompare(b.name));

if (args.includes('--json')) {
  console.log(JSON.stringify(credits, null, 2));
} else {
  console.table(credits.map((credit) => ({
    type: credit.creditType, name: credit.name, character_or_role: credit.roleOrCharacter,
    frames: credit.frameSupport, ocr: `${Math.round(credit.ocrConfidence * 100)}%`, source: credit.evidenceText,
  })));
}
console.error(`${credits.length} credits from ${frames.length} frames`);

