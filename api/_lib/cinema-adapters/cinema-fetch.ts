/**
 * Universal Cinema Fetcher with Nigerian Geo-Proxy and Scraper Gateway support.
 *
 * Supports:
 *   1. Direct REST API calls (e.g. Fusion Intel / Veezi) without scraper middleware
 *   2. ScraperAPI / ZenRows gateway for protected HTML web pages
 *   3. Custom HTTP/HTTPS/SOCKS5 proxy (CINEMA_PROXY_URL or HTTP_PROXY)
 *   4. Direct fetch with browser headers and Lagos IP emulation
 */

import { ProxyAgent } from 'undici';

const DEFAULT_TIMEOUT_MS = 30_000;

export type CinemaFetchOptions = RequestInit & {
  timeoutMs?: number;
  useProxy?: boolean;
  isHtmlPage?: boolean;
};

export async function cinemaFetch(url: string, options: CinemaFetchOptions = {}): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const scraperApiKey = process.env.SCRAPER_API_KEY?.trim();
  const zenrowsApiKey = process.env.ZENROWS_API_KEY?.trim();
  const proxyUrl = (process.env.CINEMA_PROXY_URL || process.env.HTTP_PROXY || process.env.HTTPS_PROXY)?.trim();

  const headers = new Headers(options.headers || {});

  // Set standard browser headers if not already set
  if (!headers.has('User-Agent')) {
    headers.set(
      'User-Agent',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'text/html,application/xhtml+xml,application/json,application/xml;q=0.9,*/*;q=0.8');
  }
  if (!headers.has('Accept-Language')) {
    headers.set('Accept-Language', 'en-US,en;q=0.9');
  }
  if (!headers.has('X-Forwarded-For')) {
    headers.set('X-Forwarded-For', '102.89.23.142');
  }
  if (!headers.has('CF-IPCountry')) {
    headers.set('CF-IPCountry', 'NG');
  }

  // 1. Try Direct Fetch first with a snappy timeout (8s)
  try {
    const directRes = await fetch(url, {
      ...options,
      headers,
      signal: AbortSignal.timeout(Math.min(timeoutMs, 8000)),
    });

    if (directRes.ok) {
      return directRes;
    }
  } catch (_e) {
    // Direct fetch failed or timed out — fallback to proxy/scraper gateway below
  }

  // 2. Route through ScraperAPI if key is available
  let targetUrl = url;
  if (scraperApiKey) {
    const scraperUrl = new URL('http://api.scraperapi.com');
    scraperUrl.searchParams.set('api_key', scraperApiKey);
    scraperUrl.searchParams.set('url', url);
    scraperUrl.searchParams.set('country_code', 'ng');
    scraperUrl.searchParams.set('keep_headers', 'true');
    targetUrl = scraperUrl.toString();
  }
  // 3. Route through ZenRows if key is available
  else if (zenrowsApiKey) {
    const zenrowsUrl = new URL('https://api.zenrows.com/v1/');
    zenrowsUrl.searchParams.set('apikey', zenrowsApiKey);
    zenrowsUrl.searchParams.set('url', url);
    zenrowsUrl.searchParams.set('js_render', 'true');
    zenrowsUrl.searchParams.set('premium_proxy', 'true');
    zenrowsUrl.searchParams.set('proxy_country', 'ng');
    targetUrl = zenrowsUrl.toString();
  }

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
