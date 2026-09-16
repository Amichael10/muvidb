import { serviceSupabase } from './lib/credit_consensus_verifier';

async function main() {
  console.log('🧹 Clearing harvest logs, jobs, and pending candidates...');

  // 1. Credit candidates (pending, failed, rejected)
  const { error: candErr, count: candCount } = await serviceSupabase
    .from('credit_candidates')
    .delete({ count: 'exact' })
    .neq('status', 'approved');

  if (candErr) {
    console.error('Error deleting credit_candidates:', candErr.message);
  } else {
    console.log(`✅ Deleted ${candCount ?? 0} non-approved credit_candidates.`);
  }

  // 2. Metadata candidates (pending, failed, rejected)
  const { error: metaErr, count: metaCount } = await serviceSupabase
    .from('credit_metadata_candidates')
    .delete({ count: 'exact' })
    .neq('status', 'approved');

  if (metaErr) {
    console.error('Error deleting pending credit_metadata_candidates:', metaErr.message);
  } else {
    console.log(`✅ Deleted ${metaCount ?? 0} pending credit_metadata_candidates.`);
  }

  // 3. Credit harvest logs
  const { error: logsErr, count: logsCount } = await serviceSupabase
    .from('credit_harvest_logs')
    .delete({ count: 'exact' })
    .gt('id', 0);

  if (logsErr) {
    console.error('Error deleting credit_harvest_logs:', logsErr.message);
  } else {
    console.log(`✅ Deleted ${logsCount ?? 0} credit_harvest_logs.`);
  }

  // 4. Credit harvest jobs
  const { error: jobsErr, count: jobsCount } = await serviceSupabase
    .from('credit_harvest_jobs')
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (jobsErr) {
    console.error('Error deleting credit_harvest_jobs:', jobsErr.message);
  } else {
    console.log(`✅ Deleted ${jobsCount ?? 0} credit_harvest_jobs.`);
  }

  console.log('\n✨ All logs, pending proposals, and queued jobs cleared successfully!');
}

main().catch(console.error);
