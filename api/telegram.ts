import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleTelegramOps } from './_lib/telegram_ops_handler';

export const maxDuration = 60;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleTelegramOps(req, res);
}
