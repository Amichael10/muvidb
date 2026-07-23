// Ranked, forgiving search across films, people and companies.
//
// Why not a single `ilike('%query%')`? That needs the whole phrase to appear
// as one contiguous substring, so "odunlade adekola" finds nothing unless a
// title literally contains that exact string — even though the person exists
// and stars in dozens of films. Instead we:
//   1. split the query into words (terms),
//   2. match people in an order-insensitive way (name_key + AND-of-tokens),
//   3. also find films by their cast (searching an actor shows their films),
//   4. rank everything so exact/most-complete matches lead and "similar"
//      results still show below.
// Optional pg_trgm RPCs (see migration) add typo tolerance on top; if they
// aren't installed yet we silently skip them.
import { supabase } from './supabase';
import { searchPeopleByName } from './peopleSearch';
import { sortedNameKey } from './personNameMatch';

const FILM_FIELDS = `
  id, slug, title, poster_url, backdrop_url, year, language, runtime_minutes,
  view_count, average_rating, liked_percent, audience_rating, tmdb_rating, nfvcb_rating,
  content_type, youtube_watch_url, release_type, streaming_links, source,
  countries, film_genres!left(genres(name))
`;

// Clean, lowercase, keep words of length >= 2. Strip characters that would
// break a PostgREST `.or()` filter string (comma, parens, star, dot).
function tokenize(q) {
  return (q || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

// Word-padded trigram set, mirroring how pg_trgm tokenises. Lets us rank typo'd
// queries client-side: "weding party" is far closer to "The Wedding Party" than
// to "The Party", even though neither contains the substring "weding".
function trigrams(s) {
  const set = new Set();
  const words = (s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  for (const w of words) {
    const padded = `  ${w} `;
    for (let i = 0; i < padded.length - 2; i++) set.add(padded.slice(i, i + 3));
  }
  return set;
}

// Jaccard overlap of trigram sets, 0..1.
function trigramSimilarity(a, b) {
  const A = trigrams(a);
  const B = trigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

// Relevance score for a candidate's text against the query.
function scoreText(text, fullQ, terms) {
  const t = (text || '').toLowerCase();
  if (!t) return 0;
  let s = 0;
  if (t === fullQ) s += 1000;            // exact
  else if (t.includes(fullQ)) s += 300;  // full phrase appears
  // Name/surname in either order ("adekola odunlade" ↔ "odunlade adekola")
  const qKey = sortedNameKey(fullQ);
  const tKey = sortedNameKey(t);
  if (qKey && tKey && qKey === tKey) s += 700;
  let matched = 0;
  for (const term of terms) if (t.includes(term)) { s += 60; matched++; }
  if (matched === terms.length) s += 120; // every word present
  if (t.startsWith(terms[0])) s += 25;    // prefix of first word
  // Fuzzy closeness — the only signal that can rank a typo'd match, since a
  // misspelt term never substring-matches.
  s += trigramSimilarity(fullQ, t) * 400;
  s -= Math.min(t.length, 80) * 0.15;     // gently prefer tighter matches
  return s;
}

// Best-effort pg_trgm fuzzy top-up (typo tolerance). No-ops if the RPC or the
// extension isn't installed yet.
async function fuzzy(rpcName, q) {
  try {
    const { data, error } = await supabase.rpc(rpcName, { q, lim: 20 });
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

export async function searchAll(query) {
  const fullQ = (query || '').trim().toLowerCase();
  const terms = tokenize(query);
  if (!terms.length) return { films: [], people: [], companies: [] };

  // People: order-insensitive + AND-of-tokens (fast). Companies still OR terms.
  // Fuzzy RPCs only when the first pass is empty — keeps common searches snappy.
  const orIlike = (field, ts) => ts.map((t) => `${field}.ilike.*${t}*`).join(',');

  const [peopleRows, companyRes] = await Promise.all([
    searchPeopleByName(query, {
      limit: 40,
      select: '*',
    }).catch(() => []),
    supabase.from('companies').select('*').or(orIlike('name', terms)).limit(40),
  ]);

  // A strong person-name match means the useful film results are that person's
  // credits. Skip the full film-title lookup in that case; it is both less
  // relevant and unnecessarily expensive on a large catalogue.
  const confidentPersonMatch = peopleRows
    .some((person) => scoreText(person.name, fullQ, terms) >= 180);
  const titleFilmRes = confidentPersonMatch
    ? { data: [], error: null }
    : await supabase.from('films').select(FILM_FIELDS).ilike('title', `%${fullQ}%`).limit(80);

  const peopleFz = peopleRows.length === 0
    ? await fuzzy('search_people_fuzzy', fullQ)
    : [];
  const filmsFz = (titleFilmRes.data || []).length === 0 && peopleRows.length === 0
    ? await fuzzy('search_films_fuzzy', fullQ)
    : [];

  // Merge a fuzzy result set into the exact one, skipping ids we already have.
  const mergeFuzzy = (rows, fz) => {
    const seen = new Set(rows.map((r) => r.id));
    return [...rows, ...fz.filter((r) => r?.id && !seen.has(r.id))];
  };

  const people = mergeFuzzy(peopleRows, peopleFz)
    .map((p) => ({ ...p, _score: scoreText(p.name, fullQ, terms) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 24);

  // Films by title, plus fuzzy matches so a typo'd title still lands
  // ("weding party" -> The Wedding Party). Fuzzy rows come straight from the
  // films table with no genres join, which the mapping below tolerates.
  const titleFilms = mergeFuzzy(titleFilmRes.data || [], filmsFz)
    .filter((film) => film.source !== 'mubi' || film.countries?.includes('Nigeria'));

  // Films by cast — every film the top matched people appear in.
  let castFilms = [];
  const castFilmIds = new Set();
  if (people.length) {
    const ids = people.slice(0, 8).map((p) => p.id);
    // Via our own endpoint rather than a direct `credits` read — see
    // api/content.ts (keeps the cast graph from being bulk-scraped).
    let filmIds = [];
    try {
      const fetchDirect = async () => {
        const { data } = await supabase.from('credits').select('film_id').in('person_id', ids).limit(100);
        return [...new Set((data || []).map((credit) => credit.film_id).filter(Boolean))];
      };

      if (import.meta.env.DEV) {
        filmIds = await fetchDirect();
      } else {
        const res = await fetch(`/api/content?resource=person-films&personIds=${encodeURIComponent(ids.join(','))}`);
        filmIds = res.ok ? (await res.json()).filmIds || [] : await fetchDirect();
      }
    } catch (e) {
      // Search still works on title matches alone if the cast lookup fails.
      console.warn('cast film lookup failed:', e);
    }
    if (filmIds.length) {
      const { data } = await supabase.from('films').select(FILM_FIELDS).in('id', filmIds).limit(48);
      castFilms = data || [];
      castFilms.forEach((f) => castFilmIds.add(f.id));
    }
  }

  // Merge title + cast films, dedupe, score (cast match gets a baseline), sort.
  const byId = new Map();
  for (const f of [...titleFilms, ...castFilms]) if (!byId.has(f.id)) byId.set(f.id, f);
  const films = [...byId.values()]
    .map((f) => ({
      ...f,
      genres: f.film_genres?.map((g) => g.genres?.name).filter(Boolean) || [],
      _score: Math.max(scoreText(f.title, fullQ, terms), castFilmIds.has(f.id) ? 45 : 0),
    }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 48);

  const companies = (companyRes.data || [])
    .map((c) => ({ ...c, _score: scoreText(c.name, fullQ, terms) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 20);

  return { films, people, companies };
}
