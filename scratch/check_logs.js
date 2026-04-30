import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  },
  global: {
    fetch: (url, options) => fetch(url, { ...options, timeout: 30000 })
  }
});

async function checkLogs() {
  console.log('Querying logs...');
  const { data, error } = await supabase
    .from('sync_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching logs:', error);
  } else {
    console.log('Latest Sync Logs:');
    if (!data || data.length === 0) {
      console.log('No logs found.');
    } else {
      data.forEach(log => {
        console.log(`[${log.created_at}] ${log.source} - ${log.status}: ${log.message}`);
      });
    }
  }
}

checkLogs();
