const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testTriggerInsert() {
  const testId = '33333333-3333-3333-3333-333333333333';
  const testEmail = 'trigger-insert-test-' + Date.now() + '@example.com';
  
  console.log(`Testing exact columns from trigger: ${testEmail}`);
  
  // Columns from identity_fix.sql: id, email, name, avatar_url, role
  const { data, error } = await supabase.from('users').insert({
    id: testId,
    email: testEmail,
    name: 'Test',
    avatar_url: null,
    role: 'fan'
  });
  
  if (error) {
    console.error('Insert failed:', error);
  } else {
    console.log('Insert succeeded');
    await supabase.from('users').delete().eq('id', testId);
  }
}

testTriggerInsert();
