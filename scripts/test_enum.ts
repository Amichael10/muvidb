import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  // Let's run a select that checks if we can insert a dummy row or check pg_type
  // Since we cannot run raw sql directly, let's try inserting a dummy user in public.users with role 'admin_limited'
  console.log('Testing inserting a user with role admin_limited...');
  
  const dummyId = '00000000-0000-0000-0000-000000000000';
  const { data: inserted, error: insertError } = await supabase
    .from('users')
    .insert({
      id: dummyId,
      email: 'dummy@test.com',
      name: 'Dummy',
      role: 'admin_limited'
    })
    .select();

  if (insertError) {
    console.error('❌ Insert failed:', insertError.message || insertError);
  } else {
    console.log('✅ Insert successful! Dummy inserted:', inserted);
    
    // Clean up
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', dummyId);
      
    if (deleteError) {
      console.error('❌ Cleanup failed:', deleteError);
    } else {
      console.log('✅ Cleanup successful.');
    }
  }
}

check().catch(console.error);
