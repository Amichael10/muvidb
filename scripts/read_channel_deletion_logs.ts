import { supabase } from '../api/_lib/supabase.ts';

async function main() {
  const { data: logs, error } = await supabase
    .from('deletion_logs')
    .select('*')
    .eq('entity_type', 'channel');

  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log(`Found ${logs.length} channel deletion logs.`);
  for (const l of logs) {
    console.log(`[${l.deleted_at}] ${l.entity_name} (ID: ${l.entity_id}) | Reason: ${l.reason}`);
  }
}

main().catch(console.error);
