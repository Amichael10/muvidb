import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function main() {
  const { data: byBranch } = await supabase.from('people').select('id, name, imdb_id, slug').ilike('name', '%branch%');
  console.log('People with branch in name:', byBranch);
  const { data: byFemiB } = await supabase.from('people').select('id, name, imdb_id, slug').ilike('name', 'Femi B%');
  console.log('People starting Femi B:', byFemiB);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
