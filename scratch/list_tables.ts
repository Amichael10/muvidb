
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  const { data, error } = await supabase.rpc('get_tables_info'); 
  // If get_tables_info doesn't exist, we'll try another way.
  if (error) {
    console.log('RPC failed, trying query...');
    const { data: tables, error: tableError } = await supabase
      .from('pg_catalog.pg_tables')
      .select('tablename')
      .eq('schemaname', 'public');
    
    if (tableError) {
      console.error('Error fetching tables:', tableError);
    } else {
      console.log('Tables:', tables.map(t => t.tablename));
    }
  } else {
    console.log('Tables info:', data);
  }
}

checkTables();
