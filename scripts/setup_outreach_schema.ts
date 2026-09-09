import { serviceSupabase } from './lib/credit_consensus_verifier';
import fs from 'fs';
import path from 'path';

async function checkOrSetupSchema() {
  console.log('🔍 Checking outreach tables in Supabase...');

  // Try select from outreach_queue
  const { data, error } = await serviceSupabase.from('outreach_queue').select('id').limit(1);

  if (error) {
    console.log('ℹ️ Table outreach_queue error or does not exist:', error.message);
    console.log('Please execute the migration SQL in Supabase SQL editor if not auto-created:');
    console.log(path.resolve('supabase/migrations/20260909000000_instagram_outreach_automation.sql'));
  } else {
    console.log('✅ outreach_queue table is ready! (rows accessible)');
  }
}

checkOrSetupSchema().catch(console.error);
