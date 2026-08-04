/**
 * Extracts / normalizes the base show name from a TV episode or variant title.
 *
 * Examples:
 * "The Origin: Madam Koi-Koi - Chapter 1: The Awakening" -> "The Origin: Madam Koi-Koi"
 * "Blood Sisters Season 1" -> "Blood Sisters"
 * "MSH - Episode 6" -> "MSH"
 * "Saamu Alajo | FIC | EP" -> "Saamu Alajo"
 * "Saamu Alajo: Latest (2024) Yoruba Comedy Series" -> "Saamu Alajo"
 *
 * @param {string} title
 * @returns {string} The base show name (display casing preserved where possible)
 */
export function getShowName(title) {
  if (!title) return '';

  let t = String(title).trim();

  // Pipe-separated YouTube variants: "Saamu Alajo | FIC | EP"
  if (t.includes('|')) {
    t = t.split('|')[0].trim();
  }

  // Marketing suffixes after a colon (keep real subtitle titles like "Origin: Madam Koi-Koi"
  // when the right side doesn't look like promo junk).
  const promoColon = t.match(/^(.*?)\s*:\s*(Latest|New|Full|Complete|All\s*Episodes|Yoruba|English|Hausa|Igbo|Comedy|Drama|Series|Season)\b.*$/i);
  if (promoColon?.[1]) {
    t = promoColon[1].trim();
  }

  // Drop year parentheses / trailing years used in upload titles
  t = t.replace(/\s*\((?:19|20)\d{2}\)\s*/g, ' ').trim();
  t = t.replace(/\s*\([^)]*season[^)]*\)/gi, ' ').trim();
  t = t.replace(/\b(?:EP|EPS|FIC|S\d+\s*E\d+)\b/gi, ' ').trim();

  // " - Chapter X", "Episode X", "Part X", etc.
  const match = t.match(/^(.*?)(?:[\s:-]+)?\b(?:Season|Chapter|Episode|Part|Vol(?:ume)?)\s*\d+/i);
  if (match?.[1]) {
    t = match[1].replace(/[\s:-]+$/, '').trim();
  }

  // Yoruba episode markers
  const yorubaMatch = t.match(/^(.*?)(?:[\s:-]+)?\b(?:IKAN|EJI|ETA|ERIN|ARUN|EFA|EJE|EJO|ESAN|EWA|ELESE|KEJI|KETA|KERIN|KARUN|KEFA|KEJE|KEJO|KESAN|KEWA|ABALA|IPIN)\b/i);
  if (yorubaMatch?.[1]) {
    t = yorubaMatch[1].replace(/[\s:-]+$/, '').trim();
  }

  // Trailing standalone number ("Show 2") — only if leftover looks like a base name
  const numberMatch = t.match(/^(.*?)(?:[\s:-]+)?\b\d+$/);
  if (numberMatch?.[1] && numberMatch[1].trim().length >= 3) {
    t = numberMatch[1].replace(/[\s:-]+$/, '').trim();
  }

  return t.replace(/\s+/g, ' ').trim();
}

/** Lowercase merge key for grouping. */
export function normalizeShowKey(title) {
  return getShowName(title).toLowerCase();
}

const EPISODE_TITLE_RE = /\b(?:Season|Chapter|Episode|Part|Vol(?:ume)?)\s*\d+/i;

function isSeriesType(film) {
  return film?.content_type === 'series' || film?.content_type === 'mini_series';
}

function isParentSeries(film) {
  if (!film) return false;
  if (film.series_id) return false;
  if (film.episode_number != null) return false;
  if (EPISODE_TITLE_RE.test(film.title || '')) return false;
  if ((film.title || '').includes('|')) return false;
  return isSeriesType(film);
}

function looksLikeSeriesRow(film) {
  if (!film) return false;
  if (film.series_id || film.episode_number != null) return true;
  if (isSeriesType(film)) return true;
  const t = film.title || '';
  return EPISODE_TITLE_RE.test(t) || t.includes('|');
}

/** True when two normalized show keys belong to the same series. */
export function sameShowKey(a, b) {
  if (!a || !b) return false;
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  if (x === y) return true;

  const shorter = x.length <= y.length ? x : y;
  const longer = x.length <= y.length ? y : x;
  if (shorter.length < 4) return false;

  // Containment: "saamu alajo" inside "saamu alajo fic ep" / "saamu alajo: latest…"
  if (
    longer === shorter ||
    longer.startsWith(`${shorter} `) ||
    longer.startsWith(`${shorter}:`) ||
    longer.startsWith(`${shorter}|`) ||
    longer.startsWith(`${shorter}-`)
  ) {
    // Prefer multi-word stems; allow short brands like "MSH" when exact prefix.
    const words = shorter.split(/\s+/).filter(Boolean);
    if (words.length >= 2) return true;
    if (shorter.length >= 6) return true;
    // Single short token only if the longer title is just that + episode junk
    return words.length === 1 && (longer.startsWith(`${shorter} `) || longer.startsWith(`${shorter}-`));
  }

  // Shared significant word prefix (legacy fuzzy)
  const words1 = x.split(/[\s:-]+/).filter(Boolean);
  const words2 = y.split(/[\s:-]+/).filter(Boolean);
  const prefix = [];
  for (let i = 0; i < Math.min(words1.length, words2.length); i++) {
    if (words1[i] === words2[i]) prefix.push(words1[i]);
    else break;
  }
  const shared = prefix.join(' ');
  return shared.length >= 6 && prefix.length >= 2;
}

function pickPreferred(members, showKey) {
  // Prefer the clean parent title that equals the show name exactly ("Saamu Alajo")
  const exactTitle = members.find(
    (m) => (m.title || '').trim().toLowerCase() === showKey
  );
  if (exactTitle) return exactTitle;

  const parents = members.filter(isParentSeries);
  const pool = parents.length
    ? parents
    : members.filter((m) => m.poster_url || m.backdrop_url).length
      ? members.filter((m) => m.poster_url || m.backdrop_url)
      : members;

  // Prefer shortest title (closest to clean show name), then popularity
  return [...pool].sort((a, b) => {
    const len = (a.title || '').length - (b.title || '').length;
    if (len) return len;
    return (Number(b.view_count) || 0) - (Number(a.view_count) || 0);
  })[0] || members[0];
}

function groupKeyFor(film) {
  // Linked episodes always join their parent id bucket.
  if (film.series_id) return `sid:${film.series_id}`;
  // All other series / episode-like rows group by normalized show name so
  // "Saamu Alajo" and "Saamu Alajo | FIC | EP" land in the same bucket.
  if (looksLikeSeriesRow(film) || isSeriesType(film)) {
    const name = normalizeShowKey(film.title);
    return `name:${name || film.id}`;
  }
  return `id:${film.id}`;
}

/**
 * Collapse episode / variant rows into one series card for grid/list UIs.
 * Prefers series_id grouping, then normalized show-name grouping with
 * containment merge so "Saamu Alajo | …" folds into "Saamu Alajo".
 *
 * @param {Array<object>} films
 * @returns {Array<object>}
 */
export function collapseSeriesFilms(films) {
  if (!Array.isArray(films) || films.length === 0) return [];

  /** @type {Map<string, object[]>} */
  const buckets = new Map();

  for (const film of films) {
    const key = groupKeyFor(film);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(film);
  }

  // Merge name-based buckets that belong to the same show (containment / prefix).
  let merged = true;
  while (merged) {
    merged = false;
    const nameKeys = [...buckets.keys()].filter((k) => k.startsWith('name:'));
    outer: for (let i = 0; i < nameKeys.length; i++) {
      const keyA = nameKeys[i];
      if (!buckets.has(keyA)) continue;
      const nameA = keyA.slice(5);
      for (let j = i + 1; j < nameKeys.length; j++) {
        const keyB = nameKeys[j];
        if (!buckets.has(keyB)) continue;
        const nameB = keyB.slice(5);
        if (!sameShowKey(nameA, nameB)) continue;

        const shorter = nameA.length <= nameB.length ? nameA : nameB;
        const mergedKey = `name:${shorter}`;
        const combined = [...buckets.get(keyA), ...buckets.get(keyB)];
        buckets.delete(keyA);
        buckets.delete(keyB);
        if (buckets.has(mergedKey)) {
          buckets.set(mergedKey, [...buckets.get(mergedKey), ...combined]);
        } else {
          buckets.set(mergedKey, combined);
        }
        merged = true;
        break outer;
      }
    }
  }

  // Fold sid:{parentId} episode buckets into the parent's name bucket when the
  // parent row is also present in this list.
  for (const sidKey of [...buckets.keys()].filter((k) => k.startsWith('sid:'))) {
    const parentId = sidKey.slice(4);
    const parentFilm = films.find((f) => f.id === parentId);
    if (!parentFilm) continue;
    const nameKey = `name:${normalizeShowKey(parentFilm.title) || parentId}`;
    const sidMembers = buckets.get(sidKey) || [];
    const nameMembers = buckets.get(nameKey) || [];
    buckets.set(nameKey, [...nameMembers, ...sidMembers]);
    buckets.delete(sidKey);
  }

  // Fold remaining name groups that still match by containment.
  merged = true;
  while (merged) {
    merged = false;
    const nameKeys = [...buckets.keys()].filter((k) => k.startsWith('name:'));
    outer2: for (let i = 0; i < nameKeys.length; i++) {
      const keyA = nameKeys[i];
      if (!buckets.has(keyA)) continue;
      const nameA = keyA.slice(5);
      for (let j = i + 1; j < nameKeys.length; j++) {
        const keyB = nameKeys[j];
        if (!buckets.has(keyB)) continue;
        const nameB = keyB.slice(5);
        if (!sameShowKey(nameA, nameB)) continue;
        const shorter = nameA.length <= nameB.length ? nameA : nameB;
        const mergedKey = `name:${shorter}`;
        const combined = [...buckets.get(keyA), ...buckets.get(keyB)];
        buckets.delete(keyA);
        buckets.delete(keyB);
        if (buckets.has(mergedKey)) {
          buckets.set(mergedKey, [...buckets.get(mergedKey), ...combined]);
        } else {
          buckets.set(mergedKey, combined);
        }
        merged = true;
        break outer2;
      }
    }
  }

  const collapsed = [];
  for (const members of buckets.values()) {
    if (members.length === 1 && !looksLikeSeriesRow(members[0])) {
      collapsed.push(members[0]);
      continue;
    }

    const showKey = normalizeShowKey(members[0].title) ||
      members.map((m) => normalizeShowKey(m.title)).sort((a, b) => a.length - b.length)[0];
    // Prefer the shortest shared stem across the group
    const stem = members
      .map((m) => normalizeShowKey(m.title))
      .filter(Boolean)
      .sort((a, b) => a.length - b.length)[0] || showKey;

    const preferred = pickPreferred(members, stem);
    const displayTitle = getShowName(preferred.title) || preferred.title;
    // Prefer exact clean title from any member (e.g. "Saamu Alajo")
    const cleanMember = members.find(
      (m) => (m.title || '').trim().toLowerCase() === stem
    );
    const title = cleanMember?.title?.trim() || displayTitle;
    const shell = cleanMember || preferred;

    const dbCount = Number(shell.episode_count) || 0;
    const episodesCount = Math.max(members.length, dbCount);

    collapsed.push({
      ...shell,
      title,
      original_title: preferred.title,
      content_type: shell.content_type || 'series',
      is_series_group: true,
      episodes_count: episodesCount,
      episodes_list: members,
    });
  }

  const firstIndex = new Map(films.map((f, i) => [f.id, i]));
  collapsed.sort((a, b) => {
    const ai = Math.min(...(a.episodes_list || [a]).map((m) => firstIndex.get(m.id) ?? 0));
    const bi = Math.min(...(b.episodes_list || [b]).map((m) => firstIndex.get(m.id) ?? 0));
    return ai - bi;
  });

  return collapsed;
}
