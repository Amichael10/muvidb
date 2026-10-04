import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function main() {
  const { data } = await supabase.from('films').select('*').limit(1);
  if (data && data[0]) {
    console.log('Columns:', Object.keys(data[0]).sort());
  }
}

main().catch(console.error);
