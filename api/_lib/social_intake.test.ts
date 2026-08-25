import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  rows: [] as any[],
  current: null as any,
}));

vi.mock('./supabase.js', () => ({
  supabase: {
    from: vi.fn(() => {
      const chain: any = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        order: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        maybeSingle: vi.fn(async () => ({ data: state.current, error: null })),
        then: (resolve: (value: unknown) => void) => resolve({ data: state.rows, error: null }),
      };
      return chain;
    }),
  },
}));

import { approveSocialIntake, listSocialIntake } from './social_intake.js';

describe('Telegram social intake workflow', () => {
  beforeEach(() => {
    state.rows = [];
    state.current = null;
  });

  it('normalizes legacy Telegram events into received intake items', async () => {
    state.rows = [{
      id: 'event-1',
      event_type: 'youtube_video',
      source_type: 'telegram_bot',
      status: 'new',
      title: 'Forwarded Short',
      detected_at: '2026-08-25T12:00:00.000Z',
      metadata: { image_url: 'https://example.test/thumb.jpg' },
    }];

    const result = await listSocialIntake();
    expect(result[0]).toMatchObject({
      id: 'event-1',
      intake_kind: 'unclassified',
      workflow_status: 'received',
      extracted_payload: {},
    });
  });

  it('does not publish an incomplete film merely because an admin clicked approve', async () => {
    state.current = {
      id: 'event-2',
      event_type: 'movie_announcement',
      source_type: 'telegram_bot',
      source_url: 'https://youtube.com/shorts/test',
      title: 'Example Film',
      description: 'Too short',
      metadata: {
        intake_kind: 'film',
        workflow_status: 'needs_review',
        extracted_payload: { title: 'Example Film', synopsis: 'Too short' },
      },
    };

    await expect(approveSocialIntake({ intakeId: 'event-2' }, 'admin-1'))
      .rejects.toThrow('proper synopsis');
  });
});
