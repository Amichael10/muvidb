/**
 * Supabase Auth Send Email hook (isolated from api/data for reliability).
 * URL: https://muvidb.com/api/auth-email
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleAuthEmailHook } from './_lib/auth_email_handler.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req: VercelRequest): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer | string>) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    const raw = await readRawBody(req);
    (req as VercelRequest & { body: string }).body = raw;
  }
  return handleAuthEmailHook(req, res);
}
