import { supabase } from '../supabase.js';

const DAY_MS = 86_400_000;
const DEFAULT_DAYS = 30;
const BASE_TIMES = ['09:00:00', '12:00:00', '15:00:00', '18:00:00', '20:30:00'];
const RELEASE_TIMES = ['08:00:00', '11:00:00', '16:30:00', '21:00:00'];

const ROTATION = [
  // 0: Sunday (Audience Pulse morning & evening; 3 planned cycles midday)
  ['audience_pulse', 'new_and_upcoming', 'behind_the_camera', 'filmography', 'audience_pulse'],
  // 1: Monday
  ['audience_pulse', 'whats_on_stage', 'where_to_watch', 'you_know_the_face', 'audience_pulse'],
  // 2: Tuesday
  ['audience_pulse', 'critics_say', 'by_the_numbers', 'behind_the_camera', 'audience_pulse'],
  // 3: Wednesday
  ['audience_pulse', 'new_and_upcoming', 'filmography', 'one_film_two_takes', 'audience_pulse'],
  // 4: Thursday
  ['audience_pulse', 'critics_say', 'where_to_watch', 'weekend_watchlist', 'audience_pulse'],
  // 5: Friday
  ['audience_pulse', 'whats_on_stage', 'you_know_the_face', 'one_film_two_takes', 'audience_pulse'],
  // 6: Saturday
  ['audience_pulse', 'filmography', 'by_the_numbers', 'behind_the_camera', 'audience_pulse'],
] as const;

type CalendarInsert = {
  planner_key: string;
  scheduled_date: string;
  scheduled_time: string;
  series_id: string;
  status: 'planned' | 'subject_selected';
  subject_entity_type?: string | null;
  subject_entity_id?: string | null;
  selection_locked?: boolean;
  priority: 'normal' | 'high' | 'urgent';
  source: 'planned' | 'database_event';
  notes: string;
};

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizedTitle(title: string): string {
  return String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function completenessScore(film: any): number {
  return (film.poster_url ? 8 : 0) + (film.backdrop_url ? 4 : 0) +
    (film.synopsis ? 3 : 0) + (film.youtube_watch_url ? 2 : 0) +
    (film.streaming_links && Object.keys(film.streaming_links).length ? 1 : 0) +
    (new Date(film.updated_at || film.created_at || 0).getTime() / 1e15);
}

export function canonicalizeReleaseFilms(films: any[]): any[] {
  const unique = new Map<string, any>();
  for (const film of films) {
    const key = `${film.release_date}:${normalizedTitle(film.title)}`;
    const current = unique.get(key);
    if (!current || completenessScore(film) > completenessScore(current)) unique.set(key, film);
  }
  return [...unique.values()].sort((a, b) =>
    String(a.release_date).localeCompare(String(b.release_date)) || String(a.title).localeCompare(String(b.title))
  );
}

function releaseTime(index: number): string {
  if (index < RELEASE_TIMES.length) return RELEASE_TIMES[index];
  const minutes = 8 * 60 + index * 120;
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00`;
}

export async function planRollingSocialCalendar(options: { start?: Date; days?: number; dryRun?: boolean } = {}) {
  const start = options.start || new Date();
  const startDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const days = Math.max(1, options.days || DEFAULT_DAYS);
  const endDay = new Date(startDay.getTime() + (days - 1) * DAY_MS);
  const startDate = dateOnly(startDay);
  const releaseCatchupDate = dateOnly(new Date(startDay.getTime() - DAY_MS));
  const endDate = dateOnly(endDay);

  const [
    { data: series, error: seriesError },
    { data: films, error: filmsError },
    { data: existingReleaseRows, error: existingReleaseError },
    { data: existingBaseRows, error: existingBaseError },
    { data: publishedContentRows, error: publishedContentError },
  ] = await Promise.all([
    supabase.from('social_content_series').select('id,slug').eq('active', true),
    supabase.from('films')
      .select('id,title,release_date,poster_url,backdrop_url,synopsis,youtube_watch_url,streaming_links,created_at,updated_at,is_published')
      .eq('is_published', true)
      .gte('release_date', releaseCatchupDate)
      .lte('release_date', endDate)
      .order('release_date', { ascending: true }),
    supabase.from('social_calendar').select('planner_key').like('planner_key', 'release:%'),
    supabase.from('social_calendar').select('planner_key,status,selection_locked')
      .like('planner_key', 'base:%')
      .in('status', ['published', 'approved', 'draft_ready', 'subject_selected']),
    supabase.from('social_content_items')
      .select('source_entity_id')
      .eq('status', 'published')
      .not('source_entity_id', 'is', null),
  ]);
  if (seriesError) throw seriesError;
  if (filmsError) throw filmsError;
  if (existingReleaseError) throw existingReleaseError;
  if (existingBaseError) throw existingBaseError;
  if (publishedContentError) throw publishedContentError;

  const publishedFilmIds = new Set((publishedContentRows || []).map(row => row.source_entity_id));
  const lockedBaseKeys = new Set((existingBaseRows || []).map(row => row.planner_key));

  const seriesIds = new Map((series || []).map(row => [row.slug, row.id]));
  const upcomingSeriesId = seriesIds.get('new_and_upcoming');
  if (!upcomingSeriesId) throw new Error('Active new_and_upcoming series is required');

  const rows: CalendarInsert[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(startDay.getTime() + offset * DAY_MS);
    const scheduledDate = dateOnly(day);
    const slugs = ROTATION[day.getUTCDay()];
    slugs.forEach((slug, index) => {
      const seriesId = seriesIds.get(slug);
      if (!seriesId) return;
      const plannerKey = `base:${scheduledDate}:${index + 1}`;
      if (lockedBaseKeys.has(plannerKey)) return;
      rows.push({
        planner_key: plannerKey,
        scheduled_date: scheduledDate,
        scheduled_time: BASE_TIMES[index],
        series_id: seriesId,
        status: 'planned',
        subject_entity_type: null,
        subject_entity_id: null,
        selection_locked: false,
        priority: 'normal',
        source: 'planned',
        notes: `Daily editorial slot ${index + 1}/5. Candidate selection remains subject to recency and cooldown rules.`,
      });
    });
  }

  const releases = canonicalizeReleaseFilms(films || []);
  const existingReleaseKeys = new Set((existingReleaseRows || []).map(row => row.planner_key));
  const releasesByDay = new Map<string, any[]>();
  for (const film of releases) {
    if (publishedFilmIds.has(film.id)) continue;
    const plannerKey = `release:${film.id}:${film.release_date}`;
    if (existingReleaseKeys.has(plannerKey)) continue;
    const publishDate = film.release_date < startDate ? startDate : film.release_date;
    const bucket = releasesByDay.get(publishDate) || [];
    bucket.push(film);
    releasesByDay.set(publishDate, bucket);
  }
  for (const [scheduledDate, dayFilms] of releasesByDay) {
    dayFilms.forEach((film, index) => rows.push({
      planner_key: `release:${film.id}:${film.release_date}`,
      scheduled_date: scheduledDate,
      scheduled_time: releaseTime(index),
      series_id: upcomingSeriesId,
      status: 'subject_selected',
      subject_entity_type: 'movie',
      subject_entity_id: film.id,
      selection_locked: true,
      priority: 'urgent',
      source: 'database_event',
      notes: film.poster_url || film.backdrop_url
        ? 'Mandatory new-release post. Added on top of the daily base slots; never displaced by the base schedule.'
        : 'Mandatory new-release post. Artwork enrichment is required before rendering; the slot must not be dropped.',
    }));
  }

  const summary = {
    startDate,
    endDate,
    days,
    baseSlots: days * 5,
    releaseSlots: rows.filter(row => row.planner_key.startsWith('release:')).length,
    totalSlots: rows.length,
    releasesWithoutArtwork: releases.filter(film => !film.poster_url && !film.backdrop_url).map(film => ({ id: film.id, title: film.title })),
  };
  if (options.dryRun) return { ...summary, dryRun: true, rows };

  const { data: upserted, error: upsertError } = await supabase
    .from('social_calendar')
    .upsert(rows, { onConflict: 'planner_key', ignoreDuplicates: false })
    .select('id,planner_key,scheduled_date,scheduled_time,series_id,subject_entity_id,status,priority');
  if (upsertError) throw upsertError;

  return { ...summary, dryRun: false, rows: upserted || [] };
}

