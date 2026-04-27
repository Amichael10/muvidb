const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
  console.log('Checking public.users schema and triggers...');
  
  // We can try to use a function that returns the table info
  // Since we can't run raw SQL, we'll try to find a way to get it.
  
  // Actually, let's try to find the error by manually calling the handle_new_user function if we can.
  // But wait, it's a trigger function, it expects 'new'.
  
  // Let's try to insert a test user into public.users directly to see if there are any constraint errors.
  const testId = '00000000-0000-0000-0000-000000000001';
  const testEmail = 'test-' + Date.now() + '@example.com';
  
  console.log(`Testing direct insert into public.users with ID ${testId} and Email ${testEmail}`);
  
  const { data, error } = await supabase
    .from('users')
    .insert([
      { id: testId, email: testEmail, name: 'Test User', role: 'fan' }
    ]);
    
  if (error) {
    console.error('Direct insert failed:', error);
  } else {
    console.log('Direct insert succeeded.');
    // Cleanup
    await supabase.from('users').delete().eq('id', testId);
  }
  
  // Now let's try to test the UPSERT logic that the trigger uses
  console.log('Testing UPSERT logic (email conflict)...');
  const { error: upsertError } = await supabase
    .from('users')
    .upsert(
      { id: testId, email: testEmail, name: 'Test User Updated', role: 'fan' },
      { onConflict: 'email' }
    );
    
  if (upsertError) {
    console.error('Upsert failed:', upsertError);
  } else {
    console.log('Upsert succeeded.');
  }
}

checkSchema();
