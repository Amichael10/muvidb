/**
 * Universal Cinema Fetcher with Nigerian Geo-Proxy and Scraper Gateway support.
 *
 * Supports:
 *   1. ScraperAPI gateway (SCRAPER_API_KEY) with Nigerian geo-targeting (country_code=ng)
 *   2. ZenRows gateway (ZENROWS_API_KEY) with premium Nigerian proxy
 *   3. Custom HTTP/HTTPS/SOCKS5 proxy (CINEMA_PROXY_URL or HTTP_PROXY)
 *   4. Direct fetch with browser headers and Lagos IP emulation
 */

import { ProxyAgent } from 'undici';

const DEFAULT_TIMEOUT_MS = 30_000;

export type CinemaFetchOptions = RequestInit & {
  timeoutMs?: number;
  useProxy?: boolean;
};

export async function cinemaFetch(url: string, options: CinemaFetchOptions = {}): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const scraperApiKey = process.env.SCRAPER_API_KEY?.trim();
  const zenrowsApiKey = process.env.ZENROWS_API_KEY?.trim();
  const proxyUrl = (process.env.CINEMA_PROXY_URL || process.env.HTTP_PROXY || process.env.HTTPS_PROXY)?.trim();

  let targetUrl = url;
  const headers = new Headers(options.headers || {});

  // Set standard browser headers if not already set
  if (!headers.has('User-Agent')) {
    headers.set(
      'User-Agent',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8');
  }
  if (!headers.has('Accept-Language')) {
    headers.set('Accept-Language', 'en-US,en;q=0.9');
  }

  // Emulate Nigerian residential client IP headers for CDN geo-filters
  if (!headers.has('X-Forwarded-For')) {
    // 102.89.x.x is MTN Nigeria / Lagos IP range
    headers.set('X-Forwarded-For', '102.89.23.142');
  }
  if (!headers.has('CF-IPCountry')) {
    headers.set('CF-IPCountry', 'NG');
  }

  // 1. Route through ScraperAPI if key is available
  if (scraperApiKey) {
    const scraperUrl = new URL('http://api.scraperapi.com');
    scraperUrl.searchParams.set('api_key', scraperApiKey);
    scraperUrl.searchParams.set('url', url);
    scraperUrl.searchParams.set('country_code', 'ng');
    scraperUrl.searchParams.set('keep_headers', 'true');
    targetUrl = scraperUrl.toString();
  }
  // 2. Route through ZenRows if key is available
  else if (zenrowsApiKey) {
    const zenrowsUrl = new URL('https://api.zenrows.com/v1/');
    zenrowsUrl.searchParams.set('apikey', zenrowsApiKey);
    zenrowsUrl.searchParams.set('url', url);
    zenrowsUrl.searchParams.set('premium_proxy', 'true');
    zenrowsUrl.searchParams.set('proxy_country', 'ng');
    targetUrl = zenrowsUrl.toString();
  }

  // 3. Custom Proxy Agent via undici
  const fetchOptions: any = {
    ...options,
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  };

  if (proxyUrl && !scraperApiKey && !zenrowsApiKey) {
    try {
      fetchOptions.dispatcher = new ProxyAgent(proxyUrl);
    } catch (e: any) {
      console.warn(`[cinema-fetch] Warning: Could not initialize ProxyAgent for ${proxyUrl}:`, e.message);
    }
  }

  return fetch(targetUrl, fetchOptions);
}
