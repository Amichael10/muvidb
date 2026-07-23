// Shared people directory search — order-insensitive + fast.
// Used by global search, People list, claim flow, and admin typeaheads.
import { supabase } from './supabase';
import { personNameTokens, sortedNameKey, foldPersonText } from './personNameMatch';

const DEFAULT_SELECT = 'id, slug, name, photo_url, film_count, known_for_department, popularity_score, is_verified';

/**
 * Search people by name.
 * - 1 token: substring ilike (trigram-indexed)
 * - 2+ tokens: name_key equality (order-insensitive) UNION AND-of-tokens
 * Results ranked: exact fold → token-key swap → all tokens present → popularity
 */
export async function searchPeopleByName(query, { limit = 24, select = DEFAULT_SELECT } = {}) {
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
        supabase.from('people').select(select).eq('name_key', key).limit(limit)
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

  const qFold = foldPersonText(q);
  const ranked = [...seen.values()]
    .map((p) => {
      const pFold = foldPersonText(p.name);
      const pKey = sortedNameKey(p.name);
      let score = Number(p.popularity_score || 0) * 0.01;
      if (pFold === qFold) score += 1000;
      else if (key && pKey === key) score += 800;
      else if (tokens.every((t) => pFold.includes(t))) score += 400;
      else score += 50;
      if (p.photo_url) score += 5;
      return { ...p, _score: score };
    })
    .sort((a, b) => b._score - a._score)
    .slice(0, limit);

  return ranked;
}
