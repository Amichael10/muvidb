import type { SocialPlatformAdapter, SocialPublishRequest, SocialPublishResult } from './social-platform-adapter.js';
import { SocialPlatformError } from './platform-errors.js';

function suffix(id: string): string {
  return id.replace(/-/g, '').slice(0, 12);
}

export class MockSocialPlatformAdapter implements SocialPlatformAdapter {
  async publish(request: SocialPublishRequest): Promise<SocialPublishResult> {
    if (request.caption.includes('[mock-retry]')) {
      throw new SocialPlatformError({
        platform: request.platform,
        code: 'mock_retryable_failure',
        message: `${request.platform} mock publish asked to retry.`,
        retryable: true,
      });
    }

    if (request.caption.includes('[mock-fail]')) {
      throw new SocialPlatformError({
        platform: request.platform,
        code: 'mock_permanent_failure',
        message: `${request.platform} mock publish failed permanently.`,
      });
    }

    const externalPostId = `mock_${request.platform}_${suffix(request.variantId)}`;
    const variantStatus = request.platform === 'tiktok' ? 'uploaded_as_draft' : 'published';

    return {
      platform: request.platform,
      providerPublishId: `mock_publish_${suffix(request.jobId)}`,
      externalPostId,
      externalPermalink:
        request.platform === 'tiktok'
          ? null
          : `https://muvidb.com/admin/social/mock/${request.platform}/${externalPostId}`,
      providerResponse: {
        mode: 'mock',
        job_id: request.jobId,
        variant_id: request.variantId,
        asset_url: request.assetUrl ?? null,
        asset_urls: request.assetUrls ?? (request.assetUrl ? [request.assetUrl] : []),
        accepted_at: new Date().toISOString(),
      },
      variantStatus,
    };
  }
}
