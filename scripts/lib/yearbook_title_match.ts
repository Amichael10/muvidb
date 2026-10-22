/**
 * Title matching for the FilmOne Yearbook box office import.
 *
 * This exists because the previous inline matcher put one film's gross onto
 * every title it loosely resembled. Two defects combined:
 *
 *   1. once either title contained a colon, bare substring containment counted
 *      as a match — which is how "The Call" (normalised to "call") matched
 *      "Call of Duty: Black Ops II", and "Love Is War" matched the anime
 *      "Kaguya-Sama: Love Is War";
 *   2. the caller wrote to *every* match rather than picking one, so a single
 *      yearbook row sprayed its figure across all of them.
 *
 * The rules here are deliberately strict. A missing box office figure is a gap;
 * a wrong one is a lie that looks authoritative, so anything ambiguous is
 * refused rather than guessed.
 */

export function normalizeTitleStrict(t: string): string {
  return String(t ?? '')
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/\*+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const ROMAN: Record<string, string> = { ii: '2', iii: '3', iv: '4' };
const WORD_NUM: Record<string, string> = { one: '1', two: '2', three: '3', four: '4' };

/**
 * Which instalment of a series a title refers to: '' for a first film, '2' for
 * a sequel, 'final' for a concluding part. Two titles whose instalment differs
 * are different films, full stop — this is what keeps "Chief Daddy" apart from
 * "Chief Daddy 2".
 */
export function instalmentKey(normalized: string): string {
  const explicit = normalized.match(/\b(?:part|chapter)\s*(\d+|one|two|three|four)\b/);
  if (explicit) return WORD_NUM[explicit[1]] || explicit[1];
  if (/\b(concluding|finale|final chapter)\b/.test(normalized)) return 'final';
  const roman = normalized.match(/\b(ii|iii|iv)\b/);
  if (roman) return ROMAN[roman[1]];
  const digit = normalized.match(/\b([2-9])\b/);
  if (digit) return digit[1];
  return '';
}

/** The two sides of "main: subtitle", or [] when there is no colon. */
function colonSides(normalized: string): string[] {
  const i = normalized.indexOf(':');
  if (i < 0) return [];
  return [normalized.slice(0, i).trim(), normalized.slice(i + 1).trim()].filter(Boolean);
}

/**
 * How well a catalogue title matches a yearbook title: 100 exact, 70 for an
 * alternate titling, or null for no match.
 */
export function titleMatchScore(dbTitle: string, targetTitle: string): number | null {
  const d = normalizeTitleStrict(dbTitle);
  const t = normalizeTitleStrict(targetTitle);
  if (!d || !t) return null;

  if (instalmentKey(d) !== instalmentKey(t)) return null;
  if (d === t) return 100;

  // Alternate titling, e.g. "Agesinkole: King of Thieves" vs "King of Thieves".
  // Only a WHOLE side may stand in for the other title — never a loose
  // substring, which is the hole that matched "call" inside "call of duty".
  // The length floor keeps short common words from qualifying.
  if (colonSides(d).includes(t) && t.length >= 6) return 70;
  if (colonSides(t).includes(d) && d.length >= 6) return 70;

  return null;
}

export type FilmCandidate = { id?: string; title: string; year?: number | null };
export type YearbookRow = { rawTitle: string; year?: number | null };

/**
 * The single film a yearbook row belongs to.
 *
 * Returns null when nothing matches, and — importantly — also when the two
 * best candidates are tied, since there is no basis to choose between them.
 */
export function pickBestFilmMatch<T extends FilmCandidate>(
  films: T[],
  target: YearbookRow,
): { film: T; score: number; ambiguous?: true } | null {
  const scored: Array<{ film: T; score: number }> = [];

  for (const film of films || []) {
    const base = titleMatchScore(film.title, target.rawTitle);
    if (base == null) continue;
    // A year known on both sides is the strongest discriminator available:
    // it is the only thing separating Malaika (2011) from Malaika (2023).
    if (target.year && film.year && Math.abs(Number(film.year) - Number(target.year)) > 1) continue;
    const exactYear = target.year && Number(film.year) === Number(target.year) ? 10 : 0;
    scored.push({ film, score: base + exactYear });
  }

  if (!scored.length) return null;
  scored.sort((a, b) => b.score - a.score);
  if (scored.length > 1 && scored[0].score === scored[1].score) {
    return { film: scored[0].film, score: scored[0].score, ambiguous: true };
  }
  return scored[0];
}
