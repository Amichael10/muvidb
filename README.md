<p align="center">
  <a href="https://ensembla.xyz" target="_blank">
    <img src="./public/images/Ensembla%20Brand/Logo%20Red.png" alt="Ensembla Logo" width="100" />
  </a>
</p>

<h1 align="center">Ensembla</h1>

<p align="center">
  <strong>The Ultimate Nollywood Film Discovery & Cinema Showtime Platform.</strong>
</p>

<p align="center">
  <a href="https://react.dev"><img src="https://img.shields.io/badge/React-19-20232a.svg?style=for-the-badge&logo=react" alt="React 19" /></a>
  <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4.svg?style=for-the-badge&logo=tailwind-css" alt="Tailwind CSS v4" /></a>
  <a href="https://supabase.com"><img src="https://img.shields.io/badge/Supabase-Database-3ECF8E.svg?style=for-the-badge&logo=supabase" alt="Supabase" /></a>
  <a href="https://vercel.com"><img src="https://img.shields.io/badge/Vercel-Hosted-000000.svg?style=for-the-badge&logo=vercel" alt="Vercel" /></a>
  <a href="https://vite.dev"><img src="https://img.shields.io/badge/Vite-Bundler-646CFF.svg?style=for-the-badge&logo=vite" alt="Vite" /></a>
</p>

<p align="center">
  <a href="https://ensembla.xyz">🌐 Live Production Site</a> &bull;
  <a href="https://staging.ensembla.xyz">🧪 Staging Environment</a> &bull;
  <a href="https://waitlist.ensembla.xyz">🎟️ Standalone Waitlist</a>
</p>

<hr />

<p align="center">
  <img src="./public/images/Ensembla%20Brand/Ensembla%20Social%20Share.png" alt="Ensembla Social Share Banner" width="100%" style="border-radius: 8px;" />
</p>

## 🌟 Overview

**Ensembla** is a premium, state-of-the-art web application dedicated to Nollywood cinema. It bridges the gap between Nollywood film lovers and theater showtimes across Nigeria.

Ensembla features a robust, fully automated scheduling and scraping ecosystem that compiles film catalogs, maps theater schedules in real-time, displays crew/actor filmographies, syncs with major Nollywood YouTube creators, and protects resources using smart backend proxy structures and security honeypots.

---

## ✨ Core Features

* **🎬 Nollywood Showcase** — Browse a premium Nollywood catalog filtered by genre, release year, language, and NFVCB rating.
* **📅 Live Cinema Showtimes** — Ingest and link theater showtimes dynamically from major chains (Silverbird, Filmhouse, Genesis) with fuzzy title matching.
* **🌟 Cast & Crew Hub** — Comprehensive crew profiles, high-quality portraits, dynamic filmographies, and verified social media handles (Instagram, Facebook, X).
* **📹 Creator & critic Sync** — Automated statistics, view metrics, and subscriber tracking for top Nollywood YouTube content creators.
* **🔒 Admin Control Panel** — Rich administration dashboards featuring live TMDB imports, custom record curators, and a fuzzy movie-triage mapping queue.
* **🛡️ Security Honeypots** — Active backend security endpoints that detect and log automated vulnerability scanning attempts.

---

## 🛠️ Tech Stack & Architecture

| Layer | Technologies Used |
|---|---|
| **Frontend** | React 19, React Router, Tailwind CSS v4, Remix Icons, Vite |
| **Backend** | Vercel Serverless Functions (`TypeScript`) |
| **Database** | Supabase (PostgreSQL + RLS Security Policies) |
| **Automations** | GitHub Actions Cron Pipelines (Scrapers & AI Maintenance Agents) |
| **External APIs** | TMDB API, YouTube Data API v3, Playwright Headless Scraping |

### 📂 Directory Structure

```
ensembla/
├── .github/workflows/       # Highly optimized Actions cron sync pipelines
├── api/                     # Vercel serverless backend proxy API routes
│   ├── _lib/                # Shared DB connections, rate limiters, & scraper adapters
│   ├── films.ts             # GET /api/films (public catalog)
│   ├── film/[id].ts         # GET /api/film/:id (rich profile and administration data)
│   ├── people.ts            # GET /api/people (actor and filmmaker list)
│   ├── tmdb.ts              # Secure, authenticated TMDB server-side proxy
│   ├── youtube.ts           # Secure, authenticated YouTube stats proxy
│   └── data/all.ts          # Backend honeypot endpoint (anti-reconnaissance)
├── public/                  # Static assets, branding graphics, sitemap, robots.txt
├── src/                     # Core React Frontend Application
│   ├── components/          # Reusable design tokens, layouts, and input forms
│   ├── lib/                 # Supabase & service API client linkages
│   ├── pages/               # Route pages (Browsing, Showtimes, Cinemas, Waitlist, Admin)
│   └── utils/               # Catalog, mapping, and text formatters
├── supabase/                # PostgreSQL migrations, schema types, and RLS scripts
├── vercel.json              # Serverless API routing and custom rewrite configurations
└── vite.config.ts           # Bundler configurations
```

---

## 🚀 Getting Started

Follow these instructions to configure and run the Ensembla development server locally.

### 📋 Prerequisites
* Node.js v18+
* A [Supabase](https://supabase.com) database instance
* A [TMDB API Key](https://www.themoviedb.org/settings/api)
* A [Google Cloud Console Developer Key](https://console.cloud.google.com) (with YouTube Data API v3 enabled)

### 💻 Local Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Amichael10/ensembla.git
   cd ensembla
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy the environment variables template and populate the values:
   ```bash
   cp .env.example .env
   ```
   
   | Variable | Purpose / Description |
   |---|---|
   | `VITE_SUPABASE_URL` | Your Supabase project endpoint |
   | `VITE_SUPABASE_ANON_KEY` | Public anon key for frontend DB reads |
   | `SUPABASE_URL` | Same as above — used by backend Vercel functions |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase private role key (server-only, never expose) |
   | `TMDB_API_KEY` | Private Movie Database key (server-only) |
   | `YOUTUBE_API_KEY` | Private YouTube Data key (server-only) |

4. **Launch the Development Server:**
   ```bash
   npm run dev
   ```
   The local environment is now live at `http://localhost:3001`!

---

## 🛡️ Security & API Proxying

To keep user accounts secure and protect credentials, Ensembla implements strict API proxy boundaries:

* **Token Isolation:** Key APIs (`TMDB_API_KEY` and `YOUTUBE_API_KEY`) are stored safely in backend environment variables and **never** exposed to the browser.
* **Server-Side Proxies:** The frontend makes clean fetch queries to Vercel Serverless proxy routes (`/api/tmdb` and `/api/youtube`) which handle authenticating, formatting, and returning sanitized payloads.
* **Active Honeypot Tracker:** Automated vulnerability crawlers targeting `/api/data/all` are caught by a security honeypot script. The request metrics (IP, User-Agent, origin, time) are logged directly to the Supabase `honeypot_hits` table, and the connection is aborted with an immediate HTTP `403 Forbidden` response.

---

## ⚙️ Automated Sync Workflows

Ensembla features automated data pipelines orchestrated via GitHub Actions. These schedules are heavily optimized to stay well within free limits and prevent account restrictions:

* **📅 Daily Showtimes Scraping (`daily_sync.yml` @ `0 5 * * *`):** Ingests and processes active movie schedules from major cinema sites, pushing clean data to Supabase.
* **📹 Youtube Channel Tracking (`daily_sync.yml` @ `0 */8 * * *`):** Runs three times a day to fetch and save metrics for featured Nollywood YouTube channels.
* **🤖 AI Catalog Maintenance (`daily_sync.yml` @ `0 2,14 * * *`):** Triggers twice a day to clean duplicate fields and format names dynamically.
* **👁️ Vision & Cast Sync (`cast_vision_sync.yml` @ `0 3,15 * * *`):** Runs twice a day to fetch casting details from Nollywood databases.

---

## 🤝 Contributing

Contributions to Ensembla are welcome! Please follow these guidelines:
1. Fork the repository.
2. Create a clean feature branch: `git checkout -b feature/your-awesome-feature`
3. Commit your changes: `git commit -m "feat(scope): add high-fidelity component"`
4. Push to the branch: `git push origin feature/your-awesome-feature`
5. Open a Pull Request pointing to `staging`.

---

## 📄 License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.

---

<p align="center">
  Made with 🍿 & 💖 by <a href="https://github.com/Amichael10">Amichael10</a>
</p>
