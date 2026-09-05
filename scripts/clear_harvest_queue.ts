import { supabase } from './lib/db';

async function clearPending() {
  console.log('🧹 Clearing pending credit candidates, metadata candidates, jobs, and worker logs...');

  const { error: candsErr } = await supabase.from('credit_candidates').delete().eq('status', 'pending');
  if (candsErr) console.error('Error clearing candidates:', candsErr.message);
  else console.log('✅ Cleared pending credit_candidates.');

  const { error: metaErr } = await supabase.from('credit_metadata_candidates').delete().eq('status', 'pending');
  if (metaErr) console.error('Error clearing metadata:', metaErr.message);
  else console.log('✅ Cleared pending credit_metadata_candidates.');

  const { error: logsErr } = await supabase.from('credit_harvest_logs').delete().gt('id', 0);
  if (logsErr) console.error('Error clearing logs:', logsErr.message);
  else console.log('✅ Cleared credit_harvest_logs.');

  const { error: jobsErr } = await supabase.from('credit_harvest_jobs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (jobsErr) console.error('Error clearing jobs:', jobsErr.message);
  else console.log('✅ Cleared credit_harvest_jobs.');

  console.log('🎉 Harvester queue and pending logs have been reset cleanly.');
}

clearPending().catch(console.error);
