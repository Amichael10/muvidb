import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock('./ai_service.js', () => ({ generateAIContent: mocks.generate }));

import {
  parseTimestampTag,
  restorePunctuation,
  stripTimestampTags,
  timestampForWordIndex,
  transcriptWords,
  wordIndexOfQuote,
} from './transcript_punctuation';

describe('caption timestamps', () => {
  it('reads both the mm:ss and hh:mm:ss shapes the clipper emits', () => {
    expect(parseTimestampTag('04:12')).toBe(252);
    expect(parseTimestampTag('01:05:30')).toBe(3930);
    expect(parseTimestampTag('nonsense')).toBeNull();
  });

  it('lifts inline tags out of the text and pins each to the word it introduces', () => {
    const { text, marks } = stripTimestampTags(
      '[00:05] the acting here is superb [04:12] but the third act collapses',
    );
    expect(text).toBe('the acting here is superb but the third act collapses');
    expect(marks).toEqual([
      { wordIndex: 0, seconds: 5 },
      { wordIndex: 5, seconds: 252 },
    ]);
  });

  it('keeps the earliest of several tags that introduce the same word', () => {
    // Consecutive tags with no words between them all play the same word, and
    // the first is when it is actually spoken.
    const { marks } = stripTimestampTags('[00:10] [00:12] one two');
    expect(marks).toEqual([{ wordIndex: 0, seconds: 10 }]);
  });

  it('resolves a word back to the timestamp that covers it', () => {
    const marks = [
      { wordIndex: 0, seconds: 5 },
      { wordIndex: 5, seconds: 252 },
    ];
    expect(timestampForWordIndex(marks, 0)).toBe(5);
    expect(timestampForWordIndex(marks, 4)).toBe(5);
    expect(timestampForWordIndex(marks, 5)).toBe(252);
    expect(timestampForWordIndex(marks, 99)).toBe(252);
    expect(timestampForWordIndex([], 3)).toBeNull();
  });

  it('locates a quote by word index so a deep link can be built', () => {
    const transcript = 'the acting here is superb but the third act collapses';
    expect(wordIndexOfQuote(transcript, 'but the third act collapses')).toBe(5);
    // Punctuation and case in the quote must not defeat the lookup: the quote
    // comes from the punctuated text, the marks from the raw captions.
    expect(wordIndexOfQuote(transcript, 'But the third act collapses.')).toBe(5);
    expect(wordIndexOfQuote(transcript, 'a line nobody spoke')).toBeNull();
  });
});

describe('restoring punctuation without changing what was said', () => {
  beforeEach(() => vi.resetAllMocks());

  const unpunctuated = 'the acting here is superb but the third act collapses under its own weight';

  it('passes through a transcript that already carries punctuation', async () => {
    const punctuated = 'The acting here is superb. But the third act collapses.';
    const result = await restorePunctuation(punctuated);
    expect(result).toEqual({ text: punctuated, verified: true });
    // Creator-uploaded captions and Whisper both punctuate, so there is
    // nothing to gain and a paraphrase to risk.
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it('still restores a transcript whose only full stop is an abbreviation', async () => {
    // One terminator in a long unpunctuated transcript is not punctuation.
    // Treating it as such skipped restoration and quoted the channel intro.
    const withAbbreviation =
      'the film opens in the U.S. before moving to lagos and the pacing never recovers '
      + 'from that detour which is a pity because the lead performance deserves better material '
      + 'than the script is willing to give it at any point in the second half';
    mocks.generate.mockResolvedValue({ text: withAbbreviation.replace(/\s+/g, ' ') + '.' });
    const result = await restorePunctuation(withAbbreviation);
    expect(mocks.generate).toHaveBeenCalled();
    expect(result.verified).toBe(true);
  });

  it('accepts a restoration that only adds punctuation and case', async () => {
    mocks.generate.mockResolvedValue({
      text: 'The acting here is superb, but the third act collapses under its own weight.',
    });
    const result = await restorePunctuation(unpunctuated);
    expect(result.verified).toBe(true);
    expect(result.text).toBe('The acting here is superb, but the third act collapses under its own weight.');
  });

  it('strips a fenced block the model adds despite being told not to', async () => {
    mocks.generate.mockResolvedValue({
      text: '```\nThe acting here is superb, but the third act collapses under its own weight.\n```',
    });
    const result = await restorePunctuation(unpunctuated);
    expect(result.verified).toBe(true);
    expect(result.text).not.toContain('`');
  });

  it('rejects a restoration that substitutes a word', async () => {
    // "superb" to "excellent" is a paraphrase. Published as a verbatim quote
    // it puts a word in a named critic's mouth that they did not say.
    mocks.generate.mockResolvedValue({
      text: 'The acting here is excellent, but the third act collapses under its own weight.',
    });
    const result = await restorePunctuation(unpunctuated);
    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/changed from "superb" to "excellent"/);
    expect(result.text).toBe(unpunctuated);
  });

  it('rejects a restoration that drops or adds words', async () => {
    mocks.generate.mockResolvedValue({ text: 'The acting here is superb.' });
    const dropped = await restorePunctuation(unpunctuated);
    expect(dropped.verified).toBe(false);
    expect(dropped.reason).toMatch(/word count changed from 14 to 5/);

    mocks.generate.mockResolvedValue({
      text: 'The acting here is truly superb, but the third act collapses under its own weight.',
    });
    const added = await restorePunctuation(unpunctuated);
    expect(added.verified).toBe(false);
  });

  it('tolerates an apostrophe the captions omitted', async () => {
    // Auto-captions write "dont"; restoring "don't" changes punctuation, not
    // the word, so the guard must not reject it.
    mocks.generate.mockResolvedValue({ text: "I don't think it works." });
    const result = await restorePunctuation('i dont think it works');
    expect(result.verified).toBe(true);
    expect(result.text).toBe("I don't think it works.");
  });

  it('keeps the original transcript when the model is unavailable', async () => {
    mocks.generate.mockRejectedValue(new Error('all Gemini keys exhausted'));
    const result = await restorePunctuation(unpunctuated);
    expect(result).toEqual({
      text: unpunctuated,
      verified: false,
      reason: 'punctuation model failed: all Gemini keys exhausted',
    });
  });

  it('reports an empty transcript as unverified rather than throwing', async () => {
    expect((await restorePunctuation('   ')).verified).toBe(false);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});

describe('the verbatim comparison key', () => {
  it('ignores case, punctuation and apostrophes but not words', () => {
    expect(transcriptWords("It's superb, truly!")).toEqual(['its', 'superb', 'truly']);
    expect(transcriptWords('  ')).toEqual([]);
  });
});
