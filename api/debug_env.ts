import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    SUPABASE_URL: !!process.env.SUPABASE_URL || !!process.env.VITE_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY || !!process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
    CRON_SECRET: !!process.env.CRON_SECRET || !!process.env.VITE_CRON_SECRET,
    FIRECRAWL_API_KEY: !!process.env.FIRECRAWL_API_KEY,
    YOUTUBE_API_KEY: !!process.env.YOUTUBE_API_KEY,
    VITE_YOUTUBE_API_KEY: !!process.env.VITE_YOUTUBE_API_KEY,
    NODE_VERSION: process.version
  });
}

