import type { VercelRequest, VercelResponse } from '@vercel/node';

export const maxDuration = 60;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { handleTelegramOps } = await import('./_lib/telegram_ops_handler.js');
    return await handleTelegramOps(req, res);
  } catch (err: any) {
    console.error('[api/telegram crash]:', err);
    return res.status(500).json({
      ok: false,
      error: 'telegram handler crashed',
      message: err?.message || String(err),
      stack: (err?.stack || '').split('\n').slice(0, 10),
    });
  }
}
