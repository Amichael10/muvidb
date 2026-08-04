import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleFilms } from './_lib/films_handler.js';
import { handlePeople } from './_lib/people_handler.js';
import { handleChannels } from './_lib/channels_handler.js';
import { handleContent } from './_lib/content_handler.js';
import { handleJobApply } from './_lib/job_apply_handler.js';
import { handleWelcomeEmail } from './_lib/welcome_email_handler.js';

// Consolidated data router (Hobby free-tier function budget — see
// docs/SSR_MIGRATION.md). Public paths are preserved by vercel.json rewrites:
//   /api/films    -> /api/data?_r=films
//   /api/people   -> /api/data?_r=people
//   /api/channels -> /api/data?_r=channels
//   /api/content  -> /api/data?_r=content
//   /api/job-apply -> /api/data?_r=job-apply
//   /api/send-welcome-email -> /api/data?_r=welcome-email
//
// Telegram webhook lives in api/telegram.ts (separate function) so a bot
// failure cannot crash this router.
//
// The router param is `_r`, NOT `resource`: content.ts already owns `?resource=`
// as its own dispatch key (film-credits, person-credits, person-films,
// film-reviews) and the frontend calls it that way, so reusing `resource` here
// would collide with the caller's own value.

const ROUTES = {
  films: handleFilms,
  people: handlePeople,
  channels: handleChannels,
  content: handleContent,
  'job-apply': handleJobApply,
  'welcome-email': handleWelcomeEmail,
} as const;

const TRACKED = new Set(['films', 'people', 'content', 'channels']);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = req.query._r;
  const key = Array.isArray(raw) ? raw[0] : raw;
  const route = ROUTES[key as keyof typeof ROUTES];
  if (!route) return res.status(404).json({ error: 'Unknown resource' });

  // Soft guard — never take down public APIs if blocklist/scrape tracking fails.
  try {
    const { rejectIfBlocked, trackPageHit } = await import('./_lib/scrape_guard.js');
    if (await rejectIfBlocked(req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (typeof key === 'string' && TRACKED.has(key)) {
      trackPageHit(req, `/api/${key}`, 'api');
    }
  } catch (err: any) {
    console.warn('[api/data] scrape guard skipped:', err?.message || err);
  }

  return route(req, res);
}
