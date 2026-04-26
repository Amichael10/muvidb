const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkEnum() {
  // Use a query that works in Supabase to check enums
  const { data, error } = await supabase
    .from('films')
    .select('status')
    .limit(1);
    
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Sample Status:', data);
  }

  // Actually, I can use this query to find enum values:
  const { data: enumData, error: enumError } = await supabase
    .rpc('get_enum_values', { enum_name: 'film_status' });
    
  if (enumError) {
    // Try another way: just try to update a film to 'announced' and see if it fails (it will, user already confirmed)
    console.log('RPC failed, enum probably exists but values are restricted.');
  } else {
    console.log('Enum Values:', enumData);
  }
}

checkEnum();
