// Ranked, forgiving search across films, people and companies.
//
// Why not a single `ilike('%query%')`? That needs the whole phrase to appear
// as one contiguous substring, so "odunlade adekola" finds nothing unless a
// title literally contains that exact string — even though the person exists
// and stars in dozens of films. Instead we:
//   1. split the query into words (terms),
//   2. match ANY term (so word order / extra words / partial names still hit),
//   3. also find films by their cast (searching an actor shows their films),
//   4. rank everything so exact/most-complete matches lead and "similar"
//      results still show below.
// Optional pg_trgm RPCs (see migration) add typo tolerance on top; if they
// aren't installed yet we silently skip them.
import { supabase } from './supabase';

const FILM_FIELDS = `
  id, slug, title, poster_url, backdrop_url, year, language, runtime_minutes,
  view_count, average_rating, audience_rating, tmdb_rating, nfvcb_rating,
  content_type, youtube_watch_url, release_type, streaming_links, source,
  countries, film_genres!left(genres(name))
`;

const NOLLYWOOD_FILTER = 'source.neq.mubi,source.is.null,countries.cs.{"Nigeria"}';

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

// Relevance score for a candidate's text against the query.
function scoreText(text, fullQ, terms) {
  const t = (text || '').toLowerCase();
  if (!t) return 0;
  let s = 0;
  if (t === fullQ) s += 1000;            // exact
  else if (t.includes(fullQ)) s += 300;  // full phrase appears
  let matched = 0;
  for (const term of terms) if (t.includes(term)) { s += 60; matched++; }
  if (matched === terms.length) s += 120; // every word present
  if (t.startsWith(terms[0])) s += 25;    // prefix of first word
  s -= Math.min(t.length, 80) * 0.15;     // gently prefer tighter matches
  return s;
}

// The most selective (longest) term, used for the single cheap DB filter.
// A leading-wildcard `ilike '%term%'` already seq-scans; ORing several of them
// blows the statement timeout on big tables, so we filter by ONE term and do
// the multi-word ranking/filtering client-side.
const pickTerm = (terms) => [...terms].sort((a, b) => b.length - a.length)[0];

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

  // Filter the DB by the single most-selective term (cheap); rank by all terms
  // client-side below. Run the three categories in parallel.
  const term = pickTerm(terms);
  const [peopleRes, titleFilmRes, companyRes] = await Promise.all([
    supabase.from('people').select('*').ilike('name', `%${term}%`).limit(60),
    supabase.from('films').select(FILM_FIELDS).ilike('title', `%${term}%`).or(NOLLYWOOD_FILTER).limit(80),
    supabase.from('companies').select('*').ilike('name', `%${term}%`).limit(40),
  ]);

  // People (+ fuzzy top-up), ranked.
  let peopleRaw = peopleRes.data || [];
  if (peopleRaw.length < 5) {
    const fz = await fuzzy('search_people_fuzzy', fullQ);
    const seen = new Set(peopleRaw.map((p) => p.id));
    peopleRaw = [...peopleRaw, ...fz.filter((p) => !seen.has(p.id))];
  }
  const people = peopleRaw
    .map((p) => ({ ...p, _score: scoreText(p.name, fullQ, terms) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 24);

  // Films by cast — every film the top matched people appear in.
  let castFilms = [];
  const castFilmIds = new Set();
  if (people.length) {
    const ids = people.slice(0, 8).map((p) => p.id);
    const { data: credits } = await supabase
      .from('credits').select('film_id').in('person_id', ids).limit(100);
    const filmIds = [...new Set((credits || []).map((c) => c.film_id).filter(Boolean))];
    if (filmIds.length) {
      const { data } = await supabase.from('films').select(FILM_FIELDS).in('id', filmIds).limit(48);
      castFilms = data || [];
      castFilms.forEach((f) => castFilmIds.add(f.id));
    }
  }

  // Merge title + cast films, dedupe, score (cast match gets a baseline), sort.
  const byId = new Map();
  for (const f of [...(titleFilmRes.data || []), ...castFilms]) if (!byId.has(f.id)) byId.set(f.id, f);
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
