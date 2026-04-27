const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pkenrmorywmuvnzfoylp.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectUsersTable() {
  console.log('Inspecting public.users table columns...');
  
  // Use RPC if available or query information_schema if we have permissions
  // Since we have service role key, we can try to query directly via postgrest if RLS is off or bypassed
  // But information_schema is better. Let's try to run a query that might fail if not allowed, 
  // but let's try to get one row from users to see keys.
  
  const { data: colInfo, error: colInfoError } = await supabase.from('information_schema.columns').select('column_name, data_type, is_nullable').eq('table_name', 'users').eq('table_schema', 'public');
  
  if (colInfoError) {
    console.error('Error fetching column info (likely not exposed):', colInfoError);
  } else {
    console.log('Column info:', colInfo);
  }

  // Check if there are any triggers on public.users
  const { data: triggers, error: triggerError } = await supabase.from('information_schema.triggers').select('trigger_name').eq('event_object_table', 'users');
  if (triggerError) {
    console.log('Could not fetch triggers info');
  } else {
    console.log('Triggers on users table:', triggers);
  }
}

inspectUsersTable();
