import { supabase } from '../supabase.js';
import { approveEditorialSlot } from '../social_studio.js';
import { fetchSeriesCandidates } from './candidate_service.js';
import { preflightFilm } from './social_preflight.js';

const LAGOS_OFFSET_HOURS = 1;

function getLagosNow(baseDate = new Date()): { dateStr: string; timeStr: string; nowMs: number } {
  const lagosTime = new Date(baseDate.getTime() + LAGOS_OFFSET_HOURS * 3600_000);
  const dateStr = lagosTime.toISOString().slice(0, 10);
  const timeStr = lagosTime.toISOString().slice(11, 19);
  return { dateStr, timeStr, nowMs: baseDate.getTime() };
}

const SYSTEM_ACTOR = {
  id: '6e985a31-ca3b-42f2-80cc-faa2b7d3fb37',
  email: 'amichaelwale@gmail.com',
  role: 'admin' as const,
};

/**
 * Automatically inspects due or upcoming calendar slots for today, selects top
 * verified candidates, validates portrait posters and metadata, and approves them
 * directly into scheduled status so they publish without manual intervention.
 */
export async function autoScheduleDueCalendarSlots(now = new Date()): Promise<{
  processed: number;
  scheduled: string[];
  skipped: Array<{ slotId: string; reason: string }>;
}> {
  const { dateStr, timeStr } = getLagosNow(now);

  // 1. Fetch unapproved slots for today up to 30 mins ahead in WAT
  const { data: slots, error } = await supabase
    .from('social_calendar')
    .select(`
      id, scheduled_date, scheduled_time, status, priority, subject_entity_type, subject_entity_id, planner_key,
      social_content_series (id, name, slug)
    `)
    .eq('scheduled_date', dateStr)
    .in('status', ['planned', 'subject_selected', 'draft_ready'])
    .order('scheduled_time', { ascending: true });

  if (error) {
    console.error('[auto_scheduler] Failed to query social_calendar:', error);
    throw error;
  }

  const scheduledSlots: string[] = [];
  const skippedSlots: Array<{ slotId: string; reason: string }> = [];

  // Track claimed candidate IDs across recent days and within this batch
  // to ensure 2 daily pulse slots (or other slots) never choose the same entity twice.
  const claimedCandidateIds = new Set<string>();
  const recentCutoff = new Date(now.getTime() - 14 * 86_400_000).toISOString().slice(0, 10);
  const { data: recentSlots } = await supabase
    .from('social_calendar')
    .select('subject_entity_id')
    .gte('scheduled_date', recentCutoff)
    .not('subject_entity_id', 'is', null)
    .in('status', ['published', 'approved', 'draft_ready', 'subject_selected']);

  for (const row of recentSlots || []) {
    if (row.subject_entity_id) claimedCandidateIds.add(row.subject_entity_id);
  }

  for (const slot of slots || []) {
    try {
      const series = (slot as any).social_content_series;
      const seriesSlug = series?.slug || (slot.planner_key?.startsWith('release:') ? 'new-release' : 'spotlight');
      let candidateId = slot.subject_entity_id;
      let candidateType = (slot.subject_entity_type as 'movie' | 'person' | 'play') || 'movie';

      // If subject is not yet selected, pick top verified candidate from series
      if (!candidateId) {
        const candidates = await fetchSeriesCandidates(seriesSlug, 20).catch(() => []);
        const eligible = candidates.find((c) => {
          if (!c.imageUrl) return false;
          if (claimedCandidateIds.has(c.id)) return false;
          // Filter out obvious landscape banners or low completeness
          if (c.imageUrl.includes('i.ytimg.com') && !c.imageUrl.includes('maxresdefault')) return false;
          return (c.completenessScore || 0) >= 0.5;
        });

        if (!eligible) {
          skippedSlots.push({ slotId: slot.id, reason: `No eligible verified candidate found for series ${seriesSlug}` });
          continue;
        }

        candidateId = eligible.id;
        candidateType = eligible.type as any;
      }

      // If subject is a movie, run strict portrait and credit preflight
      if (candidateType === 'movie') {
        const preflight = await preflightFilm(candidateId);
        if (!preflight.ready) {
          console.warn(`[auto_scheduler] Slot ${slot.id} movie ${candidateId} failed preflight:`, preflight.reasons);
          await supabase
            .from('social_calendar')
            .update({
              status: 'skipped',
              notes: `Auto-schedule skipped: ${preflight.reasons.join(', ')}`,
              preflight_checked_at: new Date().toISOString(),
              preflight_status: 'blocked',
              preflight_json: preflight,
            })
            .eq('id', slot.id);

          skippedSlots.push({ slotId: slot.id, reason: preflight.reasons.join(', ') });
          continue;
        }

        // Strict portrait rule: under no condition post landscape artwork
        if (preflight.artwork.orientation === 'landscape') {
          console.warn(`[auto_scheduler] Slot ${slot.id} movie ${candidateId} rejected: landscape artwork detected`);
          await supabase
            .from('social_calendar')
            .update({
              status: 'skipped',
              notes: 'Auto-schedule skipped: landscape poster strictly rejected',
              preflight_checked_at: new Date().toISOString(),
              preflight_status: 'blocked',
              preflight_json: preflight,
            })
            .eq('id', slot.id);

          skippedSlots.push({ slotId: slot.id, reason: 'landscape_poster_rejected' });
          continue;
        }
      }

      // Automatically approve and schedule the slot into social_publish_jobs
      console.log(`[auto_scheduler] Auto-approving slot ${slot.id} (${slot.scheduled_time}) for ${candidateType} ${candidateId}...`);
      await approveEditorialSlot(
        {
          slotId: slot.id,
          candidateId,
          candidateType,
          scheduledDate: slot.scheduled_date,
          scheduledTime: slot.scheduled_time,
        },
        SYSTEM_ACTOR,
      );

      scheduledSlots.push(slot.id);
      claimedCandidateIds.add(candidateId);
    } catch (err: any) {
      console.error(`[auto_scheduler] Failed to auto-schedule slot ${slot.id}:`, err?.message || err);
      skippedSlots.push({ slotId: slot.id, reason: err?.message || 'unknown_error' });
    }
  }

  return {
    processed: (slots || []).length,
    scheduled: scheduledSlots,
    skipped: skippedSlots,
  };
}
