import 'dotenv/config';
import { supabase } from '../api/_lib/supabase.js';
import { resolveEligibleCandidate } from '../api/_lib/editorial/auto_scheduler.js';
import { approveEditorialSlot, generateAndAttachReelForContentItem, scheduleContentItem } from '../api/_lib/social_studio.js';

const SYSTEM_ACTOR = {
  id: '6e985a31-ca3b-42f2-80cc-faa2b7d3fb37',
  email: 'amichaelwale@gmail.com',
  role: 'admin' as const,
};

export async function preRenderUpcomingReels(daysAhead: number = 7, startTomorrow: boolean = false) {
  const now = new Date();
  const startDate = startTomorrow
    ? new Date(now.getTime() + 24 * 3600 * 1000)
    : now;
  const startDateStr = startDate.toISOString().slice(0, 10);
  const endDate = new Date(startDate.getTime() + daysAhead * 24 * 3600 * 1000);
  const endDateStr = endDate.toISOString().slice(0, 10);

  console.log(`[auto_render_reels] Scanning reel slots between ${startDateStr} and ${endDateStr}...`);

  const { data: slots, error } = await supabase
    .from('social_calendar')
    .select('id, scheduled_date, scheduled_time, subject_entity_id, subject_entity_type, status, draft_id, planner_key, social_content_series(slug)')
    .gte('scheduled_date', startDateStr)
    .lte('scheduled_date', endDateStr)
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true });

  if (error) throw error;

  const reelSlots = (slots || []).filter(s => {
    const slug = (s.social_content_series as any)?.slug;
    return slug === 'new_and_upcoming' || slug === 'where_to_watch';
  });

  console.log(`[auto_render_reels] Found ${reelSlots.length} reel slots to check.`);

  // Seed claimed candidates with anything published, approved, or scheduled in the last 14 days
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 3600 * 1000).toISOString();
  const { data: recentItems } = await supabase
    .from('social_content_items')
    .select('source_entity_id')
    .gte('created_at', fourteenDaysAgo)
    .not('source_entity_id', 'is', null);

  const claimedCandidateIds = new Set<string>((recentItems || []).map(r => r.source_entity_id));
  console.log(`[auto_render_reels] Seeded ${claimedCandidateIds.size} claimed candidates from last 14 days.`);

  for (const slot of reelSlots) {
    const seriesSlug = (slot.social_content_series as any)?.slug;
    console.log(`\n--- Processing Slot ${slot.id} (${slot.scheduled_date} ${slot.scheduled_time}) [${seriesSlug}] ---`);

    // Check if slot already has an approved draft with a video asset
    if (slot.draft_id) {
      const { data: existingAsset } = await supabase
        .from('social_assets')
        .select('id, format, public_url')
        .eq('content_item_id', slot.draft_id)
        .in('format', ['video_vertical_9_16', 'vertical_9_16'])
        .maybeSingle();

      if (existingAsset?.public_url) {
        console.log(`Slot ${slot.id} already has a rendered video reel (${existingAsset.public_url}). Skipping.`);
        if (slot.subject_entity_id) claimedCandidateIds.add(slot.subject_entity_id);
        continue;
      }

      // Draft exists but needs a reel attached and scheduled!
      console.log(`Slot ${slot.id} has existing draft ${slot.draft_id} awaiting video reel render.`);
      const seriesLabel = seriesSlug === 'new_and_upcoming' ? 'New & Upcoming' : 'Now Streaming';
      try {
        await generateAndAttachReelForContentItem(
          {
            contentItemId: slot.draft_id,
            seriesLabel,
          },
          SYSTEM_ACTOR,
        );

        const targetMs = new Date(`${slot.scheduled_date}T${slot.scheduled_time || '11:00:00'}+01:00`).getTime();
        const effectiveScheduledFor = targetMs <= Date.now()
          ? new Date(Date.now() + 10_000).toISOString()
          : new Date(targetMs).toISOString();

        await scheduleContentItem(
          { contentItemId: slot.draft_id, scheduledFor: effectiveScheduledFor },
          SYSTEM_ACTOR,
        );

        await supabase
          .from('social_calendar')
          .update({
            status: 'approved',
            notes: `Attached 9:16 Reel and scheduled for ${slot.scheduled_date}`,
          })
          .eq('id', slot.id);

        if (slot.subject_entity_id) claimedCandidateIds.add(slot.subject_entity_id);
        console.log(`[auto_render_reels] Successfully attached reel and scheduled existing draft ${slot.draft_id}`);
        continue;
      } catch (attachErr: any) {
        console.error(`[auto_render_reels] Failed to attach reel to existing draft ${slot.draft_id}:`, attachErr?.message || attachErr);
        // Continue to resolve/re-draft below if attach failed
      }
    }

    // Resolve eligible candidate
    const resolved = await resolveEligibleCandidate({
      slot,
      seriesSlug,
      claimedCandidateIds,
      referenceDateStr: slot.scheduled_date,
    });

    if (!resolved) {
      console.warn(`[auto_render_reels] No eligible film candidate found for slot ${slot.id} (${seriesSlug})`);
      continue;
    }

    const { candidateId, candidateType, candidateName, preflight, wasReplaced } = resolved;
    console.log(`[auto_render_reels] Resolved candidate: "${candidateName}" (${candidateId})`);

    // Update slot if replaced
    if (wasReplaced || !slot.subject_entity_id) {
      await supabase
        .from('social_calendar')
        .update({
          subject_entity_id: candidateId,
          subject_entity_type: candidateType,
          notes: `Pre-rendered reel: "${candidateName}" (${candidateId})`,
          preflight_checked_at: new Date().toISOString(),
          preflight_status: 'ready',
          preflight_json: preflight || null,
        })
        .eq('id', slot.id);
    }

    // Approve slot and generate draft + reel
    const approvalResult = await approveEditorialSlot(
      {
        slotId: slot.id,
        candidateId,
        candidateType,
        scheduledDate: slot.scheduled_date,
        scheduledTime: slot.scheduled_time,
      },
      SYSTEM_ACTOR,
    );

    const draftId = approvalResult.draft?.contentItem?.id || approvalResult.contentItem?.id;
    console.log(`[auto_render_reels] Successfully approved and rendered reel for "${candidateName}"! Draft ID: ${draftId}`);
    claimedCandidateIds.add(candidateId);
  }

  console.log('\n[auto_render_reels] Completed reel pre-rendering scan.');
}

if (process.argv[1] && process.argv[1].includes('auto_render_editorial_reels')) {
  const days = Number(process.argv[2]) || 7;
  preRenderUpcomingReels(days).catch(err => {
    console.error('[auto_render_reels] Error:', err);
    process.exit(1);
  });
}
