const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkColumns() {
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'people' });
  
  if (error) {
    // Fallback: try a direct query if rpc doesn't exist
    const { data: cols, error: err2 } = await supabase.from('people').select('*').limit(1);
    if (cols && cols.length > 0) {
      console.log('Columns:', Object.keys(cols[0]));
    } else {
      console.error('Error fetching columns');
    }
  } else {
    console.log('Columns:', data);
  }
}

checkColumns();
