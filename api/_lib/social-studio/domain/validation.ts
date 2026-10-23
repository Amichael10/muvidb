import { isSocialContentType, type SocialContentType } from './content-types.js';
import { normalizePlatforms, type SocialPlatform } from './platform-types.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertUuid(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new Error(`${label} must be a valid UUID`);
  }
}

/**
 * Template used when the caller does not name one. Exhaustive over
 * SocialContentType, so adding a content type is a compile error until it has a
 * template.
 */
const DEFAULT_TEMPLATE_SLUGS: Record<SocialContentType, string> = {
  actor_spotlight: 'you-know-the-face-simple-v1',
  birthday_spotlight: 'you-know-the-face-simple-v1',
  upcoming_movie: 'new-upcoming-simple-v1',
  critics_say: 'critics-say-simple-v1',
  where_to_watch: 'where-to-watch-simple-v1',
  weekend_watchlist: 'weekend-watchlist-simple-v1',
  whats_on_stage: 'on-stage-simple-v1',
  film_conversation: 'film-conversation-simple-v1',
  audience_pulse: 'audience-pulse-v1',
};

export function parseGenerateDraftRequest(body: unknown): {
  contentType: SocialContentType;
  sourceEntityId: string;
  sourceEntityIds: string[];
  criticReviewId: string | null;
  templateSlug: string;
  platforms: SocialPlatform[];
  destinationId: string | null;
  isAdHoc: boolean;
} {
  const input = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const contentType = input.contentType;
  if (!isSocialContentType(contentType)) throw new Error('Unsupported social content type');

  assertUuid(input.sourceEntityId, 'sourceEntityId');

  const sourceEntityIds = Array.isArray(input.sourceEntityIds)
    ? [...new Set(input.sourceEntityIds.map(value => String(value).trim()))]
    : [input.sourceEntityId];
  sourceEntityIds.forEach((id, index) => assertUuid(id, `sourceEntityIds[${index}]`));

  const criticReviewId = input.criticReviewId == null || input.criticReviewId === ''
    ? null
    : String(input.criticReviewId).trim();
  if (criticReviewId) assertUuid(criticReviewId, 'criticReviewId');

  const templateSlug =
    typeof input.templateSlug === 'string' && input.templateSlug.trim()
      ? input.templateSlug.trim()
      : DEFAULT_TEMPLATE_SLUGS[contentType];

  const platforms = normalizePlatforms(input.platforms);
  if (!platforms.length) throw new Error('Select at least one platform');

  const destinationId = input.destinationId == null || input.destinationId === '' ? null : String(input.destinationId).trim();
  if (destinationId) assertUuid(destinationId, 'destinationId');

  return {
    contentType,
    sourceEntityId: input.sourceEntityId,
    sourceEntityIds,
    criticReviewId,
    templateSlug,
    platforms,
    destinationId,
    isAdHoc: input.isAdHoc === true || input.source === 'ad_hoc',
  };
}

export function createPublishJobIdempotencyKey(input: {
  contentItemId: string;
  platform: SocialPlatform;
  scheduledFor: string;
}): string {
  return `social:${input.contentItemId}:${input.platform}:${input.scheduledFor}`;
}
