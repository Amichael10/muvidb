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

// Three-lane daily plan: the existing graphic lane plus two video preparation lanes.
export const VIDEO_LANE_SCHEDULE: Record<number, CalendarSlotConfig[]> = {
  0: [{ seriesSlug: 'film_conversation', time: '14:00:00', format: 'single_image', notes: 'Graphic lane' }, { seriesSlug: 'film_conversation', time: '18:00:00', format: 'video', notes: '1:1 video lane — local clipper + Gemini' }, { seriesSlug: 'film_conversation', time: '20:00:00', format: 'video', notes: '9:16 video lane — local clipper + Gemini' }],
  1: [{ seriesSlug: 'where_to_watch', time: '14:00:00', format: 'carousel', notes: 'Graphic lane' }, { seriesSlug: 'where_to_watch', time: '18:00:00', format: 'video', notes: '1:1 video lane — local clipper + Gemini' }, { seriesSlug: 'where_to_watch', time: '20:00:00', format: 'video', notes: '9:16 video lane — local clipper + Gemini' }],
  2: [{ seriesSlug: 'critics_say', time: '14:00:00', format: 'carousel', notes: 'Graphic lane' }, { seriesSlug: 'critics_say', time: '18:00:00', format: 'video', notes: '1:1 video lane — local clipper + Gemini' }, { seriesSlug: 'critics_say', time: '20:00:00', format: 'video', notes: '9:16 video lane — local clipper + Gemini' }],
  3: [{ seriesSlug: 'where_to_watch', time: '14:00:00', format: 'carousel', notes: 'Graphic lane' }, { seriesSlug: 'where_to_watch', time: '18:00:00', format: 'video', notes: '1:1 video lane — local clipper + Gemini' }, { seriesSlug: 'where_to_watch', time: '20:00:00', format: 'video', notes: '9:16 video lane — local clipper + Gemini' }],
  4: [{ seriesSlug: 'behind_the_camera', time: '14:00:00', format: 'carousel', notes: 'Graphic lane' }, { seriesSlug: 'behind_the_camera', time: '18:00:00', format: 'video', notes: '1:1 video lane — local clipper + Gemini' }, { seriesSlug: 'behind_the_camera', time: '20:00:00', format: 'video', notes: '9:16 video lane — local clipper + Gemini' }],
  5: [{ seriesSlug: 'weekend_watchlist', time: '14:00:00', format: 'carousel', notes: 'Graphic lane' }, { seriesSlug: 'weekend_watchlist', time: '18:00:00', format: 'video', notes: '1:1 video lane — local clipper + Gemini' }, { seriesSlug: 'weekend_watchlist', time: '20:00:00', format: 'video', notes: '9:16 video lane — local clipper + Gemini' }],
  6: [{ seriesSlug: 'whats_on_stage', time: '14:00:00', format: 'carousel', notes: 'Graphic lane' }, { seriesSlug: 'whats_on_stage', time: '18:00:00', format: 'video', notes: '1:1 video lane — local clipper + Gemini' }, { seriesSlug: 'whats_on_stage', time: '20:00:00', format: 'video', notes: '9:16 video lane — local clipper + Gemini' }],
};

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

  let startBaseDate = new Date();
  if (opts.startDate) {
    const parsed = new Date(opts.startDate);
    if (!isNaN(parsed.getTime())) {
      startBaseDate = parsed;
    }
  }

  const startDateStr = startBaseDate.toISOString().split('T')[0];

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
    const d = new Date(startBaseDate);
    d.setDate(startBaseDate.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const dayOfWeek = d.getDay();

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

