import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from './_lib/cors.js';

export const maxDuration = 60;

/**
 * Hardened automation router with lazy-loaded handlers.
 * Prevents cold-start bundle evaluation failures from taking down the entire endpoint.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  const { action } = req.query;
  const pathname = (req.url || '').split('?')[0];

  try {
    // 1. Telegram webhook endpoint
    if (action === 'telegram' || pathname.includes('/api/telegram')) {
      const { handleTelegramOps } = await import('./_lib/telegram_ops_handler.js');
      return handleTelegramOps(req, res);
    }

    // 2. Supabase Auth Email hook
    if (action === 'auth-email' || pathname.includes('/api/auth-email')) {
      try {
        const { handleAuthEmailHook } = await import('./_lib/auth_email_handler.js');
        return await handleAuthEmailHook(req, res);
      } catch (err: any) {
        console.error('[auth-email] handler failed:', err?.message || err);
        return res.status(500).json({
          error: 'auth-email failed',
          message: err?.message || String(err),
        });
      }
    }

    // 3. Read-only job status
    if (action === 'status') {
      const { default: statusHandler } = await import('./_automation/status.js');
      return statusHandler(req, res);
    }

    // 4. Handlers that self-check auth internally (dedupe / enrichment)
    if (action === 'deduplicator') {
      const { default: deduplicatorHandler } = await import('./_lib/deduplicator_handler.js');
      return deduplicatorHandler(req, res);
    }

    if (action === 'people-enrichment') {
      const { default: peopleEnrichmentHandler } = await import('./_lib/people_enrichment_handler.js');
      return peopleEnrichmentHandler(req, res);
    }

    // 5. YouTube WebSub (PubSubHubbub callback for upload notifications)
    // Public callback secured by unguessable callback token and HMAC secret.
    if (action === 'youtube-websub') {
      const { youtubeWebSubHandler } = await import('./_lib/youtube_websub.js');
      return youtubeWebSubHandler(req, res);
    }

    // 6. Privileged / quota-consuming actions — require valid auth token
    if (
      action === 'scrape-imdb-actor' ||
      action === 'fetch-channels' ||
      action === 'enrich-actors' ||
      action === 'youtube-websub-renew' ||
      action === 'youtube-rss-watch'
    ) {
      const { isValidAuth } = await import('./_lib/auth.js');
      if (!(await isValidAuth(req)).valid) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (action === 'scrape-imdb-actor') {
        const { default: scrapeImdbActorHandler } = await import('./_lib/scrape_imdb_actor_handler.js');
        return scrapeImdbActorHandler(req, res);
      }

      if (action === 'youtube-websub-renew') {
        if (req.method !== 'POST' && req.method !== 'GET') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        const { renewYouTubeWebSubSubscriptions } = await import('./_lib/youtube_websub.js');
        return res.status(200).json(
          await renewYouTubeWebSubSubscriptions({
            force: String(req.query.force || '') === 'true',
          }),
        );
      }

      if (action === 'youtube-rss-watch') {
        const { runYouTubeUploadWatch } = await import('./_lib/youtube_upload_notify.js');
        return res.status(200).json(await runYouTubeUploadWatch());
      }

      if (action === 'fetch-channels') {
        const { default: fetchChannelsHandler } = await import('./_automation/fetch-channels.js');
        return fetchChannelsHandler(req, res);
      }

      const { default: enrichActorsHandler } = await import('./_automation/enrich-actors.js');
      return enrichActorsHandler(req, res);
    }

    return res.status(404).json({ error: 'Action not found' });
  } catch (err: any) {
    console.error(`[automation] Uncaught error handling action=${action}:`, err?.message || err);
    return res.status(500).json({
      error: 'internal_automation_error',
      message: err?.message || String(err),
    });
  }
}
