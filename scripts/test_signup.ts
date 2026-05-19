import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Testing normal user creation...');
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'test_normal@test.com',
    password: 'Password123!',
    email_confirm: true
  });
  if (error) {
    console.error('❌ Normal creation failed:', error.message || error);
  } else {
    console.log('✅ Normal creation successful! User:', data);
    
    // Clean up
    const { error: deleteError } = await supabase.auth.admin.deleteUser(data.user.id);
    if (deleteError) {
      console.error('❌ Delete failed:', deleteError);
    } else {
      console.log('✅ Delete successful.');
    }
  }
}

test().catch(console.error);
