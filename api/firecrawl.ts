import type { VercelRequest, VercelResponse } from '@vercel/node';
import FirecrawlApp from '@mendable/firecrawl-js';
import { checkRateLimit } from './_lib/rateLimit';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Only allow scraping YouTube channel video pages — nothing else.
const ALLOWED_URL_PATTERN = /^https:\/\/(www\.)?youtube\.com\/@[\w-]+\/videos\/?$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (checkRateLimit(req as unknown as Request)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url param' });
  }

  if (!ALLOWED_URL_PATTERN.test(url)) {
    return res.status(403).json({ error: 'URL not permitted' });
  }

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Firecrawl not configured' });
  }

  try {
    const app = new FirecrawlApp({ apiKey });
    const result = await (app as any).scrape(url, { formats: ['markdown'] });

    if (!result.success) {
      return res.status(502).json({ error: 'Firecrawl scrape failed' });
    }

    return res.status(200).json({ markdown: result.markdown ?? '' });
  } catch (err) {
    console.error('Firecrawl error:', err);
    return res.status(500).json({ error: 'Failed to scrape URL' });
  }
}
