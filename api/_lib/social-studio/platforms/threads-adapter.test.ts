import { describe, expect, it, vi } from 'vitest';
import { ThreadsPlatformAdapter } from './threads-adapter';

function request(overrides: Record<string, unknown> = {}) {
  return {
    jobId: 'job-1',
    variantId: 'variant-1',
    platform: 'threads' as const,
    caption: 'A MuviDB test post',
    scheduledFor: new Date().toISOString(),
    ...overrides,
  };
}

describe('ThreadsPlatformAdapter', () => {
  it('creates and publishes a text post without leaking the token in its result', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'container-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'post-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'post-1', permalink: 'https://threads.net/@muvidb/post/1' }), { status: 200 }));
    const adapter = new ThreadsPlatformAdapter({ accessToken: 'secret-token', userId: 'user-1', fetchImpl });

    const result = await adapter.publish(request());

    expect(result.externalPostId).toBe('post-1');
    expect(result.externalPermalink).toBe('https://threads.net/@muvidb/post/1');
    expect(JSON.stringify(result)).not.toContain('secret-token');
    const createBody = fetchImpl.mock.calls[0][1].body as URLSearchParams;
    expect(createBody.get('media_type')).toBe('TEXT');
    expect(createBody.get('text')).toBe('A MuviDB test post');
  });

  it('uses the public asset URL for an image post', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'container-2' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'post-2' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'post-2' }), { status: 200 }));
    const adapter = new ThreadsPlatformAdapter({ accessToken: 'token', userId: 'user-1', fetchImpl });

    await adapter.publish(request({ assetUrl: 'https://cdn.example.com/post.jpg' }));

    const createBody = fetchImpl.mock.calls[0][1].body as URLSearchParams;
    expect(createBody.get('media_type')).toBe('IMAGE');
    expect(createBody.get('image_url')).toBe('https://cdn.example.com/post.jpg');
  });

  it('publishes multiple images through a carousel container', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'child-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'child-2' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'carousel-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'FINISHED' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'post-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ permalink: 'https://threads.net/@muvidb/post/carousel' }), { status: 200 }));
    const adapter = new ThreadsPlatformAdapter({ accessToken: 'token', userId: 'user-1', fetchImpl });

    await adapter.publish(request({
      assetUrls: ['https://cdn.example.com/one.jpg', 'https://cdn.example.com/two.jpg'],
    }));

    expect((fetchImpl.mock.calls[0][1].body as URLSearchParams).get('is_carousel_item')).toBe('true');
    const parentBody = fetchImpl.mock.calls[2][1].body as URLSearchParams;
    expect(parentBody.get('media_type')).toBe('CAROUSEL');
    expect(parentBody.get('children')).toBe('child-1,child-2');
    expect(parentBody.get('text')).toBe('A MuviDB test post');
  });

  it('marks rate limits as retryable', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Slow down', code: 4 } }), { status: 429 }),
    );
    const adapter = new ThreadsPlatformAdapter({ accessToken: 'token', userId: 'user-1', fetchImpl });

    await expect(adapter.publish(request())).rejects.toMatchObject({
      code: 'threads_http_429',
      retryable: true,
    });
  });

  it('requires reconnection when Meta rejects the token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Invalid token', code: 190 } }), { status: 401 }),
    );
    const adapter = new ThreadsPlatformAdapter({ accessToken: 'token', userId: 'user-1', fetchImpl });

    await expect(adapter.publish(request())).rejects.toMatchObject({
      code: 'threads_reconnect_required',
      reconnectRequired: true,
    });
  });

  it('does not automatically retry an ambiguous publish response', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'container-3' }), { status: 200 }))
      .mockRejectedValueOnce(new Error('connection reset'));
    const adapter = new ThreadsPlatformAdapter({ accessToken: 'token', userId: 'user-1', fetchImpl });

    await expect(adapter.publish(request())).rejects.toMatchObject({
      code: 'threads_publish_result_unknown',
      retryable: false,
    });
  });
});
