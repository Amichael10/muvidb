<div align="center">
<img width="1200" height="475" alt="Lumi Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# Lumi

**The Nollywood film discovery platform.**
Browse films, explore cast and crew, find showtimes, and follow your favourite Nigerian filmmakers and creators.

</div>

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, React Router, Tailwind CSS v4, Vite |
| Backend | Vercel Serverless Functions (`/api`) |
| Database | Supabase (PostgreSQL + Row Level Security) |
| External APIs | TMDB, YouTube Data API v3 |
| Deployment | Vercel |

---

## Features

- **Browse & Search** — Filter Nollywood films by genre, year, language, and NFVCB rating
- **Film Pages** — Poster, backdrop, cast, crew, ratings, and streaming info
- **People** — Profiles for actors, directors, and producers with filmographies
- **Cinemas & Showtimes** — Find where films are playing near you
- **YouTube Creators** — Follow Nollywood creators with live channel stats
- **Admin Panel** — Manage films, people, and sync data from TMDB and YouTube

---

## Project Structure

```
/
├── api/                    # Vercel serverless API routes
│   ├── _lib/               # Shared server utilities (Supabase client, rate limiter)
│   ├── films.ts            # GET /api/films
│   ├── film/[id].ts        # GET /api/film/:id
│   ├── people.ts           # GET /api/people
│   ├── tmdb.ts             # Authenticated TMDB proxy
│   ├── youtube.ts          # Authenticated YouTube Data API proxy
│   └── data/all.ts         # Honeypot endpoint
├── src/
│   ├── components/         # Reusable UI components
│   ├── lib/                # Supabase and YouTube client helpers
│   ├── pages/              # Route-level page components
│   └── utils/              # TMDB and YouTube utility functions
├── vercel.json             # Routing config — /api/* → serverless, * → index.html
└── vite.config.ts
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [TMDB](https://www.themoviedb.org/settings/api) API key
- A [YouTube Data API v3](https://console.cloud.google.com) key

### Local Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**

   Copy `.env.example` to `.env` and fill in your values:

   ```bash
   cp .env.example .env
   ```

   | Variable | Description |
   |---|---|
   | `VITE_SUPABASE_URL` | Your Supabase project URL |
   | `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
   | `SUPABASE_URL` | Same as above — used by serverless functions |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only, never expose) |
   | `TMDB_API_KEY` | TMDB API key (server-only) |
   | `YOUTUBE_API_KEY` | YouTube Data API v3 key (server-only) |

3. **Start the dev server**
   ```bash
   npm run dev
   ```
   App runs at `http://localhost:3001`

---

## Deployment (Vercel)

1. Connect the repo to a Vercel project
2. Add all environment variables listed above in **Project → Settings → Environment Variables**
3. If using the Vercel Supabase integration, `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set automatically — you still need to add `SUPABASE_SERVICE_ROLE_KEY`, `TMDB_API_KEY`, and `YOUTUBE_API_KEY` manually
4. Deploy — Vercel auto-detects Vite and runs `vite build`

> **Note:** `TMDB_API_KEY` and `YOUTUBE_API_KEY` are server-only variables. They are never included in the client bundle — all calls go through the `/api/tmdb` and `/api/youtube` proxy routes.

---

## API Routes

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/films` | List films. Query params: `search`, `country`, `year`, `language`, `limit`, `offset` |
| `GET` | `/api/film/:id` | Single film. Returns extra fields for authenticated requests |
| `GET` | `/api/people` | List people. Query params: `search`, `sort`, `limit`, `offset` |
| `GET` | `/api/tmdb` | Authenticated TMDB proxy (admin use) |
| `GET` | `/api/youtube` | Authenticated YouTube proxy (admin use) |
| `ANY` | `/api/data/all` | Honeypot — always 403, logs hit to `honeypot_hits` table |

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start local dev server on port 3001 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | TypeScript type check (`tsc --noEmit`) |
