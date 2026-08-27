import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Temporary hardened router — catch all failures so we stop returning
 * opaque FUNCTION_INVOCATION_FAILED and can restore catalogue APIs.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
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
      const { handleAuthEmailData } = await import('./_lib/auth_email_data.js');
      return handleAuthEmailData(req, res);
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
    if (key === 'fetch-youtube') {
      const { default: handleFetchYoutube } = await import('./fetch-youtube.js');
      return handleFetchYoutube(req, res);
    }

    return res.status(404).json({ error: 'Unknown resource', key: key ?? null });
  } catch (err: any) {
    console.error('[api/data]', err);
    return res.status(500).json({
      error: 'data router failed',
      message: err?.message || String(err),
      stack: (err?.stack || '').split('\n').slice(0, 8),
    });
  }
}
