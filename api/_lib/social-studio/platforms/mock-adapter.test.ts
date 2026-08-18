import { describe, expect, it } from 'vitest';
import { MockSocialPlatformAdapter } from './mock-adapter';
import { SocialPlatformError } from './platform-errors';

const baseRequest = {
  jobId: '11111111-1111-4111-8111-111111111111',
  variantId: '22222222-2222-4222-8222-222222222222',
  platform: 'instagram' as const,
  caption: 'A safe MuviDB test caption',
  title: null,
  assetUrl: 'https://muvidb.com/test.webp',
  scheduledFor: '2026-08-01T10:00:00.000Z',
};

describe('MockSocialPlatformAdapter', () => {
  it('returns a deterministic mock published result', async () => {
    const result = await new MockSocialPlatformAdapter().publish(baseRequest);

    expect(result.variantStatus).toBe('published');
    expect(result.externalPostId).toBe('mock_instagram_222222222222');
    expect(result.externalPermalink).toContain('/admin/social/mock/instagram/');
    expect(result.providerResponse.mode).toBe('mock');
  });

  it('marks TikTok as uploaded as draft', async () => {
    const result = await new MockSocialPlatformAdapter().publish({
      ...baseRequest,
      platform: 'tiktok',
    });

    expect(result.variantStatus).toBe('uploaded_as_draft');
    expect(result.externalPermalink).toBeNull();
  });

  it('can simulate retryable and permanent provider errors', async () => {
    const adapter = new MockSocialPlatformAdapter();

    await expect(adapter.publish({ ...baseRequest, caption: '[mock-retry]' })).rejects.toMatchObject({
      code: 'mock_retryable_failure',
      retryable: true,
    });

    await expect(adapter.publish({ ...baseRequest, caption: '[mock-fail]' })).rejects.toBeInstanceOf(SocialPlatformError);
    await expect(adapter.publish({ ...baseRequest, caption: '[mock-fail]' })).rejects.toMatchObject({
      code: 'mock_permanent_failure',
      retryable: false,
    });
  });
});
