import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'C:/Users/User/Filmdba/lumi/.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  console.log('Fetching last 10 entries from sync_logs with status/counts...');
  const { data, error } = await supabase
    .from('sync_logs')
    .select('id, created_at, source, status, message, items_processed, items_updated, items_failed')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

check();
