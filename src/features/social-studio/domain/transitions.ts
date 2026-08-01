import type { SocialContentStatus, SocialJobStatus, SocialVariantStatus } from './statuses';

const CONTENT_TRANSITIONS: Record<SocialContentStatus, readonly SocialContentStatus[]> = {
  generating: ['draft', 'failed'],
  draft: ['ready_for_review', 'rejected', 'archived'],
  ready_for_review: ['draft', 'approved', 'rejected'],
  // `draft` is reachable from `approved` so a mistaken approval can be undone
  // while nothing is scheduled yet. Once it moves on to scheduled/publishing the
  // job queue owns it and reopening is no longer safe.
  approved: ['scheduled', 'publishing', 'archived', 'draft'],
  // `approved` is reachable so a schedule can be cancelled while its jobs are
  // still queued. Once `publishing` starts the adapter is mid-flight and the
  // item is no longer ours to pull back.
  scheduled: ['publishing', 'archived', 'approved'],
  publishing: ['published', 'partially_published', 'failed'],
  partially_published: ['published', 'failed', 'archived'],
  published: ['archived'],
  failed: ['draft', 'publishing', 'archived'],
  rejected: ['draft', 'archived'],
  archived: [],
};

const VARIANT_TRANSITIONS: Record<SocialVariantStatus, readonly SocialVariantStatus[]> = {
  draft: ['approved', 'skipped'],
  approved: ['scheduled', 'publishing', 'skipped'],
  scheduled: ['publishing', 'skipped', 'approved'],
  publishing: ['published', 'uploaded_as_draft', 'failed'],
  published: [],
  uploaded_as_draft: [],
  failed: ['publishing', 'skipped'],
  skipped: ['draft'],
};

const JOB_TRANSITIONS: Record<SocialJobStatus, readonly SocialJobStatus[]> = {
  queued: ['processing', 'cancelled'],
  processing: ['succeeded', 'failed', 'retrying', 'dead_letter'],
  retrying: ['processing', 'cancelled'],
  succeeded: [],
  failed: ['retrying', 'dead_letter', 'cancelled'],
  dead_letter: ['retrying', 'cancelled'],
  cancelled: [],
};

export function canTransitionContentStatus(from: SocialContentStatus, to: SocialContentStatus): boolean {
  return from === to || CONTENT_TRANSITIONS[from].includes(to);
}

export function canTransitionVariantStatus(from: SocialVariantStatus, to: SocialVariantStatus): boolean {
  return from === to || VARIANT_TRANSITIONS[from].includes(to);
}

export function canTransitionJobStatus(from: SocialJobStatus, to: SocialJobStatus): boolean {
  return from === to || JOB_TRANSITIONS[from].includes(to);
}

export function assertContentTransition(from: SocialContentStatus, to: SocialContentStatus): void {
  if (!canTransitionContentStatus(from, to)) {
    throw new Error(`Invalid social content status transition: ${from} -> ${to}`);
  }
}

export function assertVariantTransition(from: SocialVariantStatus, to: SocialVariantStatus): void {
  if (!canTransitionVariantStatus(from, to)) {
    throw new Error(`Invalid social variant status transition: ${from} -> ${to}`);
  }
}

export function nextRetryAvailableAt(now = new Date(), attemptCount = 0): Date {
  const cappedAttempt = Math.min(Math.max(attemptCount, 0), 10);
  const delaySeconds = Math.min(3600, 30 * 2 ** cappedAttempt);
  return new Date(now.getTime() + delaySeconds * 1000);
}
