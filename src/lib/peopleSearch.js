// Shared people directory search — order-insensitive first, Cohere optional.
// Used by global search, People list, claim flow, OCR credits, and admin typeaheads.
import { supabase } from './supabase';
import { personNameTokens, sortedNameKey, foldPersonText, pickAutoMatch } from './personNameMatch';

const DEFAULT_SELECT = 'id, slug, name, photo_url, film_count, known_for_department, popularity_score, is_verified';

/**
 * Authoritative order-insensitive lookup via Postgres name_key.
 * This is what OCR / auto-link should prefer — not Cohere.
 */
export async function matchPeopleByNameKey(query, { limit = 8 } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];
  const { data, error } = await supabase.rpc('match_people_by_name', {
    p_name: q,
    p_limit: limit,
  });
  if (error) {
    // Older envs without the RPC — fall through to lexical search.
    if (/match_people_by_name|Could not find the function/i.test(error.message || '')) {
      return [];
    }
    console.warn('match_people_by_name failed:', error.message);
    return [];
  }
  return (data || []).map((p) => ({ ...p, _matchKind: p.match_kind }));
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
  if (list.length < 2) return list;
  try {
    const res = await fetch('/api/semantic-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: query,
        mode: 'rerank',
        entity: 'people',
        limit: Math.min(list.length, limit || 24),
        candidates: list.slice(0, 40).map((p) => ({ id: p.id, name: p.name })),
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
        _semantic: r._semantic,
        _cohere: r._semantic,
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
      if (p?.id && !seen.has(p.id)) seen.set(p.id, p);
    }
  };

  // 1) Authoritative order-insensitive RPC (exact + name_key swap)
  addRows(await matchPeopleByNameKey(q, { limit }));

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
      addRows(aliasPeople);
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
    const orTokens = (strong.length ? strong : tokens)
      .map((t) => `name.ilike.*${t}*`)
      .join(',');
    if (orTokens) {
      tasks.push(
        supabase.from('people').select(select).or(orTokens).limit(Math.max(limit, 40)),
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
    const { data: aliasRows } = await supabase
      .from('person_aliases')
      .select('person_id,alias')
      .ilike('alias', `%${tokens.join('%')}%`)
      .limit(limit * 2);
    const aliasIds = [...new Set((aliasRows || []).map(row => row.person_id).filter(Boolean))];
    if (aliasIds.length) {
      const { data: aliasPeople } = await supabase.from('people').select(select).in('id', aliasIds);
      addRows(aliasPeople);
    }
  }

  // 4) Fuzzy top-up for typos when still thin
  if (seen.size < 3 || tokens.length >= 2) {
    addRows(await suggestSimilarPeople(q, { limit: Math.max(limit, 12) }));
  }

  const qFold = foldPersonText(q);
  let ranked = [...seen.values()]
    .map((p) => {
      const pFold = foldPersonText(p.name);
      const pKey = sortedNameKey(p.name);
      let score = Number(p.popularity_score || 0) * 0.01;
      if (pFold === qFold) score += 1000;
      else if (key && pKey === key) score += 900;
      else if (p._matchKind === 'name_key') score += 900;
      else if (tokens.length >= 2 && tokens.every((t) => pFold.includes(t))) score += 400;
      else if (p._suggested) score += 120;
      else score += 50;
      if (p.photo_url) score += 5;
      return { ...p, _score: score };
    })
    .sort((a, b) => b._score - a._score)
    .slice(0, Math.max(limit, 24));

  // Cohere is optional polish for ranking — never required for order-swap.
  if (useCohere && ranked.length >= 2) {
    const topIsCertain =
      ranked[0]._score >= 900 || pickAutoMatch(q, ranked.slice(0, 3));
    if (!topIsCertain) {
      ranked = await rerankPeopleWithCohere(q, ranked, { limit });
      ranked = ranked
        .map((p) => ({
          ...p,
          _score: Math.max(Number(p._score || 0), Number(p._semantic || 0) * 500),
        }))
        .sort((a, b) => b._score - a._score);
    }
  }

  return ranked.slice(0, limit);
}
