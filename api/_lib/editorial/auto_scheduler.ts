import { supabase } from '../supabase.js';
import { approveEditorialSlot } from '../social_studio.js';
import { fetchSeriesCandidates, CandidateEntity, getPublishedEntityIds } from './candidate_service.js';
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
 * Finds the next eligible candidate for a slot.
 * If candidate is a movie, ensures preflight is ready and artwork is portrait.
 * If the pre-assigned candidate fails preflight (missing crew, landscape poster, etc.),
 * it searches candidate pools and upcoming films for the next latest eligible movie
 * so that no slot is ever wasted.
 */
async function resolveEligibleCandidate(options: {
  slot: any;
  seriesSlug: string;
  claimedCandidateIds: Set<string>;
  referenceDateStr: string;
}): Promise<{
  candidateId: string;
  candidateType: 'movie' | 'person' | 'play';
  candidateName: string;
  preflight?: any;
  wasReplaced?: boolean;
} | null> {
  const { slot, seriesSlug, claimedCandidateIds, referenceDateStr } = options;
  const initialId = slot.subject_entity_id;
  const initialType = (slot.subject_entity_type as 'movie' | 'person' | 'play') || 'movie';

  // 1. If subject is already set, validate it first
  if (initialId && !claimedCandidateIds.has(initialId)) {
    if (initialType === 'movie') {
      const preflight = await preflightFilm(initialId).catch(() => null);
      if (preflight && preflight.ready && preflight.artwork?.orientation !== 'landscape') {
        return {
          candidateId: initialId,
          candidateType: 'movie',
          candidateName: preflight.title || initialId,
          preflight,
          wasReplaced: false,
        };
      }
      const reason = !preflight
        ? 'preflight_error'
        : preflight.artwork?.orientation === 'landscape'
          ? 'landscape_poster'
          : preflight.reasons.join(', ');
      console.warn(`[auto_scheduler] Pre-assigned movie ${initialId} for slot ${slot.id} failed preflight (${reason}). Finding next latest replacement movie...`);
      claimedCandidateIds.add(initialId);
    } else {
      // For person or play, if already set, assume valid
      return {
        candidateId: initialId,
        candidateType: initialType,
        candidateName: initialId,
        wasReplaced: false,
      };
    }
  }

  // 2. Fetch candidates from candidate_service for this series
  const candidates: CandidateEntity[] = await fetchSeriesCandidates(seriesSlug, 30).catch(() => []);

  for (const c of candidates) {
    if (!c.imageUrl || claimedCandidateIds.has(c.id)) continue;
    if (c.imageUrl.includes('i.ytimg.com') && !c.imageUrl.includes('maxresdefault')) continue;
    if ((c.completenessScore || 0) < 0.5) continue;

    if (c.type === 'movie') {
      const preflight = await preflightFilm(c.id).catch(() => null);
      if (!preflight || !preflight.ready) {
        console.warn(`[auto_scheduler] Candidate movie "${c.name}" (${c.id}) failed preflight:`, preflight?.reasons);
        continue;
      }
      if (preflight.artwork?.orientation === 'landscape') {
        console.warn(`[auto_scheduler] Candidate movie "${c.name}" (${c.id}) rejected: landscape poster`);
        continue;
      }
      return {
        candidateId: c.id,
        candidateType: 'movie',
        candidateName: c.name,
        preflight,
        wasReplaced: Boolean(initialId),
      };
    } else {
      return {
        candidateId: c.id,
        candidateType: c.type as any,
        candidateName: c.name,
        wasReplaced: Boolean(initialId),
      };
    }
  }

  // 3. Fallback: For movie slots (especially new releases and upcoming), query upcoming & newly released films directly
  if (initialType === 'movie' || seriesSlug.includes('upcoming') || seriesSlug.includes('release')) {
    console.log(`[auto_scheduler] Series candidates exhausted for ${seriesSlug}. Querying upcoming/recent films from database...`);

    // Fetch upcoming films first (ordered by release date)
    const { data: upcomingFilms } = await supabase
      .from('films')
      .select('id, title, poster_url, release_date')
      .eq('is_published', true)
      .not('poster_url', 'is', null)
      .gte('release_date', referenceDateStr)
      .order('release_date', { ascending: true })
      .limit(30);

    for (const f of upcomingFilms || []) {
      if (!f.poster_url || claimedCandidateIds.has(f.id)) continue;
      const preflight = await preflightFilm(f.id).catch(() => null);
      if (!preflight || !preflight.ready) continue;
      if (preflight.artwork?.orientation === 'landscape') continue;

      console.log(`[auto_scheduler] Selected upcoming film "${f.title}" (${f.id}) as replacement for slot ${slot.id}`);
      return {
        candidateId: f.id,
        candidateType: 'movie',
        candidateName: f.title,
        preflight,
        wasReplaced: true,
      };
    }

    // Fetch fresh releases from past 1 to 7 days if still not found
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    const { data: recentFilms } = await supabase
      .from('films')
      .select('id, title, poster_url, release_date')
      .eq('is_published', true)
      .not('poster_url', 'is', null)
      .gte('release_date', sevenDaysAgo)
      .order('release_date', { ascending: false })
      .limit(30);

    for (const f of recentFilms || []) {
      if (!f.poster_url || claimedCandidateIds.has(f.id)) continue;
      const preflight = await preflightFilm(f.id).catch(() => null);
      if (!preflight || !preflight.ready) continue;
      if (preflight.artwork?.orientation === 'landscape') continue;

      console.log(`[auto_scheduler] Selected recent film "${f.title}" (${f.id}) as replacement for slot ${slot.id}`);
      return {
        candidateId: f.id,
        candidateType: 'movie',
        candidateName: f.title,
        preflight,
        wasReplaced: true,
      };
    }
  }

  return null;
}

/**
 * Automatically inspects due or upcoming calendar slots for today, selects top
 * verified candidates, validates portrait posters and metadata, and approves them
 * directly into scheduled status so they publish without manual intervention.
 * If a candidate fails validation, it replaces it with the next qualified candidate.
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

  // Track claimed candidate IDs across recent days, within this batch, and all historically published entities
  // to ensure already-published or scheduled entities are NEVER chosen again.
  const claimedCandidateIds = new Set<string>();
  const publishedIds = await getPublishedEntityIds().catch(() => new Set<string>());
  for (const id of publishedIds) {
    claimedCandidateIds.add(id);
  }

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
      const seriesSlug = series?.slug || (slot.planner_key?.startsWith('release:') ? 'new_and_upcoming' : 'spotlight');

      // Resolve eligible candidate with automatic fallback
      const resolved = await resolveEligibleCandidate({
        slot,
        seriesSlug,
        claimedCandidateIds,
        referenceDateStr: dateStr,
      });

      if (!resolved) {
        console.warn(`[auto_scheduler] No eligible replacement candidate found for slot ${slot.id} (${seriesSlug})`);
        await supabase
          .from('social_calendar')
          .update({
            status: 'skipped',
            notes: `Auto-schedule skipped: No eligible replacement candidate found for ${seriesSlug}`,
            preflight_checked_at: new Date().toISOString(),
            preflight_status: 'blocked',
          })
          .eq('id', slot.id);

        skippedSlots.push({ slotId: slot.id, reason: `no_eligible_candidate_${seriesSlug}` });
        continue;
      }

      const { candidateId, candidateType, candidateName, preflight, wasReplaced } = resolved;

      // If the subject was replaced, update the social_calendar slot
      if (wasReplaced) {
        console.log(`[auto_scheduler] Slot ${slot.id} candidate updated to "${candidateName}" (${candidateId})`);
        await supabase
          .from('social_calendar')
          .update({
            subject_entity_id: candidateId,
            subject_entity_type: candidateType,
            notes: `Auto-scheduled: replaced invalid candidate with "${candidateName}" (${candidateId})`,
            preflight_checked_at: new Date().toISOString(),
            preflight_status: 'ready',
            preflight_json: preflight || null,
          })
          .eq('id', slot.id);
      }

      // Automatically approve and schedule the slot into social_publish_jobs
      console.log(`[auto_scheduler] Auto-approving slot ${slot.id} (${slot.scheduled_time}) for ${candidateType} ${candidateId} ("${candidateName}")...`);
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
