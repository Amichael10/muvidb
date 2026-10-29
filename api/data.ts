import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from './_lib/cors.js';
import { prepareRequestBody } from './_lib/request_body.js';

export const config = { api: { bodyParser: false } };

/**
 * Temporary hardened router — catch all failures so we stop returning
 * opaque FUNCTION_INVOCATION_FAILED and can restore catalogue APIs.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  try {
    await prepareRequestBody(req);
    const raw = req.query._r;
    const key = Array.isArray(raw) ? raw[0] : raw;

    // Lazy-load handlers so a bad import cannot crash the whole function at cold start.
    if (key === 'films') {
      const { handleFilms } = await import('./_lib/films_handler.js');
      return handleFilms(req, res);
    }
    if (key === 'people') {
      const { handlePeople } = await import('./_lib/people_handler.js');
      return handlePeople(req, res);
    }
    if (key === 'channels') {
      const { handleChannels } = await import('./_lib/channels_handler.js');
      return handleChannels(req, res);
    }
    if (key === 'content') {
      const { handleContent } = await import('./_lib/content_handler.js');
      return handleContent(req, res);
    }
    if (key === 'job-apply') {
      const { handleJobApply } = await import('./_lib/job_apply_handler.js');
      return handleJobApply(req, res);
    }
    if (key === 'welcome-email') {
      const { handleWelcomeEmail } = await import('./_lib/welcome_email_handler.js');
      return handleWelcomeEmail(req, res);
    }
    if (key === 'auth-email') {
      const { handleAuthEmailHook } = await import('./_lib/auth_email_handler.js');
      return handleAuthEmailHook(req, res);
    }
    if (key === 'auth-email-send') {
      const { handleAuthEmailSend } = await import('./_lib/auth_email_data.js');
      return handleAuthEmailSend(req, res);
    }
    if (key === 'actor-claims') {
      const { handleActorClaims } = await import('./_lib/actor_claims_handler.js');
      return handleActorClaims(req, res);
    }
    if (key === 'social') {
      const { default: handleSocial } = await import('./social.js');
      return handleSocial(req, res);
    }
    if (key === 'telegram') {
      const { handleTelegramOps } = await import('./_lib/telegram_ops_handler.js');
      return handleTelegramOps(req, res);
    }
    if (key === 'fetch-youtube') {
      const { handleFetchYoutube } = await import('./_lib/fetch_youtube_handler.js');
      return handleFetchYoutube(req, res);
    }
    if (key === 'outreach') {
      const { handleOutreach } = await import('./_lib/outreach_handler.js');
      return handleOutreach(req, res);
    }
    if (key === 'api-keys') {
      const { handleApiKeysAdmin } = await import('./_lib/api_keys_handler.js');
      return handleApiKeysAdmin(req, res);
    }
    if (key === 'whatsapp') {
      const { handleWhatsApp } = await import('./_lib/whatsapp_handler.js');
      return handleWhatsApp(req, res);
    }
    if (key === 'person-media') {
      const { handlePersonMedia } = await import('./_lib/person_media_handler.js');
      return handlePersonMedia(req, res);
    }
    if (key === 'film-media') {
      const { handleFilmMedia } = await import('./_lib/film_media_handler.js');
      return handleFilmMedia(req, res);
    }
    if (key === 'bachs' || key === 'webhooks/bachs') {
      const { handleBachs } = await import('./_lib/bachs_handler.js');
      return handleBachs(req, res);
    }
    if (key === 'opay' || key === 'webhooks/opay') {
      const { handleOpay } = await import('./_lib/opay_handler.js');
      return handleOpay(req, res);
    }
    if (key === 'company-claims') {
      const { handleCompanyClaims } = await import('./_lib/company_claims_handler.js');
      return handleCompanyClaims(req, res);
    }
    if (key === 'youtube-websub') {
      const { youtubeWebSubHandler } = await import('./_lib/youtube_websub.js');
      return youtubeWebSubHandler(req, res);
    }
    if (key === 'critic-videos') {
      const { handleCriticVideos } = await import('./_lib/critic_videos_handler.js');
      return handleCriticVideos(req, res);
    }
    if (key === 'automation') {
      const { default: handleAutomation } = await import('./automation.js');
      return handleAutomation(req, res);
    }

    return res.status(404).json({ error: 'Unknown resource', key: key ?? null });
  } catch (err: any) {
    if (err?.statusCode === 400 || err?.statusCode === 413) {
      return res.status(err.statusCode).json({ error: err.statusCode === 413 ? 'Request too large' : 'Invalid JSON' });
    }
    console.error('[api/data]', err);
    return res.status(500).json({ error: 'Request could not be completed' });
  }
}
