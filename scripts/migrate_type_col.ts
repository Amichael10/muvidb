import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🚀 Attempting to add "type" column to "films" table...');
  
  // We can't run arbitrary SQL via the JS client easily unless we have an RPC
  // But we can check if it exists and try to insert/update with it to see if it fails.
  // A better way is to use the 'pg_attribute' query if we have permissions.
  
  const { data, error } = await supabase.rpc('admin_run_sql', { 
    sql: "ALTER TABLE films ADD COLUMN IF NOT EXISTS type text DEFAULT 'movie';" 
  });

  if (error) {
    if (error.message.includes('function admin_run_sql(text) does not exist')) {
        console.log('⚠️ RPC "admin_run_sql" not found. Falling back to simple check.');
        // Try to select the column
        const { error: selectError } = await supabase.from('films').select('type').limit(1);
        if (selectError && selectError.message.includes('column "type" does not exist')) {
            console.log('❌ Column "type" still does not exist. Please add it via Supabase Dashboard:');
            console.log('ALTER TABLE films ADD COLUMN type text DEFAULT \'movie\';');
        } else {
            console.log('✅ Column "type" already exists or was added.');
        }
    } else {
        console.error('❌ Error running migration:', error.message);
    }
  } else {
    console.log('✅ Migration successful!');
  }
}

runMigration();
