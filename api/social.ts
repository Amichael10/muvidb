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

export const maxDuration = 60;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      await requireSocialStudioAdmin(req);
      return res.status(200).json(await getSocialStudioSummary());
    }

    if (req.method === 'POST') {
      const task = typeof req.query.task === 'string' ? req.query.task : req.body?.task;

      if (task === 'generate_draft') {
        const actor = await requireSocialStudioAdmin(req);

        // parseGenerateDraftRequest throws a bare Error, which would otherwise
        // fall through to the 500 branch. Bad input is the caller's fault.
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
