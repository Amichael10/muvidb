import type { Config } from '@react-router/dev/config';
import { vercelPreset } from '@vercel/react-router/vite';

export default {
  // Server-render every route. Phase 1 ships the SSR shell only — no loaders
  // yet, so pages still fetch in useEffect exactly as they do today.
  ssr: true,
  // Keep the existing src/ tree instead of moving everything to app/, so the
  // ~50 page components stay where they are.
  appDirectory: 'src',
  // Emits the whole app as a single Vercel function (see docs/SSR_MIGRATION.md
  // — the Hobby free tier caps at ~12 and we're at 7 after Phase 0).
  presets: [vercelPreset()],
} satisfies Config;
