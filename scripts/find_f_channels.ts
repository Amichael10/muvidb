import { supabase } from '../api/_lib/supabase.ts';

async function main() {
  const { data: logs, error } = await supabase
    .from('deletion_logs')
    .select('entity_name, entity_id, deleted_at, reason')
    .eq('entity_type', 'channel');

  if (error) {
    console.error(error);
    return;
  }

  const fChannels = logs.filter(l => l.entity_name.trim().toUpperCase().startsWith('F') || l.entity_name.toUpperCase().includes('FB') || l.entity_name.toUpperCase().includes('FAITH'));
  console.log('Channels starting with F or containing FB/FAITH:');
  for (const c of fChannels) {
    console.log(`- ${c.entity_name} (ID: ${c.entity_id}) | ${c.deleted_at}`);
  }
}

main().catch(console.error);
