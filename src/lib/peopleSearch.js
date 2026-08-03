// Shared people directory search — order-insensitive + Cohere-assisted.
// Used by global search, People list, claim flow, OCR credits, and admin typeaheads.
import { supabase } from './supabase';
import { personNameTokens, sortedNameKey, foldPersonText } from './personNameMatch';

const DEFAULT_SELECT = 'id, slug, name, photo_url, film_count, known_for_department, popularity_score, is_verified';

/**
 * Fuzzy "did you mean…?" candidates — trigram similarity, plus an exact
 * token-set (order-insensitive) match scored as 1.0.
 *
 * Deliberately separate from matching: this NEVER links or merges. Use it to
 * offer suggestions before creating a new person. Authoritative matching stays
 * with find_person_by_name(), which is strict on purpose so two different people
 * are never silently merged.
 *
 * Catches what the substring search cannot: "Bayo Adeniyi" only finds
 * "Adebayo Adeniyi" today because %bayo% happens to be a substring of it —
 * "Shola" vs "Sola" finds nothing without this.
 */
export async function suggestSimilarPeople(query, { limit = 8 } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];
  const { data, error } = await supabase.rpc('suggest_similar_people', {
    p_name: q,
    p_limit: limit,
  });
  // Suggestions are a nicety — never let a missing RPC break a search box.
  if (error) return [];
  return (data || []).map((p) => ({ ...p, _suggested: true }));
}

/**
 * Cohere Rerank over people candidates (order swaps, OCR typos, nicknames).
 * No-ops cleanly when Cohere is down or there aren't enough candidates.
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
    // Keep any leftover lexical hits after Cohere's top-N.
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

  if (tokens.length === 1) {
    const { data, error } = await supabase
      .from('people')
      .select(select)
      .ilike('name', `%${tokens[0]}%`)
      .order('popularity_score', { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) throw error;
    addRows(data);
  } else {
    // Parallel: exact order-insensitive key + every-token AND match
    const andQuery = () => {
      let qb = supabase.from('people').select(select).limit(limit);
      for (const t of tokens) qb = qb.ilike('name', `%${t}%`);
      return qb;
    };

    const tasks = [andQuery()];
    if (key) {
      tasks.push(
        supabase.from('people').select(select).eq('name_key', key).limit(limit),
      );
    }

    const results = await Promise.all(tasks);
    for (const { data, error } of results) {
      if (error) {
        // name_key column may not exist yet on older envs — ignore that path
        if (!/name_key/i.test(error.message || '')) throw error;
        continue;
      }
      addRows(data);
    }
  }

  // Fuzzy top-up: always for multi-token (OCR typos like Mirian/Marian), and
  // for single-token when lexical returned nothing.
  if (tokens.length >= 2 || !seen.size) {
    addRows(await suggestSimilarPeople(q, { limit: Math.max(limit, 12) }));
  }

  const qFold = foldPersonText(q);
  let ranked = [...seen.values()]
    .map((p) => {
      const pFold = foldPersonText(p.name);
      const pKey = sortedNameKey(p.name);
      let score = Number(p.popularity_score || 0) * 0.01;
      if (pFold === qFold) score += 1000;
      else if (key && pKey === key) score += 800;
      else if (tokens.every((t) => pFold.includes(t))) score += 400;
      else if (p._suggested) score += 120;
      else score += 50;
      if (p.photo_url) score += 5;
      return { ...p, _score: score };
    })
    .sort((a, b) => b._score - a._score)
    .slice(0, Math.max(limit, 24));

  if (useCohere && ranked.length >= 2) {
    ranked = await rerankPeopleWithCohere(q, ranked, { limit });
    ranked = ranked
      .map((p) => ({
        ...p,
        _score: Math.max(
          Number(p._score || 0),
          Number(p._semantic || 0) * 500,
        ),
      }))
      .sort((a, b) => b._score - a._score)
      .slice(0, limit);
  } else {
    ranked = ranked.slice(0, limit);
  }

  return ranked;
}
