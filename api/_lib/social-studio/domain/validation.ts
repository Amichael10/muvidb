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
  actor_spotlight: 'actor-spotlight-v1',
  birthday_spotlight: 'birthday-spotlight-v1',
  upcoming_movie: 'upcoming-movie-v1',
};

export function parseGenerateDraftRequest(body: unknown): {
  contentType: SocialContentType;
  sourceEntityId: string;
  templateSlug: string;
  platforms: SocialPlatform[];
} {
  const input = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const contentType = input.contentType;
  if (!isSocialContentType(contentType)) throw new Error('Unsupported social content type');

  assertUuid(input.sourceEntityId, 'sourceEntityId');

  const templateSlug =
    typeof input.templateSlug === 'string' && input.templateSlug.trim()
      ? input.templateSlug.trim()
      : DEFAULT_TEMPLATE_SLUGS[contentType];

  const platforms = normalizePlatforms(input.platforms);
  if (!platforms.length) throw new Error('Select at least one platform');

  return {
    contentType,
    sourceEntityId: input.sourceEntityId,
    templateSlug,
    platforms,
  };
}

export function createPublishJobIdempotencyKey(input: {
  contentItemId: string;
  platform: SocialPlatform;
  scheduledFor: string;
}): string {
  return `social:${input.contentItemId}:${input.platform}:${input.scheduledFor}`;
}
