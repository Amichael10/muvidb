# MuviDB Content Engine

This is a separately deployable Cloudflare Worker inside the MuviDB Git monorepo. It is intentionally isolated from the Vercel web application.

## Local development

```sh
npm install
npm run dev
```

## Deployment

```sh
npm run check
npm run deploy:staging
npm run deploy
```

The production hostname should be attached in Cloudflare as `content.muvidb.com`. The Worker reads destinations from Supabase, exposes protected content/operations APIs, stores media in the `muvidb` R2 bucket, and runs a five-hour queue-backed publisher trigger. The existing Vercel Social Studio remains the platform adapter; the Worker calls its authenticated `publish_due` task and records retries/activity in Supabase.

Required Worker secrets (set separately for staging and production): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ENGINE_API_TOKEN`, and `PUBLISHER_TOKEN` (the Vercel `CRON_SECRET`). Never commit these values.

Operational endpoints:

- `GET /health`
- `GET /api/destinations`
- `GET /api/destination-platforms`
- `GET /api/operations/summary`
- `GET /api/content` and `GET /api/operations` with `Authorization: Bearer $ENGINE_API_TOKEN`
- `POST /api/media` with the same authorization and an `x-media-key` header

The browser cannot start PowerShell directly. The dashboard therefore reports whether `127.0.0.1:4317` is available; a future desktop companion can provide true one-click start behavior.
