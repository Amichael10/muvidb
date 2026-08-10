import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function applyDistributorColumn() {
  console.log('🚀 Checking/Adding distributor column to films table in Supabase...');

  // Attempt exec_sql rpc if available
  try {
    const { error } = await supabase.rpc('exec_sql', {
      sql_query: 'ALTER TABLE public.films ADD COLUMN IF NOT EXISTS distributor TEXT;'
    });
    if (error) {
      console.log('rpc exec_sql notice:', error.message);
    }
  } catch (err) {
    console.log('exec_sql fallback:', err);
  }

  // Verify column presence by querying it
  const { data, error } = await supabase.from('films').select('id, distributor').limit(1);
  if (error) {
    console.error('❌ Distributor column check failed:', error.message);
  } else {
    console.log('✅ Distributor column is READY on table public.films!');
  }
}

applyDistributorColumn();
