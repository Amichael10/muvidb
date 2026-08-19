import type { SocialPlatformAdapter, SocialPublishRequest, SocialPublishResult } from './social-platform-adapter.js';
import { SocialPlatformError } from './platform-errors.js';

export type TikTokAdapterOptions = {
  accessToken: string;
  openId?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

type TikTokApiError = {
  error?: {
    code?: string;
    message?: string;
    log_id?: string;
  };
};

function errorFromResponse(status: number, payload: TikTokApiError, fallback: string): SocialPlatformError {
  const provider = payload?.error;
  const code = provider?.code;
  const reconnectRequired = status === 401 || code === 'access_token_invalid' || code === 'scope_not_authorized';
  return new SocialPlatformError({
    platform: 'tiktok',
    code: reconnectRequired ? 'tiktok_reconnect_required' : `tiktok_http_${status}`,
    message: provider?.message || fallback,
    retryable: status === 429 || status >= 500,
    reconnectRequired,
    details: {
      status,
      provider_code: code,
      provider_log_id: provider?.log_id,
    },
  });
}

export class TikTokPlatformAdapter implements SocialPlatformAdapter {
  private readonly accessToken: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: TikTokAdapterOptions) {
    this.accessToken = options.accessToken;
    this.baseUrl = options.baseUrl || 'https://open.tiktokapis.com/v2';
    this.fetchImpl = options.fetchImpl || fetch;
  }

  private async postJson(path: string, body: Record<string, any>): Promise<Record<string, any>> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error: any) {
      throw new SocialPlatformError({
        platform: 'tiktok',
        code: 'tiktok_network_error',
        message: 'TikTok API could not be reached. The post will be retried.',
        retryable: true,
        details: { cause: error?.message || 'network_error' },
      });
    }

    const payload = (await response.json().catch(() => ({}))) as TikTokApiError & Record<string, any>;
    if (!response.ok || payload.error?.code && payload.error.code !== 'ok') {
      throw errorFromResponse(response.status, payload, 'TikTok rejected the upload/publish request.');
    }
    return payload;
  }

  async publish(request: SocialPublishRequest): Promise<SocialPublishResult> {
    if (!request.assetUrl) {
      throw new SocialPlatformError({
        platform: 'tiktok',
        code: 'tiktok_media_required',
        message: 'TikTok requires a video or image asset URL.',
      });
    }

    const isVideo = /\.(mp4|mov|webm)(\?.*)?$/i.test(request.assetUrl);
    const title = (request.title || request.caption || '').slice(0, 150);

    // 1. Direct Video Publish / Upload
    if (isVideo) {
      const payload = {
        post_info: {
          title,
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_duet: false,
          disable_stitch: false,
          disable_comment: false,
          video_cover_timestamp_ms: 1000,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: request.assetUrl,
        },
      };

      const res = await this.postJson('/post/publish/video/init/', payload);
      const publishId = res.data?.publish_id || `tiktok_pub_${Date.now()}`;

      return {
        platform: 'tiktok',
        providerPublishId: publishId,
        externalPostId: publishId,
        externalPermalink: null,
        providerResponse: res,
        variantStatus: 'published',
      };
    }

    // 2. Direct Photo Carousel Post
    const photoPayload = {
      media_type: 'PHOTO',
      post_mode: 'DIRECT_POST',
      post_info: {
        title,
        description: request.caption,
        privacy_level: 'PUBLIC_TO_EVERYONE',
      },
      source_info: {
        source: 'PULL_FROM_URL',
        photo_images: [request.assetUrl],
      },
    };

    const res = await this.postJson('/post/publish/content/init/', photoPayload);
    const publishId = res.data?.publish_id || `tiktok_photo_${Date.now()}`;

    return {
      platform: 'tiktok',
      providerPublishId: publishId,
      externalPostId: publishId,
      externalPermalink: null,
      providerResponse: res,
      variantStatus: 'uploaded_as_draft',
    };
  }
}
