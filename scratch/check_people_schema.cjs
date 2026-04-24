const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://pkenrmorywmuvnzfoylp.supabase.co";
const supabaseKey = "sb_publishable_v-i89VcfvICnFoBDCRqVBQ_tufJb7r8";
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkIndexes() {
  const { data, error } = await supabase.from('people').select('*').limit(1);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Columns:', data.length > 0 ? Object.keys(data[0]) : 'No data');
    console.log('First row sample:', data[0]);
  }
}

checkIndexes();
