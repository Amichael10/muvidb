import type { SocialPlatformAdapter, SocialPublishRequest, SocialPublishResult } from './social-platform-adapter.js';
import { SocialPlatformError } from './platform-errors.js';

export type LinkedInAdapterOptions = {
  accessToken: string;
  authorUrn: string; // e.g. "urn:li:organization:12345" or "urn:li:person:67890"
  apiVersion?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

type LinkedInApiError = {
  message?: string;
  status?: number;
  serviceErrorCode?: number;
};

function errorFromResponse(status: number, payload: LinkedInApiError, fallback: string): SocialPlatformError {
  const message = payload.message || fallback;
  const reconnectRequired = status === 401 || status === 403;
  return new SocialPlatformError({
    platform: 'linkedin',
    code: reconnectRequired ? 'linkedin_reconnect_required' : `linkedin_http_${status}`,
    message,
    retryable: status === 429 || status >= 500,
    reconnectRequired,
    details: {
      status,
      serviceErrorCode: payload.serviceErrorCode,
      message: payload.message,
    },
  });
}

/**
 * LinkedIn Platform Adapter.
 *
 * Utilizes the official LinkedIn Posts API (`POST /rest/posts`) to publish updates.
 * Supports:
 * - 100% Free publishing for both Personal Profiles and Company Pages.
 * - Text commentary with automated link previews (using MuviDB's Open Graph backdrops).
 * - Article cards with custom titles and thumbnail previews.
 */
export class LinkedInPlatformAdapter implements SocialPlatformAdapter {
  private readonly accessToken: string;
  private readonly authorUrn: string;
  private readonly apiVersion: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: LinkedInAdapterOptions) {
    this.accessToken = options.accessToken;
    this.authorUrn = options.authorUrn.startsWith('urn:li:')
      ? options.authorUrn
      : `urn:li:organization:${options.authorUrn}`;
    this.apiVersion = options.apiVersion || '202601';
    this.baseUrl = options.baseUrl || 'https://api.linkedin.com/rest';
    this.fetchImpl = options.fetchImpl || fetch;
  }

  async publish(request: SocialPublishRequest): Promise<SocialPublishResult> {
    const commentary = String(request.caption || '').trim();
    if (!commentary) {
      throw new SocialPlatformError({
        platform: 'linkedin',
        code: 'linkedin_empty_text',
        message: 'Cannot publish a LinkedIn post without text commentary.',
        retryable: false,
      });
    }

    // Extract optional link URL from options or caption
    const articleUrl = (request.options?.articleUrl as string) ||
      commentary.match(/https?:\/\/[^\s]+/)?.[0] || null;

    const payload: Record<string, any> = {
      author: this.authorUrn,
      commentary,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
    };

    // If an article URL is provided, configure the article card content block
    if (articleUrl) {
      payload.content = {
        article: {
          source: articleUrl,
          title: request.title || undefined,
          description: request.caption?.slice(0, 200) || undefined,
        },
      };
    } else if (request.assetUrl) {
      // If a single image is provided directly via assetUrl
      payload.content = {
        media: {
          title: request.title || 'MuviDB Media',
          id: request.assetUrl,
        },
      };
    }

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'LinkedIn-Version': this.apiVersion,
          'X-Restli-Protocol-Version': '2.0.0',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(25_000),
      });
    } catch (err: any) {
      throw new SocialPlatformError({
        platform: 'linkedin',
        code: 'linkedin_network_error',
        message: 'LinkedIn API could not be reached. The post will be retried.',
        retryable: true,
        details: { cause: err?.message || 'network_error' },
      });
    }

    const restliId = response.headers.get('x-restli-id');
    const data = (await response.json().catch(() => ({}))) as LinkedInApiError & Record<string, any>;

    if (!response.ok && response.status !== 201) {
      throw errorFromResponse(response.status, data, 'LinkedIn rejected the post request.');
    }

    const postId = restliId || data.id || `urn:li:post:${Date.now()}`;
    const permalink = `https://www.linkedin.com/feed/update/${encodeURIComponent(postId)}/`;

    return {
      platform: 'linkedin',
      providerPublishId: postId,
      externalPostId: postId,
      externalPermalink: permalink,
      providerResponse: { ...data, restliId: postId },
      variantStatus: 'published',
    };
  }
}
