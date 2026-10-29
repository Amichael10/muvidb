import dns from 'node:dns';
import { Agent, setGlobalDispatcher } from 'undici';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const customLookup = (hostname: string, options: any, callback: any) => {
  if (hostname === 'pkenrmorywmuvnzfoylp.supabase.co') {
    if (options && options.all) return callback(null, [{ address: '172.64.149.246', family: 4 }]);
    return callback(null, '172.64.149.246', 4);
  }
  return (dns.lookup as any)(hostname, options, callback);
};
setGlobalDispatcher(new Agent({ connect: { lookup: customLookup, timeout: 30000 } }));

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://pkenrmorywmuvnzfoylp.supabase.co').trim();
const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

async function main() {
  const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '20261028000000_create_film_media_table.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('🚀 Applying film_media table migration...');

  const dbUrl = process.env.DATABASE_URL || process.env.DIRECT_URL || process.env.SUPABASE_DB_URL;
  if (dbUrl) {
    try {
      console.log('Connecting via direct Postgres connection...');
      const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
      await client.connect();
      await client.query(sql);
      console.log('✅ Successfully applied migration via PG direct connection!');
      await client.end();
    } catch (err: any) {
      console.warn('Direct PG failed:', err.message);
    }
  }

  // Also try /rest/v1/rpc/exec_sql
  try {
    console.log('Applying via exec_sql RPC endpoint...');
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ query: sql })
    });
    console.log('RPC response status:', res.status);
    if (!res.ok) {
      console.warn('RPC response text:', await res.text());
    } else {
      console.log('✅ RPC exec_sql succeeded!');
    }
  } catch (err: any) {
    console.warn('RPC exec_sql error:', err.message);
  }

  // Verify table
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data, error } = await supabase.from('film_media').select('id').limit(1);
  if (error) {
    console.error('❌ Table check failed:', error.message);
  } else {
    console.log('🎉 Verified table public.film_media exists and is queryable! Data:', data);
  }
}

main().catch(console.error);
