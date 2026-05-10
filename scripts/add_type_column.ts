
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addTypeColumn() {
  console.log('Adding "type" column to "films" table...');
  
  // Using rpc or potentially just a direct query if allowed, 
  // but usually we do this via Supabase dashboard.
  // However, I can try to execute it via a function if it exists or check if I can use the SQL tool.
  // Since I don't have a direct SQL tool, I'll recommend the user to run it in the dashboard 
  // OR try to see if I can run it via a helper function if the project has one.
  
  console.log('Please run the following SQL in your Supabase SQL Editor:');
  console.log("ALTER TABLE films ADD COLUMN IF NOT EXISTS type text DEFAULT 'movie';");
  
  // We can also check if we can do it via a quick check
  const { data, error } = await supabase.from('films').select('type').limit(1);
  if (error && error.code === 'PGRST116') {
      console.log('Column "type" is indeed missing.');
  } else if (error) {
      console.error('Error checking column:', error);
  } else {
      console.log('Column "type" already exists.');
  }
}

addTypeColumn();
