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
} from './_lib/social_studio.js';
import { parseGenerateDraftRequest } from '../src/features/social-studio/domain/validation.js';
import { handleEditorialTask } from './_lib/editorial_handler.js';

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

  const task = (req.query.task || req.body?.task || '').toString();
  const scope = (req.query.scope || req.body?.scope || '').toString();

  // Route to Editorial Handler if scope=editorial or task matches editorial task
  if (scope === 'editorial' || EDITORIAL_TASKS.has(task)) {
    return handleEditorialTask(req, res);
  }

  try {
    if (req.method === 'GET') {
      await requireSocialStudioAdmin(req);
      return res.status(200).json(await getSocialStudioSummary());
    }

    if (req.method === 'POST') {
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
