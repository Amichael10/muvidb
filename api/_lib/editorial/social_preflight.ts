import sharp from 'sharp';
import { supabase } from '../supabase.js';

const LAGOS_OFFSET = '+01:00';
const MIN_SYNOPSIS_LENGTH = 60;

export type ArtworkInspection = {
  url: string | null;
  width: number | null;
  height: number | null;
  orientation: 'portrait' | 'square' | 'landscape' | 'unknown';
};

export function classifyArtworkOrientation(width: number | null, height: number | null): ArtworkInspection['orientation'] {
  if (!width || !height) return 'unknown';
  const ratio = width / height;
  return ratio > 1.08 ? 'landscape' : ratio < 0.92 ? 'portrait' : 'square';
}

async function inspectArtwork(url: string | null): Promise<ArtworkInspection> {
  const cleanUrl = (url || '').trim().replace(/\s+/g, '');
  if (!cleanUrl) return { url: null, width: null, height: null, orientation: 'unknown' };
  try {
    const response = await fetch(cleanUrl, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
    const width = metadata.width || null;
    const height = metadata.height || null;
    return { url: cleanUrl, width, height, orientation: classifyArtworkOrientation(width, height) };
  } catch {
    return { url: cleanUrl, width: null, height: null, orientation: 'unknown' };
  }
}

export async function preflightFilm(filmId: string) {
  const { data: film, error } = await supabase
    .from('films')
    .select('id,title,poster_url,backdrop_url,synopsis,status,year,liked_percent,updated_at,credits(role,people(id,name))')
    .eq('id', filmId)
    .maybeSingle();
  if (error) throw error;
  if (!film) {
    return {
      ready: false,
      checkedAt: new Date().toISOString(),
      filmId,
      filmUpdatedAt: null,
      title: 'Unknown / Merged Film',
      synopsisLength: 0,
      artwork: { url: null, width: null, height: null, orientation: 'unknown' as const },
      castCount: 0,
      crewCount: 0,
      directorCount: 0,
      rating: null,
      reasons: ['film_not_found_or_merged'],
    };
  }

  const artwork = await inspectArtwork(film.poster_url);
  const credits = (film.credits || []) as any[];
  const castCount = credits.filter(credit => String(credit.role || 'actor').toLowerCase() === 'actor').length;
  const crewCount = credits.filter(credit => String(credit.role || '').toLowerCase() !== 'actor').length;
  const directorCount = credits.filter(credit => String(credit.role || '').toLowerCase() === 'director').length;
  const reasons: string[] = [];
  if (!film.title?.trim()) reasons.push('missing_title');
  if (!film.synopsis || film.synopsis.trim().length < MIN_SYNOPSIS_LENGTH) reasons.push('missing_or_thin_synopsis');
  if (!film.poster_url) reasons.push('missing_poster');
  else if (artwork.orientation === 'unknown') reasons.push('unreadable_poster');
  if (castCount < 1) reasons.push('missing_cast');
  if (crewCount < 1 && directorCount < 1) reasons.push('missing_director_or_crew');
  // Upcoming releases do not yet have audience ratings; do not block them with missing_rating.
  const isUpcoming = film.status === 'upcoming' || (film.year && Number(film.year) >= new Date().getFullYear());
  if (!isUpcoming && (film.liked_percent === null || film.liked_percent === undefined)) {
    reasons.push('missing_rating');
  }

  return {
    ready: reasons.length === 0,
    checkedAt: new Date().toISOString(),
    filmId,
    filmUpdatedAt: film.updated_at,
    title: film.title,
    synopsisLength: film.synopsis?.trim().length || 0,
    artwork,
    castCount,
    crewCount,
    directorCount,
    rating: film.liked_percent,
    reasons,
  };
}

function scheduledInstant(date: string, time: string): number {
  return new Date(`${date}T${time}${LAGOS_OFFSET}`).getTime();
}

export async function runSocialPreflight(options: { now?: Date; targetMinutes?: number; toleranceMinutes?: number } = {}) {
  const now = options.now || new Date();
  const targetMinutes = options.targetMinutes ?? 30;
  const toleranceMinutes = options.toleranceMinutes ?? 10;
  const minMs = (targetMinutes - toleranceMinutes) * 60_000;
  const maxMs = (targetMinutes + toleranceMinutes) * 60_000;
  const todayLagos = new Date(now.getTime() + 60 * 60_000).toISOString().slice(0, 10);
  const tomorrowLagos = new Date(now.getTime() + 25 * 60 * 60_000).toISOString().slice(0, 10);

  const { data: slots, error } = await supabase
    .from('social_calendar')
    .select('id,scheduled_date,scheduled_time,status,subject_entity_id,preflight_checked_at')
    .eq('subject_entity_type', 'movie')
    .in('scheduled_date', [todayLagos, tomorrowLagos])
    .not('status', 'in', '(published,skipped,cancelled)')
    .is('preflight_checked_at', null);
  if (error) throw error;

  const due = (slots || []).filter(slot => {
    if (!slot.scheduled_time || !slot.subject_entity_id) return false;
    const distance = scheduledInstant(slot.scheduled_date, slot.scheduled_time) - now.getTime();
    return distance >= minMs && distance <= maxMs;
  });

  const results: any[] = [];
  for (const slot of due) {
    const result = await preflightFilm(slot.subject_entity_id!);
    const { error: updateError } = await supabase.from('social_calendar').update({
      preflight_checked_at: result.checkedAt,
      preflight_status: result.ready ? 'ready' : 'blocked',
      preflight_json: result,
      status: result.ready ? slot.status : 'skipped',
      notes: result.ready
        ? `${result.artwork.orientation === 'landscape' ? '30-minute preflight passed with landscape artwork; published using current crop.' : '30-minute preflight passed: poster, cast, crew, rating and synopsis verified.'}`
        : `30-minute preflight blocked publication: ${result.reasons.join(', ')}.`,
    }).eq('id', slot.id);
    if (updateError) throw updateError;
    results.push({ slotId: slot.id, ...result });
  }

  return { checked: results.length, ready: results.filter(result => result.ready).length, blocked: results.filter(result => !result.ready).length, results };
}

