import { describe, expect, it, vi } from 'vitest';
const ocr = vi.hoisted(() => ({ recognize: vi.fn(), terminate: vi.fn() }));
vi.mock('tesseract.js', () => ({ createWorker: async () => ocr }));
import { extractCreditsWithLocalOCR } from './localCreditOcr';

describe('local screenshot OCR', () => {
  it('accepts actor mode and keeps the actor on the left of dotted character columns', async () => {
    ocr.recognize.mockResolvedValue({ data: { text: 'CAST\nMurphy Afolabi........Oba\nMurphy Afolabi........Oba\nToyin Abraham' } });
    expect(await extractCreditsWithLocalOCR('image', 'actor')).toEqual([
      { name: 'Murphy Afolabi', role_or_character: 'Oba' },
      { name: 'Toyin Abraham', role_or_character: 'Actor' },
    ]);
    expect(ocr.terminate).toHaveBeenCalled();
  });
  it('preserves a person in different crew roles', async () => {
    ocr.recognize.mockResolvedValue({ data: { text: 'Director: John Doe\nProducer: John Doe' } });
    expect(await extractCreditsWithLocalOCR('image', 'crew')).toHaveLength(2);
  });
  it('preserves hyphenated names and numbered characters', async () => {
    ocr.recognize.mockResolvedValue({ data: { text: 'Toyin Ade-Lawal....Guard 1\nToyin Ade-Lawal....Guard 2' } });
    expect(await extractCreditsWithLocalOCR('image', 'actor')).toEqual([
      { name: 'Toyin Ade-Lawal', role_or_character: 'Guard 1' },
      { name: 'Toyin Ade-Lawal', role_or_character: 'Guard 2' },
    ]);
  });
});
