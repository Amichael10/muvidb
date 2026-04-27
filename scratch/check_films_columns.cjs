const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkColumns() {
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'films' });
  if (error) {
    // If RPC doesn't exist, try a simple select
    const { data: selectData, error: selectError } = await supabase.from('films').select('*').limit(1);
    if (selectError) {
      console.log('Error:', selectError);
    } else {
      console.log('Columns in films:', Object.keys(selectData[0] || {}));
    }
  } else {
    console.log('Columns in films:', data);
  }
}

checkColumns();
