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

/** Strip Yoruba theophoric prefixes and nicknames (oluwakemi -> kemi, babatunde -> tunde). */
export function yorubaStem(token) {
  const t = String(token || '').toLowerCase().trim();
  if (t.startsWith('oluwa') && t.length >= 8) return t.slice(5); // oluwakemi -> kemi, oluwaseun -> seun, oluwatobiloba -> tobiloba
  if (t.startsWith('baba') && t.length >= 7) return t.slice(4);  // babatunde -> tunde, babajide -> jide
  if (t.startsWith('mobo') && t.length >= 7) return t.slice(2);  // mobolaji -> bolaji
  if (t === 'ayodeji') return 'deji';
  if (t === 'abimbola') return 'bimbo';
  return t;
}

/** Match single name tokens allowing typos, vowel shifts, prefixes, or suffixes. */
export function isTokenNearMatch(token, u) {
  if (token === u) return true;
  if (!token || !u) return false;
  const minLen = Math.min(token.length, u.length);
  if (minLen < 3) return false;

  // 1) Yoruba theophoric stem equality (e.g. oluwakemi vs kemi, babatunde vs tunde)
  const st1 = yorubaStem(token);
  const st2 = yorubaStem(u);
  if (st1 === st2 || st1 === u || st2 === token) return true;
  if (st1.length >= 4 && st2.length >= 4 && editDistance(st1, st2) <= 1) return true;

  // 2) Small edit distance: <= 1 for short tokens (<= 4 chars), <= 2 for longer tokens (>= 5 chars)
  if (Math.abs(u.length - token.length) <= 2) {
    const maxDist = minLen <= 4 ? 1 : 2;
    if (editDistance(token, u) <= maxDist) return true;
  }

  // 3) Stem, prefix, and suffix matches for Nigerian / common name variations
  const [shorter, longer] = token.length <= u.length ? [token, u] : [u, token];
  if (shorter.length >= 4) {
    // Exact prefix (soliu -> soliudeen, kemi -> kemity)
    if (longer.startsWith(shorter)) return true;
    // Exact suffix (tunde -> babatunde, lateef -> abdullateef)
    if (longer.endsWith(shorter)) return true;
    // Prefix with single vowel/char variation (saliu vs soliudeen -> saliu vs soliu)
    const prefix = longer.slice(0, shorter.length);
    if (editDistance(shorter, prefix) <= 1) return true;
    // Suffix with single vowel/char variation
    const suffix = longer.slice(-shorter.length);
    if (editDistance(shorter, suffix) <= 1) return true;
  }
  return false;
}

/**
 * True when query and candidate share the same token multiset modulo one
 * near-typo or stem/diminutive token.
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
    for (let i = 0; i < unused.length; i++) {
      const u = unused[i];
      if (isTokenNearMatch(token, u)) {
        bestIdx = i;
        break;
      }
    }
    if (bestIdx >= 0) {
      typoSlots += 1;
      if (typoSlots > 1) return false;
      unused.splice(bestIdx, 1);
      continue;
    }
    return false;
  }
  return unused.length <= 1 && typoSlots <= 1 && (typoSlots === 1 || unused.length === 0);
}

/** Aggregate all identity tokens from a candidate's canonical name and all their aliases. */
export function getCandidateIdentityTokens(person) {
  const tokens = new Set();
  if (!person) return tokens;
  for (const t of personNameTokens(person.name || '')) {
    tokens.add(t);
    const stem = yorubaStem(t);
    if (stem && stem !== t) tokens.add(stem);
  }
  for (const alias of person.aliases || []) {
    for (const t of personNameTokens(alias)) {
      tokens.add(t);
      const stem = yorubaStem(t);
      if (stem && stem !== t) tokens.add(stem);
    }
  }
  return tokens;
}

/**
 * Matches composite identities like "Ibrahim Bakare Itele" where different
 * tokens come from the real name, middle/family name, and moniker aliases.
 */
export function matchesCompositeIdentity(query, person) {
  const qTokens = personNameTokens(query);
  if (qTokens.length < 2 || !person) return false;
  const identityTokens = getCandidateIdentityTokens(person);
  if (!identityTokens.size) return false;

  let matchCount = 0;
  for (const q of qTokens) {
    const qStem = yorubaStem(q);
    let matched = false;
    for (const idToken of identityTokens) {
      if (
        idToken === q ||
        idToken === qStem ||
        isTokenNearMatch(q, idToken) ||
        isTokenNearMatch(qStem, idToken)
      ) {
        matched = true;
        break;
      }
    }
    if (matched) matchCount++;
  }

  // Exactly 2 tokens: both must match (e.g. "Oluwakemi Apesin" vs "Kemi Apesin")
  if (qTokens.length === 2 && matchCount === 2) return true;
  // 3 or more tokens: at least 2 tokens and at most 1 missing (e.g. "Ibrahim Bakare Itele")
  if (qTokens.length >= 3 && matchCount >= qTokens.length - 1 && matchCount >= 2) return true;
  return false;
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

  // Composite identity match (e.g. "Ibrahim Bakare Itele" or "Oluwakemi Apesin")
  const composite = candidates.filter((p) => matchesCompositeIdentity(q, p));
  if (composite.length) {
    const uniqueIds = new Set(composite.map((p) => p.id));
    if (uniqueIds.size === 1) return composite[0];
    const sorted = [...composite].sort(rankPersonMatch);
    if (
      sorted.length >= 2 &&
      Number(sorted[0].film_count || 0) > Number(sorted[1].film_count || 0) * 2
    ) {
      return sorted[0];
    }
  }

  const near = candidates.filter((p) => namesNearMatch(q, p.name) || (p.aliases || []).some((a) => namesNearMatch(q, a)));
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
  const topNear = namesNearMatch(q, top.name) || (top.aliases || []).some((a) => namesNearMatch(q, a));
  if (!shared && !topNear) return null;
  return top;
}
