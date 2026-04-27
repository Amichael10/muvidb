const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkNotNullsRole() {
  const testId = '00000000-0000-0000-0000-000000000021';
  const { error } = await supabase.from('users').insert({
    id: testId,
    email: 'notnull-role@ex.com',
    name: 'Test Name'
  });
  
  if (error) {
    console.log('Insert failed:', error.message);
  } else {
    console.log('Insert succeeded (Role is optional).');
    await supabase.from('users').delete().eq('id', testId);
  }
}

checkNotNullsRole();
