import { describe, expect, it, vi } from 'vitest';
import { InstagramPlatformAdapter } from './instagram-adapter';

function request(overrides: Record<string, unknown> = {}) {
  return {
    jobId: 'job-ig-1',
    variantId: 'variant-ig-1',
    platform: 'instagram' as const,
    caption: 'A MuviDB Instagram test post',
    assetUrl: 'https://cdn.example.com/poster.png',
    scheduledFor: new Date().toISOString(),
    ...overrides,
  };
}

describe('InstagramPlatformAdapter', () => {
  it('creates and publishes an image container without leaking token', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ig_container_1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ig_media_1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ig_media_1', permalink: 'https://instagram.com/p/123' }), { status: 200 }));

    const adapter = new InstagramPlatformAdapter({
      accessToken: 'ig-secret-token',
      instagramAccountId: 'ig-user-1',
      fetchImpl,
    });

    const result = await adapter.publish(request());

    expect(result.externalPostId).toBe('ig_media_1');
    expect(result.externalPermalink).toBe('https://instagram.com/p/123');
    expect(result.platform).toBe('instagram');
    expect(JSON.stringify(result)).not.toContain('ig-secret-token');

    const containerBody = fetchImpl.mock.calls[0][1].body as URLSearchParams;
    expect(containerBody.get('image_url')).toBe('https://cdn.example.com/poster.png');
    expect(containerBody.get('caption')).toBe('A MuviDB Instagram test post');
  });

  it('handles reel / video publishing with container status check', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ig_container_video' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status_code: 'FINISHED' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ig_reel_1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ig_reel_1', permalink: 'https://instagram.com/reel/123' }), { status: 200 }));

    const adapter = new InstagramPlatformAdapter({
      accessToken: 'token',
      instagramAccountId: 'ig-user-1',
      fetchImpl,
      pollIntervalMs: 10,
    });

    const result = await adapter.publish(request({ assetUrl: 'https://cdn.example.com/trailer.mp4' }));

    expect(result.externalPostId).toBe('ig_reel_1');
    expect(result.externalPermalink).toBe('https://instagram.com/reel/123');
    const containerBody = fetchImpl.mock.calls[0][1].body as URLSearchParams;
    expect(containerBody.get('media_type')).toBe('REELS');
    expect(containerBody.get('video_url')).toBe('https://cdn.example.com/trailer.mp4');
  });

  it('rejects requests without media asset', async () => {
    const adapter = new InstagramPlatformAdapter({
      accessToken: 'token',
      instagramAccountId: 'ig-user-1',
      fetchImpl: vi.fn(),
    });

    await expect(adapter.publish(request({ assetUrl: null }))).rejects.toMatchObject({
      code: 'instagram_media_required',
    });
  });
});
