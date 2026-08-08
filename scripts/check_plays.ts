import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function check() {
  const { data, error } = await supabase.from('plays').select('*');
  console.log('COUNT:', data?.length);
  console.log('ERROR:', error);
  if (data) {
    console.log('PLAYS LIST:');
    data.forEach((p, i) => {
      console.log(`${i + 1}. [${p.id}] ${p.title} (${p.slug}) - Year: ${p.year || p.first_performed_year}`);
    });
  }
}
check();
