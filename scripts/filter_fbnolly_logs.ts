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
  
  const matches = logs.filter(l => {
    const s = `${l.entity_name} ${JSON.stringify(l.metadata || {})}`.toLowerCase();
    return s.includes('fb') || s.includes('faithia') || s.includes('balogun') || s.includes('fbnolly');
  });

  console.log(`Found ${matches.length} matching channel deletion logs:`);
  for (const m of matches) {
    console.log(`- [${m.deleted_at}] "${m.entity_name}" (ID: ${m.entity_id}) | Reason: ${m.reason} | metadata:`, m.metadata);
  }
}

main().catch(console.error);
