import { supabase } from '../api/_lib/supabase.ts';

async function main() {
  const { data: logs, error } = await supabase
    .from('deletion_logs')
    .select('*')
    .limit(20);

  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log(`Found ${logs.length} deletion logs.`);
  console.log(logs);
}

main().catch(console.error);
