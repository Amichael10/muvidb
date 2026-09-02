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

The production hostname should be attached in Cloudflare as `content.muvidb.com`. This first shell does not yet access Supabase or publish content; it establishes destination-channel routing and the deployment boundary safely before adding queues and workflows.

The browser cannot start PowerShell directly. The dashboard therefore reports whether `127.0.0.1:4317` is available; a future desktop companion can provide true one-click start behavior.
