import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const WEEKDAY_SERIES_SLUGS: Record<number, string> = {
  1: 'filmography',        // Monday
  2: 'critics_say',        // Tuesday
  3: 'where_to_watch',     // Wednesday
  4: 'behind_the_camera',  // Thursday
  5: 'weekend_watchlist',  // Friday
  6: 'whats_on_stage',     // Saturday
  0: 'film_conversation',  // Sunday
};

/**
 * Seed or refresh 30 days of rolling editorial calendar slots.
 */
export async function seedRollingCalendar(daysAhead = 30): Promise<number> {
  const { data: seriesList } = await supabase.from('social_content_series').select('id, slug');
  if (!seriesList || !seriesList.length) return 0;

  const seriesMap = new Map(seriesList.map((s) => [s.slug, s.id]));
  const today = new Date();
  let createdCount = 0;

  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const dayOfWeek = d.getDay();

    const targetSlug = WEEKDAY_SERIES_SLUGS[dayOfWeek] || 'filmography';
    const seriesId = seriesMap.get(targetSlug);

    if (!seriesId) continue;

    // Check if slot already exists for date
    const { data: existing } = await supabase
      .from('social_calendar')
      .select('id')
      .eq('scheduled_date', dateStr)
      .eq('series_id', seriesId);

    if (!existing || existing.length === 0) {
      await supabase.from('social_calendar').insert({
        scheduled_date: dateStr,
        series_id: seriesId,
        status: 'planned',
        source: 'planned',
      });
      createdCount++;
    }
  }

  return createdCount;
}
