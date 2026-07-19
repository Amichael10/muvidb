import type { SupabaseClient } from '@supabase/supabase-js';
import type { ScrapedShowtime } from './types.js';

export interface CinemaResolvedFilm {
  id: string;
  title: string;
  poster_url: string | null;
  backdrop_url: string | null;
  is_in_cinemas: boolean;
  synopsis: string | null;
  runtime_minutes: number | null;
  genres: string[] | null;
  year: number | null;
  nfvcb_rating: string | null;
  trailer_external_url: string | null;
}

const resolutionCache = new Map<string, Promise<CinemaResolvedFilm | null>>();

function normalizedTitle(value: string): string {
  return (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function imageUrl(path: string | null | undefined, size: 'w500' | 'w1280'): string | null {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

function trailerUrl(videos: any): string | null {
  const video = videos?.results?.find(
    (item: any) => item.site === 'YouTube' && item.type === 'Trailer' && item.official,
  ) ?? videos?.results?.find((item: any) => item.site === 'YouTube' && item.type === 'Trailer');
  return video?.key ? `https://www.youtube.com/watch?v=${video.key}` : null;
}

async function resolveFromTmdb(
  supabase: SupabaseClient,
  title: string,
  source: string,
): Promise<CinemaResolvedFilm | null> {
  const apiKey = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
  if (!apiKey) return null;

  const search = await fetch(
    `https://api.themoviedb.org/3/search/movie?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(title)}`,
  );
  if (!search.ok) return null;

  const searchData = await search.json() as { results?: any[] };
  const expected = normalizedTitle(title);
  const candidate = (searchData.results || []).slice(0, 8).find((item) =>
    normalizedTitle(item.title) === expected || normalizedTitle(item.original_title) === expected,
  );
  if (!candidate?.id) return null;

  const detailsResponse = await fetch(
    `https://api.themoviedb.org/3/movie/${candidate.id}?api_key=${encodeURIComponent(apiKey)}&append_to_response=videos`,
  );
  if (!detailsResponse.ok) return null;

  const details = await detailsResponse.json() as any;
  const isNigerian = details.production_countries?.some((country: any) => country.iso_3166_1 === 'NG');
  if (!isNigerian) return null;

  const releaseYear = details.release_date ? Number(details.release_date.slice(0, 4)) : null;
  const payload = {
    title: details.title || title,
    original_title: details.original_title || null,
    synopsis: details.overview || null,
    year: Number.isFinite(releaseYear) ? releaseYear : null,
    release_date: details.release_date || null,
    poster_url: imageUrl(details.poster_path, 'w500'),
    backdrop_url: imageUrl(details.backdrop_path, 'w1280'),
    runtime_minutes: details.runtime || null,
    genres: details.genres?.map((genre: any) => genre.name).filter(Boolean) || null,
    countries: details.production_countries?.map((country: any) => country.iso_3166_1).filter(Boolean) || ['NG'],
    languages: details.spoken_languages?.map((language: any) => language.english_name).filter(Boolean) || null,
    tmdb_id: details.id,
    tmdb_rating: details.vote_average || null,
    tmdb_vote_count: details.vote_count || 0,
    trailer_external_url: trailerUrl(details.videos),
    trailer_source: 'youtube',
    source: `tmdb-cinema:${source}`,
    release_type: 'cinema',
    status: 'released',
    is_nollywood: true,
    is_in_cinemas: true,
    coming_soon: false,
    is_published: true,
    needs_review: true,
  };

  const { data, error } = await supabase
    .from('films')
    .insert(payload)
    .select('id,title,poster_url,backdrop_url,is_in_cinemas,synopsis,runtime_minutes,genres,year,nfvcb_rating,trailer_external_url')
    .single();

  if (!error && data) return data as CinemaResolvedFilm;

  if (error?.code === '23505') {
    const { data: existing } = await supabase
      .from('films')
      .select('id,title,poster_url,backdrop_url,is_in_cinemas,synopsis,runtime_minutes,genres,year,nfvcb_rating,trailer_external_url')
      .eq('tmdb_id', details.id)
      .limit(1);
    return (existing?.[0] as CinemaResolvedFilm | undefined) ?? null;
  }

  console.error(`[cinema-resolver] Could not create "${title}":`, error?.message);
  return null;
}

export function resolveMissingNollywoodFilm(
  supabase: SupabaseClient,
  title: string,
  source: string,
): Promise<CinemaResolvedFilm | null> {
  const key = normalizedTitle(title);
  if (!resolutionCache.has(key)) {
    resolutionCache.set(key, resolveFromTmdb(supabase, title, source).catch((error) => {
      console.error(`[cinema-resolver] TMDB lookup failed for "${title}":`, error);
      return null;
    }));
  }
  return resolutionCache.get(key)!;
}

export function scrapedFilmUpdates(
  film: CinemaResolvedFilm,
  meta?: ScrapedShowtime['filmMeta'],
): Record<string, unknown> {
  if (!meta) return {};

  const updates: Record<string, unknown> = {};
  if (!film.synopsis && meta.synopsis) updates.synopsis = meta.synopsis;
  if (!film.runtime_minutes && meta.runtimeMinutes && meta.runtimeMinutes >= 20 && meta.runtimeMinutes <= 600) {
    updates.runtime_minutes = meta.runtimeMinutes;
  }
  if ((!film.genres || film.genres.length === 0) && meta.genres?.length) updates.genres = meta.genres;
  if (!film.year && meta.releaseYear) updates.year = meta.releaseYear;
  if (!film.trailer_external_url && meta.trailerUrl) updates.trailer_external_url = meta.trailerUrl;

  const rating = meta.rating?.trim().toUpperCase();
  if (!film.nfvcb_rating && rating && ['G', 'PG', 'PG-13', '15', '18'].includes(rating)) {
    updates.nfvcb_rating = rating;
  }

  return updates;
}
