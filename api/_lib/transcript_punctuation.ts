/**
 * Turning a caption track into something selectCriticExcerpt can quote from.
 *
 * Two problems stand between a YouTube caption track and a usable pull quote.
 *
 * 1. The clipper's /metadata returns captions as `[mm:ss] text [mm:ss] text`.
 *    Those tags are inline, so any quote selected from the raw string would
 *    carry timestamps inside it.
 *
 * 2. YouTube's automatic captions have no terminal punctuation and no
 *    capitalisation. critic_review_extractor's sentences() splits on
 *    /(?<=[.!?])\s+(?=[A-Z…])/ and keeps only 10-55 word fragments, so an
 *    unpunctuated transcript yields no sentences at all: exactExcerpt() can
 *    never match, and fallbackDiscussionExcerpt() returns the first 280
 *    characters instead — the channel intro. Every quote would read "hey guys
 *    welcome back to the channel don't forget to like and subscribe".
 *
 * So punctuation is restored by a model, and then verified: the word sequence
 * must come back byte-identical once punctuation and case are stripped. That
 * keeps "verbatim" meaningful at the word level, which is the level that
 * matters when the quote is attributed to a named critic. A model that
 * paraphrases, drops a filler or merges two words fails the check and the
 * transcript is rejected rather than quoted.
 *
 * Word indices survive that guard unchanged, which is what makes the deep
 * link possible: a quote found in the punctuated text sits at the same word
 * index as in the raw captions, so the nearest preceding timestamp is exact.
 */

import { generateAIContent } from './ai_service.js';

/** A caption timestamp, pinned to the word it introduces. */
export interface TranscriptMark {
  wordIndex: number;
  seconds: number;
}

export interface StrippedTranscript {
  text: string;
  marks: TranscriptMark[];
}

export interface RestoredTranscript {
  text: string;
  /** False when the model could not punctuate without altering words. */
  verified: boolean;
  reason?: string;
}

const TIMESTAMP_TAG = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;
const SENTENCE_TERMINATOR = /[.!?]["'”’]?(?=\s|$)/g;
/** Above this many words per terminator, a transcript is not really punctuated. */
const MAX_WORDS_PER_TERMINATOR = 40;

/**
 * Whether a transcript already carries sentence punctuation.
 *
 * Judged on density, not presence: an unpunctuated caption track that happens
 * to contain "U.S." has one terminator, and treating that as punctuated would
 * skip restoration and put us straight back to quoting the channel intro.
 *
 * Real prose runs about one terminator per 15-25 words, so 40 is generous
 * enough for a critic who speaks in long sentences. The threshold is
 * deliberately biased toward restoring: a false negative costs one model call
 * that changes nothing, while a false positive yields an unpunctuated quote.
 */
export function isAlreadyPunctuated(text: string): boolean {
  const terminators = (text.match(SENTENCE_TERMINATOR) || []).length;
  if (!terminators) return false;
  return terminators >= transcriptWords(text).length / MAX_WORDS_PER_TERMINATOR;
}

/** `[mm:ss]` or `[hh:mm:ss]` to seconds. */
export function parseTimestampTag(tag: string): number | null {
  const parts = tag.split(':').map(Number);
  if (parts.some(part => !Number.isFinite(part) || part < 0)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

/**
 * The comparison key for the verbatim guard: words only, lowercased, with
 * punctuation and apostrophes removed. "don't" and "dont" compare equal, so
 * the model may normalise an apostrophe the captions omitted, but it may not
 * change, add or drop a word.
 */
export function transcriptWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[‘’']/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Pull the inline `[mm:ss]` tags out of a clipper transcript, recording which
 * word each one introduces.
 */
export function stripTimestampTags(raw: string): StrippedTranscript {
  const marks: TranscriptMark[] = [];
  const segments: string[] = [];
  let wordCount = 0;
  let cursor = 0;

  for (const match of raw.matchAll(TIMESTAMP_TAG)) {
    const before = raw.slice(cursor, match.index);
    segments.push(before);
    wordCount += transcriptWords(before).length;
    const seconds = parseTimestampTag(match[1]);
    // Only the first tag for a given word is kept: consecutive tags with no
    // words between them all introduce the same word, and the earliest is the
    // one that actually plays it.
    if (seconds !== null && marks[marks.length - 1]?.wordIndex !== wordCount) {
      marks.push({ wordIndex: wordCount, seconds });
    }
    cursor = match.index + match[0].length;
  }
  segments.push(raw.slice(cursor));

  const text = segments.join(' ').replace(/\s+/g, ' ').trim();
  return { text, marks };
}

/** Seconds for the word at `wordIndex`, from the nearest preceding mark. */
export function timestampForWordIndex(marks: TranscriptMark[], wordIndex: number): number | null {
  let seconds: number | null = null;
  for (const mark of marks) {
    if (mark.wordIndex > wordIndex) break;
    seconds = mark.seconds;
  }
  return seconds;
}

/**
 * Word index where `quote` begins inside `transcript`, or null when the quote
 * is not a contiguous run of the transcript's words.
 */
export function wordIndexOfQuote(transcript: string, quote: string): number | null {
  const haystack = transcriptWords(transcript);
  const needle = transcriptWords(quote);
  if (!needle.length || needle.length > haystack.length) return null;

  for (let start = 0; start <= haystack.length - needle.length; start++) {
    let matched = true;
    for (let offset = 0; offset < needle.length; offset++) {
      if (haystack[start + offset] !== needle[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) return start;
  }
  return null;
}

/** Where the two word sequences first diverge, for a usable rejection reason. */
function describeWordMismatch(before: string[], after: string[]): string {
  const limit = Math.min(before.length, after.length);
  for (let i = 0; i < limit; i++) {
    if (before[i] !== after[i]) {
      return `word ${i + 1} changed from "${before[i]}" to "${after[i]}"`;
    }
  }
  return before.length === after.length
    ? 'word sequences differ'
    : `word count changed from ${before.length} to ${after.length}`;
}

/**
 * Restore sentence punctuation and capitalisation without altering a single
 * word. Returns the original text with `verified: false` when that cannot be
 * guaranteed, so a caller can refuse to quote rather than quote something the
 * critic may not have said.
 */
export async function restorePunctuation(text: string): Promise<RestoredTranscript> {
  const trimmed = text.trim();
  if (!trimmed) return { text: trimmed, verified: false, reason: 'empty transcript' };

  // Already punctuated — a creator-uploaded caption track, or Whisper output,
  // both of which carry sentence punctuation. Nothing to restore, nothing to
  // risk.
  if (isAlreadyPunctuated(trimmed)) {
    return { text: trimmed, verified: true };
  }

  const expected = transcriptWords(trimmed);
  if (!expected.length) return { text: trimmed, verified: false, reason: 'no words in transcript' };

  const prompt = `Add sentence punctuation and capitalisation to this speech transcript.

RULES:
1. Do not add, remove, reorder or substitute ANY word. The words must come back exactly as given.
2. Only insert punctuation (. , ! ? ' -) and change letter case.
3. Do not summarise, translate, tidy up grammar, or remove filler words and repetition.
4. Return the punctuated transcript as plain text, with no preamble and no commentary.

TRANSCRIPT:
${trimmed}`;

  let candidate: string;
  try {
    const response = await generateAIContent(prompt, { preferredProvider: 'gemini', strictProvider: true });
    candidate = String(response?.text || '').trim();
  } catch (error) {
    return { text: trimmed, verified: false, reason: `punctuation model failed: ${(error as Error).message}` };
  }

  if (!candidate) return { text: trimmed, verified: false, reason: 'punctuation model returned nothing' };

  // Models like to wrap a response in a fenced block even when told not to.
  const unfenced = candidate.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();
  const actual = transcriptWords(unfenced);

  if (actual.length !== expected.length || actual.some((word, i) => word !== expected[i])) {
    return { text: trimmed, verified: false, reason: describeWordMismatch(expected, actual) };
  }

  return { text: unfenced, verified: true };
}
