import { describe, expect, it, vi } from 'vitest';
import { TikTokPlatformAdapter } from './tiktok-adapter';

function request(overrides: Record<string, unknown> = {}) {
  return {
    jobId: 'job-tt-1',
    variantId: 'variant-tt-1',
    platform: 'tiktok' as const,
    caption: 'A MuviDB TikTok video post',
    assetUrl: 'https://cdn.example.com/video.mp4',
    scheduledFor: new Date().toISOString(),
    ...overrides,
  };
}

describe('TikTokPlatformAdapter', () => {
  it('publishes video pull request to TikTok API', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        privacy_level_options: ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'],
        comment_disabled: false,
        duet_disabled: false,
        stitch_disabled: false,
      } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { publish_id: 'tt_pub_123' } }), { status: 200 }));

    const adapter = new TikTokPlatformAdapter({
      accessToken: 'tt-token',
      fetchImpl,
    });

    const result = await adapter.publish(request());

    expect(result.externalPostId).toBe('tt_pub_123');
    expect(result.platform).toBe('tiktok');
    expect(result.variantStatus).toBe('published');

    expect(fetchImpl.mock.calls[0][0]).toContain('/creator_info/query/');
    expect(fetchImpl.mock.calls[1][0]).toContain('/video/init/');
    const headers = fetchImpl.mock.calls[1][1].headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer tt-token');
  });

  it('uploads photo post as draft', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { publish_id: 'tt_photo_456' } }), { status: 200 })
    );

    const adapter = new TikTokPlatformAdapter({
      accessToken: 'tt-token',
      fetchImpl,
    });

    const result = await adapter.publish(request({
      assetUrl: 'https://cdn.example.com/card.png',
      options: { tiktok: { post_mode: 'MEDIA_UPLOAD' } },
    }));

    expect(result.externalPostId).toBe('tt_photo_456');
    expect(result.variantStatus).toBe('uploaded_as_draft');
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body as string);
    expect(body.post_mode).toBe('MEDIA_UPLOAD');
  });

  it('uses the full photo-carousel controls for direct posts', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        privacy_level_options: ['SELF_ONLY'],
        comment_disabled: true,
      } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { publish_id: 'tt_carousel_1' } }), { status: 200 }));
    const adapter = new TikTokPlatformAdapter({ accessToken: 'tt-token', fetchImpl });

    await adapter.publish(request({
      assetUrl: 'https://cdn.example.com/one.jpg',
      assetUrls: ['https://cdn.example.com/one.jpg', 'https://cdn.example.com/two.jpg'],
      title: 'Carousel title',
      options: { tiktok: {
        privacy_level: 'PUBLIC_TO_EVERYONE',
        photo_cover_index: 1,
        auto_add_music: true,
        brand_organic_toggle: true,
      } },
    }));

    const body = JSON.parse(fetchImpl.mock.calls[1][1].body as string);
    expect(body.source_info.photo_images).toHaveLength(2);
    expect(body.source_info.photo_cover_index).toBe(1);
    expect(body.post_info.privacy_level).toBe('SELF_ONLY');
    expect(body.post_info.disable_comment).toBe(true);
    expect(body.post_info.auto_add_music).toBe(true);
    expect(body.post_info.brand_organic_toggle).toBe(true);
  });
});
