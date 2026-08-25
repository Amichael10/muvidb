/**
 * Dedicated Telegram webhook endpoint (isolated from api/data so ops
 * code cannot take down films/people APIs).
 *
 * URL: https://muvidb.com/api/telegram
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleTelegramOps } from './_lib/telegram_ops_handler.js';

// Media extraction is handled inside this existing endpoint so the bot can
// return playable Shorts without consuming another serverless function.
export const maxDuration = 60;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleTelegramOps(req, res);
}
