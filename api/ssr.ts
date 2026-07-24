/**
 * SSR entry — currently unused by vercel.json (pages go to /index.html)
 * after FUNCTION_INVOCATION_FAILED on every document request.
 *
 * Kept minimal so enabling `/api/ssr` again cannot take the site down while
 * we debug the React Router server-build load on Vercel.
 *
 * To re-enable: point the catch-all rewrite at `/api/ssr` and restore the
 * createRequestHandler + build/server import (see git history).
 */
import fs from 'node:fs';
import path from 'node:path';

function readIndexHtml(): Buffer | null {
  const candidates = [
    path.join(process.cwd(), 'build', 'client', 'index.html'),
    path.join(process.cwd(), 'index.html'),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) return fs.readFileSync(file);
  }
  return null;
}

export default async function ssr(_request: Request): Promise<Response> {
  const html = readIndexHtml();
  if (!html) {
    return new Response(
      'SSR shell missing (build/client/index.html). Check includeFiles.',
      { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-MuviDB-SSR': 'spa-shell',
    },
  });
}
