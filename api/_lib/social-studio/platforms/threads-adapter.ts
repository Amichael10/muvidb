import type { SocialPlatformAdapter, SocialPublishRequest, SocialPublishResult } from './social-platform-adapter.js';
import { SocialPlatformError } from './platform-errors.js';

type ThreadsAdapterOptions = {
  accessToken: string;
  userId: string;
  apiVersion?: string;
  fetchImpl?: typeof fetch;
};

type ThreadsApiError = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

const DEFAULT_API_VERSION = 'v1.0';

function cleanVersion(value?: string): string {
  const version = String(value || DEFAULT_API_VERSION).trim();
  return /^v\d+\.\d+$/.test(version) ? version : DEFAULT_API_VERSION;
}

function errorFromResponse(status: number, payload: ThreadsApiError, fallback: string): SocialPlatformError {
  const provider = payload?.error;
  const code = provider?.code;
  const reconnectRequired = status === 401 || code === 190;
  return new SocialPlatformError({
    platform: 'threads',
    code: reconnectRequired ? 'threads_reconnect_required' : `threads_http_${status}`,
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

export class ThreadsPlatformAdapter implements SocialPlatformAdapter {
  private readonly accessToken: string;
  private readonly userId: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ThreadsAdapterOptions) {
    this.accessToken = options.accessToken;
    this.userId = options.userId;
    this.baseUrl = `https://graph.threads.net/${cleanVersion(options.apiVersion)}`;
    this.fetchImpl = options.fetchImpl || fetch;
  }

  private async post(path: string, body: URLSearchParams): Promise<Record<string, any>> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error: any) {
      throw new SocialPlatformError({
        platform: 'threads',
        code: 'threads_network_error',
        message: 'Threads could not be reached. The post will be retried.',
        retryable: true,
        details: { cause: error?.message || 'network_error' },
      });
    }

    const payload = (await response.json().catch(() => ({}))) as ThreadsApiError & Record<string, any>;
    if (!response.ok || payload.error) {
      throw errorFromResponse(response.status, payload, 'Threads rejected the publishing request.');
    }
    return payload;
  }

  private async permalink(postId: string): Promise<string | null> {
    const url = new URL(`${this.baseUrl}/${encodeURIComponent(postId)}`);
    url.searchParams.set('fields', 'id,permalink');
    url.searchParams.set('access_token', this.accessToken);
    try {
      const response = await this.fetchImpl(url.toString(), { signal: AbortSignal.timeout(10_000) });
      const payload = await response.json().catch(() => ({}));
      return response.ok && typeof payload?.permalink === 'string' ? payload.permalink : null;
    } catch {
      // The post is already public. A metadata lookup must never turn that
      // success into a retried publish and create a duplicate.
      return null;
    }
  }

  async publish(request: SocialPublishRequest): Promise<SocialPublishResult> {
    if (request.platform !== 'threads') {
      throw new SocialPlatformError({
        platform: request.platform,
        code: 'threads_adapter_platform_mismatch',
        message: 'The Threads publisher received a job for another platform.',
      });
    }

    const mediaUrls = (request.assetUrls?.length ? request.assetUrls : request.assetUrl ? [request.assetUrl] : [])
      .filter(Boolean);
    if (mediaUrls.length > 10) {
      throw new SocialPlatformError({
        platform: 'threads',
        code: 'threads_carousel_too_large',
        message: 'This carousel contains more than the supported 10 images.',
      });
    }

    let create: URLSearchParams;
    if (mediaUrls.length > 1) {
      const childIds: string[] = [];
      for (const mediaUrl of mediaUrls) {
        const childIsVideo = /\.(mp4|mov|webm)(\?.*)?$/i.test(mediaUrl);
        const child = new URLSearchParams({
          access_token: this.accessToken,
          media_type: childIsVideo ? 'VIDEO' : 'IMAGE',
          is_carousel_item: 'true',
        });
        child.set(childIsVideo ? 'video_url' : 'image_url', mediaUrl);
        const childContainer = await this.post(`/${encodeURIComponent(this.userId)}/threads`, child);
        if (!childContainer.id) {
          throw new SocialPlatformError({
            platform: 'threads',
            code: 'threads_carousel_child_missing',
            message: 'Threads did not return an ID for one of the carousel items.',
            retryable: true,
          });
        }
        childIds.push(String(childContainer.id));
      }
      create = new URLSearchParams({
        access_token: this.accessToken,
        media_type: 'CAROUSEL',
        children: childIds.join(','),
        text: request.caption,
      });
    } else {
      create = new URLSearchParams({
        access_token: this.accessToken,
        media_type: mediaUrls.length ? 'IMAGE' : 'TEXT',
        text: request.caption,
      });
      if (mediaUrls[0]) create.set('image_url', mediaUrls[0]);
    }

    const container = await this.post(`/${encodeURIComponent(this.userId)}/threads`, create);
    if (!container.id) {
      throw new SocialPlatformError({
        platform: 'threads',
        code: 'threads_missing_container_id',
        message: 'Threads accepted the media but did not return a container ID.',
        retryable: true,
      });
    }

    let published: Record<string, any>;
    try {
      published = await this.post(
        `/${encodeURIComponent(this.userId)}/threads_publish`,
        new URLSearchParams({ access_token: this.accessToken, creation_id: String(container.id) }),
      );
    } catch (error: any) {
      const status = Number(error?.details?.status || 0);
      if (error?.code === 'threads_network_error' || status >= 500) {
        throw new SocialPlatformError({
          platform: 'threads',
          code: 'threads_publish_result_unknown',
          message: 'Threads may have published this post. Check the account before retrying it.',
          retryable: false,
          details: { container_id: String(container.id), cause: error?.message || 'unknown_result' },
        });
      }
      throw error;
    }
    if (!published.id) {
      throw new SocialPlatformError({
        platform: 'threads',
        code: 'threads_missing_post_id',
        message: 'Threads did not return a post ID after publishing.',
        retryable: true,
      });
    }

    const externalPermalink = await this.permalink(String(published.id));
    return {
      platform: 'threads',
      providerPublishId: String(container.id),
      externalPostId: String(published.id),
      externalPermalink,
      providerResponse: {
        mode: 'live',
        container_id: String(container.id),
        post_id: String(published.id),
      },
      variantStatus: 'published',
    };
  }
}
