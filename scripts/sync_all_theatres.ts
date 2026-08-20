import { supabase } from './lib/db';
import { derivePlayStatus } from '../api/_lib/theatre_service';

async function main() {
  console.log('=== Starting Sync Across All Theatre & Stage Platforms ===');

  const now = new Date();
  console.log(`Current Reference Date: ${now.toISOString().slice(0, 10)}\n`);

  // 1. Fetch all plays from the database
  const { data: plays, error } = await supabase
    .from('plays')
    .select('id, title, slug, venue, city, country, run_start_date, run_end_date, year, status');

  if (error) {
    console.error('Error querying plays:', error.message);
    process.exit(1);
  }

  console.log(`Auditing & syncing statuses for ${plays?.length || 0} stage plays...`);

  let updated = 0;
  let running = 0;
  let upcoming = 0;
  let archived = 0;

  for (const play of plays || []) {
    const derivedStatus = derivePlayStatus(play, now);

    if (derivedStatus === 'currently_running') running++;
    else if (derivedStatus === 'upcoming') upcoming++;
    else if (derivedStatus === 'archived') archived++;

    if (play.status !== derivedStatus) {
      console.log(`[Status Transition] "${play.title}" (dates: ${play.run_start_date || 'TBA'} - ${play.run_end_date || 'TBA'})`);
      console.log(`  -> Old: "${play.status}" | New: "${derivedStatus}"`);

      const { error: updErr } = await supabase
        .from('plays')
        .update({
          status: derivedStatus,
          updated_at: now.toISOString(),
        })
        .eq('id', play.id);

      if (updErr) {
        console.error(`  ❌ Failed to update ${play.title}:`, updErr.message);
      } else {
        updated++;
      }
    }
  }

  console.log('\n=== Theatre Sync Summary ===');
  console.log(`Total Plays Audited: ${plays?.length || 0}`);
  console.log(`Status Transitions Applied: ${updated}`);
  console.log(`Currently Running: ${running}`);
  console.log(`Upcoming Productions: ${upcoming}`);
  console.log(`Archived / Past Runs: ${archived}`);
}

main().catch((err) => {
  console.error('Fatal error in theatre sync:', err);
  process.exit(1);
});
