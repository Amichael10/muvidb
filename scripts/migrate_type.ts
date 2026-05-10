
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('Adding "type" column to "films" table...');
  const { error } = await supabase.rpc('execute_sql', {
    sql: "ALTER TABLE films ADD COLUMN IF NOT EXISTS type text DEFAULT 'movie';"
  });

  if (error) {
    // If the RPC doesn't exist, we might get an error.
    // In that case, we can try to use a dummy query to see if the column exists now.
    console.error('Error running migration via RPC:', error.message);
    console.log('Trying alternative check...');
    
    const { data: cols, error: colError } = await supabase
      .from('films')
      .select('type')
      .limit(1);
    
    if (colError) {
      console.error('Column "type" still does not exist.');
    } else {
      console.log('Column "type" already exists or was added.');
    }
  } else {
    console.log('Successfully added "type" column.');
  }
}

runMigration();
