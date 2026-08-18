import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  generateSocialDraft,
  getSocialStudioSummary,
  isSocialReviewAction,
  cancelContentSchedule,
  reviewContentItem,
  scheduleContentItem,
  requireSocialPublisherAuth,
  requireSocialStudioAdmin,
  runSocialPublisher,
  socialHttpErrorPayload,
  parseGenerateDraftRequest,
} from './_lib/social_studio.js';
import { handleEditorialTask } from './_lib/editorial_handler.js';
import {
  completeThreadsOAuth,
  createThreadsAuthorizationUrl,
  disconnectThreads,
  getThreadsConfiguration,
  getThreadsConnection,
  sanitizeThreadsConnection,
  threadsAdminRedirect,
} from './_lib/threads_oauth.js';

export const maxDuration = 60;

const EDITORIAL_TASKS = new Set([
  'candidates',
  'calendar',
  'series',
  'generate_brief',
  'mark_published',
  'overview',
]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const task = (req.query?.task || req.body?.task || '').toString();
  const scope = (req.query?.scope || req.body?.scope || '').toString();

  // Route to Editorial Handler if scope=editorial or task matches editorial task
  if (scope === 'editorial' || EDITORIAL_TASKS.has(task)) {
    return handleEditorialTask(req, res);
  }

  if (req.method === 'GET' && task === 'threads_callback') {
    try {
      await completeThreadsOAuth(req);
      const dest = threadsAdminRedirect(req, 'connected');
      res.setHeader('Location', dest);
      return res.status(302).end();
    } catch (error) {
      const errMsg = (error as Error)?.message || 'We could not connect Threads. Please check the app settings and try again.';
      console.error('Threads OAuth callback error:', errMsg);
      try {
        const dest = threadsAdminRedirect(req, 'error', errMsg);
        res.setHeader('Location', dest);
        return res.status(302).end();
      } catch (redirectErr) {
        return res.status(200).send(`
          <!DOCTYPE html>
          <html>
            <head><title>Threads Connection</title><meta http-equiv="refresh" content="3;url=/admin/social-studio"></head>
            <body style="background:#111;color:#fff;font-family:sans-serif;padding:40px;text-align:center;">
              <h2>Threads connection issue</h2>
              <p style="color:#f87171;">${errMsg}</p>
              <p><a href="/admin/social-studio" style="color:#f97316;">Return to Social Studio</a></p>
            </body>
          </html>
        `);
      }
    }
  }

  // Deauthorization & Data Deletion Callbacks required by Meta
  if (task === 'threads_deauth') {
    return res.status(200).json({ success: true, message: 'Threads deauthorized successfully' });
  }

  if (task === 'threads_delete') {
    const confirmationCode = 'muvidb_del_' + Date.now();
    return res.status(200).json({
      url: 'https://muvidb.com/privacy',
      confirmation_code: confirmationCode,
    });
  }

  try {
    if (req.method === 'GET') {
      await requireSocialStudioAdmin(req);
      if (task === 'threads_status') {
        const connection = await getThreadsConnection();
        return res.status(200).json({
          configuration: getThreadsConfiguration(req),
          connection: sanitizeThreadsConnection(connection),
        });
      }
      return res.status(200).json(await getSocialStudioSummary());
    }

    if (req.method === 'POST') {
      if (task === 'threads_oauth_start') {
        const actor = await requireSocialStudioAdmin(req);
        return res.status(200).json({ authorizationUrl: await createThreadsAuthorizationUrl(req, actor) });
      }

      if (task === 'threads_disconnect') {
        await requireSocialStudioAdmin(req);
        return res.status(200).json(await disconnectThreads());
      }

      if (task === 'generate_draft') {
        const actor = await requireSocialStudioAdmin(req);
        let parsed;
        try {
          parsed = parseGenerateDraftRequest(req.body);
        } catch (parseErr) {
          return res.status(400).json({ error: (parseErr as Error).message });
        }
        return res.status(201).json(await generateSocialDraft(parsed, actor));
      }

      if (task === 'review') {
        const actor = await requireSocialStudioAdmin(req);
        const { contentItemId, action, reason } = req.body || {};

        if (!isSocialReviewAction(action)) {
          return res.status(400).json({ error: 'action must be submit, approve, reject or reopen' });
        }
        if (typeof contentItemId !== 'string' || !contentItemId) {
          return res.status(400).json({ error: 'contentItemId is required' });
        }

        return res.status(200).json(await reviewContentItem({ contentItemId, action, reason }, actor));
      }

      if (task === 'schedule') {
        const actor = await requireSocialStudioAdmin(req);
        const { contentItemId, scheduledFor } = req.body || {};

        if (typeof contentItemId !== 'string' || !contentItemId) {
          return res.status(400).json({ error: 'contentItemId is required' });
        }
        if (typeof scheduledFor !== 'string' || !scheduledFor) {
          return res.status(400).json({ error: 'scheduledFor is required' });
        }

        return res.status(200).json(await scheduleContentItem({ contentItemId, scheduledFor }, actor));
      }

      if (task === 'cancel_schedule') {
        const actor = await requireSocialStudioAdmin(req);
        const { contentItemId } = req.body || {};

        if (typeof contentItemId !== 'string' || !contentItemId) {
          return res.status(400).json({ error: 'contentItemId is required' });
        }

        return res.status(200).json(await cancelContentSchedule({ contentItemId }, actor));
      }

      if (task === 'publish_due') {
        await requireSocialPublisherAuth(req);
        const result = await runSocialPublisher({
          limit: Number(req.body?.limit || req.query.limit || 10),
          lockedBy: 'api-social',
        });
        return res.status(200).json(result);
      }

      return res.status(400).json({ error: 'Unsupported social task' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    const payload = socialHttpErrorPayload(err);
    return res.status(payload.status).json(payload.body);
  }
}
