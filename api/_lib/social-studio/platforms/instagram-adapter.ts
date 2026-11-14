import type { SocialPlatformAdapter, SocialPublishRequest, SocialPublishResult } from './social-platform-adapter.js';
import { SocialPlatformError } from './platform-errors.js';

export type InstagramAdapterOptions = {
  accessToken: string;
  instagramAccountId: string;
  accountUsername?: string;
  collaborators?: string[];
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
  private readonly accountUsername?: string;
  private readonly defaultCollaborators: string[];
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly pollIntervalMs: number;
  private readonly maxPollAttempts: number;

  constructor(options: InstagramAdapterOptions) {
    this.accessToken = options.accessToken;
    this.instagramAccountId = options.instagramAccountId;
    this.accountUsername = options.accountUsername;
    this.defaultCollaborators = options.collaborators ?? ['muvi_database'];
    const isDirectInstagramToken = options.accessToken.startsWith('IGAG') || options.accessToken.startsWith('IGAA');
    const domain = isDirectInstagramToken ? 'graph.instagram.com' : 'graph.facebook.com';
    this.baseUrl = `https://${domain}/${cleanVersion(options.apiVersion)}`;
    this.fetchImpl = options.fetchImpl || fetch;
    this.pollIntervalMs = options.pollIntervalMs || 3000;
    this.maxPollAttempts = options.maxPollAttempts || 40;
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

      if (attempt % 5 === 0 || attempt === this.maxPollAttempts - 1) {
        console.log(`[Instagram Adapter] Container ${containerId} status: ${statusCode || 'IN_PROGRESS'} (attempt ${attempt + 1}/${this.maxPollAttempts})`);
      }

      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }

    throw new SocialPlatformError({
      platform: 'instagram',
      code: 'instagram_media_processing_timeout',
      message: 'Instagram media container processing timed out.',
      retryable: true,
    });
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

    const requestedCollaborators: string[] = Array.isArray(request.options?.collaborators)
      ? (request.options.collaborators as string[])
      : this.defaultCollaborators;

    const activeCollaborators = requestedCollaborators
      .map((u) => String(u || '').trim().replace(/^@/, ''))
      .filter((u) => Boolean(u) && u.toLowerCase() !== (this.accountUsername || '').toLowerCase());

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

      const carouselParams = new URLSearchParams({
        media_type: 'CAROUSEL',
        children: childIds.join(','),
        caption: request.caption,
      });
      if (activeCollaborators.length > 0) {
        carouselParams.set('collaborators', JSON.stringify(activeCollaborators));
      }

      let carousel: { id?: string };
      try {
        carousel = await this.post(`/${encodeURIComponent(this.instagramAccountId)}/media`, carouselParams);
      } catch (carouselErr: any) {
        if (carouselParams.has('collaborators')) {
          console.warn(`[instagram-adapter] Failed to create carousel container with collaborators (${carouselErr?.message}). Retrying without collaborators...`);
          const fallbackParams = new URLSearchParams(carouselParams);
          fallbackParams.delete('collaborators');
          carousel = await this.post(`/${encodeURIComponent(this.instagramAccountId)}/media`, fallbackParams);
        } else {
          throw carouselErr;
        }
      }
      if (!carousel.id) {
        throw new SocialPlatformError({
          platform: 'instagram',
          code: 'instagram_container_missing',
          message: 'Instagram did not return a carousel container ID.',
        });
      }

      // Instagram processes the carousel container asynchronously too. A
      // mixed image/video carousel can otherwise reach media_publish before a
      // media ID exists, returning the opaque "Media ID is not available" error.
      await this.waitForContainer(String(carousel.id));

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
    if (activeCollaborators.length > 0) {
      containerParams.set('collaborators', JSON.stringify(activeCollaborators));
    }

    if (isVideo) {
      containerParams.set('media_type', 'REELS');
      containerParams.set('video_url', assetUrl);
      const audio = request.options?.instagram_audio;
      if (audio && typeof audio === 'object') {
        const selected = audio as Record<string, unknown>;
        const audioId = String(selected.audio_id || '').trim();
        // Instagram Meta Graph API accepts external Instagram sound/music library IDs.
        // Internal curated catalog keys (e.g. "cat_fave_baby_riddim", "cat_mercy_chinwo_confidence")
        // are for Remotion/ffmpeg rendering and cause Meta to throw HTTP 500 OAuthException.
        const isInternalCatalogKey = audioId.startsWith('cat_');
        if (audioId && !isInternalCatalogKey) {
          const clampVolume = (value: unknown, fallback: number) => {
            const numeric = Number(value);
            return Number.isFinite(numeric) ? Math.min(100, Math.max(0, Math.round(numeric))) : fallback;
          };
          containerParams.set('audio_configuration', JSON.stringify({
            audio_id: audioId,
            audio_volume: clampVolume(selected.audio_volume, 100),
            video_volume: clampVolume(selected.video_volume, 20),
          }));
        }
      }
      const coverUrl = request.options?.cover_url || request.options?.cover_image_url || request.options?.thumbnail_url;
      if (coverUrl && typeof coverUrl === 'string' && coverUrl.trim()) {
        containerParams.set('cover_url', coverUrl.trim());
      }
    } else {
      containerParams.set('image_url', assetUrl);
    }

    // 1. Create Media Container (with progressive fallback stripping audio_configuration, collaborators, and cover_url)
    let containerRes: { id?: string } | null = null;
    const attemptParams = new URLSearchParams(containerParams);
    let lastCreateErr: any = null;

    const fallbackSteps = [
      () => true, // initial attempt with full params
      (p: URLSearchParams) => {
        if (!p.has('audio_configuration')) return false;
        p.delete('audio_configuration');
        return true;
      },
      (p: URLSearchParams) => {
        if (!p.has('collaborators')) return false;
        p.delete('collaborators');
        return true;
      },
      (p: URLSearchParams) => {
        if (!p.has('cover_url')) return false;
        p.delete('cover_url');
        return true;
      },
      (p: URLSearchParams) => {
        const hadAny = p.has('audio_configuration') || p.has('collaborators') || p.has('cover_url');
        p.delete('audio_configuration');
        p.delete('collaborators');
        p.delete('cover_url');
        return hadAny;
      },
    ];

    for (let step = 0; step < fallbackSteps.length; step++) {
      if (step > 0) {
        const changed = fallbackSteps[step](attemptParams);
        if (!changed) continue;
        console.warn(`[instagram-adapter] Retrying container creation (fallback step ${step})...`);
      }
      try {
        containerRes = await this.post(`/${encodeURIComponent(this.instagramAccountId)}/media`, new URLSearchParams(attemptParams));
        if (containerRes?.id) break;
      } catch (err: any) {
        lastCreateErr = err;
        console.warn(`[instagram-adapter] Container creation failed at step ${step}: ${err?.message || err}`);
      }
    }

    if (!containerRes?.id) {
      throw lastCreateErr || new SocialPlatformError({
        platform: 'instagram',
        code: 'instagram_container_missing',
        message: 'Instagram did not return a media container ID.',
      });
    }
    const containerId = containerRes.id;
    if (!containerId) {
      throw new SocialPlatformError({
        platform: 'instagram',
        code: 'instagram_container_missing',
        message: 'Instagram did not return a media container ID.',
      });
    }

    // 2. Wait for container to finish processing before publishing
    await this.waitForContainer(containerId);

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
