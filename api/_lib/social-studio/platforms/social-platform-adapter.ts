import type { SocialPlatform } from '../domain/platform-types.js';
import type { SocialVariantStatus } from '../domain/statuses.js';

export type SocialPublishRequest = {
  jobId: string;
  variantId: string;
  platform: SocialPlatform;
  caption: string;
  title?: string | null;
  assetUrl?: string | null;
  assetUrls?: string[];
  scheduledFor: string;
  options?: Record<string, unknown> | null;
  sourceSnapshot?: unknown;
};

export type SocialPublishResult = {
  platform: SocialPlatform;
  providerPublishId: string;
  externalPostId: string;
  externalPermalink: string | null;
  providerResponse: Record<string, unknown>;
  variantStatus: Extract<SocialVariantStatus, 'publishing' | 'published' | 'uploaded_as_draft'>;
};

export interface SocialPlatformAdapter {
  publish(request: SocialPublishRequest): Promise<SocialPublishResult>;
}
