import { createRequestHandler } from 'react-router';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Shared React Router SSR handler (invert-fix — see docs/WORK_LOG.md).
 *
 * Used by api/ssr.ts (Vercel) and mirrored by server/node-server.mjs (scale path).
 * Dynamic-import the RR server build so @vercel/node does not esbuild the whole graph.
 * vercel.json includeFiles must ship build/server/** into the function.
 *
 * Note: createRequestHandler lives on `react-router` in v7.18+ (not @react-router/node).
 */

let buildPromise: Promise<unknown> | null = null;
let resolvedBuildPath: string | null = null;

function candidatePaths(): string[] {
  const cwd = process.cwd();
  const dirname =
    typeof __dirname !== 'undefined' ? __dirname : path.join(cwd, 'api', '_lib');

  return [
    path.join(cwd, 'build', 'server', 'index.js'),
    path.join(cwd, '..', 'build', 'server', 'index.js'),
    path.join('/var/task', 'build', 'server', 'index.js'),
    path.join(dirname, '..', '..', 'build', 'server', 'index.js'),
    path.join(dirname, '..', 'build', 'server', 'index.js'),
    path.join(dirname, 'build', 'server', 'index.js'),
  ];
}

export function resolveServerBuildPath(): string | null {
  if (resolvedBuildPath && existsSync(resolvedBuildPath)) return resolvedBuildPath;
  for (const p of candidatePaths()) {
    if (existsSync(p)) {
      resolvedBuildPath = p;
      return p;
    }
  }
  return null;
}

async function loadServerBuild() {
  const file = resolveServerBuildPath();
  if (!file) {
    throw new Error(
      `React Router server build not found. Tried:\n  - ${candidatePaths().join('\n  - ')}\n` +
        `cwd=${process.cwd()}. Ensure vercel.json includeFiles ships build/server/**.`,
    );
  }
  const mod = await import(pathToFileURL(file).href);
  return mod.default ?? mod;
}

function getBuild() {
  if (!buildPromise) {
    buildPromise = loadServerBuild().catch((err) => {
      buildPromise = null;
      throw err;
    });
  }
  return buildPromise;
}

const mode = process.env.NODE_ENV || 'production';
const requestHandler = createRequestHandler(() => getBuild() as any, mode);

export function getSsrHandler() {
  return requestHandler;
}

export async function handleSsrRequest(request: Request): Promise<Response> {
  try {
    return await requestHandler(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[rrHandler] SSR failed:', message);
    const safe = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return new Response(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>MuviDB — temporarily unavailable</title></head>` +
        `<body style="font-family:system-ui;background:#0A0A0B;color:#F2F2F2;padding:2rem">` +
        `<h1>Something went wrong</h1><p>The server could not render this page.</p>` +
        `<pre style="opacity:.6;white-space:pre-wrap;font-size:12px">${safe}</pre>` +
        `</body></html>`,
      {
        status: 500,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-MuviDB-SSR': 'error',
        },
      },
    );
  }
}
