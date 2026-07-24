/**
 * Vercel SSR entry (invert packaging).
 *
 * Lazy-load the RR handler so a bad import cannot crash the whole function
 * before we can return an error body (FUNCTION_INVOCATION_FAILED).
 *
 * Node (req, res) signature — matches every other api/*.ts in this project.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Ensure the RR server bundle is copied into this function's deployment.
export const config = {
  includeFiles: ['build/server/**'],
  maxDuration: 60,
};
function headerString(
  value: string | string[] | undefined,
): string | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function toWebRequest(req: VercelRequest): Request {
  const proto = headerString(req.headers['x-forwarded-proto']) || 'https';
  const host =
    headerString(req.headers['x-forwarded-host']) ||
    headerString(req.headers.host) ||
    'localhost';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Dynamic import — top-level import of react-router/rrHandler was crashing
    // the lambda before any response could be written.
    const { handleSsrRequest, resolveServerBuildPath } = await import(
      './_lib/rrHandler.js'
    );

    const buildPath = resolveServerBuildPath();
    if (!buildPath) {
      res.status(500);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('X-MuviDB-SSR', 'missing-server-build');
      res.end(
        `SSR server build missing. cwd=${process.cwd()} includeFiles=build/server/**`,
      );
      return;
    }

    const response = await handleSsrRequest(toWebRequest(req));
    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'transfer-encoding') return;
      res.setHeader(key, value);
    });
    res.setHeader('X-MuviDB-SSR', 'ok');
    res.setHeader('X-MuviDB-SSR-Build', buildPath);
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    const message = err instanceof Error ? err.stack || err.message : String(err);
    console.error('[api/ssr]', message);
    res.status(500);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-MuviDB-SSR', 'handler-error');
    res.end(message.slice(0, 4000));
  }
}
