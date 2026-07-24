import { createRequestHandler } from '@react-router/node';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Inverted packaging (see docs/WORK_LOG.md "The fix: invert it"):
// Vercel builds the seven existing api/*.ts functions normally, and this one
// extra function serves the React Router SSR app. `vercel.json` includeFiles
// copies build/server into the deployment; we load it at runtime so @vercel/node
// does not try to esbuild-bundle the whole RR server graph into this file.

async function loadServerBuild() {
  const href = pathToFileURL(
    path.join(process.cwd(), 'build', 'server', 'index.js'),
  ).href;
  return import(href);
}

const handler = createRequestHandler(
  () => loadServerBuild(),
  process.env.NODE_ENV || 'production',
);

export default (request: Request) => handler(request);
