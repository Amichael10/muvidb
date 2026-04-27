const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkNotNulls() {
  console.log('Checking NOT NULL constraints on public.users columns...');
  
  // We'll try to insert a row with only ID and Email, and see what fails.
  const testId = '00000000-0000-0000-0000-000000000020';
  const { error } = await supabase.from('users').insert({
    id: testId,
    email: 'notnull@ex.com'
  });
  
  if (error) {
    console.log('Insert failed:', error.message);
  } else {
    console.log('Insert succeeded (only ID and Email required).');
    await supabase.from('users').delete().eq('id', testId);
  }
}

checkNotNulls();
