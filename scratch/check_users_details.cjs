const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUsersTable() {
  // Use a query to get column info
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'users' });
  
  if (error) {
    console.log('RPC failed, trying direct query on pg_attribute...');
    // Fallback: try to select a row to see what's there
    const { data: rows, error: selectError } = await supabase.from('users').select('*').limit(1);
    if (selectError) {
      console.log('Select error:', selectError);
    } else {
      console.log('Sample row columns:', Object.keys(rows[0] || {}));
    }
  } else {
    console.log('Users columns:', data);
  }
}

checkUsersTable();
