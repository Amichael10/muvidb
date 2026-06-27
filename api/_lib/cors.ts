import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Checks the incoming Origin header and returns CORS headers that allow
 * the request only if it comes from our trusted domains or localhost.
 */
export function getCorsHeaders(req: VercelRequest) {
  const origin = req.headers.origin;
  let allowedOrigin = 'https://muvidb.com'; // fallback default

  if (origin) {
    // Check if origin is allowed
    // Allow localhost, muvidb.com, or Vercel preview domains
    const isAllowed =
      origin === 'https://muvidb.com' ||
      origin === 'https://www.muvidb.com' ||
      origin === 'https://lumi.muvidb.com' ||
      origin.endsWith('.vercel.app') ||
      /^http:\/\/localhost(:\d+)?$/.test(origin) ||
      /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin);

    if (isAllowed) {
      allowedOrigin = origin;
    }
  }

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin', // Tell caches that the response varies depending on the Origin header
  };
}

/**
 * Helper to write CORS headers to the response object.
 * Returns true if the request is an OPTIONS preflight request (and terminates it).
 */
export function handleCors(req: VercelRequest, res: VercelResponse): boolean {
  const headers = getCorsHeaders(req);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}
