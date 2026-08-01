import { isSocialContentType } from './content-types';
import { normalizePlatforms, type SocialPlatform } from './platform-types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertUuid(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new Error(`${label} must be a valid UUID`);
  }
}

export function parseGenerateDraftRequest(body: unknown): {
  contentType: 'actor_spotlight' | 'upcoming_movie';
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
      : contentType === 'actor_spotlight'
        ? 'actor-spotlight-v1'
        : 'upcoming-movie-v1';

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
