import { supabase } from './supabase.js';
import { syncFilmEmbedding } from './film_embeddings.js';

const TOP_N = 12;
const EMB_NEIGHBOR_N = 40;
const EMB_SCORE_WEIGHT = 14;

/**
 * Computes embedding and updates film_related recommendations for a single film on-the-fly.
 */
export async function syncSingleFilmRelatedAndEmbedding(filmId: string): Promise<boolean> {
  if (!filmId) return false;

  try {
    // 1. Fetch film details
    const { data: film, error: filmErr } = await supabase
      .from('films')
      .select('id, title, synopsis, year, language, content_type, series_id, view_count, liked_percent, is_published')
      .eq('id', filmId)
      .maybeSingle();

    if (filmErr || !film) {
      console.warn(`[film-related-sync] Film ${filmId} not found: ${filmErr?.message}`);
      return false;
    }

    // 2. Synchronize embedding with Cohere
    await syncFilmEmbedding({
      id: film.id,
      title: film.title,
      synopsis: film.synopsis,
    });

    // 3. Find embedding neighbors if available
    let embSims = new Map<string, number>();
    try {
      const { data: neighborData } = await supabase.rpc('match_related_by_embedding', {
        p_film_id: filmId,
        match_count: EMB_NEIGHBOR_N,
      });
      if (Array.isArray(neighborData)) {
        for (const row of neighborData) {
          if (row?.film_id) embSims.set(row.film_id, Number(row.similarity) || 0);
        }
      }
    } catch {
      // RPC or embeddings table may be optional
    }

    // 4. Fetch credits for target film
    const { data: targetCredits } = await supabase
      .from('credits')
      .select('person_id, billing_order')
      .eq('film_id', filmId);

    const targetPersonIds = (targetCredits || []).map((c) => c.person_id).filter(Boolean);

    // 5. Fetch candidate films sharing credits
    let sharedFilms: { film_id: string; person_id: string }[] = [];
    if (targetPersonIds.length > 0) {
      const { data: creditHits } = await supabase
        .from('credits')
        .select('film_id, person_id')
        .in('person_id', targetPersonIds.slice(0, 15))
        .neq('film_id', filmId)
        .limit(200);
      sharedFilms = creditHits || [];
    }

    // 6. Fetch genres for target film
    const { data: targetGenreRows } = await supabase
      .from('film_genres')
      .select('genre_id')
      .eq('film_id', filmId);
    const targetGenreIds = (targetGenreRows || []).map((g) => g.genre_id);

    // 7. Fetch candidates sharing genres
    let genreFilmHits: { film_id: string; genre_id: number }[] = [];
    if (targetGenreIds.length > 0) {
      const { data: gHits } = await supabase
        .from('film_genres')
        .select('film_id, genre_id')
        .in('genre_id', targetGenreIds)
        .neq('film_id', filmId)
        .limit(200);
      genreFilmHits = gHits || [];
    }

    // Score candidates
    const candidates = new Map<string, { sharedPeople: string[]; sharedGenres: number[]; embSim: number }>();

    for (const [nbrId, sim] of embSims.entries()) {
      if (nbrId === filmId) continue;
      candidates.set(nbrId, { sharedPeople: [], sharedGenres: [], embSim: sim });
    }

    for (const { film_id, person_id } of sharedFilms) {
      const cur = candidates.get(film_id) || { sharedPeople: [], sharedGenres: [], embSim: embSims.get(film_id) || 0 };
      if (!cur.sharedPeople.includes(person_id)) cur.sharedPeople.push(person_id);
      candidates.set(film_id, cur);
    }

    for (const { film_id, genre_id } of genreFilmHits) {
      const cur = candidates.get(film_id) || { sharedPeople: [], sharedGenres: [], embSim: embSims.get(film_id) || 0 };
      if (!cur.sharedGenres.includes(genre_id)) cur.sharedGenres.push(genre_id);
      candidates.set(film_id, cur);
    }

    if (candidates.size === 0) return true;

    // Fetch candidate metadata
    const candIds = Array.from(candidates.keys()).slice(0, 100);
    const { data: candFilmRows } = await supabase
      .from('films')
      .select('id, title, year, language, view_count, liked_percent, is_published')
      .in('id', candIds)
      .eq('is_published', true);

    const candMap = new Map((candFilmRows || []).map((f) => [f.id, f]));

    const scored: { related_id: string; score: number; reason: string | null }[] = [];

    for (const [candId, data] of candidates.entries()) {
      const candFilm = candMap.get(candId);
      if (!candFilm) continue;

      let score = 0;
      let reason: string | null = null;

      // Neural embedding similarity
      if (data.embSim > 0.4) {
        score += data.embSim * EMB_SCORE_WEIGHT;
        reason = `Plot & thematic similarity (${Math.round(data.embSim * 100)}%)`;
      }

      // Shared cast/crew
      if (data.sharedPeople.length > 0) {
        score += data.sharedPeople.length * 15;
        reason = `${data.sharedPeople.length} shared cast/crew`;
      }

      // Shared genres
      if (data.sharedGenres.length > 0) {
        score += data.sharedGenres.length * 5;
        if (!reason) reason = `Same genre (${data.sharedGenres.length} shared)`;
      }

      // Popularity boost
      const pop = (Math.log10((candFilm.view_count ?? 0) + 1) * 2) + ((candFilm.liked_percent ?? 0) / 100);
      score += Math.min(pop, 10);

      scored.push({ related_id: candId, score, reason });
    }

    scored.sort((a, b) => b.score - a.score);
    const topRelated = scored.slice(0, TOP_N).map((item, index) => ({
      film_id: filmId,
      related_id: item.related_id,
      rank: index + 1,
      score: Math.round(item.score * 100) / 100,
      reason: item.reason,
    }));

    if (topRelated.length > 0) {
      // Upsert into film_related
      await supabase.from('film_related').delete().eq('film_id', filmId);
      const { error: insErr } = await supabase.from('film_related').insert(topRelated);
      if (insErr) {
        console.warn(`[film-related-sync] Error inserting related films for ${filmId}: ${insErr.message}`);
      }
    }

    return true;
  } catch (err: any) {
    console.warn(`[film-related-sync] Error syncing related for film ${filmId}: ${err?.message || err}`);
    return false;
  }
}
