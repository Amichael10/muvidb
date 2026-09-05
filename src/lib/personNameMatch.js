// Shared person-name matching for credit extractor / admin link flows.
// Handles exact match, name-order swaps ("Adekola Odunlade" ↔ "Odunlade Adekola"),
// OCR numbering ("1. Marian Abiodun"), nicknames ("Marian Abiodun (Supa)"), and
// soft near-typo / Cohere-assisted auto-link as a last resort.

const PERSON_NOISE = new Set([
  'actor', 'actress', 'alhaji', 'alhaja', 'chief', 'comedian', 'director',
  'dr', 'engr', 'evangelist', 'hon', 'mr', 'mrs', 'ms', 'pastor', 'prince',
  'princess', 'producer', 'sir', 'official', 'and', 'as', 'with', 'feat',
  'featuring', 'starring', 'also', 'aka', 'the', 'of', 'jr', 'jnr', 'snr',
  'sr', 'ii', 'iii', 'iv',
]);

/** Drop "(Supa)" / "[DJ]" / "1." credit-roll decorations. */
export function stripPersonNameDecorations(value) {
  return String(value || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    // "1. Name", "12) Name", "#3 Name" at start or after whitespace
    .replace(/(^|\s)[0-9]{1,3}[.)\-:]\s*/g, ' ')
    .replace(/(^|\s)#\d{1,3}\s+/g, ' ');
}

export function foldPersonText(value) {
  return stripPersonNameDecorations(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘`]/g, "'")
    .toLowerCase();
}

export function personNameTokens(name) {
  return foldPersonText(name)
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => t.length > 1)
    .filter((t) => !/^[0-9]+$/.test(t))
    .filter((t) => !PERSON_NOISE.has(t));
}

/** Multiset key so token order doesn't matter. Null if fewer than 2 real tokens. */
export function sortedNameKey(name) {
  const tokens = personNameTokens(name);
  if (tokens.length < 2) return null;
  return `${tokens.length}:${[...tokens].sort().join('|')}`;
}

export function namesLookSame(a, b) {
  if (!a || !b) return false;
  if (foldPersonText(a) === foldPersonText(b)) return true;
  const ka = sortedNameKey(a);
  const kb = sortedNameKey(b);
  return Boolean(ka && kb && ka === kb);
}

// Match the database's person_alias_key without dropping stage-name words.
export function personAliasKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function matchesPersonAlias(query, person) {
  const key = personAliasKey(query);
  return Boolean(key && (person.aliases || []).some(alias => personAliasKey(alias) === key));
}

/** Prefer richer / more-credited people when several candidates match. */
export function rankPersonMatch(a, b) {
  const films = Number(b.film_count || 0) - Number(a.film_count || 0);
  if (films) return films;
  const photo = Number(Boolean(b.photo_url)) - Number(Boolean(a.photo_url));
  if (photo) return photo;
  const sem =
    Number(b._semantic || b._cohere || 0) - Number(a._semantic || a._cohere || 0);
  if (sem) return sem;
  return String(a.name || '').localeCompare(String(b.name || ''));
}

/** Levenshtein distance for short given-name typos (Marian / Mirian). */
function editDistance(a, b) {
  const s = String(a || '');
  const t = String(b || '');
  if (s === t) return 0;
  const m = s.length;
  const n = t.length;
  if (!m) return n;
  if (!n) return m;
  const row = new Array(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[n];
}

/**
 * True when query and candidate share the same token multiset modulo one
 * near-typo token (edit distance ≤ 2 on tokens longer than 3 chars).
 */
export function namesNearMatch(a, b) {
  const ta = personNameTokens(a);
  const tb = personNameTokens(b);
  if (ta.length < 2 || tb.length < 2) return false;
  if (Math.abs(ta.length - tb.length) > 1) return false;

  const unused = [...tb];
  let typoSlots = 0;
  for (const token of ta) {
    const exact = unused.indexOf(token);
    if (exact >= 0) {
      unused.splice(exact, 1);
      continue;
    }
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < unused.length; i++) {
      const u = unused[i];
      if (Math.abs(u.length - token.length) > 2) continue;
      if (token.length < 4 || u.length < 4) continue;
      const d = editDistance(token, u);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0 && bestDist > 0 && bestDist <= 2) {
      typoSlots += 1;
      if (typoSlots > 1) return false;
      unused.splice(bestIdx, 1);
      continue;
    }
    return false;
  }
  return unused.length <= 1 && typoSlots <= 1 && (typoSlots === 1 || unused.length === 0);
}

/**
 * Pick the best auto-link from a candidate list for a typed/OCR name.
 * Exact (case-insensitive) wins, then token-order swap, then near-typo /
 * high-confidence Cohere rerank — never a low-confidence guess.
 */
export function pickAutoMatch(query, candidates = [], { minSemantic = 0.42 } = {}) {
  const q = String(query || '').trim();
  if (!q || !candidates.length) return null;

  const qFold = foldPersonText(q);
  const exact = candidates.filter((p) => foldPersonText(p.name) === qFold);
  if (exact.length) {
    return [...exact].sort(rankPersonMatch)[0];
  }

  const qKey = sortedNameKey(q);
  if (qKey) {
    const swaps = candidates.filter((p) => sortedNameKey(p.name) === qKey);
    if (swaps.length) return [...swaps].sort(rankPersonMatch)[0];
  }

  const aliases = candidates.filter((p) => matchesPersonAlias(q, p));
  // Shared stage names require a manual choice, regardless of popularity.
  if (aliases.length) return new Set(aliases.map(p => p.id)).size === 1 ? aliases[0] : null;

  const near = candidates.filter((p) => namesNearMatch(q, p.name));
  if (near.length) return [...near].sort(rankPersonMatch)[0];

  const withScore = candidates
    .map((p) => ({ ...p, _sem: Number(p._semantic ?? p._cohere ?? 0) }))
    .filter((p) => p._sem >= minSemantic)
    .sort((a, b) => b._sem - a._sem || rankPersonMatch(a, b));

  if (!withScore.length) return null;
  const top = withScore[0];
  const second = withScore[1];
  if (second && top._sem - second._sem < 0.08) return null;
  const qTokens = personNameTokens(q);
  const tTokens = personNameTokens(top.name);
  const shared = qTokens.some((t) => t.length >= 4 && tTokens.includes(t));
  if (!shared && !namesNearMatch(q, top.name)) return null;
  return top;
}
