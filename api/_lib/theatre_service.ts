import { supabase } from './supabase.js';

export type PlayStatus = 'upcoming' | 'currently_running' | 'archived';

/**
 * Derive date-accurate status for a play
 */
export function derivePlayStatus(
  play: { run_start_date?: string | null; run_end_date?: string | null; year?: number | null; status?: string | null },
  refDate: Date = new Date()
): PlayStatus {
  const todayStr = refDate.toISOString().slice(0, 10);
  const currentYear = refDate.getFullYear();

  const start = play?.run_start_date ? String(play.run_start_date).slice(0, 10) : null;
  const end = play?.run_end_date ? String(play.run_end_date).slice(0, 10) : null;

  if (start && end) {
    if (end < todayStr) return 'archived';
    if (start <= todayStr && end >= todayStr) return 'currently_running';
    return 'upcoming';
  }

  if (start && !end) {
    if (start < todayStr) return 'archived';
    if (start === todayStr) return 'currently_running';
    return 'upcoming';
  }

  if (!start && end) {
    if (end < todayStr) return 'archived';
    return 'currently_running';
  }

  if (play?.year && Number(play.year) < currentYear) {
    return 'archived';
  }

  return (play?.status as PlayStatus) || 'archived';
}

/**
 * Sweep and update all plays in the database to ensure their `status` column
 * matches their run dates. Moves plays from `upcoming` -> `archived` or `currently_running`
 * when their dates arrive or pass.
 */
export async function sweepAndUpdatePlayStatuses(): Promise<{
  total: number;
  updated: number;
  archived: number;
  running: number;
  upcoming: number;
}> {
  const { data: plays, error } = await supabase
    .from('plays')
    .select('id, title, slug, run_start_date, run_end_date, year, status');

  if (error) {
    console.error('[theatre_service] Error fetching plays for status sweep:', error.message);
    throw error;
  }

  let updatedCount = 0;
  let archivedCount = 0;
  let runningCount = 0;
  let upcomingCount = 0;

  const now = new Date();

  for (const play of plays || []) {
    const derived = derivePlayStatus(play, now);

    if (derived === 'archived') archivedCount++;
    else if (derived === 'currently_running') runningCount++;
    else if (derived === 'upcoming') upcomingCount++;

    if (play.status !== derived) {
      const { error: updErr } = await supabase
        .from('plays')
        .update({ status: derived, updated_at: now.toISOString() })
        .eq('id', play.id);

      if (!updErr) {
        updatedCount++;
        console.log(`[theatre_service] Transitioned play "${play.title}" (${play.slug}): ${play.status} -> ${derived}`);
      } else {
        console.error(`[theatre_service] Failed to update play status for "${play.title}":`, updErr.message);
      }
    }
  }

  return {
    total: (plays || []).length,
    updated: updatedCount,
    archived: archivedCount,
    running: runningCount,
    upcoming: upcomingCount,
  };
}
