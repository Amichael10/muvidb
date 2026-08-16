import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendTelegramMock = vi.hoisted(() => vi.fn());
const updates = vi.hoisted(() => [] as Array<Record<string, unknown>>);

vi.mock('./telegram.js', () => ({
  telegramConfigured: () => true,
  sendTelegramMessage: sendTelegramMock,
}));

vi.mock('./supabase.js', () => ({
  supabase: {
    from: vi.fn(() => {
      const chain: any = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        is: vi.fn(() => chain),
        update: vi.fn((patch: Record<string, unknown>) => {
          updates.push(patch);
          return chain;
        }),
        single: vi.fn(async () => ({
          data: {
            id: '9af5e5b8-fdbb-4571-843d-32c3fbb3e7ff',
            user_id: 'user-id',
            person_id: 'person-id',
            status: 'pending',
            verification_status: 'awaiting_contact',
            verification_code: '759933',
            social_platform: 'instagram',
            social_handle: '@amichael.design',
            social_url: 'https://instagram.com/amichael.design',
            created_at: '2026-08-16T19:00:44.792Z',
            telegram_notified_at: null,
            claimant: { name: 'Adewale Michael', email: 'mychlewhale10@gmail.com' },
            people: { name: 'End To End Test', slug: 'end-to-end-test' },
          },
          error: null,
        })),
        maybeSingle: vi.fn(async () => ({ data: { id: 'claim-id' }, error: null })),
      };
      return chain;
    }),
  },
}));

import { notifyActorClaimSubmission } from './actor_claim_notify.js';

describe('actor claim Telegram notification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updates.length = 0;
    sendTelegramMock.mockResolvedValue({ ok: true, messageId: 321 });
  });

  it('sends the requested claim details with review and social CTAs', async () => {
    const result = await notifyActorClaimSubmission('9af5e5b8-fdbb-4571-843d-32c3fbb3e7ff', { expectedUserId: 'user-id' });

    expect(result).toEqual({ ok: true, skipped: false, messageId: 321 });
    expect(sendTelegramMock).toHaveBeenCalledWith({
      text: [
        '🎭 New actor profile claim',
        'Actor: End To End Test',
        'Claimant: Adewale Michael',
        'Email: mychlewhale10@gmail.com',
        'Social: @amichael.design on instagram',
        'Reference: 9AF5E5B8',
        'Verification code: 759933',
        'Submitted: 2026-08-16T19:00:44.792Z',
      ].join('\n'),
      replyMarkup: {
        inline_keyboard: [
          [{ text: 'Review claim', url: 'https://muvidb.com/admin/claims' }],
          [{ text: 'Open social account', url: 'https://instagram.com/amichael.design' }],
        ],
      },
    });
    expect(updates).toContainEqual(expect.objectContaining({ telegram_notified_at: expect.any(String) }));
  });
});
