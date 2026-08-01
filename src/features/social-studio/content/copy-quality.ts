/**
 * Rejects copy that is scraped noise rather than prose.
 *
 * A lot of `films.synopsis` and `people.bio` values were harvested from YouTube
 * descriptions and are just hashtag dumps or link bait. Pasting one into a
 * caption produces a post that is nothing but tags, so unusable copy is dropped
 * and the caption falls back to the next source.
 */
export function isUsableCopy(value: string | null | undefined): value is string {
  if (!value) return false;

  const trimmed = value.trim();
  if (trimmed.length < 12) return false;
  if (trimmed.startsWith('#')) return false;

  const tokens = trimmed.split(/\s+/);
  const noisy = tokens.filter(token => token.startsWith('#') || /^https?:\/\//i.test(token)).length;
  if (noisy / tokens.length > 0.25) return false;

  // Strip surrounding punctuation before counting, so "kneels." still counts.
  // The floor stays low because a real tagline can be four words long.
  const words = tokens
    .map(token => token.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, ''))
    .filter(word => /^[a-zA-Z][a-zA-Z'’-]*$/.test(word));

  return words.length >= 3;
}

/**
 * Titles that are clearly not films.
 *
 * Much of the catalogue is harvested from YouTube channels, so a person's
 * credits often include interviews, behind-the-scenes clips and reaction videos
 * alongside real work. Listing "Interview and Behind the Scene" under KNOWN FOR
 * on a spotlight card is embarrassing, so those titles are dropped.
 *
 * Deliberately conservative — it only rejects formats that are never a film.
 * "Full Movie" stays, because that is how a lot of genuine Nollywood titles are
 * published on YouTube.
 */
const NON_FILM_TITLE = new RegExp(
  [
    'interview',
    'behind[\\s-]the[\\s-]scenes?',
    '\\bbts\\b',
    'appreciation',
    'trailer',
    'teaser',
    // Plural only. "A Chain Reaction" is a real film, and singular "reaction"
    // cannot be told apart from it by pattern alone — a false positive here
    // silently drops a genuine credit, which is worse than letting one clip
    // through. Long reaction-video headlines are caught by the length rule.
    '\\breactions\\b',
    'making[\\s-]of',
    'bloopers?',
    '\\brecap\\b',
    'highlights',
    '\\bvlog\\b',
    'unboxing',
    'live[\\s-]stream',
  ].join('|'),
  'i',
);

export function isLikelyFilmTitle(title: string | null | undefined): title is string {
  if (!title) return false;

  const trimmed = title.trim();
  if (!trimmed) return false;

  // Harvested titles frequently carry the whole video headline. Real film
  // titles are short.
  if (trimmed.length > 70) return false;

  return !NON_FILM_TITLE.test(trimmed);
}

export function firstUsableCopy(...candidates: (string | null | undefined)[]): string | null {
  for (const candidate of candidates) {
    if (isUsableCopy(candidate)) return candidate.trim();
  }
  return null;
}
