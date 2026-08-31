import type { SocialPlatformAdapter, SocialPublishRequest, SocialPublishResult } from './social-platform-adapter.js';
import { SocialPlatformError } from './platform-errors.js';

export type InstagramAdapterOptions = {
  accessToken: string;
  instagramAccountId: string;
  apiVersion?: string;
  fetchImpl?: typeof fetch;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
};

type MetaApiError = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

const DEFAULT_API_VERSION = 'v19.0';

function cleanVersion(value?: string): string {
  const version = String(value || DEFAULT_API_VERSION).trim();
  return /^v\d+\.\d+$/.test(version) ? version : DEFAULT_API_VERSION;
}

function errorFromResponse(status: number, payload: MetaApiError, fallback: string): SocialPlatformError {
  const provider = payload?.error;
  const code = provider?.code;
  const reconnectRequired = status === 401 || code === 190;
  return new SocialPlatformError({
    platform: 'instagram',
    code: reconnectRequired ? 'instagram_reconnect_required' : `instagram_http_${status}`,
    message: provider?.message || fallback,
    retryable: status === 429 || status >= 500,
    reconnectRequired,
    details: {
      status,
      provider_type: provider?.type,
      provider_code: code,
      provider_subcode: provider?.error_subcode,
    },
  });
}

export class InstagramPlatformAdapter implements SocialPlatformAdapter {
  private readonly accessToken: string;
  private readonly instagramAccountId: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly pollIntervalMs: number;
  private readonly maxPollAttempts: number;

  constructor(options: InstagramAdapterOptions) {
    this.accessToken = options.accessToken;
    this.instagramAccountId = options.instagramAccountId;
    const isDirectInstagramToken = options.accessToken.startsWith('IGAG') || options.accessToken.startsWith('IGAA');
    const domain = isDirectInstagramToken ? 'graph.instagram.com' : 'graph.facebook.com';
    this.baseUrl = `https://${domain}/${cleanVersion(options.apiVersion)}`;
    this.fetchImpl = options.fetchImpl || fetch;
    this.pollIntervalMs = options.pollIntervalMs || 2000;
    this.maxPollAttempts = options.maxPollAttempts || 15;
  }

  private async post(path: string, body: URLSearchParams): Promise<Record<string, any>> {
    let response: Response;
    try {
      body.set('access_token', this.accessToken);
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error: any) {
      throw new SocialPlatformError({
        platform: 'instagram',
        code: 'instagram_network_error',
        message: 'Instagram Graph API could not be reached. The post will be retried.',
        retryable: true,
        details: { cause: error?.message || 'network_error' },
      });
    }

    const payload = (await response.json().catch(() => ({}))) as MetaApiError & Record<string, any>;
    if (!response.ok || payload.error) {
      throw errorFromResponse(response.status, payload, 'Instagram rejected the publishing request.');
    }
    return payload;
  }

  private async get(path: string, params: Record<string, string>): Promise<Record<string, any>> {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set('access_token', this.accessToken);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), { signal: AbortSignal.timeout(15_000) });
    } catch (error: any) {
      throw new SocialPlatformError({
        platform: 'instagram',
        code: 'instagram_network_error',
        message: 'Instagram Graph API could not be reached.',
        retryable: true,
        details: { cause: error?.message || 'network_error' },
      });
    }

    const payload = (await response.json().catch(() => ({}))) as MetaApiError & Record<string, any>;
    if (!response.ok || payload.error) {
      throw errorFromResponse(response.status, payload, 'Instagram request failed.');
    }
    return payload;
  }

  private async waitForContainer(containerId: string): Promise<void> {
    for (let attempt = 0; attempt < this.maxPollAttempts; attempt++) {
      const statusData = await this.get(`/${encodeURIComponent(containerId)}`, {
        fields: 'status_code,status',
      });
      const statusCode = statusData.status_code;

      if (statusCode === 'FINISHED') return;
      if (statusCode === 'ERROR' || statusCode === 'EXPIRED') {
        throw new SocialPlatformError({
          platform: 'instagram',
          code: `instagram_media_${String(statusCode).toLowerCase()}`,
          message: `Instagram media container failed with status: ${statusCode}`,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }
  }

  private async permalink(mediaId: string): Promise<string | null> {
    try {
      const data = await this.get(`/${encodeURIComponent(mediaId)}`, { fields: 'id,permalink' });
      return typeof data?.permalink === 'string' ? data.permalink : null;
    } catch {
      return null;
    }
  }

  async publish(request: SocialPublishRequest): Promise<SocialPublishResult> {
    const mediaUrls = (request.assetUrls?.length ? request.assetUrls : request.assetUrl ? [request.assetUrl] : [])
      .filter(Boolean);
    if (!mediaUrls.length) {
      throw new SocialPlatformError({
        platform: 'instagram',
        code: 'instagram_media_required',
        message: 'Instagram requires an image or video asset URL.',
      });
    }

    if (mediaUrls.length > 10) {
      throw new SocialPlatformError({
        platform: 'instagram',
        code: 'instagram_carousel_too_large',
        message: 'Instagram carousels can contain no more than 10 items.',
      });
    }

    if (mediaUrls.length > 1) {
      const childIds: string[] = [];
      const carouselAssets = Array.isArray(request.options?.carousel_assets)
        ? request.options.carousel_assets as Array<{ url?: string; alt_text?: string }>
        : [];
      for (const [index, mediaUrl] of mediaUrls.entries()) {
        const childParams = new URLSearchParams({ is_carousel_item: 'true' });
        const childIsVideo = /\.(mp4|mov|webm)(\?.*)?$/i.test(mediaUrl);
        if (childIsVideo) {
          childParams.set('media_type', 'VIDEO');
          childParams.set('video_url', mediaUrl);
        } else {
          childParams.set('image_url', mediaUrl);
          const altText = String(carouselAssets[index]?.alt_text || '').trim();
          if (altText) childParams.set('alt_text', altText.slice(0, 1000));
        }
        const child = await this.post(`/${encodeURIComponent(this.instagramAccountId)}/media`, childParams);
        if (!child.id) {
          throw new SocialPlatformError({
            platform: 'instagram',
            code: 'instagram_carousel_child_missing',
            message: 'Instagram did not return an ID for one of the carousel items.',
          });
        }
        if (childIsVideo) await this.waitForContainer(String(child.id));
        childIds.push(String(child.id));
      }

      const carousel = await this.post(
        `/${encodeURIComponent(this.instagramAccountId)}/media`,
        new URLSearchParams({
          media_type: 'CAROUSEL',
          children: childIds.join(','),
          caption: request.caption,
        }),
      );
      if (!carousel.id) {
        throw new SocialPlatformError({
          platform: 'instagram',
          code: 'instagram_container_missing',
          message: 'Instagram did not return a carousel container ID.',
        });
      }

      const publishRes = await this.post(
        `/${encodeURIComponent(this.instagramAccountId)}/media_publish`,
        new URLSearchParams({ creation_id: String(carousel.id) }),
      );
      if (!publishRes.id) {
        throw new SocialPlatformError({
          platform: 'instagram',
          code: 'instagram_publish_missing_id',
          message: 'Instagram did not return a published carousel ID.',
        });
      }
      const externalPermalink = await this.permalink(String(publishRes.id));
      return {
        platform: 'instagram',
        providerPublishId: String(carousel.id),
        externalPostId: String(publishRes.id),
        externalPermalink,
        providerResponse: {
          container_id: String(carousel.id),
          media_id: String(publishRes.id),
          child_container_ids: childIds,
          carousel_size: childIds.length,
        },
        variantStatus: 'published',
      };
    }

    const assetUrl = mediaUrls[0];
    const isVideo = /\.(mp4|mov|webm)(\?.*)?$/i.test(assetUrl);
    const containerParams = new URLSearchParams();
    containerParams.set('caption', request.caption);

    if (isVideo) {
      containerParams.set('media_type', 'REELS');
      containerParams.set('video_url', assetUrl);
    } else {
      containerParams.set('image_url', assetUrl);
    }

    // 1. Create Media Container
    const containerRes = await this.post(`/${encodeURIComponent(this.instagramAccountId)}/media`, containerParams);
    const containerId = containerRes.id;
    if (!containerId) {
      throw new SocialPlatformError({
        platform: 'instagram',
        code: 'instagram_container_missing',
        message: 'Instagram did not return a media container ID.',
      });
    }

    // 2. Poll if video
    if (isVideo) {
      await this.waitForContainer(containerId);
    }

    // 3. Publish Container
    const publishParams = new URLSearchParams({ creation_id: containerId });
    const publishRes = await this.post(`/${encodeURIComponent(this.instagramAccountId)}/media_publish`, publishParams);
    const mediaId = publishRes.id;
    if (!mediaId) {
      throw new SocialPlatformError({
        platform: 'instagram',
        code: 'instagram_publish_missing_id',
        message: 'Instagram did not return a published media ID.',
      });
    }

    const externalPermalink = await this.permalink(mediaId);

    return {
      platform: 'instagram',
      providerPublishId: containerId,
      externalPostId: mediaId,
      externalPermalink,
      providerResponse: {
        container_id: containerId,
        media_id: mediaId,
        is_video: isVideo,
      },
      variantStatus: 'published',
    };
  }
}
