import { createHmac, randomBytes } from 'node:crypto';
import type { SocialPlatformAdapter, SocialPublishRequest, SocialPublishResult } from './social-platform-adapter.js';
import { SocialPlatformError } from './platform-errors.js';

export type XAdapterOptions = {
  accessToken: string;
  accessTokenSecret?: string;
  apiKey?: string;
  apiSecret?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

type XApiError = {
  title?: string;
  detail?: string;
  type?: string;
  status?: number;
  errors?: Array<{ message?: string; code?: number }>;
};

function generateOAuth1Header(params: {
  method: string;
  url: string;
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: params.apiKey,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: params.accessToken,
    oauth_version: '1.0',
  };

  const paramString = Object.keys(oauthParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`)
    .join('&');

  const baseString = [
    params.method.toUpperCase(),
    encodeURIComponent(params.url),
    encodeURIComponent(paramString),
  ].join('&');

  const signingKey = `${encodeURIComponent(params.apiSecret)}&${encodeURIComponent(params.accessTokenSecret)}`;
  const signature = createHmac('sha1', signingKey).update(baseString).digest('base64');
  oauthParams.oauth_signature = signature;

  return 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ');
}

function errorFromResponse(status: number, payload: XApiError, fallback: string): SocialPlatformError {
  const message = payload.detail || payload.errors?.[0]?.message || payload.title || fallback;
  const reconnectRequired = status === 401 || status === 403;
  return new SocialPlatformError({
    platform: 'x',
    code: reconnectRequired ? 'x_reconnect_required' : `x_http_${status}`,
    message,
    retryable: status === 429 || status >= 500,
    reconnectRequired,
    details: {
      status,
      title: payload.title,
      detail: payload.detail,
      type: payload.type,
      errors: payload.errors,
    },
  });
}

/**
 * X (Twitter) Platform Adapter.
 *
 * Utilizes the Twitter API v2 (`POST /2/tweets`) to post updates.
 * Supports both OAuth 1.0a User Context and OAuth 2.0 User Context Bearer tokens.
 * Optimized for the Free API Tier: when a URL (e.g. https://muvidb.com/films/...)
 * is included in the tweet text, Twitter's crawler automatically extracts the
 * page's Open Graph / Twitter Card tags (`summary_large_image` and `backdrop_url`)
 * and renders a rich visual card at zero cost without requiring paid media upload tiers.
 */
export class XPlatformAdapter implements SocialPlatformAdapter {
  private readonly accessToken: string;
  private readonly accessTokenSecret?: string;
  private readonly apiKey?: string;
  private readonly apiSecret?: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: XAdapterOptions) {
    this.accessToken = options.accessToken;
    this.accessTokenSecret = options.accessTokenSecret;
    this.apiKey = options.apiKey;
    this.apiSecret = options.apiSecret;
    this.baseUrl = options.baseUrl || 'https://api.twitter.com/2';
    this.fetchImpl = options.fetchImpl || fetch;
  }

  async publish(request: SocialPublishRequest): Promise<SocialPublishResult> {
    const text = String(request.caption || '').trim();
    if (!text) {
      throw new SocialPlatformError({
        platform: 'x',
        code: 'x_empty_text',
        message: 'Cannot publish a tweet without text.',
        retryable: false,
      });
    }

    // Prepare JSON body for Twitter API v2 POST /2/tweets
    const payload: Record<string, any> = { text };

    // If options contain pre-uploaded media IDs (for users on basic/pro tiers with media upload)
    const mediaIds = (request.options?.mediaIds as string[]) || [];
    if (mediaIds.length > 0) {
      payload.media = { media_ids: mediaIds.slice(0, 4) };
    }

    const endpointUrl = `${this.baseUrl}/tweets`;
    let authHeader: string;
    if (this.apiKey && this.apiSecret && this.accessTokenSecret) {
      authHeader = generateOAuth1Header({
        method: 'POST',
        url: endpointUrl,
        apiKey: this.apiKey,
        apiSecret: this.apiSecret,
        accessToken: this.accessToken,
        accessTokenSecret: this.accessTokenSecret,
      });
    } else {
      authHeader = `Bearer ${this.accessToken}`;
    }

    let response: Response;
    try {
      response = await this.fetchImpl(endpointUrl, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (err: any) {
      throw new SocialPlatformError({
        platform: 'x',
        code: 'x_network_error',
        message: 'X (Twitter) API could not be reached. The post will be retried.',
        retryable: true,
        details: { cause: err?.message || 'network_error' },
      });
    }

    const data = (await response.json().catch(() => ({}))) as XApiError & Record<string, any>;
    if (!response.ok || !data.data?.id) {
      throw errorFromResponse(response.status, data, 'X (Twitter) rejected the tweet request.');
    }

    const tweetId = String(data.data.id);
    const permalink = `https://x.com/i/status/${tweetId}`;

    return {
      platform: 'x',
      providerPublishId: tweetId,
      externalPostId: tweetId,
      externalPermalink: permalink,
      providerResponse: data,
      variantStatus: 'published',
    };
  }
}
