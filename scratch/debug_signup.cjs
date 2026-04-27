const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugSignup() {
  const testEmail = 'debug-signup-' + Date.now() + '@example.com';
  const testPassword = 'password123';
  
  console.log(`Attempting to create user via auth.admin: ${testEmail}`);
  
  const { data, error } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { name: 'Debug User', role: 'fan' }
  });
  
  if (error) {
    console.error('Signup failed with detailed error:');
    console.error(JSON.stringify(error, null, 2));
  } else {
    console.log('Signup succeeded (unexpected if there is a bug):', data.user.id);
    // Cleanup
    await supabase.auth.admin.deleteUser(data.user.id);
  }
}

debugSignup();
