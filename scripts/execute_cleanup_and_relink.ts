import { supabase } from '../api/_lib/supabase.ts';
import fs from 'fs';

function extractVideoId(url: string): string {
  if (!url) return '';
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : '';
}

async function retryOp<T>(op: () => Promise<T>, maxRetries = 3, label = 'op'): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await op();
    } catch (err: any) {
      if (i === maxRetries - 1) throw err;
      console.log(`[Retry ${i + 1}/${maxRetries}] ${label}: ${err.message || err}`);
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error(`Failed ${label} after ${maxRetries} retries`);
}

async function runCleanupAndRelink() {
  console.log('--- STARTING CLEANUP & RELINK PROCESS ---');

  // 1. Fetch active channels
  const channelsRes = await retryOp(async () => {
    const { data, error } = await supabase
      .from('channels')
      .select('id, name, channel_handle, channel_url, channel_id');
    if (error) throw error;
    return data;
  }, 4, 'Fetch channels');

  const channelMap = new Map();
  channelsRes?.forEach((ch: any) => {
    if (ch.name) channelMap.set(ch.name.toLowerCase().trim(), ch);
    if (ch.channel_handle) channelMap.set(ch.channel_handle.toLowerCase().trim().replace(/^@/, ''), ch);
    if (ch.channel_id) channelMap.set(ch.channel_id.toLowerCase().trim(), ch);
  });

  const progress = JSON.parse(fs.readFileSync('unattached_films_resolved_progress.json', 'utf8'));

  const toDelete: any[] = [];
  const toRelink: any[] = [];
  const deadOrPrivate: any[] = [];

  for (const item of progress) {
    if (item.status === 'unavailable' || item.resolved_channel === 'Video Unavailable / Private') {
      deadOrPrivate.push(item);
      continue;
    }

    const cName = (item.resolved_channel || '').toLowerCase().trim();
    const cHandle = item.resolved_channel_url ? item.resolved_channel_url.replace(/.*\/@/, '').toLowerCase().trim() : '';
    const matchedChannel = channelMap.get(cName) || channelMap.get(cHandle);

    if (matchedChannel) {
      toRelink.push({
        ...item,
        channel_db_id: matchedChannel.id,
        channel_db_name: matchedChannel.name,
      });
    } else {
      toDelete.push(item);
    }
  }

  console.log(`\n========================================`);
  console.log(`Total Scanned: ${progress.length}`);
  console.log(`1. To Delete (Deleted/Untracked Channels): ${toDelete.length}`);
  console.log(`2. To Relink (Active Channels in DB): ${toRelink.length}`);
  console.log(`3. Dead / Private Videos: ${deadOrPrivate.length}`);
  console.log(`========================================\n`);

  // STEP A: ANALYZE DEAD / PRIVATE FILMS
  console.log(`\n>>> [STEP A] Analyzing Dead / Private Films (${deadOrPrivate.length} items)...`);
  const deadIds = deadOrPrivate.map(d => d.id);
  let deadWithCredits = 0;
  let deadTotalCredits = 0;
  let deadWithSynopsis = 0;
  let deadWithGenres = 0;
  let deadWithCastList: any[] = [];

  const CHUNK_SIZE = 50;
  for (let i = 0; i < deadIds.length; i += CHUNK_SIZE) {
    const chunk = deadIds.slice(i, i + CHUNK_SIZE);
    
    // Check credits
    await retryOp(async () => {
      const { data: credits, error: crErr } = await supabase
        .from('credits')
        .select('film_id, role')
        .in('film_id', chunk);
      if (crErr) throw crErr;
      if (credits && credits.length > 0) {
        const filmsWithCr = new Set(credits.map(c => c.film_id));
        deadWithCredits += filmsWithCr.size;
        deadTotalCredits += credits.length;
        deadWithCastList.push(...credits);
      }
    }, 3, 'Check dead credits');

    // Check synopsis & genres
    await retryOp(async () => {
      const { data: filmData, error: fErr } = await supabase
        .from('films')
        .select('id, title, synopsis, genres')
        .in('id', chunk);
      if (fErr) throw fErr;
      filmData?.forEach((f: any) => {
        if (f.synopsis && f.synopsis.trim().length > 10) deadWithSynopsis++;
        if (f.genres && f.genres.length > 0) deadWithGenres++;
      });
    }, 3, 'Check dead film fields');
  }

  const deadAnalysis = {
    total_dead_or_private: deadOrPrivate.length,
    films_with_credits: deadWithCredits,
    total_credits_count: deadTotalCredits,
    films_with_synopsis: deadWithSynopsis,
    films_with_genres: deadWithGenres,
    empty_shells_count: deadOrPrivate.length - deadWithCredits,
    sample_empty_titles: deadOrPrivate.slice(0, 10).map(d => ({ id: d.id, title: d.title, url: d.youtube_url })),
  };
  fs.writeFileSync('dead_films_analysis.json', JSON.stringify(deadAnalysis, null, 2));

  console.log(`Dead Films Analysis Result:`);
  console.log(`- Films with Cast/Crew: ${deadWithCredits} (Total credits: ${deadTotalCredits})`);
  console.log(`- Empty Shells (No cast, no synopsis, dead video): ${deadOrPrivate.length - deadWithCredits}`);
  console.log(`- Films with synopsis: ${deadWithSynopsis}`);
  console.log(`- Films with genres: ${deadWithGenres}`);

  // STEP B: RELINK ACTIVE CHANNEL MOVIES
  console.log(`\n>>> [STEP B] Relinking ${toRelink.length} Movies to Active Channels...`);
  let relinkedCount = 0;
  let relinkSkipped = 0;

  for (let i = 0; i < toRelink.length; i += CHUNK_SIZE) {
    const chunk = toRelink.slice(i, i + CHUNK_SIZE);
    const videoRows = chunk.map((item: any) => {
      const videoId = extractVideoId(item.youtube_url);
      return {
        channel_id: item.channel_db_id,
        film_id: item.id,
        video_id: videoId || item.id,
        title: item.title,
        match_status: 'matched',
        published_at: item.created_at ? new Date(item.created_at).toISOString() : new Date().toISOString(),
      };
    });

    await retryOp(async () => {
      // Upsert into channel_videos
      const { error: insErr } = await supabase
        .from('channel_videos')
        .upsert(videoRows, { onConflict: 'channel_id, video_id', ignoreDuplicates: true });
      if (insErr) {
        // Fallback: insert ignoring duplicates individually if constraint differs
        for (const row of videoRows) {
          const { error: singleErr } = await supabase.from('channel_videos').insert(row);
          if (!singleErr) relinkedCount++;
          else relinkSkipped++;
        }
      } else {
        relinkedCount += videoRows.length;
      }
    }, 3, 'Relink channel_videos');

    if ((i + CHUNK_SIZE) % 250 === 0 || i + CHUNK_SIZE >= toRelink.length) {
      console.log(`Relink Progress: ${Math.min(i + CHUNK_SIZE, toRelink.length)} / ${toRelink.length}...`);
    }
  }
  console.log(`Successfully relinked ${relinkedCount} movies to active channels (Skipped/Existing: ${relinkSkipped}).`);

  // STEP C: DELETE MOVIES FROM DELETED / UNTRACKED CHANNELS
  console.log(`\n>>> [STEP C] Deleting ${toDelete.length} Movies from Deleted/Untracked Channels...`);
  const deleteIds = toDelete.map(d => d.id);
  let totalDeletedFilms = 0;
  let totalDeletedCredits = 0;

  for (let i = 0; i < deleteIds.length; i += CHUNK_SIZE) {
    const chunk = deleteIds.slice(i, i + CHUNK_SIZE);

    await retryOp(async () => {
      // 1. Delete credits
      const { count: cCount } = await supabase
        .from('credits')
        .delete({ count: 'exact' })
        .in('film_id', chunk);
      if (cCount) totalDeletedCredits += cCount;

      // 2. Clear FK references and child records
      await Promise.allSettled([
        supabase.from('pending_cinema_films').update({ promoted_film_id: null }).in('promoted_film_id', chunk),
        supabase.from('pending_cinema_films').delete().in('promoted_film_id', chunk),
        supabase.from('film_genres').delete().in('film_id', chunk),
        supabase.from('film_companies').delete().in('film_id', chunk),
        supabase.from('reviews').delete().in('film_id', chunk),
        supabase.from('box_office_records').delete().in('film_id', chunk),
        supabase.from('comments').delete().in('film_id', chunk),
        supabase.from('showtimes').delete().in('film_id', chunk),
        supabase.from('channel_videos').delete().in('film_id', chunk),
        supabase.from('social_content_items').delete().in('film_id', chunk),
        supabase.from('watchlist').delete().in('film_id', chunk),
        supabase.from('user_favorites').delete().in('film_id', chunk),
        supabase.from('film_sync_logs').delete().in('film_id', chunk),
        supabase.from('screenplay_analyses').delete().in('film_id', chunk),
      ]);

      // 3. Delete films
      const { count: fCount, error: fErr } = await supabase
        .from('films')
        .delete({ count: 'exact' })
        .in('id', chunk);
      if (fErr) throw fErr;
      if (fCount) totalDeletedFilms += fCount;
    }, 3, `Delete films chunk ${i}`);

    if ((i + CHUNK_SIZE) % 500 === 0 || i + CHUNK_SIZE >= deleteIds.length) {
      console.log(`Delete Progress: ${totalDeletedFilms} / ${deleteIds.length} movies deleted...`);
    }
  }

  console.log(`\n=== CLEANUP & RELINK COMPLETED SUCCESSFULLY ===`);
  console.log(`- Deleted Orphaned Movies: ${totalDeletedFilms} (Deleted associated credits: ${totalDeletedCredits})`);
  console.log(`- Relinked Active Channel Movies: ${relinkedCount}`);
  console.log(`- Dead / Private Films Analyzed: ${deadOrPrivate.length}`);
}

runCleanupAndRelink().catch(console.error);
