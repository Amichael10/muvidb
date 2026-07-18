// Defensive TMDB match selection.
//
// TMDB's /search/movie ignores `with_origin_country` AND omits origin_country
// from results, so the old pattern ("first NG-origin result, else results[0]")
// silently matched Nollywood titles to same-named HOLLYWOOD films — Maku→Pulp
// Fiction, Venom→Marvel, No Time to Die→Bond — pulling their images, ratings and
// thousands of votes.
//
// Search results DO carry `original_language` and `vote_count`, which separate
// the two cleanly: real Nollywood films are African-language and/or obscure
// (Jagun Jagun = yo/58 votes, Aníkúlápó = en/43), while the wrong Hollywood
// matches are famous (Venom 17k, Bond 7k). So we require an exact title match
// AND either an African original language or a low vote count — never a famous
// film. When in doubt we return null: no TMDB data beats wrong TMDB data.

const AFRICAN_LANGS = new Set([
  'yo', 'ha', 'ig', 'pcm', 'sw', 'am', 'zu', 'xh', 'af', 'sn', 'ny', 'st', 'tn',
  'rw', 'lg', 'ln', 'wo', 'ff', 'bm', 'so', 'ak', 'tw', 'ee', 'kg',
]);
const MAX_KNOWN_VOTES = 500; // a Nollywood TMDB entry ~never exceeds this; blockbusters are in the thousands.

// Fold diacritics to base letters (Aníkúlápó → anikulapo) THEN drop punctuation.
const norm = (s: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function pickTmdbMatch(
  results: any[],
  opts: { title?: string; year?: number | string } = {},
): any | null {
  if (!results?.length) return null;
  const year = opts.year ? Number(opts.year) : null;
  const wanted = norm(String(opts.title || ''));
  const yearOf = (r: any) => Number((r.release_date || '').slice(0, 4)) || null;
  const yearOk = (r: any) => { const y = yearOf(r); return y ? Math.abs(y - Number(year)) <= 1 : false; };

  // Must be the same title (exact, punctuation/diacritics-insensitive). Without
  // a title to check we can't be safe — refuse.
  if (!wanted) return null;
  const cands = results
    .filter((r) => norm(r.title) === wanted || norm(r.original_title) === wanted)
    .filter((r) => (r.vote_count || 0) <= MAX_KNOWN_VOTES); // Hollywood guard
  if (!cands.length) return null;

  const yearHits = year ? cands.filter(yearOk) : [];

  // Strongest signal: an African original language (Yoruba, Hausa, Igbo, ...).
  // Accept it, preferring a year-confirmed one.
  const african = yearHits.find((r) => AFRICAN_LANGS.has(r.original_language))
    || cands.find((r) => AFRICAN_LANGS.has(r.original_language));
  if (african) return african;

  // Non-African language (incl. generic English titles like "Venom", "Bad Boys"
  // that collide with obscure indie films): only accept when a year CONFIRMS it.
  // Without that, refuse — no TMDB data beats a coincidental wrong one.
  return year && yearHits.length ? yearHits[0] : null;
}
