import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
  const { count, error } = await supabase
    .from('films')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'kava');
  
  if (error) {
    console.error(error);
  } else {
    console.log('Total Kava films:', count);
  }
}

run();
