const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUnique() {
  console.log('Checking unique constraints on public.users...');
  
  const testId1 = '00000000-0000-0000-0000-000000000010';
  const testId2 = '00000000-0000-0000-0000-000000000011';
  const profileId = '00000000-0000-0000-0000-000000000099';
  
  console.log('Attempting to insert two users with same linked_profile_id...');
  
  await supabase.from('users').insert({ id: testId1, email: 'u1@ex.com', linked_profile_id: profileId });
  const { error } = await supabase.from('users').insert({ id: testId2, email: 'u2@ex.com', linked_profile_id: profileId });
  
  if (error) {
    console.log('Unique constraint hit on linked_profile_id:', error.message);
  } else {
    console.log('linked_profile_id is NOT unique.');
  }
  
  // Cleanup
  await supabase.from('users').delete().in('id', [testId1, testId2]);
}

checkUnique();
