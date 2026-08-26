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

    const mediaUrls = (request.assetUrls?.length ? request.assetUrls : [request.assetUrl]).filter(Boolean) as string[];
    if (mediaUrls.length > 35) {
      throw new SocialPlatformError({
        platform: 'tiktok',
        code: 'tiktok_photo_carousel_too_large',
        message: 'TikTok photo carousels can contain no more than 35 images.',
      });
    }
    if (mediaUrls.length > 1 && mediaUrls.some(url => /\.(mp4|mov|webm)(\?.*)?$/i.test(url))) {
      throw new SocialPlatformError({
        platform: 'tiktok',
        code: 'tiktok_photo_carousel_images_only',
        message: 'TikTok carousel publishing supports images only.',
      });
    }
    const isVideo = /\.(mp4|mov|webm)(\?.*)?$/i.test(request.assetUrl);
    const settings = (request.options?.tiktok || {}) as Record<string, any>;
    const postMode = settings.post_mode === 'MEDIA_UPLOAD' ? 'MEDIA_UPLOAD' : 'DIRECT_POST';
    let creatorInfo: Record<string, any> = {};
    if (postMode === 'DIRECT_POST') {
      const creator = await this.postJson('/post/publish/creator_info/query/', {});
      creatorInfo = creator.data || {};
    }
    const privacyOptions = Array.isArray(creatorInfo.privacy_level_options)
      ? creatorInfo.privacy_level_options
      : [];
    const requestedPrivacy = String(settings.privacy_level || 'PUBLIC_TO_EVERYONE');
    const privacyLevel = privacyOptions.length && !privacyOptions.includes(requestedPrivacy)
      ? (privacyOptions.includes('SELF_ONLY') ? 'SELF_ONLY' : privacyOptions[0])
      : requestedPrivacy;
    const commonDisclosure = {
      brand_content_toggle: Boolean(settings.brand_content_toggle),
      brand_organic_toggle: Boolean(settings.brand_organic_toggle),
    };

    const proxyUrl = (url: string) => {
      if (url.startsWith('https://pkenrmorywmuvnzfoylp.supabase.co/')) {
        return `https://muvidb.com/api/social?task=asset&url=${encodeURIComponent(url)}`;
      }
      return url;
    };

    const targetMediaUrls = mediaUrls.map(proxyUrl);
    const targetAssetUrl = proxyUrl(request.assetUrl);

    // 1. Direct Video Publish / Upload
    if (isVideo) {
      const sourceInfo = {
        source: 'PULL_FROM_URL',
        video_url: targetAssetUrl,
      };
      const payload = postMode === 'MEDIA_UPLOAD'
        ? { source_info: sourceInfo }
        : {
          post_info: {
            title: String(request.caption || request.title || '').slice(0, 2200),
            privacy_level: privacyLevel,
            disable_duet: Boolean(settings.disable_duet || creatorInfo.duet_disabled),
            disable_stitch: Boolean(settings.disable_stitch || creatorInfo.stitch_disabled),
            disable_comment: Boolean(settings.disable_comment || creatorInfo.comment_disabled),
            video_cover_timestamp_ms: Math.max(0, Math.floor(Number(settings.video_cover_timestamp_ms) || 0)),
            ...commonDisclosure,
            is_aigc: Boolean(settings.is_aigc),
          },
          source_info: sourceInfo,
        };

      const endpoint = postMode === 'MEDIA_UPLOAD'
        ? '/post/publish/inbox/video/init/'
        : '/post/publish/video/init/';
      const res = await this.postJson(endpoint, payload);
      const publishId = res.data?.publish_id;
      if (!publishId) {
        throw new SocialPlatformError({
          platform: 'tiktok',
          code: 'tiktok_publish_id_missing',
          message: 'TikTok accepted the video request but did not return a publish ID.',
        });
      }

      return {
        platform: 'tiktok',
        providerPublishId: publishId,
        externalPostId: publishId,
        externalPermalink: null,
        providerResponse: { ...res, creator_info: creatorInfo, delivery_mode: postMode },
        variantStatus: postMode === 'MEDIA_UPLOAD' ? 'uploaded_as_draft' : 'published',
      };
    }

    // 2. Direct Photo / Photo Carousel Post
    const photoPostInfo: Record<string, unknown> = {
      title: String(request.title || '').slice(0, 90),
      description: String(request.caption || '').slice(0, 4000),
    };
    if (postMode === 'DIRECT_POST') {
      Object.assign(photoPostInfo, {
        privacy_level: privacyLevel,
        disable_comment: Boolean(settings.disable_comment || creatorInfo.comment_disabled),
        auto_add_music: Boolean(settings.auto_add_music),
        ...commonDisclosure,
      });
    }

    const photoPayload = {
      media_type: 'PHOTO',
      post_mode: postMode,
      post_info: photoPostInfo,
      source_info: {
        source: 'PULL_FROM_URL',
        photo_images: targetMediaUrls,
        photo_cover_index: Math.max(
          1,
          Math.min(targetMediaUrls.length, Math.floor(Number(settings.photo_cover_index) || 1)),
        ),
      },
    };

    const res = await this.postJson('/post/publish/content/init/', photoPayload);
    const publishId = res.data?.publish_id;
    if (!publishId) {
      throw new SocialPlatformError({
        platform: 'tiktok',
        code: 'tiktok_publish_id_missing',
        message: 'TikTok accepted the photo request but did not return a publish ID.',
      });
    }

    return {
      platform: 'tiktok',
      providerPublishId: publishId,
      externalPostId: publishId,
      externalPermalink: null,
      providerResponse: { ...res, creator_info: creatorInfo, delivery_mode: postMode },
      variantStatus: postMode === 'MEDIA_UPLOAD' ? 'uploaded_as_draft' : 'published',
    };
  }
}
