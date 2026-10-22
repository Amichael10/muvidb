import { describe, expect, it, vi } from 'vitest';
import { FacebookPlatformAdapter } from './facebook-adapter';

function request(overrides: Record<string, unknown> = {}) {
  return {
    jobId: 'job-fb-1',
    variantId: 'variant-fb-1',
    platform: 'facebook' as const,
    caption: 'A MuviDB Facebook post',
    scheduledFor: new Date().toISOString(),
    ...overrides,
  };
}

describe('FacebookPlatformAdapter', () => {
  it('publishes a photo post to a Facebook Page', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'photo_1', post_id: 'page_post_1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'page_post_1', permalink_url: 'https://facebook.com/page/posts/1' }), { status: 200 }));

    const adapter = new FacebookPlatformAdapter({
      accessToken: 'fb-token',
      pageId: 'page_123',
      fetchImpl,
    });

    const result = await adapter.publish(request({ assetUrl: 'https://cdn.example.com/poster.png' }));

    expect(result.externalPostId).toBe('page_post_1');
    expect(result.externalPermalink).toBe('https://facebook.com/page/posts/1');
    expect(result.platform).toBe('facebook');

    const body = fetchImpl.mock.calls[0][1].body as URLSearchParams;
    expect(body.get('url')).toBe('https://cdn.example.com/poster.png');
    expect(body.get('caption')).toBe('A MuviDB Facebook post');
  });

  it('publishes a text feed post to a Facebook Page when no asset is provided', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'feed_post_1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'feed_post_1', permalink_url: 'https://facebook.com/page/posts/2' }), { status: 200 }));

    const adapter = new FacebookPlatformAdapter({
      accessToken: 'fb-token',
      pageId: 'page_123',
      fetchImpl,
    });

    const result = await adapter.publish(request());

    expect(result.externalPostId).toBe('feed_post_1');
    expect(result.externalPermalink).toBe('https://facebook.com/page/posts/2');
    const body = fetchImpl.mock.calls[0][1].body as URLSearchParams;
    expect(body.get('message')).toBe('A MuviDB Facebook post');
  });

  it('publishes multiple photos as one Facebook feed post', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'photo_1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'photo_2' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'page_post_1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ permalink_url: 'https://facebook.com/page/posts/carousel' }), { status: 200 }));
    const adapter = new FacebookPlatformAdapter({ accessToken: 'fb-token', pageId: 'page_123', fetchImpl });

    const result = await adapter.publish(request({
      assetUrls: ['https://cdn.example.com/one.jpg', 'https://cdn.example.com/two.jpg'],
    }));

    expect(result.externalPostId).toBe('page_post_1');
    expect((fetchImpl.mock.calls[0][1].body as URLSearchParams).get('published')).toBe('false');
    const feedBody = fetchImpl.mock.calls[2][1].body as URLSearchParams;
    expect(feedBody.get('message')).toBe('A MuviDB Facebook post');
    expect(feedBody.get('attached_media[0]')).toBe(JSON.stringify({ media_fbid: 'photo_1' }));
    expect(feedBody.get('attached_media[1]')).toBe(JSON.stringify({ media_fbid: 'photo_2' }));
  });
});
