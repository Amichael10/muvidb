import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleProIntelQuery } from './_lib/pro_intel_handler.js';

export const maxDuration = 60;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleProIntelQuery(req, res);
}
