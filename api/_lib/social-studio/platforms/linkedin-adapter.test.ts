import { describe, expect, it, vi } from 'vitest';
import { LinkedInPlatformAdapter } from './linkedin-adapter';

function request(overrides: Record<string, unknown> = {}) {
  return {
    jobId: 'job-li-1',
    variantId: 'variant-li-1',
    platform: 'linkedin' as any,
    caption: 'Discover Nigerian cinema heritage on MuviDB: https://muvidb.com/films/agogo-ewo',
    scheduledFor: new Date().toISOString(),
    ...overrides,
  };
}

describe('LinkedInPlatformAdapter', () => {
  it('publishes a post with an article link card', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'urn:li:share:987654321' }), {
        status: 201,
        headers: {
          'x-restli-id': 'urn:li:share:987654321',
          'Content-Type': 'application/json',
        },
      })
    );

    const adapter = new LinkedInPlatformAdapter({
      accessToken: 'li-access-token',
      authorUrn: 'urn:li:organization:123456',
      fetchImpl,
    });

    const result = await adapter.publish(request({ title: 'Agogo Ewo on MuviDB' }));

    expect(result.platform).toBe('linkedin');
    expect(result.externalPostId).toBe('urn:li:share:987654321');
    expect(result.externalPermalink).toBe('https://www.linkedin.com/feed/update/urn%3Ali%3Ashare%3A987654321/');
    expect(result.variantStatus).toBe('published');

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.linkedin.com/rest/posts');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer li-access-token');

    const body = JSON.parse(init.body as string);
    expect(body.author).toBe('urn:li:organization:123456');
    expect(body.content?.article?.source).toBe('https://muvidb.com/films/agogo-ewo');
  });

  it('rejects an empty post commentary', async () => {
    const adapter = new LinkedInPlatformAdapter({
      accessToken: 'li-access-token',
      authorUrn: 'urn:li:person:123',
    });
    await expect(adapter.publish(request({ caption: '' }))).rejects.toThrow('Cannot publish a LinkedIn post without text commentary');
  });

  it('identifies 401 unauthorized as reconnect required', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Expired access token', status: 401 }), { status: 401 })
    );

    const adapter = new LinkedInPlatformAdapter({
      accessToken: 'bad-token',
      authorUrn: 'urn:li:person:123',
      fetchImpl,
    });

    await expect(adapter.publish(request())).rejects.toMatchObject({
      reconnectRequired: true,
      platform: 'linkedin',
    });
  });
});
