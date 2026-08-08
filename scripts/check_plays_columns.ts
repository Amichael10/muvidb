import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function inspectSchema() {
  const { data } = await supabase.from('plays').select('*').limit(1);
  if (data && data.length > 0) {
    console.log('PLAYS COLUMNS:', Object.keys(data[0]));
    console.log('SAMPLE ROW:', data[0]);
  }
}
inspectSchema();
