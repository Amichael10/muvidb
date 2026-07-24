import type { Config } from '@react-router/dev/config';

export default {
  // Server-render every route. Loaders land page-by-page; until then pages
  // still fetch in useEffect exactly as they do today.
  ssr: true,
  // Keep the existing src/ tree instead of moving everything to app/, so the
  // ~50 page components stay where they are.
  appDirectory: 'src',
  // No vercelPreset(): that triggers Build Output API takeover and zeroes out
  // api/ detection. See docs/WORK_LOG.md invert-fix.
} satisfies Config;
