const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listTriggers() {
  console.log('Calling list_table_triggers for users...');
  const { data, error } = await supabase.rpc('list_table_triggers', { tbl_name: 'users' });
  
  if (error) {
    console.log('RPC failed (likely function does not exist):', error.message);
  } else {
    console.log('Triggers on users:', data);
  }
}

listTriggers();
