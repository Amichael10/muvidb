import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isValidAuth } from './_lib/auth';
import statusHandler from './_automation/status';

export const maxDuration = 60;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { action } = req.query;

  // Read-only job status — no privileged side effects.
  if (action === 'status') {
    return statusHandler(req, res);
  }

  // Lazy-load heavier handlers so a Gemini/SDK import failure cannot
  // take down status or unrelated automation actions.
  if (action === 'scrape-imdb-actor') {
    const { default: scrapeImdbActorHandler } = await import('./_lib/scrape_imdb_actor_handler');
    return scrapeImdbActorHandler(req, res);
  }

  if (action === 'deduplicator') {
    const { default: deduplicatorHandler } = await import('./_lib/deduplicator_handler');
    return deduplicatorHandler(req, res);
  }

  if (action === 'people-enrichment') {
    const { default: peopleEnrichmentHandler } = await import('./_lib/people_enrichment_handler');
    return peopleEnrichmentHandler(req, res);
  }

  // The remaining actions write to the DB and consume paid AI/YouTube
  // quota, so they require an authenticated admin/cron caller.
  if (action === 'fetch-channels' || action === 'enrich-actors') {
    if (!(await isValidAuth(req)).valid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (action === 'fetch-channels') {
      const { default: fetchChannelsHandler } = await import('./_automation/fetch-channels');
      return fetchChannelsHandler(req, res);
    }
    const { default: enrichActorsHandler } = await import('./_automation/enrich-actors');
    return enrichActorsHandler(req, res);
  }

  return res.status(404).json({ error: 'Action not found' });
}
