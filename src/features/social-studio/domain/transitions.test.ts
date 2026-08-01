import { describe, expect, it } from 'vitest';
import {
  assertContentTransition,
  canTransitionContentStatus,
  canTransitionJobStatus,
  canTransitionVariantStatus,
  nextRetryAvailableAt,
} from './transitions';

describe('social status transitions', () => {
  it('allows the human approval path', () => {
    expect(canTransitionContentStatus('generating', 'draft')).toBe(true);
    expect(canTransitionContentStatus('draft', 'ready_for_review')).toBe(true);
    expect(canTransitionContentStatus('ready_for_review', 'approved')).toBe(true);
    expect(canTransitionContentStatus('approved', 'scheduled')).toBe(true);
    expect(canTransitionContentStatus('scheduled', 'publishing')).toBe(true);
    expect(canTransitionContentStatus('publishing', 'published')).toBe(true);
  });

  it('blocks publishing a draft directly', () => {
    expect(canTransitionContentStatus('draft', 'published')).toBe(false);
    expect(() => assertContentTransition('draft', 'published')).toThrow(/draft -> published/);
  });

  it('keeps variants from returning to editable states after publishing', () => {
    expect(canTransitionVariantStatus('published', 'draft')).toBe(false);
    expect(canTransitionVariantStatus('uploaded_as_draft', 'draft')).toBe(false);
  });

  it('keeps completed jobs terminal', () => {
    expect(canTransitionJobStatus('succeeded', 'processing')).toBe(false);
    expect(canTransitionJobStatus('dead_letter', 'retrying')).toBe(true);
  });

  it('backs off retry availability without growing forever', () => {
    const now = new Date('2026-08-01T10:00:00.000Z');
    expect(nextRetryAvailableAt(now, 0).toISOString()).toBe('2026-08-01T10:00:30.000Z');
    expect(nextRetryAvailableAt(now, 2).toISOString()).toBe('2026-08-01T10:02:00.000Z');
    expect(nextRetryAvailableAt(now, 20).toISOString()).toBe('2026-08-01T11:00:00.000Z');
  });
});

describe('review reversibility', () => {
  it('lets a mistaken approval go back to draft', () => {
    expect(canTransitionContentStatus('approved', 'draft')).toBe(true);
  });

  it('still allows approved to move forward', () => {
    expect(canTransitionContentStatus('approved', 'scheduled')).toBe(true);
    expect(canTransitionContentStatus('approved', 'publishing')).toBe(true);
  });

  it('does not let a scheduled item be reopened — the queue owns it', () => {
    expect(canTransitionContentStatus('scheduled', 'draft')).toBe(false);
    expect(canTransitionContentStatus('publishing', 'draft')).toBe(false);
  });

  it('keeps rejected reopenable', () => {
    expect(canTransitionContentStatus('rejected', 'draft')).toBe(true);
  });
});

describe('schedule reversibility', () => {
  it('lets a scheduled item be cancelled back to approved', () => {
    expect(canTransitionContentStatus('scheduled', 'approved')).toBe(true);
    expect(canTransitionVariantStatus('scheduled', 'approved')).toBe(true);
  });

  it('does not let a publishing item be pulled back', () => {
    // The adapter is mid-flight by then; the item is no longer ours to revert.
    expect(canTransitionContentStatus('publishing', 'approved')).toBe(false);
    expect(canTransitionVariantStatus('publishing', 'approved')).toBe(false);
  });

  it('allows a queued job to be cancelled', () => {
    expect(canTransitionJobStatus('queued', 'cancelled')).toBe(true);
    expect(canTransitionJobStatus('retrying', 'cancelled')).toBe(true);
  });

  it('does not allow a succeeded job to be cancelled', () => {
    expect(canTransitionJobStatus('succeeded', 'cancelled')).toBe(false);
  });
});
