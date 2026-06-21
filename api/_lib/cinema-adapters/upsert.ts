/**
 * Shared match/upsert pipeline for cinema showtime scrapers.
 *
 *   scraped showtime  →  matchNollywoodFilm  →  upsert showtime (if matched)
 *                                            →  record in pending_cinema_films (if unmatched)
 *
 * KEY RULE: we only create `showtimes` rows for films already in our Nollywood
 * catalog (films.is_nollywood = true). Unmatched titles (Hollywood, anime, etc.)
 * go into `pending_cinema_films` for admin triage. They never pollute the main
 * catalog or the user-facing CinemaDetail page.
 *
 * Admin workflow (/admin/cinema-films):
 *   • "Promote"   → copies into films (is_nollywood=true), future scrapes link here
 *   • "Blacklist" → sets admin_decision='blacklisted', future scrapes skip
 */

import { supabase } from '../supabase.js';
import type { ScrapedShowtime } from './types.js';
import { isOwnUrl, mirrorImageToStorage } from '../image_mirror.js';

interface MatchedFilm {
  id: string;
  poster_url: string | null;
  backdrop_url: string | null;
  is_in_cinemas: boolean;
}

type MatchCache = Map<string, MatchedFilm | null>; // normalized title → MatchedFilm | null (= pending)

function normalizeTitle(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Find an existing Nollywood film whose title exactly matches (case-insensitive,
 * trimmed, collapsed whitespace). Returns films.id or null.
 *
 * We intentionally do NOT do fuzzy/substring matching here — the cost of a false
 * positive (wrong film linked to a showtime) is much higher than admin triage on
 * a new title. Unmatched scrapes go to pending_cinema_films; once an admin
 * promotes a title or aliases it to an existing film, this exact matcher will
 * start linking it automatically next run.
 */
async function matchNollywoodFilm(title: string): Promise<MatchedFilm | null> {
  const clean = title.trim().replace(/\s+/g, ' ');
  if (!clean) return null;

  // 1. Direct case-insensitive exact match in films
  const { data: directMatch } = await supabase
    .from('films')
    .select('id, poster_url, backdrop_url, is_in_cinemas')
    .eq('is_nollywood', true)
    .ilike('title', clean)       // ilike with no %..% = case-insensitive exact
    .limit(1);

  if (directMatch && directMatch.length) {
    return directMatch[0] as MatchedFilm;
  }

  // 2. Resolve via pending triage mapping (admin-promoted alias)
  const { data: aliasMatch } = await supabase
    .from('pending_cinema_films')
    .select('promoted_film_id')
    .ilike('title', clean)
    .eq('admin_decision', 'promoted')
    .limit(1);

  if (aliasMatch && aliasMatch.length && aliasMatch[0].promoted_film_id) {
    const { data: pf } = await supabase
      .from('films')
      .select('id, poster_url, backdrop_url, is_in_cinemas')
      .eq('id', aliasMatch[0].promoted_film_id)
      .limit(1);
    if (pf && pf.length) {
      return pf[0] as MatchedFilm;
    }
  }

  return null;
}

/** Upsert into pending_cinema_films (or update last_seen + count). */
async function recordPending(
  st: ScrapedShowtime,
  cinemaId: string,
  source: string,
): Promise<void> {
  // Skip blacklisted titles — if admin previously rejected "The Super Mario Movie",
  // we won't keep re-inserting it.
  const { data: existing } = await supabase
    .from('pending_cinema_films')
    .select('id, showtime_count, admin_decision')
    .eq('title', st.filmTitle.trim())
    .maybeSingle();

  if (existing) {
    if (existing.admin_decision === 'blacklisted' || existing.admin_decision === 'promoted') return;
    await supabase
      .from('pending_cinema_films')
      .update({
        last_seen_at: new Date().toISOString(),
        last_seen_cinema_id: cinemaId,
        showtime_count: (existing.showtime_count ?? 0) + 1,
        // Refresh poster/synopsis in case the source updated them
        poster_url: st.filmMeta?.posterUrl ?? null,
        synopsis:   st.filmMeta?.synopsis   ?? null,
        rating:     st.filmMeta?.rating     ?? null,
      })
      .eq('id', existing.id);
    return;
  }

  const { error: insertErr } = await supabase.from('pending_cinema_films').insert({
    title:               st.filmTitle.trim(),
    external_id:         st.externalFilmId,
    poster_url:          st.filmMeta?.posterUrl  ?? null,
    synopsis:            st.filmMeta?.synopsis   ?? null,
    rating:              st.filmMeta?.rating     ?? null,
    runtime_minutes:     st.filmMeta?.runtimeMinutes ?? null,
    source,
    last_seen_cinema_id: cinemaId,
    showtime_count:      1,
  });

  if (insertErr) {
    console.error(`[cinema-upsert] pending_cinema_films insert failed for ${st.filmTitle}:`, insertErr.message);
  }
}

/**
 * Insert or update showtime rows for a cinema. Marks any showtimes for this
 * cinema+date range not present in the new batch as is_available=false, so
 * cancelled screenings disappear from the UI without being hard-deleted.
 */
export async function upsertShowtimes(
  cinemaId: string,
  scraped: ScrapedShowtime[],
  source: string,
): Promise<{ matched_showtimes: number; unmatched_titles: number; marked_unavailable: number }> {
  if (!scraped.length) return { matched_showtimes: 0, unmatched_titles: 0, marked_unavailable: 0 };

  const cache: MatchCache = new Map();
  const rows: Record<string, unknown>[] = [];
  const unmatchedSeen = new Set<string>();

  // Track the date range so we know what to mark unavailable
  let minDate = scraped[0].showDate;
  let maxDate = scraped[0].showDate;

  for (const st of scraped) {
    const key = normalizeTitle(st.filmTitle);
    let film = cache.get(key);
    if (film === undefined) {
      film = await matchNollywoodFilm(st.filmTitle);
      cache.set(key, film);
    }

    if (!film) {
      // Not a Nollywood film — route to pending table once per unique title per run
      if (!unmatchedSeen.has(key)) {
        await recordPending(st, cinemaId, source);
        unmatchedSeen.add(key);
      }
      continue;
    }

    const filmId = film.id;

    // Check if the film is missing a valid mirrored poster or backdrop (cover)
    const hasValidPoster = film.poster_url && isOwnUrl(film.poster_url);
    const hasValidBackdrop = film.backdrop_url && isOwnUrl(film.backdrop_url);
    const updatedFields: Record<string, any> = {};

    if (!hasValidPoster && st.filmMeta?.posterUrl) {
      console.log(`[cinema-upsert] Film "${st.filmTitle}" has no valid poster. Attempting to mirror scraped poster: ${st.filmMeta.posterUrl}`);
      const filename = `${filmId.slice(0, 8)}-${st.filmTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`;
      const mirroredPoster = await mirrorImageToStorage(st.filmMeta.posterUrl, 'posters', filename);
      if (mirroredPoster) {
        updatedFields.poster_url = mirroredPoster;
        film.poster_url = mirroredPoster;
      }
    }

    if (!hasValidBackdrop && st.filmMeta?.backdropUrl) {
      console.log(`[cinema-upsert] Film "${st.filmTitle}" has no valid backdrop. Attempting to mirror scraped backdrop: ${st.filmMeta.backdropUrl}`);
      const filename = `${filmId.slice(0, 8)}-${st.filmTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-bd`;
      const mirroredBackdrop = await mirrorImageToStorage(st.filmMeta.backdropUrl, 'backdrops', filename);
      if (mirroredBackdrop) {
        updatedFields.backdrop_url = mirroredBackdrop;
        film.backdrop_url = mirroredBackdrop;
      }
    }

    if (Object.keys(updatedFields).length > 0) {
      console.log(`[cinema-upsert] Updating film "${st.filmTitle}" with mirrored images:`, updatedFields);
      await supabase.from('films').update(updatedFields).eq('id', filmId);
    }

    if (st.showDate < minDate) minDate = st.showDate;
    if (st.showDate > maxDate) maxDate = st.showDate;

    rows.push({
      cinema_id:    cinemaId,
      film_id:      filmId,
      show_date:    st.showDate,
      show_time:    st.showTime,
      format:       st.format || 'Standard',
      screen_name:  st.screenName ?? null,
      ticket_url:   st.ticketUrl ?? null,
      price:        st.price ?? null,
      is_available: true,
      source,
      last_seen_at: new Date().toISOString(),
    });
  }

  if (!rows.length) {
    return { matched_showtimes: 0, unmatched_titles: unmatchedSeen.size, marked_unavailable: 0 };
  }

  // Batch upsert — conflict key matches showtimes_cinema_film_date_time_fmt_uidx
  const { error } = await supabase
    .from('showtimes')
    .upsert(rows, { onConflict: 'cinema_id,film_id,show_date,show_time,format' });

  if (error) {
    console.error(`[cinema-upsert] showtime upsert failed for cinema ${cinemaId}:`, error.message);
    return { matched_showtimes: 0, unmatched_titles: unmatchedSeen.size, marked_unavailable: 0 };
  }

  // Mark old showtimes in the same cinema+date range as unavailable if
  // they weren't seen in this scrape (they got cancelled/removed).
  const seenKeys = new Set(rows.map(r => `${r.film_id}|${r.show_date}|${r.show_time}|${r.format}`));
  const { data: stale } = await supabase
    .from('showtimes')
    .select('id, film_id, show_date, show_time, format')
    .eq('cinema_id', cinemaId)
    .gte('show_date', minDate)
    .lte('show_date', maxDate)
    .eq('is_available', true);

  let markedUnavailable = 0;
  if (stale && stale.length) {
    const staleIds = stale
      .filter(s => !seenKeys.has(`${s.film_id}|${s.show_date}|${s.show_time}|${s.format || 'Standard'}`))
      .map(s => s.id);
    if (staleIds.length) {
      const { error: updErr } = await supabase
        .from('showtimes')
        .update({ is_available: false })
        .in('id', staleIds);
      if (!updErr) markedUnavailable = staleIds.length;
    }
  }

  // Flag every film we just scheduled as currently in cinemas. The weekly
  // sweep (sweepStaleCinemas) later clears this flag once a title stops
  // appearing in scrapes, moving it to "Leaving Cinemas Soon" and eventually off.
  const matchedFilmIds = Array.from(new Set(rows.map(r => r.film_id as string)));
  if (matchedFilmIds.length) {
    await supabase.from('films').update({ is_in_cinemas: true }).in('id', matchedFilmIds);
  }

  return {
    matched_showtimes:  rows.length,
    unmatched_titles:   unmatchedSeen.size,
    marked_unavailable: markedUnavailable,
  };
}

/**
 * Weekly cinema hygiene sweep — keeps the "In Cinemas" experience fresh instead
 * of letting stale showtimes and flags pile up indefinitely.
 *
 *   1. Expire every past showtime (show_date < today) → is_available=false, so
 *      last month's schedule stops counting and drops out of the UI.
 *   2. A film that still has an upcoming showtime, or was seen in a scrape within
 *      the grace window, keeps is_in_cinemas=true. With upcoming showtimes it
 *      reads as "In Cinemas Now"; without them it reads as "Leaving Cinemas Soon"
 *      (the split is derived client-side from whether live showtimes exist).
 *   3. A scraper-sourced film not seen for longer than `graceDays` has
 *      is_in_cinemas cleared, so it leaves the cinema rails entirely.
 *
 * Only films that have at least one showtime row (i.e. came from a scraper) are
 * ever auto-unflagged — manually curated cinema films are left untouched.
 */
export async function sweepStaleCinemas(
  graceDays = 14,
): Promise<{ expired_showtimes: number; dropped_films: number }> {
  const today = new Date().toISOString().split('T')[0];
  const graceCutoff = new Date(Date.now() - graceDays * 86_400_000).toISOString();

  // 1. Expire past showtimes so they stop surfacing as "available".
  const { data: expired } = await supabase
    .from('showtimes')
    .update({ is_available: false })
    .lt('show_date', today)
    .eq('is_available', true)
    .select('id');

  // 2. Which films are currently flagged as in cinemas?
  const { data: flagged } = await supabase
    .from('films')
    .select('id')
    .eq('is_in_cinemas', true);

  if (!flagged?.length) {
    return { expired_showtimes: expired?.length ?? 0, dropped_films: 0 };
  }
  const flaggedIds = flagged.map(f => f.id);

  // 3a. Films that came from a scraper. Scraper showtimes always carry a
  //     `source` (adapter name); admin-entered showtimes leave it null, so we
  //     filter to non-null source to avoid ever demoting manually curated titles.
  const { data: withShowtimes } = await supabase
    .from('showtimes')
    .select('film_id')
    .in('film_id', flaggedIds)
    .not('source', 'is', null);
  const scrapedIds = new Set((withShowtimes ?? []).map(s => s.film_id));

  // 3b. Films still "fresh" — an upcoming showtime or seen within the grace window.
  const { data: fresh } = await supabase
    .from('showtimes')
    .select('film_id')
    .in('film_id', flaggedIds)
    .or(`show_date.gte.${today},last_seen_at.gte.${graceCutoff}`);
  const keepIds = new Set((fresh ?? []).map(s => s.film_id));

  // Drop only scraper-sourced films that have gone stale.
  const dropIds = flaggedIds.filter(id => scrapedIds.has(id) && !keepIds.has(id));

  let dropped = 0;
  if (dropIds.length) {
    const { data: cleared } = await supabase
      .from('films')
      .update({ is_in_cinemas: false })
      .in('id', dropIds)
      .select('id');
    dropped = cleared?.length ?? 0;
  }

  return { expired_showtimes: expired?.length ?? 0, dropped_films: dropped };
}
