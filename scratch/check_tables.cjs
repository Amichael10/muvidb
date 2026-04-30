const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  const tables = ['films', 'people', 'credits', 'genres', 'film_genres'];
  console.log(`🔍 Checking tables in ${supabaseUrl}...`);

  for (const table of tables) {
    const { data, error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`❌ Table [${table}]: ${error.message} (${error.code})`);
    } else {
      console.log(`✅ Table [${table}]: Exists (${count} records)`);
    }
  }
}

checkTables();
