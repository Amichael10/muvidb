import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export interface CalendarSlotConfig {
  seriesSlug: string;
  time: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  format?: 'carousel' | 'single_image' | 'text' | 'video';
  notes?: string;
}

export const WEEKDAY_SCHEDULE: Record<number, CalendarSlotConfig[]> = {
  // Monday: useful discovery first, then one qualified emerging professional.
  1: [
    { seriesSlug: 'where_to_watch', time: '11:00:00', priority: 'high', format: 'carousel', notes: 'Utility Post: A verified current destination to watch' },
    { seriesSlug: 'you_know_the_face', time: '18:30:00', format: 'carousel', notes: 'Emerging professional with a verified current-project reason' },
  ],
  // Tuesday: timely release information and conversation.
  2: [
    { seriesSlug: 'new_and_upcoming', time: '11:00:00', priority: 'high', format: 'single_image', notes: 'Verified upcoming release, trailer or announcement' },
    { seriesSlug: 'film_conversation', time: '18:30:00', format: 'text', notes: 'Evening Post: African Cinema Discussion & Debate Prompt' },
  ],
  // Wednesday: streaming utility and filmmaking craft.
  3: [
    { seriesSlug: 'where_to_watch', time: '11:00:00', priority: 'high', format: 'carousel', notes: 'Morning Carousel: Where to Watch (Nollistream, Docuth, EbonyLife, Kava)' },
    { seriesSlug: 'behind_the_camera', time: '18:30:00', format: 'carousel', notes: 'Qualified filmmaker or craft professional with a current-project connection' },
  ],
  // Thursday: another timely release; critics only when review material exists.
  4: [
    { seriesSlug: 'new_and_upcoming', time: '11:00:00', priority: 'high', format: 'single_image', notes: 'Verified release announcement or trailer' },
    { seriesSlug: 'critics_say', time: '18:30:00', format: 'carousel', notes: 'Critic material only when a qualified review exists' },
  ],
  // Friday: practical weekend viewing decisions.
  5: [
    { seriesSlug: 'weekend_watchlist', time: '12:00:00', priority: 'high', format: 'carousel', notes: 'Midday Carousel: 5-Film Weekend Guide (Nollistream, Docuth, YouTube Gems, Netflix)' },
    { seriesSlug: 'where_to_watch', time: '18:00:00', priority: 'high', format: 'single_image', notes: 'Evening utility post with a verified destination' },
  ],
  // Saturday: live culture and community conversation.
  6: [
    { seriesSlug: 'whats_on_stage', time: '11:00:00', format: 'carousel', notes: 'Morning Carousel: What’s On Stage / Live Performance' },
    { seriesSlug: 'film_conversation', time: '17:30:00', format: 'text', notes: 'Specific film question backed by usable story or audience data' },
  ],
  // Sunday: one recognizable career story and one timely title.
  0: [
    { seriesSlug: 'filmography', time: '14:00:00', format: 'carousel', notes: 'Recognizable professional with a defensible editorial reason' },
    { seriesSlug: 'new_and_upcoming', time: '19:00:00', format: 'single_image', notes: 'Next-week release radar' },
  ],
};

export const SINGLE_POST_SCHEDULE: Record<number, CalendarSlotConfig[]> = {
  // Monday: Emerging Faces / Rising Stars
  1: [{ seriesSlug: 'you_know_the_face', time: '11:00:00', format: 'carousel', notes: 'Daily Spotlight: Emerging Nollywood Stars' }],
  // Tuesday: Where to Watch (Nollistream, Docuth, EbonyLife Priority)
  2: [{ seriesSlug: 'where_to_watch', time: '11:00:00', priority: 'high', format: 'carousel', notes: 'Daily Streaming Alert: Nollistream, Docuth, EbonyLife' }],
  // Wednesday: Critics Review Consensus & Verdict
  3: [{ seriesSlug: 'critics_say', time: '11:00:00', format: 'carousel', notes: 'Daily Review: Critic Consensus & Verdicts' }],
  // Thursday: Crew & Behind The Camera (DP, Writer, Editor, Director)
  4: [{ seriesSlug: 'behind_the_camera', time: '11:00:00', priority: 'high', format: 'carousel', notes: 'Daily Craft: Crew & Filmmaker Spotlight' }],
  // Friday: Weekend 5-Film Watchlist
  5: [{ seriesSlug: 'weekend_watchlist', time: '12:00:00', priority: 'high', format: 'carousel', notes: 'Weekend Watchlist: 5 Nollywood & African Gems' }],
  // Saturday: Theatre / What's On Stage
  6: [{ seriesSlug: 'whats_on_stage', time: '11:00:00', format: 'carousel', notes: 'Weekend Stage: Live African Theatre & Productions' }],
  // Sunday: African Cinema Debate & Community Question
  0: [{ seriesSlug: 'film_conversation', time: '14:00:00', format: 'text', notes: 'Sunday Cinema: Community Debate & Conversation' }],
};

// Three-post daily schedule aligned with publishing cron slots (09:00, 12:00, 15:30 WAT)
export const THREE_POST_SCHEDULE: Record<number, CalendarSlotConfig[]> = {
  // Sunday
  0: [
    { seriesSlug: 'filmography', time: '09:00:00', priority: 'high', format: 'carousel', notes: 'Morning Spotlight: Career Deep-Dive' },
    { seriesSlug: 'critics_say', time: '12:00:00', priority: 'high', format: 'carousel', notes: 'Midday Review: Recent Critic Consensus' },
    { seriesSlug: 'film_conversation', time: '15:30:00', format: 'text', notes: 'Afternoon Discussion: African Cinema Debate' },
  ],
  // Monday
  1: [
    { seriesSlug: 'you_know_the_face', time: '09:00:00', priority: 'high', format: 'carousel', notes: 'Morning Spotlight: Emerging Nollywood Stars' },
    { seriesSlug: 'critics_say', time: '12:00:00', priority: 'high', format: 'carousel', notes: 'Midday Review: Recent Critic Consensus' },
    { seriesSlug: 'new_and_upcoming', time: '15:30:00', format: 'single_image', notes: 'Afternoon Release Radar: Trailers & Announcements' },
  ],
  // Tuesday
  2: [
    { seriesSlug: 'where_to_watch', time: '09:00:00', priority: 'high', format: 'carousel', notes: 'Morning Streaming Alert: Nollistream, Docuth, etc.' },
    { seriesSlug: 'critics_say', time: '12:00:00', priority: 'high', format: 'carousel', notes: 'Midday Review: Recent Critic Consensus' },
    { seriesSlug: 'film_conversation', time: '15:30:00', format: 'text', notes: 'Afternoon Discussion: Film Industry Debate' },
  ],
  // Wednesday
  3: [
    { seriesSlug: 'behind_the_camera', time: '09:00:00', priority: 'high', format: 'carousel', notes: 'Morning Craft: Directors, Writers & Crew' },
    { seriesSlug: 'critics_say', time: '12:00:00', priority: 'high', format: 'carousel', notes: 'Midday Review: Recent Critic Consensus' },
    { seriesSlug: 'where_to_watch', time: '15:30:00', format: 'single_image', notes: 'Afternoon Streaming Discovery' },
  ],
  // Thursday
  4: [
    { seriesSlug: 'you_know_the_face', time: '09:00:00', priority: 'high', format: 'carousel', notes: 'Morning Spotlight: Emerging Nollywood Stars' },
    { seriesSlug: 'critics_say', time: '12:00:00', priority: 'high', format: 'carousel', notes: 'Midday Review: Recent Critic Consensus' },
    { seriesSlug: 'new_and_upcoming', time: '15:30:00', format: 'single_image', notes: 'Afternoon Release Radar' },
  ],
  // Friday
  5: [
    { seriesSlug: 'where_to_watch', time: '09:00:00', priority: 'high', format: 'carousel', notes: 'Morning Weekend Streaming Destination' },
    { seriesSlug: 'weekend_watchlist', time: '12:00:00', priority: 'high', format: 'carousel', notes: 'Midday 5-Film Weekend Watchlist' },
    { seriesSlug: 'new_and_upcoming', time: '15:30:00', format: 'single_image', notes: 'Afternoon Weekend Release Radar' },
  ],
  // Saturday
  6: [
    { seriesSlug: 'whats_on_stage', time: '09:00:00', priority: 'high', format: 'carousel', notes: 'Morning Stage: Theatre & Live African Productions' },
    { seriesSlug: 'critics_say', time: '12:00:00', priority: 'high', format: 'carousel', notes: 'Midday Review: Recent Critic Consensus' },
    { seriesSlug: 'film_conversation', time: '15:30:00', format: 'text', notes: 'Afternoon Discussion: Community Conversation' },
  ],
};

export const VIDEO_LANE_SCHEDULE = THREE_POST_SCHEDULE;

export interface SeedCalendarOptions {
  daysAhead?: number;
  startDate?: string;
  postsPerDay?: 1 | 2 | 3;
  clearExistingPlanned?: boolean;
}

/**
 * Seed or refresh rolling editorial calendar slots with configurable cadence and start date.
 */
export async function seedRollingCalendar(options: SeedCalendarOptions | number = 30): Promise<number> {
  const opts: SeedCalendarOptions =
    typeof options === 'number' ? { daysAhead: options } : options || {};
  const daysAhead = opts.daysAhead || 30;
  const postsPerDay = opts.postsPerDay || 2;
  const clearExisting = Boolean(opts.clearExistingPlanned);

  const { data: seriesList } = await supabase.from('social_content_series').select('id, slug');
  if (!seriesList || !seriesList.length) return 0;

  const seriesMap = new Map(seriesList.map((s) => [s.slug, s.id]));

  let startYear = new Date().getUTCFullYear();
  let startMonth = new Date().getUTCMonth();
  let startDay = new Date().getUTCDate();

  if (opts.startDate && /^\d{4}-\d{2}-\d{2}$/.test(opts.startDate)) {
    const [y, m, d] = opts.startDate.split('-').map(Number);
    startYear = y;
    startMonth = m - 1;
    startDay = d;
  }

  const startDateStr = opts.startDate && /^\d{4}-\d{2}-\d{2}$/.test(opts.startDate)
    ? opts.startDate
    : `${startYear}-${String(startMonth + 1).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;

  // Optionally remove un-published planned slots from startDate onwards
  if (clearExisting) {
    await supabase
      .from('social_calendar')
      .delete()
      .gte('scheduled_date', startDateStr)
      .eq('status', 'planned');
  }

  let createdCount = 0;

  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(Date.UTC(startYear, startMonth, startDay + i, 12, 0, 0));
    const dateStr = d.toISOString().split('T')[0];
    const dayOfWeek = d.getUTCDay();

    const scheduleMap = postsPerDay === 1 ? SINGLE_POST_SCHEDULE : postsPerDay === 3 ? VIDEO_LANE_SCHEDULE : WEEKDAY_SCHEDULE;
    const slotConfigs = scheduleMap[dayOfWeek] || [
      { seriesSlug: 'filmography', time: '11:00:00' },
    ];

    for (const slot of slotConfigs) {
      const seriesId = seriesMap.get(slot.seriesSlug);
      if (!seriesId) continue;

      // Check if slot already exists for date, series, and time
      const { data: existing } = await supabase
        .from('social_calendar')
        .select('id')
        .eq('scheduled_date', dateStr)
        .eq('series_id', seriesId)
        .eq('scheduled_time', slot.time);

      if (!existing || existing.length === 0) {
        await supabase.from('social_calendar').insert({
          scheduled_date: dateStr,
          scheduled_time: slot.time,
          series_id: seriesId,
          status: 'planned',
          source: 'planned',
          priority: slot.priority || 'normal',
          notes: slot.notes || null,
        });
        createdCount++;
      }
    }
  }

  return createdCount;
}

export interface GenerateScheduleDraftsOptions {
  daysAhead?: number;
  startDate?: string;
  actor?: any;
}

/**
 * Generates 3 rich post drafts for each day across a specified date range.
 * Each post is assigned to the exact cron publishing times:
 * - Slot 1: 09:00 WAT (Spotlight or Streaming Guide)
 * - Slot 2: 12:00 WAT (Recent Critic Review Consensus or Weekend Watchlist)
 * - Slot 3: 15:30 WAT (Upcoming Release Radar or Cinema Conversation)
 */
export async function generateDailyScheduleDrafts(options: GenerateScheduleDraftsOptions = {}) {
  const daysAhead = Math.min(Math.max(options.daysAhead || 7, 1), 30);
  const systemActor = options.actor || {
    id: '00000000-0000-0000-0000-000000000000',
    email: 'admin@muvidb.com',
    role: 'admin' as const,
  };

  const { generateSocialDraft } = await import('../social_studio.js');
  const { fetchSeriesCandidates } = await import('./candidate_service.js');

  let startYear = new Date().getUTCFullYear();
  let startMonth = new Date().getUTCMonth();
  let startDay = new Date().getUTCDate();

  if (options.startDate && /^\d{4}-\d{2}-\d{2}$/.test(options.startDate)) {
    const [y, m, d] = options.startDate.split('-').map(Number);
    startYear = y;
    startMonth = m - 1;
    startDay = d;
  }

  const startDateStr = options.startDate && /^\d{4}-\d{2}-\d{2}$/.test(options.startDate)
    ? options.startDate
    : `${startYear}-${String(startMonth + 1).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;

  // Pre-seed used entities to avoid duplicates from recent 14-day history
  const usedEntityIds = new Set<string>();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentItems } = await supabase
    .from('social_content_items')
    .select('source_entity_id')
    .gte('created_at', fourteenDaysAgo);
  for (const item of recentItems || []) {
    if (item.source_entity_id) usedEntityIds.add(item.source_entity_id);
  }

  const results: any[] = [];
  let totalCreated = 0;

  // 3 daily slots aligned with GitHub Actions publisher crons (Africa/Lagos is UTC+1)
  const DAILY_SLOTS = [
    {
      slotIndex: 1,
      time: '09:00:00',
      rotation: ['where_to_watch', 'actor_spotlight'],
      label: 'Morning Spotlight & Streaming Guide',
    },
    {
      slotIndex: 2,
      time: '12:00:00',
      rotation: ['critics_say'],
      label: 'Midday Critic Consensus & Reviews',
    },
    {
      slotIndex: 3,
      time: '15:30:00',
      rotation: ['upcoming_movie', 'whats_on_stage', 'film_conversation'],
      label: 'Afternoon Release Radar & Culture',
    },
  ];

  for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
    const d = new Date(Date.UTC(startYear, startMonth, startDay + dayOffset, 12, 0, 0));
    const dateStr = d.toISOString().split('T')[0];
    const isFriday = d.getUTCDay() === 5;

    const dayItems: any[] = [];

    for (const slot of DAILY_SLOTS) {
      let contentType = slot.rotation[dayOffset % slot.rotation.length];
      if (slot.slotIndex === 2 && isFriday) {
        contentType = 'weekend_watchlist';
      }

      // 09:00 WAT = 08:00 UTC, 12:00 WAT = 11:00 UTC, 15:30 WAT = 14:30 UTC
      const scheduledFor = new Date(`${dateStr}T${slot.time}+01:00`).toISOString();
      const { data: existingPost } = await supabase
        .from('social_content_items')
        .select('id, title, status, scheduled_for')
        .eq('scheduled_for', scheduledFor)
        .neq('status', 'rejected')
        .maybeSingle();

      if (existingPost) {
        dayItems.push({
          slotIndex: slot.slotIndex,
          time: slot.time,
          status: existingPost.status,
          title: existingPost.title,
          alreadyExisted: true,
        });
        continue;
      }

      try {
        const candidates = await fetchSeriesCandidates(contentType, 20);
        const candidate = candidates.find(c => !usedEntityIds.has(c.id)) || candidates[0];

        if (!candidate) {
          console.warn(`[calendar_service] No candidates found for ${contentType} on ${dateStr}`);
          continue;
        }

        usedEntityIds.add(candidate.id);

        const templateMap: Record<string, string> = {
          actor_spotlight: 'actor-spotlight-v1',
          upcoming_movie: 'upcoming-movie-v1',
          critics_say: 'critics-say-v1',
          where_to_watch: 'where-to-watch-v1',
          weekend_watchlist: 'weekend-watchlist-v1',
          whats_on_stage: 'whats-on-stage-v1',
          film_conversation: 'nollywood-debate-v1',
        };

        const templateSlug = templateMap[contentType] || 'where-to-watch-v1';

        const draft = await generateSocialDraft(
          {
            contentType: contentType as any,
            sourceEntityId: candidate.id,
            criticReviewId: candidate.data?.criticReview?.id || null,
            templateSlug,
            platforms: ['instagram', 'threads', 'facebook', 'tiktok'],
            skipAssets: true,
          },
          systemActor,
        );

        if (draft?.contentItem?.id) {
          await supabase
            .from('social_content_items')
            .update({
              scheduled_for: scheduledFor,
              status: 'draft',
              metadata: {
                scheduled_date: dateStr,
                scheduled_time: slot.time,
                slot_index: slot.slotIndex,
                auto_scheduled: true,
                candidate_name: candidate.name,
              },
            })
            .eq('id', draft.contentItem.id);

          await supabase
            .from('social_platform_variants')
            .update({ scheduled_for: scheduledFor })
            .eq('content_item_id', draft.contentItem.id);

          totalCreated++;
          dayItems.push({
            id: draft.contentItem.id,
            slotIndex: slot.slotIndex,
            time: slot.time,
            title: draft.contentItem.title,
            contentType,
            status: 'draft',
          });
        }
      } catch (slotErr: any) {
        console.error(`[calendar_service] Failed to generate slot ${slot.slotIndex} (${contentType}) for ${dateStr}:`, slotErr);
      }
    }

    results.push({ date: dateStr, items: dayItems });
  }

  return {
    success: true,
    totalCreated,
    daysAhead,
    startDate: startDateStr,
    days: results,
  };
}

