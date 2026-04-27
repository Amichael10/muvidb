const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkNullable() {
  console.log('Checking if linked_profile_id is nullable...');
  
  // Try to insert a row without linked_profile_id
  const { error } = await supabase.from('users').insert({
    id: '00000000-0000-0000-0000-000000000002',
    email: 'test-null-' + Date.now() + '@example.com',
    name: 'Test Null',
    role: 'fan'
  });
  
  if (error) {
    console.log('Insert failed (maybe linked_profile_id is NOT NULL?):', error.message);
  } else {
    console.log('Insert succeeded (linked_profile_id is nullable).');
    await supabase.from('users').delete().eq('id', '00000000-0000-0000-0000-000000000002');
  }
}

checkNullable();
