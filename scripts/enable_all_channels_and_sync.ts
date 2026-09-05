import { getSupabase } from '../api/_lib/supabase.js';
import { runVideosSync, purgeStaleUnmappedChannelVideos } from '../api/_lib/sync_service.js';
import { runCastExtraction, runTitleCleanup } from '../api/_lib/ai_maintenance.js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const supabase = getSupabase();
  console.log('--- Step 1: Checking channels status ---');
  const { count: totalChannels } = await supabase.from('channels').select('*', { count: 'exact', head: true });
  const { count: enabledBefore } = await supabase.from('channels').select('*', { count: 'exact', head: true }).eq('sync_enabled', true);
  const { count: disabledBefore } = await supabase.from('channels').select('*', { count: 'exact', head: true }).neq('sync_enabled', true);
  
  console.log(`Total channels: ${totalChannels}`);
  console.log(`Enabled before: ${enabledBefore}`);
  console.log(`Disabled before: ${disabledBefore}`);

  console.log('\n--- Step 2: Enabling sync on ALL channels (sync_enabled = true) ---');
  // Update in batches of 200 channels to avoid payload size limits
  const PAGE = 200;
  let updatedCount = 0;
  for (let from = 0; ; from += PAGE) {
    const { data: batch, error: fetchErr } = await supabase
      .from('channels')
      .select('id')
      .or('sync_enabled.is.null,sync_enabled.eq.false')
      .range(0, PAGE - 1);

    if (fetchErr) {
      console.error('Error fetching disabled channels:', fetchErr.message);
      break;
    }
    if (!batch || batch.length === 0) break;

    const ids = batch.map((c: { id: string }) => c.id);
    const { error: updateErr } = await supabase
      .from('channels')
      .update({ sync_enabled: true })
      .in('id', ids);

    if (updateErr) {
      console.error('Error enabling channels batch:', updateErr.message);
      break;
    }
    updatedCount += ids.length;
    console.log(`Enabled batch of ${ids.length} channels (total enabled so far: ${updatedCount})...`);
    if (batch.length < PAGE) break;
  }

  const { count: enabledAfter } = await supabase.from('channels').select('*', { count: 'exact', head: true }).eq('sync_enabled', true);
  console.log(`\nAll channels sync_enabled check: ${enabledAfter} / ${totalChannels} are now ENABLED.`);

  // Also update automation_jobs table if present
  try {
    await supabase.from('automation_jobs').upsert({
      id: 'youtube_sync_paused_channels',
      status: 'active',
      last_message: `All ${enabledAfter} channels enabled for YouTube sync.`,
      last_run: new Date().toISOString()
    });
  } catch (e: any) {
    console.warn('automation_jobs update notice:', e?.message);
  }

  console.log('\n--- Step 3: Starting YouTube Sync immediately across all channels ---');
  // force: true to ensure all channels get checked even if fetched recently
  const result = await runVideosSync({ force: true });
  console.log('\n=== YouTube Sync Execution Result ===');
  console.log(JSON.stringify(result, null, 2));

  console.log('\n--- Step 4: Post-sync AI maintenance (Cast extraction & Title cleanup) ---');
  try {
    const castResult = await runCastExtraction({ limit: 100 });
    const titleResult = await runTitleCleanup({ limit: 150 });
    console.log('Cast extraction result:', castResult);
    console.log('Title cleanup result:', titleResult);
  } catch (err: any) {
    console.warn('Post-sync AI maintenance notice:', err?.message);
  }

  console.log('\n--- Step 5: Purging stale unmapped channel videos buffer ---');
  try {
    const purged = await purgeStaleUnmappedChannelVideos({ maxAgeDays: 30 });
    console.log('Stale buffer purge result:', purged);
  } catch (err: any) {
    console.warn('Buffer purge notice:', err?.message);
  }

  console.log('\nAll sync tasks finished successfully!');
}

main().catch((err) => {
  console.error('Fatal error in sync runner:', err);
  process.exit(1);
});
