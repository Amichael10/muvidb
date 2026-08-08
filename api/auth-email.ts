/**
 * Supabase Auth Send Email hook (isolated from api/data for reliability).
 * URL: https://muvidb.com/api/auth-email
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  api: {
    bodyParser: false,
  },
};

function readRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer | string) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { handleAuthEmailHook } = await import('./_lib/auth_email_handler.js');
    if (req.method === 'POST') {
      const raw = await readRawBody(req);
      (req as VercelRequest & { body: string }).body = raw;
    }
    return await handleAuthEmailHook(req, res);
  } catch (err: any) {
    console.error('[auth-email] handler failed:', err?.message || err);
    return res.status(500).json({
      error: 'auth-email failed',
      message: err?.message || String(err),
    });
  }
}
