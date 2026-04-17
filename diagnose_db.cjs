const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pkenrmorywmuvnzfoylp.supabase.co';
const supabaseKey = 'sb_publishable_z8vTS60VmKgpsh1NiBnWDA_ed6ajgRJ';
const supabase = createClient(supabaseUrl, supabaseKey);

const tables = [
  'films', 'cinemas', 'people', 'companies', 'credits', 'showtimes',
  'users', 'profile_claims'
];

async function diagnose() {
  console.log('🔍 Starting Database Diagnosis...');
  
  for (const table of tables) {
    const { data, error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error(`❌ Table [${table}]: ${error.message} (${error.code})`);
    } else {
      console.log(`✅ Table [${table}]: Accessible. Count: ${count}`);
      // If count is 0, let's try to select one row just to be sure it's not RLS hiding rows
      const { data: rowData } = await supabase.from(table).select('*').limit(1);
      if (rowData?.length === 0 && count > 0) {
        console.warn(`⚠️ Table [${table}]: RLS potentially hiding rows (Count: ${count}, Select: 0)`);
      }
    }
  }
}

diagnose();
