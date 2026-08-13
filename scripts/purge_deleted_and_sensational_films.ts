import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { isSensationalizedYouTubeTitle, curateYouTubeTitle } from '../api/_lib/youtube_title_policy.js';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function withRetry<T>(fn: () => Promise<T>, retries = 5, delayMs = 2000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.log(`[Attempt ${i + 1}] Network error, retrying in ${delayMs}ms...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

async function purgeSensationalAndOrphanedFilms() {
  console.log('🧹 STARTING SENSATIONAL & ORPHANED FILMS PURGE...');

  let allFilms: any[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;

  while (true) {
    const currentFrom = from;
    const pageData = await withRetry(async () => {
      const { data, error } = await supabase
        .from('films')
        .select('id, title, source_video_id, trailer_youtube_id, youtube_watch_url, release_type')
        .range(currentFrom, currentFrom + PAGE_SIZE - 1);
      if (error) throw error;
      return data || [];
    });

    if (!pageData || pageData.length === 0) break;
    allFilms.push(...pageData);
    if (pageData.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  console.log(`Auditing ${allFilms.length} films for clickbait titles and rejected video links...`);

  // 1. Identify sensational clickbait title films
  const sensationalFilmIds: string[] = [];
  const videoIdsToHide = new Set<string>();

  for (const film of allFilms) {
    const title = film.title || '';
    const policy = curateYouTubeTitle(title);

    if (isSensationalizedYouTubeTitle(title) || policy.action === 'skip') {
      sensationalFilmIds.push(film.id);
      if (film.source_video_id) videoIdsToHide.add(film.source_video_id);
      if (film.trailer_youtube_id) videoIdsToHide.add(film.trailer_youtube_id);
    }
  }

  console.log(`Found ${sensationalFilmIds.length} clickbait/sensational films to purge.`);

  // 2. Identify films linked to hidden/rejected channel_videos
  const hiddenVideos = await withRetry(async () => {
    const { data, error } = await supabase
      .from('channel_videos')
      .select('video_id')
      .or('is_hidden.eq.true,match_status.eq.rejected');
    if (error) throw error;
    return data || [];
  });

  const hiddenVideoSet = new Set((hiddenVideos || []).map((v: any) => v.video_id));
  const recreatedFilmIds: string[] = [];

  for (const film of allFilms) {
    if (film.source_video_id && hiddenVideoSet.has(film.source_video_id)) {
      recreatedFilmIds.push(film.id);
    }
  }

  console.log(`Found ${recreatedFilmIds.length} films resurrected from hidden/rejected videos to purge.`);

  const allIdsToPurge = Array.from(new Set([...sensationalFilmIds, ...recreatedFilmIds]));

  if (allIdsToPurge.length === 0) {
    console.log('✅ No clickbait or resurrected films found in DB!');
    return;
  }

  // 3. Mark channel_videos for all purged films as is_hidden = true, match_status = 'rejected'
  const videoIdList = Array.from(videoIdsToHide).filter(Boolean);
  if (videoIdList.length > 0) {
    const CHUNK_V = 100;
    for (let i = 0; i < videoIdList.length; i += CHUNK_V) {
      const chunk = videoIdList.slice(i, i + CHUNK_V);
      await withRetry(async () => {
        const { error } = await supabase
          .from('channel_videos')
          .update({
            is_hidden: true,
            match_status: 'rejected',
            film_id: null,
          })
          .in('video_id', chunk);
        if (error) throw error;
      });
    }
  }

  // 4. Delete films from `films` table in chunks of 50
  const CHUNK_F = 50;
  let deletedTotal = 0;
  for (let i = 0; i < allIdsToPurge.length; i += CHUNK_F) {
    const chunk = allIdsToPurge.slice(i, i + CHUNK_F);
    await withRetry(async () => {
      const { error } = await supabase.from('films').delete().in('id', chunk);
      if (error) throw error;
    });
    deletedTotal += chunk.length;
  }

  console.log(`🎉 Purge complete! Deleted ${deletedTotal} clickbait / resurrected films and hid ${videoIdList.length} YouTube source videos.`);
}

purgeSensationalAndOrphanedFilms().catch(console.error);
