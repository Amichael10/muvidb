import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config();

async function main() {
  const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '20261012100000_create_filmmaker_portfolios.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const dbUrl = process.env.DATABASE_URL || process.env.DIRECT_URL || process.env.SUPABASE_DB_URL;
  if (dbUrl) {
    console.log('Connecting via PG client...');
    const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      console.log('Connected to PG!');
      await client.query(sql);
      console.log('Successfully executed migration via PG client!');
      await client.end();
      return;
    } catch (err) {
      console.error('PG direct query failed:', err);
      try { await client.end(); } catch (_) {}
    }
  }

  // Fallback via Supabase REST RPC
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    console.log('Attempting RPC exec_sql with service role key...');
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({ query: sql })
    });
    console.log('RPC response status:', res.status, await res.text());

    // Verify table exists
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const check = await supabase.from('filmmaker_portfolios').select('id').limit(1);
    console.log('Check filmmaker_portfolios table query result:', check);
  }
}

main().catch(console.error);
