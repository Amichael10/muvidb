import type { VercelRequest, VercelResponse } from '@vercel/node';
import statusHandler from './_automation/status';
import fetchChannelsHandler from './_automation/fetch-channels';
import enrichActorsHandler from './_automation/enrich-actors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { action } = req.query;

  if (action === 'status') {
    return statusHandler(req, res);
  } else if (action === 'fetch-channels') {
    return fetchChannelsHandler(req, res);
  } else if (action === 'enrich-actors') {
    return enrichActorsHandler(req, res);
  }

  return res.status(404).json({ error: 'Action not found' });
}
