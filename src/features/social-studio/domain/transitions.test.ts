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
