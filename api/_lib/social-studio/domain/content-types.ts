export const SOCIAL_CONTENT_TYPES = [
  'actor_spotlight',
  'birthday_spotlight',
  'upcoming_movie',
  'critics_say',
  'where_to_watch',
  'weekend_watchlist',
  'whats_on_stage',
  'film_conversation',
] as const;

export type SocialContentType = (typeof SOCIAL_CONTENT_TYPES)[number];

export const SOCIAL_CONTENT_TYPE_LABELS: Record<SocialContentType, string> = {
  actor_spotlight: 'Actor Spotlight',
  birthday_spotlight: 'Birthday Spotlight',
  upcoming_movie: 'Upcoming Movie',
  critics_say: 'What The Critics Say',
  where_to_watch: 'Where To Watch',
  weekend_watchlist: 'Weekend Watchlist',
  whats_on_stage: "What's On Stage",
  film_conversation: 'Nollywood Debate',
};

export function isSocialContentType(value: unknown): value is SocialContentType {
  return typeof value === 'string' && SOCIAL_CONTENT_TYPES.includes(value as SocialContentType);
}
