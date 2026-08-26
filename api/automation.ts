import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isValidAuth } from './_lib/auth';
import statusHandler from './_automation/status';
import fetchChannelsHandler from './_automation/fetch-channels';
import enrichActorsHandler from './_automation/enrich-actors';
import scrapeImdbActorHandler from './_lib/scrape_imdb_actor_handler';
import deduplicatorHandler from './_lib/deduplicator_handler';
import peopleEnrichmentHandler from './_lib/people_enrichment_handler';
import { renewYouTubeWebSubSubscriptions, youtubeWebSubHandler } from './_lib/youtube_websub';

export const maxDuration = 60;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { action } = req.query;

  // Read-only job status — no privileged side effects.
  if (action === 'status') {
    return statusHandler(req, res);
  }

  // Handlers that self-check auth internally (dedupe / enrichment).
  if (action === 'deduplicator') {
    return deduplicatorHandler(req, res);
  }

  if (action === 'people-enrichment') {
    return peopleEnrichmentHandler(req, res);
  }

  // Public callback secured by an unguessable callback token and WebSub HMAC.
  // It must remain reachable by Google's hub without an admin JWT.
  if (action === 'youtube-websub') {
    return youtubeWebSubHandler(req, res);
  }

  // Write / paid-quota actions — require admin JWT or cron secret.
  if (
    action === 'scrape-imdb-actor' ||
    action === 'fetch-channels' ||
    action === 'enrich-actors' ||
    action === 'youtube-websub-renew'
  ) {
    if (!(await isValidAuth(req)).valid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (action === 'scrape-imdb-actor') return scrapeImdbActorHandler(req, res);
    if (action === 'youtube-websub-renew') {
      if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
      }
      return res.status(200).json(
        await renewYouTubeWebSubSubscriptions({
          force: String(req.query.force || '') === 'true',
        }),
      );
    }
    return action === 'fetch-channels' ? fetchChannelsHandler(req, res) : enrichActorsHandler(req, res);
  }

  return res.status(404).json({ error: 'Action not found' });
}
