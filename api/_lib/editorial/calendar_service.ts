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
  // Monday: Emerging Faces / Rising Stars (No superstar bias)
  1: [
    { seriesSlug: 'you_know_the_face', time: '11:00:00', format: 'carousel', notes: 'Morning Carousel: Emerging Nollywood Stars & Supporting Faces' },
  ],
  // Tuesday: Critics Review Consensus & Evening Community Debate
  2: [
    { seriesSlug: 'critics_say', time: '11:00:00', format: 'carousel', notes: 'Morning Carousel: Critic Consensus & Review Highlights' },
    { seriesSlug: 'film_conversation', time: '18:30:00', format: 'text', notes: 'Evening Post: African Cinema Discussion & Debate Prompt' },
  ],
  // Wednesday: Where to Watch (Emerging Streamers Priority) + Evening Video Clip
  3: [
    { seriesSlug: 'where_to_watch', time: '11:00:00', priority: 'high', format: 'carousel', notes: 'Morning Carousel: Where to Watch (Nollistream, Docuth, EbonyLife, Kava)' },
    { seriesSlug: 'new_and_upcoming', time: '18:30:00', format: 'video', notes: 'Evening Video Snippet: New Scene Clip or Trailer Drop' },
  ],
  // Thursday: Behind The Camera (Crew Spotlight: DP, Writer, Editor) + Director/Craft Stills
  4: [
    { seriesSlug: 'behind_the_camera', time: '11:00:00', priority: 'high', format: 'carousel', notes: 'Morning Carousel: Crew Spotlight (Cinematographer, Screenwriter, Editor, Director)' },
    { seriesSlug: 'filmography', time: '19:00:00', format: 'single_image', notes: 'Evening Card: Director/DP Craft & Frame Stills' },
  ],
  // Friday: 5-Film Weekend Watchlist (Balanced & Gem-heavy) + Video Snippet Drop
  5: [
    { seriesSlug: 'weekend_watchlist', time: '12:00:00', priority: 'high', format: 'carousel', notes: 'Midday Carousel: 5-Film Weekend Guide (Nollistream, Docuth, YouTube Gems, Netflix)' },
    { seriesSlug: 'new_and_upcoming', time: '18:00:00', format: 'video', notes: 'Evening Video Snippet: #1 Weekend Recommendation Scene/Trailer' },
  ],
  // Saturday: Theatre & Stage to Screen + Indie Scene
  6: [
    { seriesSlug: 'whats_on_stage', time: '11:00:00', format: 'carousel', notes: 'Morning Carousel: What’s On Stage / Live Performance' },
    { seriesSlug: 'stage_to_screen', time: '17:30:00', format: 'video', notes: 'Evening Video/Clip: Stage to Screen Performer Highlight' },
  ],
  // Sunday: Sunday Film Conversation + Data Story / Collaboration Map
  0: [
    { seriesSlug: 'film_conversation', time: '14:00:00', format: 'text', notes: 'Afternoon Discussion: Community Topic' },
    { seriesSlug: 'by_the_numbers', time: '19:00:00', format: 'single_image', notes: 'Evening Deep-Dive: MuviDB Data Story & Collaboration Map' },
  ],
};

/**
 * Seed or refresh 30 days of rolling editorial calendar slots with multi-slot support.
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

    const slotConfigs = WEEKDAY_SCHEDULE[dayOfWeek] || [
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

