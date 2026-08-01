export const SOCIAL_CONTENT_TYPES = ['actor_spotlight', 'birthday_spotlight', 'upcoming_movie'] as const;

export type SocialContentType = (typeof SOCIAL_CONTENT_TYPES)[number];

export const SOCIAL_CONTENT_TYPE_LABELS: Record<SocialContentType, string> = {
  actor_spotlight: 'Actor Spotlight',
  birthday_spotlight: 'Birthday Spotlight',
  upcoming_movie: 'Upcoming Movie',
};

export function isSocialContentType(value: unknown): value is SocialContentType {
  return typeof value === 'string' && SOCIAL_CONTENT_TYPES.includes(value as SocialContentType);
}
