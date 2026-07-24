# MuviDB SSR scale runbook

## Now (Vercel Hobby — invert packaging)

- `framework: null` so `api/*.ts` keep building.
- `react-router build` → `build/client` (static) + `build/server` (SSR module).
- Document routes → `/api/ssr` → `api/_lib/rrHandler.ts` → `createRequestHandler`.
- JSON APIs stay as separate serverless functions (data, seo sitemaps, cron, etc.).
- **Never** set `framework: "react-router"` or `vercelPreset()` — verified to zero out `api/`.

Gate every preview with content-type checks:

```bash
npm run build && npm run start:node
BASE_URL=http://127.0.0.1:3000 npm run smoke:ssr

# against a Vercel preview:
BASE_URL=https://YOUR-PREVIEW.vercel.app npm run smoke:ssr
```

Pass criteria: `/api/films` → JSON, `/sitemap.xml` → XML, `/` and a film URL → HTML with real markup (not empty `#root`).

## Later (Fly.io / Railway — one Node process)

When Hobby limits or SSR cold starts hurt:

1. Deploy this repo’s `Dockerfile` (`server/node-server.mjs` serves static + SSR).
2. Point DNS at the container.
3. Mount or proxy `/api/*`:
   - Short term: keep APIs on Vercel, proxy `/api` there from Fly; or
   - Better: port `api/*.ts` handlers into Express routes in the same process (dissolves function-count limits).
4. Replace Vercel cron with platform cron hitting your `/api/cron/...` routes.

The React app (`src/routes`, loaders, `*.server.ts`) does not change between hosts — only the adapter (`api/ssr.ts` vs `server/node-server.mjs`).

## Dashboard gotcha

Vercel project **Framework Preset** can override `vercel.json`. Set it to **Other** / unset.
