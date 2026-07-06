---
name: scraper-recon
description: Investigate a new website/platform as a scraping source (find its API, dump HTML, intercept XHR, screenshot). Use when onboarding a new film/cinema/streaming source or debugging why an existing scraper broke.
---

# Scraper reconnaissance

## Rule 1: no one-off sniff/intercept/dump/screenshot scripts

The repo root is littered with dozens of abandoned `intercept_*.cjs`,
`sniff_*.ts`, `*_dump.html`, `screenshot_*` files from past investigations.
Use the recon runner instead; prototype parsers in `scratch/` (gitignored).

## Step 1: run recon

```
npm run recon -- <url> [--stealth] [--headed] [--wait ms] [--filter str]
```

One run captures everything into `scratch/recon/<host>/<timestamp>/`:

- `summary.txt` — candidate API endpoints ranked by JSON response size (start here)
- `next_data.json` — present means it's a Next.js site; often the whole catalog
  is in here and no API sniffing is needed (see `sync-filmhouse.ts` for a
  working `__NEXT_DATA__` adapter)
- `network.json` + `responses/*.json` — every request and captured JSON body
- `page.html`, `screenshot.png` — rendered DOM and visual state

Use `--stealth` if the first run gets blocked/challenged (Cloudflare, Netflix-style
bot walls). Use `--filter api` (or a hostname fragment) to capture only matching
response bodies on noisy sites.

## Step 2: identify the data source, in this order

1. `next_data.json` exists and contains the catalog → parse it directly (cheapest, most stable).
2. A JSON endpoint in `summary.txt` returns the catalog → replay it with plain
   `fetch`/`undici` (copy method, headers, postData from `network.json`).
3. Neither → parse `page.html` with cheerio; last resort is live Playwright scraping.

## Step 3: prototype the parser in scratch/

Write `scratch/parse_<site>.ts` reading the saved recon files (never re-fetch
while iterating on parsing). Run with `npx tsx scratch/parse_<site>.ts`.

## Step 4: graduate to a real adapter

Only when the parser works: create `scripts/<site>_sync.ts` modeled on an
existing adapter (`sync_feed_kappa.ts`, `sync-filmhouse.ts`), import the shared
client from `scripts/lib/db.ts`, and add an npm script (`"sync:<site>"` or
`"scrape:<site>"`). Delete the scratch files.
