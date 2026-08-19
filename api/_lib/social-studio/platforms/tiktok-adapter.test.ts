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
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { publish_id: 'tt_pub_123' } }), { status: 200 })
    );

    const adapter = new TikTokPlatformAdapter({
      accessToken: 'tt-token',
      fetchImpl,
    });

    const result = await adapter.publish(request());

    expect(result.externalPostId).toBe('tt_pub_123');
    expect(result.platform).toBe('tiktok');
    expect(result.variantStatus).toBe('published');

    const headers = fetchImpl.mock.calls[0][1].headers as Record<string, string>;
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

    const result = await adapter.publish(request({ assetUrl: 'https://cdn.example.com/card.png' }));

    expect(result.externalPostId).toBe('tt_photo_456');
    expect(result.variantStatus).toBe('uploaded_as_draft');
  });
});
