import { describe, it, expect } from 'vitest';
import { isFaithfulPartition } from './credit_name_splitter';
import { characterCandidate } from './credit_consensus_verifier';

// The whole safety argument for letting a model touch credit data rests on
// isFaithfulPartition: the model may choose a split POINT and nothing else.
// If this check is loose, invented character names become indistinguishable
// from real ones once committed.
describe('isFaithfulPartition', () => {
  it('accepts a clean split of the original words', () => {
    expect(isFaithfulPartition('Odunlade Adekola Saamu', 'Odunlade Adekola', 'Saamu')).toBe(true);
  });

  it('accepts a whole-line name with no character', () => {
    expect(isFaithfulPartition('Mercy Johnson Okojie', 'Mercy Johnson Okojie', '')).toBe(true);
  });

  it('ignores case and punctuation only', () => {
    expect(isFaithfulPartition('Odunlade Adekola Saamu', 'ODUNLADE ADEKOLA', 'saamu.')).toBe(true);
    expect(isFaithfulPartition("Baba Risi O'Neil", 'Baba Risi', "ONeil")).toBe(true);
  });

  it('rejects an invented character name', () => {
    expect(isFaithfulPartition('Odunlade Adekola Saamu', 'Odunlade Adekola', 'Saamu Alajo')).toBe(false);
  });

  it('rejects a dropped word', () => {
    expect(isFaithfulPartition('Odunlade Adekola Saamu', 'Odunlade', 'Saamu')).toBe(false);
  });

  it('rejects a respelled name', () => {
    expect(isFaithfulPartition('Odunlade Adekola Saamu', 'Odunlade Adekolah', 'Saamu')).toBe(false);
  });

  it('rejects reordered words', () => {
    expect(isFaithfulPartition('Odunlade Adekola Saamu', 'Saamu Odunlade', 'Adekola')).toBe(false);
  });

  it('rejects a translated or substituted character', () => {
    expect(isFaithfulPartition('Shirly Oaikhenan Gbariye', 'Shirly Oaikhenan', 'The Chief')).toBe(false);
  });
});

// For actor observations the parser stores the character in `role`, so this is
// the gate that stops group headings and crew job titles being committed as
// character names.
describe('characterCandidate', () => {
  it('keeps a real character name', () => {
    expect(characterCandidate('Saamu')).toBe('Saamu');
    expect(characterCandidate('Madam Comfort')).toBe('Madam Comfort');
  });

  it('trims surrounding whitespace', () => {
    expect(characterCandidate('  Iyawo  ')).toBe('Iyawo');
  });

  it('rejects empty and missing values', () => {
    expect(characterCandidate(null)).toBeNull();
    expect(characterCandidate(undefined)).toBeNull();
    expect(characterCandidate('   ')).toBeNull();
  });

  it('rejects generic cast group headings', () => {
    for (const label of ['Cast', 'CASTS', 'Main Cast', 'Supporting Cast', 'Featuring', 'Cameo', 'Actor', 'Actress', 'Extras', 'Guest', 'Artistes']) {
      expect(characterCandidate(label)).toBeNull();
    }
  });

  it('rejects crew job titles', () => {
    for (const job of ['Director', 'Produced By', 'Screenplay', 'Director of Photography', 'Editor', 'Costume', 'Makeup', 'Sound']) {
      expect(characterCandidate(job)).toBeNull();
    }
  });

  it('rejects credit-roll noise', () => {
    expect(characterCandidate('THE END')).toBeNull();
    expect(characterCandidate('Subscribe')).toBeNull();
    expect(characterCandidate('Coming Soon')).toBeNull();
  });

  it('rejects a value too long to be a character name', () => {
    expect(characterCandidate('A'.repeat(61))).toBeNull();
  });
});
