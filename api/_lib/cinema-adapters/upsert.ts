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
import {
  resolveMissingNollywoodFilm,
  scrapedFilmUpdates,
  type CinemaResolvedFilm,
} from './resolve-film.js';

type MatchedFilm = CinemaResolvedFilm;

type MatchCache = Map<string, MatchedFilm | null>; // normalized title → MatchedFilm | null (= pending)

/** Remove cinema presentation labels without touching the actual film title. */
export function cleanCinemaListingTitle(raw: string): string {
  let title = (raw || '').normalize('NFC').replace(/\s+/g, ' ').trim();
  let previous = '';

  while (title && title !== previous) {
    previous = title;
    title = title
      .replace(/\s*(?:[-|:/]\s*)?\((?:vip|v ?vip|imax|4dx|3d|premium|luxe|standard)\)\s*$/i, '')
      .replace(/\s+(?:vip|v ?vip|imax|4dx|3d|premium|luxe|standard)\s*$/i, '')
      .replace(/[\s\-:|/]+$/g, '')
      .trim();
  }

  return title
    .replace(/\s*:\s*/g, ': ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeCinemaTitle(raw: string): string {
  return cleanCinemaListingTitle(raw)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

let activeCinemaCatalogPromise: Promise<MatchedFilm[]> | null = null;

async function getActiveCinemaCatalog(): Promise<MatchedFilm[]> {
  if (!activeCinemaCatalogPromise) {
    activeCinemaCatalogPromise = supabase
      .from('films')
      .select('id,title,poster_url,backdrop_url,is_in_cinemas,synopsis,runtime_minutes,genres,year,nfvcb_rating,trailer_external_url')
      .eq('is_nollywood', true)
      .eq('is_in_cinemas', true)
      .then(({ data, error }) => {
        if (error) throw error;
        return ((data || []) as MatchedFilm[]).sort(
          (a, b) => Number(isOwnUrl(b.poster_url)) - Number(isOwnUrl(a.poster_url)),
        );
      });
  }
  return activeCinemaCatalogPromise;
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
  const clean = cleanCinemaListingTitle(title);
  if (!clean) return null;

  // 1. Direct case-insensitive exact match, including the safe &/and variant.
  const directVariants = new Set([clean]);
  if (/\band\b/i.test(clean)) directVariants.add(clean.replace(/\band\b/gi, '&'));
  if (clean.includes('&')) directVariants.add(clean.replace(/&/g, 'and'));

  for (const variant of directVariants) {
    const { data: directMatch } = await supabase
      .from('films')
      .select('id,title,poster_url,backdrop_url,is_in_cinemas,synopsis,runtime_minutes,genres,year,nfvcb_rating,trailer_external_url')
      .eq('is_nollywood', true)
      .ilike('title', variant)
      .limit(1);

    if (directMatch?.length) return directMatch[0] as MatchedFilm;
  }

  // 2. Compare normalized forms only against films already curated as being in
  // cinemas. This fixes punctuation/diacritic differences without broad fuzzy
  // matching against the full catalog.
  const normalized = normalizeCinemaTitle(clean);
  const normalizedMatch = (await getActiveCinemaCatalog())
    .find((film) => normalizeCinemaTitle(film.title) === normalized);
  if (normalizedMatch) return normalizedMatch;

  // 3. Resolve via a pending-triage mapping approved by an admin.
  for (const variant of directVariants) {
    const { data: aliasMatch } = await supabase
      .from('pending_cinema_films')
      .select('promoted_film_id')
      .ilike('title', variant)
      .eq('admin_decision', 'promoted')
      .limit(1);

    if (aliasMatch?.[0]?.promoted_film_id) {
      const { data: pf } = await supabase
        .from('films')
        .select('id,title,poster_url,backdrop_url,is_in_cinemas,synopsis,runtime_minutes,genres,year,nfvcb_rating,trailer_external_url')
        .eq('id', aliasMatch[0].promoted_film_id)
        .limit(1);
      if (pf?.length) return pf[0] as MatchedFilm;
    }
  }

  return null;
}

/** Upsert into pending_cinema_films (or update last_seen + count). */
async function recordPending(
  st: ScrapedShowtime,
  cinemaId: string,
  source: string,
): Promise<string | null> {
  const pendingTitle = cleanCinemaListingTitle(st.filmTitle);

  // Skip blacklisted titles — if admin previously rejected "The Super Mario Movie",
  // we won't keep re-inserting it.
  const { data: existingRows, error: pendingLookupError } = await supabase
    .from('pending_cinema_films')
    .select('id, showtime_count, admin_decision')
    .ilike('title', pendingTitle)
    .limit(1);
  if (pendingLookupError) {
    throw new Error(`Pending title lookup failed for "${pendingTitle}": ${pendingLookupError.message}`);
  }
  const existing = existingRows?.[0];

  if (existing) {
    if (existing.admin_decision === 'blacklisted' || existing.admin_decision === 'promoted') return null;
    const metadata: Record<string, unknown> = {
      last_seen_at: new Date().toISOString(),
      last_seen_cinema_id: cinemaId,
      showtime_count: (existing.showtime_count ?? 0) + 1,
    };
    if (st.filmMeta?.posterUrl) metadata.poster_url = st.filmMeta.posterUrl;
    if (st.filmMeta?.synopsis) metadata.synopsis = st.filmMeta.synopsis;
    if (st.filmMeta?.rating) metadata.rating = st.filmMeta.rating;
    if (st.filmMeta?.runtimeMinutes) metadata.runtime_minutes = st.filmMeta.runtimeMinutes;
    const { error: pendingUpdateError } = await supabase
      .from('pending_cinema_films')
      .update(metadata)
      .eq('id', existing.id);
    if (pendingUpdateError) {
      throw new Error(`Pending title update failed for "${pendingTitle}": ${pendingUpdateError.message}`);
    }
    return existing.id;
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('pending_cinema_films')
    .insert({
      title:               pendingTitle,
      external_id:         st.externalFilmId,
      poster_url:          st.filmMeta?.posterUrl  ?? null,
      synopsis:            st.filmMeta?.synopsis   ?? null,
      rating:              st.filmMeta?.rating     ?? null,
      runtime_minutes:     st.filmMeta?.runtimeMinutes ?? null,
      source,
      last_seen_cinema_id: cinemaId,
      showtime_count:      1,
    })
    .select('id')
    .single();

  if (insertErr) {
    throw new Error(`Pending title insert failed for "${pendingTitle}": ${insertErr.message}`);
  }
  return inserted.id;
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
  const pendingRows: Record<string, unknown>[] = [];
  const pendingIds = new Map<string, string | null>();
  const unmatchedSeen = new Set<string>();
  const posterAttempts = new Set<string>();
  const backdropAttempts = new Set<string>();

  // Track the date range so we know what to mark unavailable
  let minDate = scraped[0].showDate;
  let maxDate = scraped[0].showDate;

  for (const st of scraped) {
    const key = normalizeCinemaTitle(st.filmTitle);
    let film = cache.get(key);
    if (film === undefined) {
      film = await matchNollywoodFilm(st.filmTitle);
      if (!film) {
        film = await resolveMissingNollywoodFilm(
          supabase,
          cleanCinemaListingTitle(st.filmTitle),
          source,
        );
      }
      cache.set(key, film);
    }

    if (!film) {
      // Not a Nollywood film — route to pending table once per unique title per run
      if (!pendingIds.has(key)) {
        pendingIds.set(key, await recordPending(st, cinemaId, source));
        unmatchedSeen.add(key);
      }
      const pendingId = pendingIds.get(key);
      if (pendingId) {
        pendingRows.push({
          pending_film_id: pendingId,
          cinema_id: cinemaId,
          show_date: st.showDate,
          show_time: st.showTime,
          format: st.format || 'Standard',
          screen_name: st.screenName ?? null,
          ticket_url: st.ticketUrl ?? null,
          price: st.price ?? null,
          source,
          last_seen_at: new Date().toISOString(),
        });
      }
      continue;
    }

    const filmId = film.id;

    // Check if the film is missing a valid mirrored poster or backdrop (cover)
    const hasValidPoster = film.poster_url && isOwnUrl(film.poster_url);
    const hasValidBackdrop = film.backdrop_url && isOwnUrl(film.backdrop_url);
    const updatedFields: Record<string, any> = scrapedFilmUpdates(film, st.filmMeta);

    if (!hasValidPoster && st.filmMeta?.posterUrl && !posterAttempts.has(filmId)) {
      posterAttempts.add(filmId);
      console.log(`[cinema-upsert] Film "${st.filmTitle}" has no valid poster. Attempting to mirror scraped poster: ${st.filmMeta.posterUrl}`);
      const filename = `${filmId.slice(0, 8)}-${st.filmTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`;
      const mirroredPoster = await mirrorImageToStorage(st.filmMeta.posterUrl, 'posters', filename);
      if (mirroredPoster) {
        updatedFields.poster_url = mirroredPoster;
        film.poster_url = mirroredPoster;
      }
    }

    if (!hasValidBackdrop && st.filmMeta?.backdropUrl && !backdropAttempts.has(filmId)) {
      backdropAttempts.add(filmId);
      console.log(`[cinema-upsert] Film "${st.filmTitle}" has no valid backdrop. Attempting to mirror scraped backdrop: ${st.filmMeta.backdropUrl}`);
      const filename = `${filmId.slice(0, 8)}-${st.filmTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-bd`;
      const mirroredBackdrop = await mirrorImageToStorage(st.filmMeta.backdropUrl, 'backdrops', filename);
      if (mirroredBackdrop) {
        updatedFields.backdrop_url = mirroredBackdrop;
        film.backdrop_url = mirroredBackdrop;
      }
    }

    if (Object.keys(updatedFields).length > 0) {
      console.log(`[cinema-upsert] Enriching film "${st.filmTitle}":`, updatedFields);
      const { error: enrichmentError } = await supabase.from('films').update(updatedFields).eq('id', filmId);
      if (enrichmentError) {
        throw new Error(`Film enrichment failed for "${st.filmTitle}": ${enrichmentError.message}`);
      }
      Object.assign(film, updatedFields);
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

  if (pendingRows.length) {
    const uniquePendingRows = Array.from(new Map(pendingRows.map((row) => [
      `${row.pending_film_id}|${row.cinema_id}|${row.show_date}|${row.show_time}|${row.format}`,
      row,
    ])).values());
    const { error: pendingError } = await supabase
      .from('pending_cinema_showtimes')
      .upsert(uniquePendingRows, {
        onConflict: 'pending_film_id,cinema_id,show_date,show_time,format',
      });
    if (pendingError) {
      throw new Error(`Pending showtime upsert failed for cinema ${cinemaId}: ${pendingError.message}`);
    }
  }

  if (!rows.length) {
    return { matched_showtimes: 0, unmatched_titles: unmatchedSeen.size, marked_unavailable: 0 };
  }

  const uniqueRows = Array.from(new Map(rows.map((row) => [
    `${row.cinema_id}|${row.film_id}|${row.show_date}|${row.show_time}|${row.format}`,
    row,
  ])).values());

  // Batch upsert — conflict key matches showtimes_cinema_film_date_time_fmt_uidx
  const { error } = await supabase
    .from('showtimes')
    .upsert(uniqueRows, { onConflict: 'cinema_id,film_id,show_date,show_time,format' });

  if (error) {
    throw new Error(`Showtime upsert failed for cinema ${cinemaId}: ${error.message}`);
  }

  // Mark old showtimes in the same cinema+date range as unavailable if
  // they weren't seen in this scrape (they got cancelled/removed).
  const seenKeys = new Set(uniqueRows.map(r => `${r.film_id}|${r.show_date}|${r.show_time}|${r.format}`));
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
  //
  // A title that is physically screening in cinemas is, by definition, released
  // and no longer "coming soon" — so we also flip status='released' and clear
  // coming_soon. Without this a film added as upcoming/coming-soon would keep
  // showing in the Coming Soon rail *and* In Cinemas at the same time.
  const matchedFilmIds = Array.from(new Set(uniqueRows.map(r => r.film_id as string)));
  if (matchedFilmIds.length) {
    await supabase
      .from('films')
      .update({ is_in_cinemas: true, coming_soon: false, status: 'released' })
      .in('id', matchedFilmIds);
  }

  return {
    matched_showtimes:  uniqueRows.length,
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
 *   2. A film keeps is_in_cinemas only if it still has a future available
 *      showtime, or was seen in a scrape within the grace window.
 *   3. Everything else (including manual flags with no showtimes, and titles
 *      that left cinemas) is cleared so "In Cinemas" badges don't linger.
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

  // 3. Keep only films that are still "live" in cinemas:
  //    - future available showtime, OR
  //    - scrape last_seen within the grace window (leaving soon).
  const { data: fresh } = await supabase
    .from('showtimes')
    .select('film_id')
    .in('film_id', flaggedIds)
    .or(`and(show_date.gte.${today},is_available.eq.true),last_seen_at.gte.${graceCutoff}`);
  const keepIds = new Set((fresh ?? []).map(s => s.film_id));

  const dropIds = flaggedIds.filter(id => !keepIds.has(id));

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
