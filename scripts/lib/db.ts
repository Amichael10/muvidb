// Shared Supabase client for all scripts. Import this instead of creating
// your own client:
//
//   import { supabase } from './lib/db';          // from scripts/*.ts
//   import { supabase } from '../scripts/lib/db'; // from scratch/*.ts
//
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config(); // fall back to .env for anything not set in .env.local

const url = (process.env.VITE_SUPABASE_URL || '').trim();
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!url || !serviceKey) {
  console.error(
    'Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (checked .env.local, then .env)'
  );
  process.exit(1);
}

export const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});
