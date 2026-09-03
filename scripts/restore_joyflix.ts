import { supabase } from './lib/db.js';
import { runVideosSync } from '../api/_lib/sync_service.js';
import { runCastExtraction, runTitleCleanup } from '../api/_lib/ai_maintenance.js';
import { ytGet } from '../api/_lib/yt_service.js';

async function restoreJoyflix() {
  console.log('===============================================================');
  console.log('🎬 RESTORING JOYFLIX TV CHANNEL, MOVIES & CREDITS');
  console.log('===============================================================');

  const channelId = 'UC66YiHzr62gRKk38F06JEKw';
  const handle = 'JOYFLIX_';
  const name = 'Joyflix';

  // 1. Check if channel already exists or insert it
  console.log('\n1. Checking / Creating Channel record...');
  const { data: existingChannel, error: findErr } = await supabase
    .from('channels')
    .select('*')
    .or(`channel_id.eq.${channelId},channel_handle.eq.@${handle}`)
    .maybeSingle();

  let targetChannelId = existingChannel?.id;

  if (existingChannel) {
    console.log(`Found existing channel ID: ${existingChannel.id} (name: ${existingChannel.name})`);
    const { error: updErr } = await supabase
      .from('channels')
      .update({
        name: 'Joyflix',
        channel_handle: `@${handle}`,
        channel_id: channelId,
        sync_enabled: true,
        videos_last_fetched_at: null, // trigger immediate fresh fetch
        updated_at: new Date().toISOString()
      })
      .eq('id', existingChannel.id);
    if (updErr) console.error('Error updating channel:', updErr.message);
  } else {
    console.log('Inserting fresh channel record for Joyflix...');
    const { data: newCh, error: insErr } = await supabase
      .from('channels')
      .insert({
        id: '9e366ebb-280d-4047-86fe-4c7ef1434afd',
        name: 'Joyflix',
        channel_handle: `@${handle}`,
        channel_id: channelId,
        channel_url: `https://www.youtube.com/@${handle}`,
        sync_enabled: true
      })
      .select()
      .single();

    if (insErr) {
      console.error('Error inserting channel:', insErr.message);
      process.exit(1);
    }
    targetChannelId = newCh.id;
    console.log(`✓ Channel created with UUID: ${targetChannelId}`);
  }

  // 2. Run video sync with deep pagination (maxPages: 10 to get up to 500 uploads)
  console.log('\n2. Syncing YouTube videos & promoting films for Joyflix...');
  const syncResult = await runVideosSync({
    channelId: targetChannelId,
    force: true,
    maxPages: 10
  });
  console.log('Sync Result:', JSON.stringify(syncResult, null, 2));

  // 3. Check films created for Joyflix
  const { data: joyflixFilms, error: fErr } = await supabase
    .from('films')
    .select('id, title, release_year, youtube_id, duration_minutes, view_count, synopsis')
    .eq('channel_id', targetChannelId);

  console.log(`\nFound ${joyflixFilms?.length || 0} films linked to Joyflix in database.`);
  if (joyflixFilms && joyflixFilms.length > 0) {
    console.log('Sample Joyflix Films:');
    for (const f of joyflixFilms.slice(0, 10)) {
      console.log(`  - "${f.title}" (${f.release_year || 'N/A'}) - ${f.duration_minutes || 'N/A'} mins [YT: ${f.youtube_id}]`);
    }
  }

  // 4. Run AI Cast Extraction and Title Cleanup
  console.log('\n3. Running Cast & Credit Extraction for restored films...');
  const castResult = await runCastExtraction({ limit: 100 });
  console.log('Cast Extraction Result:', JSON.stringify(castResult, null, 2));

  const titleResult = await runTitleCleanup({ limit: 100 });
  console.log('Title Cleanup Result:', JSON.stringify(titleResult, null, 2));

  // 5. Check credits attached to Joyflix films
  if (joyflixFilms && joyflixFilms.length > 0) {
    const filmIds = joyflixFilms.map(f => f.id);
    const { data: credits, error: credErr } = await supabase
      .from('credits')
      .select('id, role, character_name, people(id, name)')
      .in('film_id', filmIds);

    console.log(`\nTotal Credits Attached to Joyflix Films: ${credits?.length || 0}`);
    if (credits && credits.length > 0) {
      console.log('Sample Credits:');
      for (const c of credits.slice(0, 15)) {
        const personName = (c as any).people?.name || 'Unknown';
        console.log(`  - ${personName} as ${c.character_name || c.role || 'Cast'}`);
      }
    }
  }

  console.log('\n===============================================================');
  console.log('🎉 JOYFLIX RESTORATION COMPLETE');
  console.log('===============================================================');
  process.exit(0);
}

restoreJoyflix().catch(err => {
  console.error('Fatal error during restoration:', err);
  process.exit(1);
});
