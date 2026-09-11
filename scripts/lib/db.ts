// Shared Supabase client for all scripts. Import this instead of creating
// your own client:
//
//   import { supabase } from './lib/db';          // from scripts/*.ts
//   import { supabase } from '../scripts/lib/db'; // from scratch/*.ts
//
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import { Agent, setGlobalDispatcher } from 'undici';
// The hosted DB has been answering in 8-15s under load, and undici's DEFAULT
// 10s connect timeout was killing long-running scripts mid-run
// (UND_ERR_CONNECT_TIMEOUT). Give connections real headroom.
setGlobalDispatcher(
  new Agent({
    connect: { timeout: 60_000 },
    headersTimeout: 300_000,
    bodyTimeout: 300_000,
  })
);

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config(); // fall back to .env for anything not set in .env.local

// CI workflows usually set SUPABASE_URL; local scripts often use VITE_SUPABASE_URL.
const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://pkenrmorywmuvnzfoylp.supabase.co').trim();
const serviceKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_KEY ||
  ''
).trim();

if (!url || !serviceKey) {
  console.error(
    '❌ Missing VITE_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (checked .env.local, then .env)'
  );
  process.exit(1);
}

if (serviceKey.startsWith('sb_publishable_')) {
  console.warn('⚠️ WARNING: SUPABASE_SERVICE_ROLE_KEY is set to a publishable (anon) key.');
  console.warn('⚠️ Admin/Worker operations that access RLS-protected tables (like artist_outreach) will fail.');
  console.warn('👉 Please set SUPABASE_SERVICE_ROLE_KEY to your Supabase project\'s secret "service_role" key in .env.local.');
}

// Retry transient network blips so a long batch job doesn't abort on one hiccup.
const retryingFetch: typeof fetch = async (input, init) => {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await fetch(input as any, init as any);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastErr;
};

export const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
  global: { fetch: retryingFetch },
});
