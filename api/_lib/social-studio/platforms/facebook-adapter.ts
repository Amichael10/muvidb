import type { SocialPlatformAdapter, SocialPublishRequest, SocialPublishResult } from './social-platform-adapter.js';
import { SocialPlatformError } from './platform-errors.js';

export type FacebookAdapterOptions = {
  accessToken: string;
  pageId: string;
  apiVersion?: string;
  fetchImpl?: typeof fetch;
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
    platform: 'facebook',
    code: reconnectRequired ? 'facebook_reconnect_required' : `facebook_http_${status}`,
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

export class FacebookPlatformAdapter implements SocialPlatformAdapter {
  private readonly accessToken: string;
  private readonly pageId: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: FacebookAdapterOptions) {
    this.accessToken = options.accessToken;
    this.pageId = options.pageId;
    this.baseUrl = `https://graph.facebook.com/${cleanVersion(options.apiVersion)}`;
    this.fetchImpl = options.fetchImpl || fetch;
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
        platform: 'facebook',
        code: 'facebook_network_error',
        message: 'Facebook Graph API could not be reached. The post will be retried.',
        retryable: true,
        details: { cause: error?.message || 'network_error' },
      });
    }

    const payload = (await response.json().catch(() => ({}))) as MetaApiError & Record<string, any>;
    if (!response.ok || payload.error) {
      throw errorFromResponse(response.status, payload, 'Facebook rejected the publishing request.');
    }
    return payload;
  }

  private async permalink(postId: string): Promise<string | null> {
    const url = new URL(`${this.baseUrl}/${encodeURIComponent(postId)}`);
    url.searchParams.set('fields', 'permalink_url');
    url.searchParams.set('access_token', this.accessToken);
    try {
      const response = await this.fetchImpl(url.toString(), { signal: AbortSignal.timeout(10_000) });
      const payload = await response.json().catch(() => ({}));
      return response.ok && typeof payload?.permalink_url === 'string' ? payload.permalink_url : null;
    } catch {
      return null;
    }
  }

  async publish(request: SocialPublishRequest): Promise<SocialPublishResult> {
    const params = new URLSearchParams();

    // Photo Post
    if (request.assetUrl) {
      const isVideo = /\.(mp4|mov|webm)(\?.*)?$/i.test(request.assetUrl);
      if (isVideo) {
        params.set('description', request.caption);
        params.set('file_url', request.assetUrl);
        const res = await this.post(`/${encodeURIComponent(this.pageId)}/videos`, params);
        const externalPostId = res.id;
        const externalPermalink = await this.permalink(externalPostId);
        return {
          platform: 'facebook',
          providerPublishId: res.id,
          externalPostId,
          externalPermalink,
          providerResponse: res,
          variantStatus: 'published',
        };
      }

      params.set('caption', request.caption);
      params.set('url', request.assetUrl);
      const res = await this.post(`/${encodeURIComponent(this.pageId)}/photos`, params);
      const externalPostId = res.post_id || res.id;
      const externalPermalink = await this.permalink(externalPostId);

      return {
        platform: 'facebook',
        providerPublishId: res.id,
        externalPostId,
        externalPermalink,
        providerResponse: res,
        variantStatus: 'published',
      };
    }

    // Text Post / Feed
    params.set('message', request.caption);
    const res = await this.post(`/${encodeURIComponent(this.pageId)}/feed`, params);
    const externalPostId = res.id;
    const externalPermalink = await this.permalink(externalPostId);

    return {
      platform: 'facebook',
      providerPublishId: res.id,
      externalPostId,
      externalPermalink,
      providerResponse: res,
      variantStatus: 'published',
    };
  }
}
