import type { VercelRequest, VercelResponse } from '@vercel/node';

export const maxDuration = 10;

/** The previous generation, scheduling and publishing contract is retired. */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(410).json({
    error: 'legacy_social_studio_retired',
    message: 'The previous social generation and publishing workflow has been removed.',
  });
}
