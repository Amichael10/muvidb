/**
 * Portable Node SSR server for local prod-like runs and Fly/Railway scale-out.
 *
 * Vercel still uses api/ssr.ts → api/_lib/rrHandler.ts.
 * This process serves the same react-router build for document routes.
 *
 * /api/* on Vercel remain separate serverless functions.
 * On Fly/Railway, put a reverse proxy in front OR mount those handlers later —
 * see docs/SSR_SCALE.md.
 *
 *   npm run build && npm run start:node
 */
import { createRequestHandler } from 'react-router';
import express from 'express';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

/** Minimal .env loader (no dependency) — does not override existing process.env. */
function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile(path.join(root, '.env'));
loadEnvFile(path.join(root, '.env.local'));
// Sibling monorepo checkout often has secrets during local smoke
loadEnvFile(path.join(root, '..', 'lumi', '.env'));

const clientDir = path.join(root, 'build', 'client');
const serverBuildPath = path.join(root, 'build', 'server', 'index.js');
const port = Number(process.env.PORT || 3000);

if (!existsSync(serverBuildPath)) {
  console.error(`Missing ${serverBuildPath}. Run: npm run build`);
  process.exit(1);
}
if (!existsSync(clientDir)) {
  console.error(`Missing ${clientDir}. Run: npm run build`);
  process.exit(1);
}

const build = await import(pathToFileURL(serverBuildPath).href);
const handler = createRequestHandler(
  build.default ?? build,
  process.env.NODE_ENV || 'production',
);

const app = express();

app.use(express.static(clientDir, { index: false, maxAge: '1h', immutable: true }));

app.use(async (req, res, next) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    // Leave /api to upstream (Vercel) or a future mount — do not pretend SSR owns JSON APIs.
    if (url.pathname.startsWith('/api/')) {
      res.status(404).json({
        error: 'api_not_mounted',
        message:
          'This Node server serves SSR + static assets only. On Vercel, /api/* are separate functions. See docs/SSR_SCALE.md.',
      });
      return;
    }
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v == null) continue;
      if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
      else headers.set(k, v);
    }
    const request = new Request(url, { method: req.method, headers });
    const response = await handler(request);
    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'transfer-encoding') return;
      res.setHeader(key, value);
    });
    const buf = Buffer.from(await response.arrayBuffer());
    res.end(buf);
  } catch (err) {
    next(err);
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).send('Internal Server Error');
});

app.listen(port, () => {
  console.log(`MuviDB SSR node-server on http://127.0.0.1:${port}`);
});
