import { createRequestHandler } from '@react-router/node';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Inverted packaging (docs/WORK_LOG.md): this function serves RR SSR while the
 * other api/*.ts functions stay normal Vercel Node functions.
 *
 * IMPORTANT: the server build must be resolvable AND its imports (react, etc.)
 * must be traced into this function. Prefer a static import when the file
 * exists at build time; fall back to runtime load + SPA shell if SSR fails
 * so hard-refresh never 500s the whole site.
 */

async function loadServerBuild() {
  // Static relative import path — resolved after `npm run build` on Vercel.
  // Dynamic-only import() was crashing because NFT did not pull react/etc.
  // into the function bundle.
  try {
    // @ts-expect-error built artifact, not in TS project
    return await import('../build/server/index.js');
  } catch (staticErr) {
    const candidates = [
      path.join(process.cwd(), 'build', 'server', 'index.js'),
      path.join(process.cwd(), '..', 'build', 'server', 'index.js'),
    ];
    for (const file of candidates) {
      if (fs.existsSync(file)) {
        return import(pathToFileURL(file).href);
      }
    }
    throw staticErr;
  }
}

function spaFallback(): Response {
  const candidates = [
    path.join(process.cwd(), 'build', 'client', 'index.html'),
    path.join(process.cwd(), 'index.html'),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      return new Response(fs.readFileSync(file), {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }
  }
  return new Response(
    '<!doctype html><html><body><p>MuviDB is warming up. <a href="/">Retry</a></p><script>location.replace("/")</script></body></html>',
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

const handler = createRequestHandler(
  () => loadServerBuild(),
  process.env.NODE_ENV || 'production',
);

export default async function ssr(request: Request): Promise<Response> {
  try {
    return await handler(request);
  } catch (err) {
    console.error('[api/ssr] handler failed, serving SPA shell:', err);
    return spaFallback();
  }
}
