import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isValidAuth } from './_lib/auth';
import statusHandler from './_automation/status';
import fetchChannelsHandler from './_automation/fetch-channels';
import enrichActorsHandler from './_automation/enrich-actors';
import scrapeImdbActorHandler from './_lib/scrape_imdb_actor_handler';
import deduplicatorHandler from './_lib/deduplicator_handler';
import peopleEnrichmentHandler from './_lib/people_enrichment_handler';

export const maxDuration = 60;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { action } = req.query;

  // Read-only job status — no privileged side effects.
  if (action === 'status') {
    return statusHandler(req, res);
  }

  if (action === 'scrape-imdb-actor') {
    return scrapeImdbActorHandler(req, res);
  }

  if (action === 'deduplicator') {
    return deduplicatorHandler(req, res);
  }

  if (action === 'people-enrichment') {
    return peopleEnrichmentHandler(req, res);
  }

  // The remaining actions write to the DB and consume paid AI/YouTube
  // quota, so they require an authenticated admin/cron caller.
  if (action === 'fetch-channels' || action === 'enrich-actors') {
    if (!(await isValidAuth(req)).valid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return action === 'fetch-channels'
      ? fetchChannelsHandler(req, res)
      : enrichActorsHandler(req, res);
  }

  return res.status(404).json({ error: 'Action not found' });
}
