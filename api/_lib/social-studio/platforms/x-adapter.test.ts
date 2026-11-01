import { describe, expect, it, vi } from 'vitest';
import { XPlatformAdapter } from './x-adapter';

function request(overrides: Record<string, unknown> = {}) {
  return {
    jobId: 'job-x-1',
    variantId: 'variant-x-1',
    platform: 'x' as const,
    caption: 'Now showing: Agogo Ewo https://muvidb.com/films/agogo-ewo',
    scheduledFor: new Date().toISOString(),
    ...overrides,
  };
}

describe('XPlatformAdapter', () => {
  it('publishes a tweet with URL for free Twitter Card rendering', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: '17934000111222', text: 'Tweet content' } }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const adapter = new XPlatformAdapter({
      accessToken: 'x-bearer-token',
      fetchImpl,
    });

    const result = await adapter.publish(request());

    expect(result.platform).toBe('x');
    expect(result.externalPostId).toBe('17934000111222');
    expect(result.externalPermalink).toBe('https://x.com/i/status/17934000111222');
    expect(result.variantStatus).toBe('published');

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.twitter.com/2/tweets');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer x-bearer-token');

    const body = JSON.parse(init.body as string);
    expect(body.text).toContain('https://muvidb.com/films/agogo-ewo');
  });

  it('rejects an empty caption', async () => {
    const adapter = new XPlatformAdapter({ accessToken: 'token' });
    await expect(adapter.publish(request({ caption: '' }))).rejects.toThrow('Cannot publish a tweet without text');
  });

  it('identifies 401/403 as reconnect required', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ title: 'Unauthorized', detail: 'Invalid token' }), { status: 401 })
    );

    const adapter = new XPlatformAdapter({ accessToken: 'bad-token', fetchImpl });
    await expect(adapter.publish(request())).rejects.toMatchObject({
      reconnectRequired: true,
      platform: 'x',
    });
  });
});
