export const SOCIAL_CONTENT_STATUSES = [
  'generating',
  'draft',
  'ready_for_review',
  'approved',
  'scheduled',
  'publishing',
  'partially_published',
  'published',
  'failed',
  'rejected',
  'archived',
] as const;

export const SOCIAL_VARIANT_STATUSES = [
  'draft',
  'approved',
  'scheduled',
  'publishing',
  'published',
  'uploaded_as_draft',
  'failed',
  'skipped',
] as const;

export const SOCIAL_JOB_STATUSES = [
  'queued',
  'processing',
  'retrying',
  'succeeded',
  'failed',
  'dead_letter',
  'cancelled',
] as const;

export type SocialContentStatus = (typeof SOCIAL_CONTENT_STATUSES)[number];
export type SocialVariantStatus = (typeof SOCIAL_VARIANT_STATUSES)[number];
export type SocialJobStatus = (typeof SOCIAL_JOB_STATUSES)[number];

export function isSocialContentStatus(value: unknown): value is SocialContentStatus {
  return typeof value === 'string' && SOCIAL_CONTENT_STATUSES.includes(value as SocialContentStatus);
}

export function isSocialVariantStatus(value: unknown): value is SocialVariantStatus {
  return typeof value === 'string' && SOCIAL_VARIANT_STATUSES.includes(value as SocialVariantStatus);
}
