import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  generateSocialDraft,
  getSocialStudioSummary,
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
