const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testTriggerLogic() {
  console.log('Querying user_role enum values...');
  const { data: enumValues, error: enumError } = await supabase
    .rpc('get_enum_values', { enum_name: 'user_role' });
  
  if (enumError) {
    // If RPC fails, try a direct query
    const { data: directData, error: directError } = await supabase
      .from('pg_type')
      .select('typname, pg_enum(enumlabel)')
      .eq('typname', 'user_role')
      .single();
    
    console.log('Direct query result:', directData || directError);
  } else {
    console.log('Enum values:', enumValues);
  }

  console.log('\nTesting manual insert into public.users to simulate trigger...');
  const testId = '00000000-0000-0000-0000-000000000001';
  const testEmail = 'test@example.com';
  
  const { data, error } = await supabase
    .from('users')
    .upsert({
      id: testId,
      email: testEmail,
      name: 'Test User',
      role: 'fan'
    });
    
  if (error) {
    console.log('Insert failed:', error);
  } else {
    console.log('Insert succeeded! The manual logic works.');
    // Clean up
    await supabase.from('users').delete().eq('id', testId);
  }
}

testTriggerLogic();
