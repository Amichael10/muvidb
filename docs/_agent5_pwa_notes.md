# Agent / PWA notes for SSR

- `navigateFallback` must not point at `index.html` (RR SSR does not emit a SPA shell).
- `cleanupOutdatedCaches: true` + `registerType: 'autoUpdate'` are set in `vite.config.ts`.
- `/api/*` uses NetworkOnly so the SW never caches JSON as HTML.
- After a bad deploy, users may need Application → Clear site data once.
