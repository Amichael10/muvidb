const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSyncLogs() {
  console.log('🔍 Checking sync_logs...');
  
  const { data: logs, error } = await supabase
    .from('sync_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching logs:', error);
    return;
  }

  if (logs.length === 0) {
    console.log('No sync logs found.');
    return;
  }

  logs.forEach(log => {
    console.log(`[${log.created_at}] Source: ${log.source} | Status: ${log.status} | Message: ${log.message}`);
    if (log.status === 'error' || log.status === 'partial') {
      console.log('  Details:', JSON.stringify(log.details, null, 2));
    }
  });
}

checkSyncLogs();
