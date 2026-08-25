import { beforeEach, describe, expect, it, vi } from 'vitest';

const telegram = vi.hoisted(() => ({
  message: vi.fn(),
  photo: vi.fn(),
  video: vi.fn(),
}));
const inserted = vi.hoisted(() => [] as any[]);

vi.mock('./telegram.js', () => ({
  answerTelegramCallback: vi.fn(),
  getTelegramFileUrl: vi.fn(),
  isAllowedOpsChat: () => true,
  sendTelegramMessage: telegram.message,
  sendTelegramPhoto: telegram.photo,
  sendTelegramVideo: telegram.video,
  telegramConfigured: () => true,
}));

vi.mock('./supabase.js', () => ({
  supabase: {
    from: vi.fn(() => {
      const chain: any = {
        insert: vi.fn((row: any) => { inserted.push(row); return chain; }),
        select: vi.fn(() => chain),
        single: vi.fn(async () => ({ data: { id: 'event-uuid' }, error: null })),
      };
      return chain;
    }),
  },
}));

vi.mock('./ip_blocklist.js', () => ({
  allowIp: vi.fn(), blockIp: vi.fn(), listAllowlistedIps: vi.fn(), listBlockedIps: vi.fn(), unallowIp: vi.fn(), unblockIp: vi.fn(),
}));
vi.mock('./scrape_guard.js', () => ({ recentHitsForIp: vi.fn(), topHitters: vi.fn() }));
vi.mock('./ai_service.js', () => ({ generateAIContent: vi.fn() }));
vi.mock('./instagram_downloader.js', () => ({ extractInstagramMedia: vi.fn() }));

import { handleTelegramOps } from './telegram_ops_handler.js';

function response() {
  const result: any = { statusCode: 200, body: null };
  result.status = vi.fn((code: number) => { result.statusCode = code; return result; });
  result.json = vi.fn((body: any) => { result.body = body; return result; });
  return result;
}

describe('Telegram content intake', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inserted.length = 0;
    telegram.photo.mockResolvedValue({ ok: true, messageId: 1 });
    telegram.message.mockResolvedValue({ ok: true, messageId: 1 });
    telegram.video.mockResolvedValue({ ok: true, messageId: 1 });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ title: 'Example Short', author_name: 'Example Channel', thumbnail_url: 'https://example.test/thumb.jpg' }),
    })));
  });

  it('turns a forwarded YouTube Short into one intake item with all approval actions', async () => {
    const req: any = {
      method: 'POST',
      headers: {},
      body: {
        message: {
          message_id: 77,
          chat: { id: 123 },
          from: { username: 'owner' },
          text: 'https://youtube.com/shorts/abc123',
        },
      },
    };
    const res = response();
    await handleTelegramOps(req, res);

    expect(res.body).toEqual({ ok: true });
    expect(inserted[0]).toMatchObject({
      event_type: 'youtube_video',
      source_type: 'telegram_bot',
      source_url: 'https://youtube.com/shorts/abc123',
      metadata: { intake_kind: 'unclassified', workflow_status: 'received' },
    });
    const keyboard = telegram.photo.mock.calls[0][0].replyMarkup.inline_keyboard.flat();
    expect(keyboard).toEqual(expect.arrayContaining([
      expect.objectContaining({ callback_data: 'intake_download:event-uuid' }),
      expect.objectContaining({ callback_data: 'intake_draft:event-uuid' }),
      expect.objectContaining({ callback_data: 'intake_film:event-uuid' }),
      expect.objectContaining({ callback_data: 'intake_review:event-uuid' }),
      expect.objectContaining({ callback_data: 'intake_credits:event-uuid' }),
      expect.objectContaining({ callback_data: 'intake_news:event-uuid' }),
      expect.objectContaining({ callback_data: 'intake_ignore:event-uuid' }),
    ]));
  });
});
