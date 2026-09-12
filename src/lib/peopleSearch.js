// Shared people directory search — order-insensitive first, Cohere optional.
// Used by global search, People list, claim flow, OCR credits, and admin typeaheads.
import { supabase } from './supabase';
import {
  personNameTokens,
  sortedNameKey,
  foldPersonText,
  personAliasKey,
  matchesPersonAlias,
  yorubaStem,
  matchesCompositeIdentity,
  namesNearMatch,
} from './personNameMatch';

const DEFAULT_SELECT = 'id, slug, name, photo_url, film_count, known_for_department, popularity_score, is_verified';

/**
 * Authoritative order-insensitive lookup via Postgres name_key.
 * This is what OCR / auto-link should prefer — not Cohere.
 */
export async function matchPeopleByNameKey(query, { limit = 8 } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];
  const aliasKey = personAliasKey(q);
  const { data: aliasRows, error: aliasError } = aliasKey
    ? await supabase.from('person_aliases').select('person_id,alias').eq('alias_key', aliasKey)
    : { data: [], error: null };
  if (aliasError) console.warn('Alias lookup failed:', aliasError.message);
  const aliasIds = [...new Set((aliasRows || []).map(row => row.person_id))];
  const { data: aliasPeople } = aliasIds.length
    ? await supabase.from('people').select(DEFAULT_SELECT).in('id', aliasIds)
    : { data: [] };
  const aliasMatches = (aliasPeople || []).map(person => ({
    ...person,
    aliases: aliasRows.filter(row => row.person_id === person.id).map(row => row.alias),
    _matchKind: 'alias',
  }));
  const { data, error } = await supabase.rpc('match_people_by_name', {
    p_name: q,
    p_limit: limit,
  });
  if (error) {
    // Older envs without the RPC — fall through to lexical search.
    if (/match_people_by_name|Could not find the function/i.test(error.message || '')) {
      return aliasMatches;
    }
    console.warn('match_people_by_name failed:', error.message);
    return aliasMatches;
  }
  const merged = new Map(aliasMatches.map(p => [p.id, p]));
  for (const person of data || []) merged.set(person.id, { ...person, aliases: merged.get(person.id)?.aliases || [], _matchKind: person.match_kind });
  return [...merged.values()];
}

export async function suggestSimilarPeople(query, { limit = 8 } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];
  const { data, error } = await supabase.rpc('suggest_similar_people', {
    p_name: q,
    p_limit: limit,
  });
  if (error) return [];
  return (data || []).map((p) => ({ ...p, _suggested: true }));
}

/**
 * Cohere Rerank over people candidates. Ranking only — never the sole
 * signal for auto-link. No-ops when Cohere is down or candidates < 2.
 */
export async function rerankPeopleWithCohere(query, people, { limit } = {}) {
  const list = Array.isArray(people) ? people : [];
  if (list.length < 2 || (typeof window === 'undefined' && !process?.env?.VITEST)) return list;
  try {
    const res = await fetch('/api/semantic-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: query,
        mode: 'rerank',
        entity: 'people',
        limit: Math.min(list.length, limit || 24),
        candidates: list.slice(0, 40).map((p) => ({ id: p.id, name: [p.name, ...(p.aliases || [])].join(' | ') })),
      }),
    });
    if (!res.ok) return list;
    const body = await res.json();
    const ranked = Array.isArray(body.people) ? body.people : [];
    if (!ranked.length) return list;

    const byId = new Map(list.map((p) => [p.id, p]));
    const seen = new Set();
    const out = [];
    for (const r of ranked) {
      const base = byId.get(r.id);
      if (!base || seen.has(r.id)) continue;
      seen.add(r.id);
      out.push({
        ...base,
        _semantic: Number(r.score ?? r._semantic ?? 0),
        _cohere: Number(r.score ?? r._semantic ?? 0),
        _score: Math.max(Number(base._score || 0), Number(r._score || 0)),
      });
    }
    for (const p of list) {
      if (!seen.has(p.id)) out.push(p);
    }
    return out;
  } catch {
    return list;
  }
}

export async function searchPeopleByName(
  query,
  { limit = 24, select = DEFAULT_SELECT, useCohere = true } = {},
) {
  const q = String(query || '').trim();
  const tokens = personNameTokens(q);
  if (!tokens.length) return [];

  const key = sortedNameKey(q);
  const seen = new Map();

  const addRows = (rows = []) => {
    for (const p of rows) {
      if (p?.id) seen.set(p.id, { ...seen.get(p.id), ...p, aliases: [...new Set([...(seen.get(p.id)?.aliases || []), ...(p.aliases || [])])] });
    }
  };

  // Fetch the full requested row even when the name-key RPC is unavailable.
  const exactResult = await supabase.from('people').select(select).ilike('name', q.replace(/[%_]/g, ' ')).limit(limit);
  if (exactResult.error) throw exactResult.error;

  // 1) Authoritative order-insensitive RPC (exact + name_key swap)
  addRows(await matchPeopleByNameKey(q, { limit }));
  addRows(exactResult.data || []);

  if (tokens.length === 1) {
    const { data, error } = await supabase
      .from('people')
      .select(select)
      .ilike('name', `%${tokens[0]}%`)
      .order('popularity_score', { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) throw error;
    addRows(data);
    // Credit lists commonly use a nickname/alias in brackets. Search those
    // decorations explicitly so "itele" resolves to "Ibrahim ... (Itele)".
    const aliasQueries = await Promise.all([
      supabase.from('people').select(select).ilike('name', `%(${tokens[0]})%`).limit(limit),
      supabase.from('people').select(select).ilike('name', `%[${tokens[0]}]%`).limit(limit),
    ]);
    for (const result of aliasQueries) if (!result.error) addRows(result.data);
    const { data: aliasRows } = await supabase
      .from('person_aliases')
      .select('person_id,alias')
      .ilike('alias', `%${tokens[0]}%`)
      .limit(limit * 2);
    const aliasIds = [...new Set((aliasRows || []).map(row => row.person_id).filter(Boolean))];
    if (aliasIds.length) {
      const { data: aliasPeople } = await supabase.from('people').select(select).in('id', aliasIds);
      addRows((aliasPeople || []).map(p => ({ ...p, aliases: (aliasRows || []).filter(a => a.person_id === p.id).map(a => a.alias) })));
    }
  } else {
    // 2) name_key column (same as RPC, kept for envs where RPC lags)
    // 3) OR of strong tokens — wider net than AND, then client-rank by key
    const tasks = [];
    if (key) {
      tasks.push(
        supabase.from('people').select(select).eq('name_key', key).limit(limit),
      );
    }
    const strong = tokens.filter((t) => t.length >= 3);
    const expandedTokens = new Set(strong);
    for (const t of strong) {
      const stem = yorubaStem(t);
      if (stem && stem !== t && stem.length >= 3) expandedTokens.add(stem);
    }
    const tokenList = [...expandedTokens];
    const orTokens = (tokenList.length ? tokenList : tokens)
      .map((t) => `name.ilike.*${t}*`)
      .join(',');
    if (orTokens) {
      tasks.push(
        supabase
          .from('people')
          .select(select)
          .or(orTokens)
          .order('film_count', { ascending: false, nullsFirst: false })
          .limit(Math.max(limit, 50)),
      );
    }

    const results = await Promise.all(tasks);
    for (const { data, error } of results) {
      if (error) {
        if (!/name_key/i.test(error.message || '')) throw error;
        continue;
      }
      addRows(data);
    }

    // Search person_aliases with OR across tokens so aliases like "Itele" or "Kemity"
    // are matched even when query contains other tokens like "Ibrahim Bakare" or "Oluwakemi".
    const aliasOr = (tokenList.length ? tokenList : tokens)
      .map((t) => `alias.ilike.*${t}*`)
      .join(',');
    const { data: aliasRows } = await supabase
      .from('person_aliases')
      .select('person_id,alias')
      .or(aliasOr)
      .limit(Math.max(limit * 3, 60));
    const aliasIds = [...new Set((aliasRows || []).map(row => row.person_id).filter(Boolean))];
    if (aliasIds.length) {
      const { data: aliasPeople } = await supabase.from('people').select(select).in('id', aliasIds);
      addRows((aliasPeople || []).map(p => ({ ...p, aliases: (aliasRows || []).filter(a => a.person_id === p.id).map(a => a.alias) })));
    }
  }

  // 4) Fuzzy top-up for typos when still thin
  if (seen.size < 3 || tokens.length >= 2) {
    addRows(await suggestSimilarPeople(q, { limit: Math.max(limit, 12) }));
  }

  // Hydrate candidates with caller's fields and attach all registered aliases
  if (seen.size) {
    const ids = [...seen.keys()];
    const [peopleRes, aliasRes] = await Promise.all([
      supabase.from('people').select(select).in('id', ids),
      supabase.from('person_aliases').select('person_id, alias').in('person_id', ids),
    ]);
    if (peopleRes.error) throw peopleRes.error;
    addRows(peopleRes.data || []);
    if (!aliasRes.error && aliasRes.data) {
      for (const row of aliasRes.data) {
        const p = seen.get(row.person_id);
        if (p) {
          p.aliases = [...new Set([...(p.aliases || []), row.alias])];
        }
      }
    }
  }
  let ranked = rankPeopleResults(q, [...seen.values()]);
  if (useCohere && ranked.length >= 2) {
    ranked = await rerankPeopleWithCohere(q, ranked, { limit: Math.min(ranked.length, 40) });
    ranked = rankPeopleResults(q, ranked);
  }
  return ranked.slice(0, limit);
}

// Relevance tiers are absolute: popularity and semantic scores cannot bury an
// exact canonical name, exact alias, or complete name-order match.
export function rankPeopleResults(query, people) {
  const folded = foldPersonText(query).trim().replace(/\s+/g, ' ');
  const key = sortedNameKey(query);
  const tokens = personNameTokens(query);

  return (people || []).map(person => {
    if (!person) return null;
    const name = foldPersonText(person.name).trim().replace(/\s+/g, ' ');
    const personTokens = personNameTokens(person.name);

    const isExactName = Boolean(folded && name === folded);
    const isExactAlias = matchesPersonAlias(query, person);
    const isExactKey = Boolean(key && sortedNameKey(person.name) === key);
    const isAliasKey = Boolean(key && (person.aliases || []).some(a => sortedNameKey(a) === key));
    const isCompositeIdentity = matchesCompositeIdentity(query, person);
    const hasAllTokensExact = Boolean(tokens.length >= 2 && tokens.every(t => personTokens.includes(t)));
    const hasAllTokensSubstring = Boolean(tokens.length && tokens.every(t => name.includes(t)));
    const isNear = namesNearMatch(query, person.name) || (person.aliases || []).some(a => namesNearMatch(query, a));

    // Tiers are spaced by thousands so lower tiers can never leapfrog
    const tier = isExactName ? 100
      : isExactAlias ? 90
      : isExactKey ? 80
      : isAliasKey ? 75
      : isCompositeIdentity ? 70
      : isNear ? 50
      : hasAllTokensExact ? 40
      : hasAllTokensSubstring ? 25
      : 10;

    const semantic = Math.min(1, Math.max(0, Number(person._semantic || 0)));
    const popularity = Math.min(1, Math.max(0, Number(person.popularity_score || 0)) / 10000);
    const filmBonus = Math.min(5, Number(person.film_count || 0) * 0.05);
    const photoBonus = person.photo_url || person.photo ? 0.5 : 0;
    const verifiedBonus = person.is_verified ? 0.5 : 0;

    const score = tier * 1000 + (semantic * 100) + popularity + filmBonus + photoBonus + verifiedBonus;

    return { ...person, _score: score, _tier: tier };
  }).filter(Boolean).sort((a, b) => b._score - a._score);
}
