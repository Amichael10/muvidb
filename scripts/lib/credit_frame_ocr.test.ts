import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseCreditFrameWithOcr, reconcileCreditPasses } from './credit_frame_ocr';
import { consolidateCreditObservations, type CreditObservation } from './credit_roll_parser';

it('uses one pass for assignments and only borrows confidence from an agreeing name at the same position', () => {
  const credit: CreditObservation = {
    name: 'Diana Childs', roleOrCharacter: 'Executive Producer', creditType: 'crew',
    frameIndex: 1, frameSec: 1, videoSec: 100, ocrConfidence: 0.8, evidenceText: 'DIANA CHILDS',
    layout: { mode: 'role-then-name', personBox: [100, 100, 120, 20] },
  };
  const authoritative = [credit, { ...credit, name: 'Funmi Oduse', roleOrCharacter: 'Production Manager' }];
  const noisy = [
    { ...credit, roleOrCharacter: 'Sound Recordist', ocrConfidence: 0.95 },
    { ...credit, name: 'Love Birds', roleOrCharacter: 'Sound Recordist' },
  ];
  const parsed = reconcileCreditPasses([authoritative, noisy]);
  expect(parsed).toHaveLength(2);
  expect(parsed[0]).toMatchObject({ name: 'Diana Childs', roleOrCharacter: 'Executive Producer', ocrConfidence: 0.95 });
  expect(consolidateCreditObservations(parsed).every((credit) => credit.frameSupport === 1)).toBe(true);
});

// Opt in on worker machines with ffmpeg, ffprobe and English Tesseract installed.
// These are image-to-credit checks, independent of handcrafted OCR fixtures.
describe.runIf(process.env.CREDIT_OCR_INTEGRATION === '1')('credit screenshot extraction', () => {
  const read = async (file: string) => {
    const path = fileURLToPath(new URL(`./fixtures/credit-ocr/${file}`, import.meta.url));
    return parseCreditFrameWithOcr(path, 0, 0, 0);
  };

  it('extracts all seven Royal Arts cast names with their characters and no extra people', async () => {
    const credits = await read('royal-arts-cast.png');
    expect(credits.map((credit) => [credit.name, credit.roleOrCharacter]).sort()).toEqual([
      ['Tersy Akpata', 'Susan'], ['Ray Adeka', 'Patrick'], ['Bryan Okoye', 'Chuddy'],
      ['Diana Childs', 'Neighbor'], ['Funmi Oduse', 'Love Birds'], ['Olawale Ibrahim', 'Love Birds'],
      ['Belle Mariam Soroh', 'Handyman NG Rep'],
    ].sort());
    expect(credits.every((credit) => credit.creditType === 'actor' && credit.ocrConfidence >= 0.65)).toBe(true);
  }, 120_000);

  it('extracts all nine dotted cast rows, including Eve and Jane, without inventing names', async () => {
    const credits = await read('dotted-cast.png');
    expect(credits.map((credit) => [credit.name, credit.roleOrCharacter]).sort()).toEqual([
      ['Eso Dike', 'Raymond'], ['Joy Lisa', 'Eve'], ['Amanda Neo', 'Jane'],
      ['Igunwe Alfred', "Jane's Boyfriend"], ['Chukwu Francis', 'Detective 1'],
      ['Chieke Donald', 'Detective 2'], ['Bright Omoregie', 'Barrister'],
      ['Desmond Anyanwu', 'Gateman'], ['Akanno Chimezie Ferdinard', 'Man'],
    ].sort());
    expect(credits.every((credit) => credit.creditType === 'actor' && credit.ocrConfidence >= 0.65)).toBe(true);
  }, 120_000);

  it('keeps crew cards out of the cast list and binds the sound, props and camera roles correctly', async () => {
    const credits = [];
    for (const file of ['royal-arts-crew-1.png', 'royal-arts-crew-2.png', 'royal-arts-crew-3.png']) {
      credits.push(...await read(file));
    }
    expect(credits.every((credit) => credit.creditType === 'crew')).toBe(true);
    expect(credits.map((credit) => [credit.name, credit.roleOrCharacter])).toEqual(expect.arrayContaining([
      ['Diana Childs', 'Executive Producer'], ['Diana Childs', 'Story/Screenplay'],
      ['Olaide Abraham Cross Ayodele', 'Director of Photography'],
      ['Usman Ahmed', 'Camera Operator'], ['Olayinka Ibitoye', 'Art Director'],
      ['Ibrahim Kalejaiye', 'Sound Recordist'], ['Matthew James Godspower', 'Props Assistant'],
      ['Funmi Oduse', 'Production Manager'], ['Joshua Cassidy', 'Editor'], ['Peter Cassidy', 'Editor'],
    ]));
    expect(credits.filter((credit) => credit.roleOrCharacter === 'Sound Recordist')).toHaveLength(1);
  }, 120_000);
});
