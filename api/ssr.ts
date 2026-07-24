/**
 * Vercel SSR entry (invert packaging).
 *
 * Do NOT set framework:"react-router" / vercelPreset() — that zeroes out api/.
 * Catch-all document routes rewrite here; /api/* stay as separate functions.
 * See docs/WORK_LOG.md § "The fix: invert it".
 *
 * All other api/*.ts handlers use the Node (VercelRequest, VercelResponse)
 * signature — a Web-Fetch-only export crashes with FUNCTION_INVOCATION_FAILED.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleSsrRequest } from './_lib/rrHandler';

function headerString(
  value: string | string[] | undefined,
): string | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

/** Rebuild the browser URL after a rewrite to /api/ssr. */
function toWebRequest(req: VercelRequest): Request {
  const proto = headerString(req.headers['x-forwarded-proto']) || 'https';
  const host =
    headerString(req.headers['x-forwarded-host']) ||
    headerString(req.headers.host) ||
    'localhost';

  // Prefer an explicit pathname from the rewrite (?__pathname=/films/x).
  const rawPath = req.query.__pathname;
  const pathnameFromQuery = Array.isArray(rawPath) ? rawPath[0] : rawPath;

  let pathWithQuery: string;
  if (typeof pathnameFromQuery === 'string' && pathnameFromQuery.startsWith('/')) {
    const incoming = new URL(req.url || '/', `http://${host}`);
    incoming.searchParams.delete('__pathname');
    const qs = incoming.searchParams.toString();
    pathWithQuery = qs ? `${pathnameFromQuery}?${qs}` : pathnameFromQuery;
  } else {
    const forwarded =
      headerString(req.headers['x-forwarded-uri']) ||
      headerString(req.headers['x-invoke-path']) ||
      headerString(req.headers['x-vercel-forwarded-path']);
    if (forwarded && !forwarded.startsWith('/api/ssr')) {
      pathWithQuery = forwarded;
    } else {
      pathWithQuery = req.url || '/';
    }
  }

  const url = new URL(pathWithQuery, `${proto}://${host}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else headers.set(key, value);
  }

  const method = req.method || 'GET';
  const init: RequestInit = { method, headers };
  if (method !== 'GET' && method !== 'HEAD' && req.body != null) {
    init.body =
      typeof req.body === 'string' || Buffer.isBuffer(req.body)
        ? (req.body as BodyInit)
        : JSON.stringify(req.body);
  }

  return new Request(url, init);
}

async function writeWebResponse(res: VercelResponse, response: Response) {
  res.status(response.status);
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'transfer-encoding') return;
    res.setHeader(key, value);
  });
  const buf = Buffer.from(await response.arrayBuffer());
  res.end(buf);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const response = await handleSsrRequest(toWebRequest(req));
    await writeWebResponse(res, response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/ssr] FUNCTION ERROR:', message);
    res.status(500);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-MuviDB-SSR', 'node-adapter-error');
    res.end(
      `<!doctype html><html><body style="font-family:system-ui;background:#0A0A0B;color:#fff;padding:2rem">` +
        `<h1>SSR adapter error</h1><pre>${message.replace(/</g, '&lt;')}</pre></body></html>`,
    );
  }
}
