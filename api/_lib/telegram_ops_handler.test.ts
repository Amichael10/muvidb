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
vi.mock('./facebook_downloader.js', () => ({
  extractFacebookMedia: vi.fn(async (url: string) => {
    const isReel = url.includes('/reel') || url.includes('/share/r/');
    return {
      isReel,
      isVideo: isReel || url.includes('/watch') || url.includes('/videos/'),
      videoUrl: isReel ? 'https://facebook.com/reel.mp4' : null,
      imageUrl: 'https://facebook.com/thumb.jpg',
      caption: 'Awesome Nollywood film teaser on Facebook',
      authorName: 'EbonyLife Films',
      title: 'EbonyLife Films on Facebook',
    };
  }),
}));
vi.mock('./threads_downloader.js', () => ({
  extractThreadsMedia: vi.fn(async (_url: string) => ({
    shortcode: 'DFk123',
    isReel: false,
    isVideo: false,
    videoUrl: null,
    imageUrl: 'https://threads.net/image.jpg',
    caption: 'Big cinema announcement today on Threads!',
    authorName: 'Jade Osiberu',
    authorUsername: 'jadeosiberu',
    title: 'Jade Osiberu on Threads',
  })),
}));

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

  it('turns a forwarded Facebook Reel into a facebook_reel intake with playable video', async () => {
    const req: any = {
      method: 'POST',
      headers: {},
      body: {
        message: {
          message_id: 88,
          chat: { id: 123 },
          from: { username: 'admin' },
          text: 'Check this out: (https://www.facebook.com/share/r/abc123xyz/)',
        },
      },
    };
    const res = response();
    await handleTelegramOps(req, res);

    expect(res.body).toEqual({ ok: true });
    expect(inserted[0]).toMatchObject({
      event_type: 'facebook_reel',
      source_type: 'telegram_bot',
      source_url: 'https://www.facebook.com/share/r/abc123xyz/',
      metadata: expect.objectContaining({
        intake_kind: 'unclassified',
        workflow_status: 'received',
        author_name: 'EbonyLife Films',
        video_url: 'https://facebook.com/reel.mp4',
      }),
    });
    // Video was sent because videoUrl exists
    expect(telegram.video).toHaveBeenCalled();
    const keyboard = telegram.video.mock.calls[0][0].replyMarkup.inline_keyboard.flat();
    expect(keyboard).toEqual(expect.arrayContaining([
      expect.objectContaining({ callback_data: 'intake_download:event-uuid' }),
      expect.objectContaining({ callback_data: 'intake_draft:event-uuid' }),
      expect.objectContaining({ callback_data: 'intake_film:event-uuid' }),
    ]));
  });

  it('turns a forwarded Threads post from message entity into a threads_post intake', async () => {
    const req: any = {
      method: 'POST',
      headers: {},
      body: {
        message: {
          message_id: 99,
          chat: { id: 123 },
          from: { username: 'admin' },
          text: 'Forwarded post from Threads',
          entities: [
            {
              type: 'text_link',
              offset: 0,
              length: 14,
              url: 'https://www.threads.net/@jadeosiberu/post/DFk123?xmt=AQG1',
            },
          ],
        },
      },
    };
    const res = response();
    await handleTelegramOps(req, res);

    expect(res.body).toEqual({ ok: true });
    expect(inserted[0]).toMatchObject({
      event_type: 'threads_post',
      source_type: 'telegram_bot',
      source_url: 'https://www.threads.net/@jadeosiberu/post/DFk123?xmt=AQG1',
      metadata: expect.objectContaining({
        intake_kind: 'unclassified',
        workflow_status: 'received',
        author_name: 'Jade Osiberu',
        image_url: 'https://threads.net/image.jpg',
      }),
    });
    // Photo was sent because imageUrl exists
    expect(telegram.photo).toHaveBeenCalled();
    const keyboard = telegram.photo.mock.calls[0][0].replyMarkup.inline_keyboard.flat();
    expect(keyboard).toEqual(expect.arrayContaining([
      expect.objectContaining({ callback_data: 'intake_draft:event-uuid' }),
      expect.objectContaining({ callback_data: 'intake_news:event-uuid' }),
    ]));
  });
});

