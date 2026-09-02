import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function applyPersonMediaMigration() {
  const sql = fs.readFileSync('supabase/migrations/20260901000003_create_person_media_table.sql', 'utf-8');
  console.log('Applying person_media migration via Supabase...');

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({ query: sql })
  });

  const text = await response.text();
  console.log('Result:', response.status, text);
}

applyPersonMediaMigration().catch(console.error);
