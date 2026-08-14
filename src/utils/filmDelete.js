import { supabase } from '../lib/supabase';

/**
 * Log a deletion event to `deletion_logs` in Supabase.
 */
export async function logDeletion({ entity_type, entity_id, entity_name, deleted_by = 'Admin UI', reason = '' }) {
  try {
    await supabase.from('deletion_logs').insert({
      entity_type,
      entity_id,
      entity_name,
      deleted_by,
      reason,
    });
  } catch (err) {
    console.warn('[logDeletion] Non-blocking warning logging deletion:', err);
  }
}

/**
 * Permanently delete film(s) from the database, log the deletion event,
 * and ensure their source YouTube video(s) are marked as hidden/rejected in `channel_videos`.
 */
export async function deleteFilmsPermanently(filmIds, deletedBy = 'Admin UI', reason = 'Manual deletion from Admin') {
  if (!filmIds || !filmIds.length) return { count: 0 };

  // 1. Fetch title & source_video_id for these films to record logs & hide videos
  const { data: films } = await supabase
    .from('films')
    .select('id, title, source_video_id, trailer_youtube_id, youtube_watch_url')
    .in('id', filmIds);

  const videoIdsToHide = new Set();
  if (films) {
    for (const f of films) {
      if (f.source_video_id) videoIdsToHide.add(f.source_video_id);
      if (f.trailer_youtube_id) videoIdsToHide.add(f.trailer_youtube_id);
      if (f.youtube_watch_url) {
        const match = f.youtube_watch_url.match(/(?:v=|youtu\.be\/)([\w-]{11})/);
        if (match?.[1]) videoIdsToHide.add(match[1]);
      }

      // Log each film deletion
      await logDeletion({
        entity_type: 'film',
        entity_id: f.id,
        entity_name: f.title || 'Untitled Film',
        deleted_by: deletedBy,
        reason: reason,
      });
    }
  }

  // 2. Mark corresponding channel_videos as hidden & rejected
  const videoIdList = Array.from(videoIdsToHide).filter(Boolean);
  if (videoIdList.length > 0) {
    try {
      await supabase
        .from('channel_videos')
        .update({
          is_hidden: true,
          match_status: 'rejected',
          film_id: null,
        })
        .in('video_id', videoIdList);
    } catch (err) {
      console.warn('[deleteFilmsPermanently] Warning updating channel_videos:', err);
    }
  }

  // 3. Delete the films in chunks of 50
  const CHUNK_SIZE = 50;
  for (let i = 0; i < filmIds.length; i += CHUNK_SIZE) {
    const chunk = filmIds.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from('films').delete().in('id', chunk);
    if (error) throw error;
  }

  return { count: filmIds.length, hiddenVideoCount: videoIdList.length };
}
