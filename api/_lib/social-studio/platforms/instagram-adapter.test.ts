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
  it('creates and publishes an image container with muvi_database as collaborator by default', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ig_container_1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status_code: 'FINISHED' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ig_media_1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ig_media_1', permalink: 'https://instagram.com/p/123' }), { status: 200 }));

    const adapter = new InstagramPlatformAdapter({
      accessToken: 'ig-secret-token',
      instagramAccountId: 'ig-user-1',
      accountUsername: 'muvidb_',
      fetchImpl,
      pollIntervalMs: 10,
    });

    const result = await adapter.publish(request());

    expect(result.externalPostId).toBe('ig_media_1');
    expect(result.externalPermalink).toBe('https://instagram.com/p/123');
    expect(result.platform).toBe('instagram');
    expect(JSON.stringify(result)).not.toContain('ig-secret-token');

    const containerBody = fetchImpl.mock.calls[0][1].body as URLSearchParams;
    expect(containerBody.get('image_url')).toBe('https://cdn.example.com/poster.png');
    expect(containerBody.get('caption')).toBe('A MuviDB Instagram test post');
    expect(containerBody.get('collaborators')).toBe('["muvi_database"]');
  });

  it('does not invite muvi_database as collaborator if posting from muvi_database', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ig_container_1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status_code: 'FINISHED' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ig_media_1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ig_media_1', permalink: 'https://instagram.com/p/123' }), { status: 200 }));

    const adapter = new InstagramPlatformAdapter({
      accessToken: 'ig-secret-token',
      instagramAccountId: 'ig-user-2',
      accountUsername: 'muvi_database',
      fetchImpl,
      pollIntervalMs: 10,
    });

    await adapter.publish(request());

    const containerBody = fetchImpl.mock.calls[0][1].body as URLSearchParams;
    expect(containerBody.get('collaborators')).toBeNull();
  });

  it('handles reel / video publishing with collaborator and container status check', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ig_container_video' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status_code: 'FINISHED' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ig_reel_1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ig_reel_1', permalink: 'https://instagram.com/reel/123' }), { status: 200 }));

    const adapter = new InstagramPlatformAdapter({
      accessToken: 'token',
      instagramAccountId: 'ig-user-1',
      accountUsername: 'muvidb_',
      fetchImpl,
      pollIntervalMs: 10,
    });

    const result = await adapter.publish(request({ assetUrl: 'https://cdn.example.com/trailer.mp4' }));

    expect(result.externalPostId).toBe('ig_reel_1');
    expect(result.externalPermalink).toBe('https://instagram.com/reel/123');
    const containerBody = fetchImpl.mock.calls[0][1].body as URLSearchParams;
    expect(containerBody.get('media_type')).toBe('REELS');
    expect(containerBody.get('video_url')).toBe('https://cdn.example.com/trailer.mp4');
    expect(containerBody.get('collaborators')).toBe('["muvi_database"]');
  });

  it('publishes ordered images as one carousel and attaches collaborator to parent', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'child_1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'child_2' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'carousel_1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status_code: 'FINISHED' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'media_1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ permalink: 'https://instagram.com/p/carousel' }), { status: 200 }));
    const adapter = new InstagramPlatformAdapter({
      accessToken: 'token',
      instagramAccountId: 'ig-user-1',
      accountUsername: 'muvidb_',
      fetchImpl,
      pollIntervalMs: 10,
    });

    const result = await adapter.publish(request({
      assetUrls: ['https://cdn.example.com/one.jpg', 'https://cdn.example.com/two.jpg'],
    }));

    expect(result.externalPostId).toBe('media_1');
    expect((fetchImpl.mock.calls[0][1].body as URLSearchParams).get('is_carousel_item')).toBe('true');
    expect((fetchImpl.mock.calls[1][1].body as URLSearchParams).get('image_url')).toBe('https://cdn.example.com/two.jpg');
    const parentBody = fetchImpl.mock.calls[2][1].body as URLSearchParams;
    expect(parentBody.get('media_type')).toBe('CAROUSEL');
    expect(parentBody.get('children')).toBe('child_1,child_2');
    expect(parentBody.get('caption')).toBe('A MuviDB Instagram test post');
    expect(parentBody.get('collaborators')).toBe('["muvi_database"]');
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

  it('retries without collaborators if Instagram rejects the collaborator tag', async () => {
    const fetchImpl = vi.fn()
      // First attempt with collaborators fails
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { message: 'Invalid collaborator account', code: 100 }
      }), { status: 400 }))
      // Second attempt without collaborators succeeds
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ig_container_fallback' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status_code: 'FINISHED' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ig_media_fallback' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ig_media_fallback', permalink: 'https://instagram.com/p/fallback' }), { status: 200 }));

    const adapter = new InstagramPlatformAdapter({
      accessToken: 'token',
      instagramAccountId: 'ig-user-1',
      accountUsername: 'muvidb_',
      fetchImpl,
      pollIntervalMs: 10,
    });

    const result = await adapter.publish(request());

    expect(result.externalPostId).toBe('ig_media_fallback');
    // First call had collaborators
    expect((fetchImpl.mock.calls[0][1].body as URLSearchParams).get('collaborators')).toBe('["muvi_database"]');
    // Second call retried without collaborators
    expect((fetchImpl.mock.calls[1][1].body as URLSearchParams).get('collaborators')).toBeNull();
  });

  it('retries without cover_url if Instagram rejects the cover image', async () => {
    const fetchImpl = vi.fn()
      // First attempt with cover_url fails
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { message: 'Invalid cover image format', code: 100 }
      }), { status: 400 }))
      // Second attempt without cover_url (and without collaborators if needed, or retry succeeds)
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ig_container_fallback' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status_code: 'FINISHED' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ig_reel_fallback' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ig_reel_fallback', permalink: 'https://instagram.com/reel/fallback' }), { status: 200 }));

    const adapter = new InstagramPlatformAdapter({
      accessToken: 'token',
      instagramAccountId: 'ig-user-1',
      accountUsername: 'muvidb_',
      fetchImpl,
      pollIntervalMs: 10,
    });

    const result = await adapter.publish(request({
      assetUrl: 'https://cdn.example.com/trailer.mp4',
      options: { cover_url: 'https://cdn.example.com/bad_cover.jpg' },
    }));

    expect(result.externalPostId).toBe('ig_reel_fallback');
    expect(result.externalPermalink).toBe('https://instagram.com/reel/fallback');
  });
});
