import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
  const { data, error } = await supabase.from('films').select('*').limit(1).single();
  if (error) console.error(error);
  else console.log(Object.keys(data));
}

checkSchema();
