import { supabase } from '../lib/supabase';
import { logDeletion } from './filmDelete';

/**
 * Temporary rule / Cascade deletion utility:
 * When deleting a channel (or multiple channels), permanently deletes:
 * 1. All associated films linked to the channel
 * 2. All credits belonging to those films
 * 3. All associated film child records (genres, companies, reviews, etc.)
 * 4. All channel_videos for the channel
 * 5. The channel record(s) itself
 */
export async function deleteChannelWithAssociatedFilms(channelIds, options = {}) {
  const ids = Array.isArray(channelIds) ? channelIds : [channelIds];
  if (!ids.length) return { deletedChannels: 0, deletedFilms: 0, deletedCredits: 0 };

  const onProgress = options.onProgress || (() => {});

  onProgress({ stage: 'finding_films', message: 'Resolving movies associated with channel(s)...' });

  // 1. Fetch channel names for logging
  const { data: channelRows } = await supabase
    .from('channels')
    .select('id, name')
    .in('id', ids);

  // 2. Find all film IDs linked to these channels
  const { data: cvs } = await supabase
    .from('channel_videos')
    .select('film_id, video_id')
    .in('channel_id', ids);

  const rawFilmIds = (cvs || []).map((c) => c.film_id).filter(Boolean);
  const filmIds = [...new Set(rawFilmIds)];

  onProgress({
    stage: 'deleting_films',
    message: `Found ${filmIds.length} movie(s) associated with ${ids.length} channel(s). Purging...`,
    totalFilms: filmIds.length,
  });

  let deletedCreditsCount = 0;
  let deletedFilmsCount = 0;

  // 3. Delete films and their credits in safe batches
  const CHUNK_SIZE = 50;
  for (let i = 0; i < filmIds.length; i += CHUNK_SIZE) {
    const chunk = filmIds.slice(i, i + CHUNK_SIZE);

    // Delete credits
    const { count: credCount } = await supabase
      .from('credits')
      .delete({ count: 'exact' })
      .in('film_id', chunk);
    if (credCount) deletedCreditsCount += credCount;

    // Delete other film relations (swallow if table does not exist or empty)
    await Promise.allSettled([
      supabase.from('film_genres').delete().in('film_id', chunk),
      supabase.from('film_companies').delete().in('film_id', chunk),
      supabase.from('reviews').delete().in('film_id', chunk),
      supabase.from('box_office_records').delete().in('film_id', chunk),
      supabase.from('comments').delete().in('film_id', chunk),
      supabase.from('showtimes').delete().in('film_id', chunk),
    ]);

    // Delete films
    const { count: fCount, error: filmErr } = await supabase
      .from('films')
      .delete({ count: 'exact' })
      .in('id', chunk);

    if (filmErr) {
      console.error('[deleteChannelWithAssociatedFilms] Error deleting films chunk:', filmErr);
    } else if (fCount) {
      deletedFilmsCount += fCount;
    }

    onProgress({
      stage: 'deleting_films',
      message: `Deleted ${deletedFilmsCount}/${filmIds.length} movies...`,
      doneFilms: deletedFilmsCount,
      totalFilms: filmIds.length,
    });
  }

  // 4. Delete channel_videos for the channel(s)
  onProgress({ stage: 'deleting_videos', message: 'Cleaning up channel video index...' });
  await supabase.from('channel_videos').delete().in('channel_id', ids);

  // 5. Delete the channel record(s)
  onProgress({ stage: 'deleting_channels', message: 'Deleting channel entry...' });
  const { error: chErr } = await supabase.from('channels').delete().in('id', ids);
  if (chErr) {
    console.error('[deleteChannelWithAssociatedFilms] Error deleting channel:', chErr);
    throw chErr;
  }

  // 6. Log deletion
  if (channelRows) {
    for (const ch of channelRows) {
      await logDeletion({
        entity_type: 'channel',
        entity_id: ch.id,
        entity_name: ch.name,
        deleted_by: options.deletedBy || 'Admin UI (Cascade Rule)',
        reason: options.reason || `Temporary cascade rule: channel + ${filmIds.length} movies purged`,
      });
    }
  }

  return {
    deletedChannels: ids.length,
    deletedFilms: deletedFilmsCount,
    deletedCredits: deletedCreditsCount,
  };
}
