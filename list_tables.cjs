const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pkenrmorywmuvnzfoylp.supabase.co';
const supabaseKey = 'sb_publishable_z8vTS60VmKgpsh1NiBnWDA_ed6ajgRJ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
  console.log('📋 Fetching table list from information_schema...');
  
  // We can't access information_schema via anon key usually.
  // We'll try to select from likely names.
  const tests = ['users', 'profiles', 'claims', 'profile_claims', 'films', 'cinemas'];
  for (const t of tests) {
    const { error } = await supabase.from(t).select('id').limit(1);
    if (error) {
      console.log(`❌ Table [${t}]: ${error.message} (${error.code})`);
    } else {
      console.log(`✅ Table [${t}]: Exists`);
    }
  }
}

listTables();
