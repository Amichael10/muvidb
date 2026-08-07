import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('🚀 Applying Critics and Theatre Schema Migration to Supabase...');

  const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '20260807180000_critics_and_theatre_schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Execute SQL statements using rpc or direct exec if available
  // Fallback to checking table creation directly
  try {
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (error) {
      console.log('ℹ️ Notice from exec_sql:', error.message);
    }
  } catch (err) {
    console.log('exec_sql not available, ensuring tables via query verification...');
  }

  // Verify tables
  const { data: criticsData, error: criticsError } = await supabase.from('critics').select('id').limit(1);
  if (criticsError) {
    console.error('❌ Table public.critics error:', criticsError.message);
  } else {
    console.log('✅ Table public.critics is READY');
  }

  const { data: playsData, error: playsError } = await supabase.from('plays').select('id').limit(1);
  if (playsError) {
    console.error('❌ Table public.plays error:', playsError.message);
  } else {
    console.log('✅ Table public.plays is READY');
  }

  const { data: creditsData, error: creditsError } = await supabase.from('stage_credits').select('id').limit(1);
  if (creditsError) {
    console.error('❌ Table public.stage_credits error:', creditsError.message);
  } else {
    console.log('✅ Table public.stage_credits is READY');
  }
}

applyMigration().catch(console.error);
