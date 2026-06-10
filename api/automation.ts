import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isValidAuth } from './_lib/auth';
import statusHandler from './_automation/status';
import fetchChannelsHandler from './_automation/fetch-channels';
import enrichActorsHandler from './_automation/enrich-actors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { action } = req.query;

  // Read-only job status — no privileged side effects.
  if (action === 'status') {
    return statusHandler(req, res);
  }

  // The remaining actions write to the DB and consume paid AI/YouTube
  // quota, so they require an authenticated admin/cron caller.
  if (action === 'fetch-channels' || action === 'enrich-actors') {
    if (!(await isValidAuth(req))) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return action === 'fetch-channels'
      ? fetchChannelsHandler(req, res)
      : enrichActorsHandler(req, res);
  }

  return res.status(404).json({ error: 'Action not found' });
}
