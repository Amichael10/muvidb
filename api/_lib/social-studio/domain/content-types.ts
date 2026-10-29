export const SOCIAL_CONTENT_TYPES = [
  'actor_spotlight',
  'birthday_spotlight',
  'upcoming_movie',
  'critics_say',
  'where_to_watch',
  'weekend_watchlist',
  'whats_on_stage',
  'film_conversation',
  'audience_pulse',
] as const;

export type SocialContentType = (typeof SOCIAL_CONTENT_TYPES)[number];

export const SOCIAL_CONTENT_TYPE_LABELS: Record<SocialContentType, string> = {
  actor_spotlight: 'Actor Spotlight',
  birthday_spotlight: 'Birthday Spotlight',
  upcoming_movie: 'Upcoming Movie',
  critics_say: 'The Critic’s Take',
  where_to_watch: 'Now Streaming',
  weekend_watchlist: 'Weekend Watchlist',
  whats_on_stage: "What's On Stage",
  film_conversation: 'Nollywood Debate',
  audience_pulse: 'Audience Pulse',
};

export function isSocialContentType(value: unknown): value is SocialContentType {
  return typeof value === 'string' && SOCIAL_CONTENT_TYPES.includes(value as SocialContentType);
}

/**
 * Automated 9:16 Instagram Reel generation is strictly restricted to:
 * 1. "Now Streaming" (`where_to_watch` / `streaming_alert`)
 * 2. "New & Upcoming Release" (`upcoming_movie` / `new_release`)
 *
 * All other editorial series (Actor Spotlight, What The Critics Say,
 * Behind The Camera, Weekend Watchlist Carousels, What's On Stage,
 * Nollywood Debate, Birthday Spotlight) remain static 4:5 portraits
 * or multi-slide carousels.
 */
export const REEL_AUTO_GENERATION_CONTENT_TYPES = new Set<string>([
  'where_to_watch',
  'upcoming_movie',
  'streaming_alert',
  'new_release',
]);

export function supportsReelAutoGeneration(input?: {
  contentType?: string | null;
  themeId?: string | null;
  seriesSlug?: string | null;
}): boolean {
  const candidates = [
    input?.contentType,
    input?.themeId,
    input?.seriesSlug,
  ]
    .map((v) => String(v || '').trim().toLowerCase())
    .filter(Boolean);

  return candidates.some((c) => REEL_AUTO_GENERATION_CONTENT_TYPES.has(c));
}
