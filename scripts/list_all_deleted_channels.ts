import { supabase } from '../api/_lib/supabase.ts';

async function main() {
  const { data: logs, error } = await supabase
    .from('deletion_logs')
    .select('entity_name, deleted_at, reason')
    .eq('entity_type', 'channel')
    .order('entity_name');

  if (error) {
    console.error('Error:', error);
    return;
  }
  
  const uniqueNames = Array.from(new Set(logs.map(l => l.entity_name)));
  console.log(`Total unique deleted channels: ${uniqueNames.length}`);
  console.log(uniqueNames.join('\n'));
}

main().catch(console.error);
