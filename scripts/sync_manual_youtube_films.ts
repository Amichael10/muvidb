import './dotenv_init.ts';
import { createClient } from '@supabase/supabase-js';
import { mineFilmComments } from '../api/_lib/comment_reviews.js';
import { pctLiked } from '../api/_lib/rating.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials.');
  process.exit(1);
}

if (!YOUTUBE_API_KEY) {
  console.error('❌ Missing YOUTUBE_API_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function extractYouTubeId(urlOrId: string | null | undefined): string | null {
  if (!urlOrId) return null;
  const clean = urlOrId.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) return clean;
  const m = clean.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

/**
 * Batch fetch video stats from YouTube Data API (up to 50 at a time)
 */
async function fetchBatchVideoStats(videoIds: string[]): Promise<Record<string, { viewCount: number; likeCount: number; commentCount: number; channelId?: string; channelTitle?: string }>> {
  if (videoIds.length === 0) return {};
  const results: Record<string, any> = {};

  const chunks: string[][] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    chunks.push(videoIds.slice(i, i + 50));
  }

  for (const chunk of chunks) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${chunk.join(',')}&key=${YOUTUBE_API_KEY}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`⚠️ YouTube API error status ${res.status}: ${await res.text()}`);
        continue;
      }
      const data = await res.json();
      for (const item of data.items || []) {
        const id = item.id;
        const stats = item.statistics || {};
        const snippet = item.snippet || {};
        results[id] = {
          viewCount: Number(stats.viewCount || 0),
          likeCount: Number(stats.likeCount || 0),
          commentCount: Number(stats.commentCount || 0),
          channelId: snippet.channelId,
          channelTitle: snippet.channelTitle
        };
      }
    } catch (e: any) {
      console.error('❌ Error fetching batch YouTube stats:', e.message);
    }
  }

  return results;
}

/**
 * Register Baggy Land and any new channel in youtube_channels
 */
async function ensureChannelRegistered(channelId: string, channelTitle: string) {
  if (!channelId) return;
  try {
    const { data: existing } = await supabase
      .from('youtube_channels')
      .select('id')
      .eq('channel_id', channelId)
      .maybeSingle();

    if (!existing) {
      await supabase.from('youtube_channels').insert({
        channel_id: channelId,
        title: channelTitle,
        is_active: true
      });
      console.log(`   📺 Registered channel: "${channelTitle}" (${channelId}) in youtube_channels`);
    }
  } catch (err: any) {
    // Ignore duplicate insert errors
  }
}

export async function syncManualYouTubeFilms(options: { limit?: number; onlyBaggy?: boolean } = {}) {
  console.log('🎬 Starting YouTube Manual Film Ratings & Reviews Sync...');
  console.log('🔒 STRICT GUARANTEE: FILM TITLES WILL NOT BE CHANGED OR MODIFIED.');

  // 1. Fetch Baggy Land film IDs first
  const { data: baggyRels } = await supabase
    .from('film_companies')
    .select('film_id')
    .eq('company_id', '2023564b-9d17-4aa9-a0f1-88e70bc16a8c');

  const baggyFilmIds = new Set((baggyRels || []).map(r => r.film_id));
  console.log(`📌 Found ${baggyFilmIds.size} Baggy Land Productions films.`);

  let targetFilms: any[] = [];

  if (baggyFilmIds.size > 0) {
    const { data: baggyFilms } = await supabase
      .from('films')
      .select('id, title, source, source_video_id, trailer_youtube_id, trailer_external_url, view_count, audience_rating')
      .in('id', Array.from(baggyFilmIds));

    if (baggyFilms) {
      targetFilms.push(...baggyFilms);
    }
  }

  if (!options.onlyBaggy) {
    // 2. Fetch other manual films with YouTube video IDs or links
    const { data: otherManualFilms, error: mErr } = await supabase
      .from('films')
      .select('id, title, source, source_video_id, trailer_youtube_id, trailer_external_url, view_count, audience_rating')
      .eq('source', 'manual')
      .or('source_video_id.not.is.null,trailer_youtube_id.not.is.null,trailer_external_url.ilike.%youtube%,trailer_external_url.ilike.%youtu.be%')
      .limit(options.limit || 1000);

    if (otherManualFilms) {
      for (const f of otherManualFilms) {
        if (!baggyFilmIds.has(f.id)) {
          targetFilms.push(f);
        }
      }
    }
  }

  if (options.limit && options.limit > 0) {
    targetFilms = targetFilms.slice(0, options.limit);
  }
  console.log(`🎯 Total manual films in queue: ${targetFilms.length}`);

  // 3. Extract video IDs
  const validQueue: { film: any; videoId: string; isBaggy: boolean }[] = [];
  for (const film of targetFilms) {
    const videoId = extractYouTubeId(film.source_video_id) || extractYouTubeId(film.trailer_youtube_id) || extractYouTubeId(film.trailer_external_url);
    if (videoId) {
      validQueue.push({
        film,
        videoId,
        isBaggy: baggyFilmIds.has(film.id)
      });
    }
  }

  console.log(`📹 Valid YouTube video IDs mapped: ${validQueue.length} / ${targetFilms.length}`);

  // 4. Batch fetch video stats (views, likes, comments)
  const allVideoIds = Array.from(new Set(validQueue.map(q => q.videoId)));
  console.log(`📡 Fetching YouTube stats for ${allVideoIds.length} unique videos in batches of 50...`);
  const statsMap = await fetchBatchVideoStats(allVideoIds);
  console.log(`✓ Received stats for ${Object.keys(statsMap).length} videos.`);

  let totalProcessed = 0;
  let statsUpdated = 0;
  let commentsMined = 0;

  for (const { film, videoId, isBaggy } of validQueue) {
    totalProcessed++;
    const stats = statsMap[videoId];
    const tag = isBaggy ? '[BAGGY LAND]' : '[MANUAL]';
    console.log(`\n------------------------------------------------------------`);
    console.log(`[${totalProcessed}/${validQueue.length}] ${tag} Processing: "${film.title}" (Video: ${videoId})`);

    // Ensure Baggy Land channel is registered if it's a Baggy Land video
    if (isBaggy) {
      await ensureChannelRegistered('UC8xp-iF5mxrFcyb0ZqApWVQ', 'Baggy Land Productions');
    } else if (stats?.channelId && stats?.channelTitle) {
      await ensureChannelRegistered(stats.channelId, stats.channelTitle);
    }

    // Skip if already enriched with ratings & reviews
    if (film.view_count > 0 && film.audience_rating > 0) {
      const { count: existingRevs } = await supabase
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('film_id', film.id)
        .eq('source', 'youtube');
      if (existingRevs && existingRevs > 0) {
        console.log(`   ⚡ Already enriched with audience rating (${film.audience_rating}/10) and ${existingRevs} reviews. Skipping.`);
        continue;
      }
    }

    if (stats) {
      console.log(`   📊 Stats: ${stats.viewCount.toLocaleString()} views, ${stats.likeCount.toLocaleString()} likes, ${stats.commentCount.toLocaleString()} comments`);

      // 1. Insert into youtube_stats table
      try {
        await supabase.from('youtube_stats').insert({
          film_id: film.id,
          youtube_video_id: videoId,
          view_count: stats.viewCount,
          like_count: stats.likeCount,
          comment_count: stats.commentCount,
          synced_at: new Date().toISOString()
        });
      } catch (err: any) {
        console.warn(`   ⚠️ Error inserting youtube_stats:`, err.message);
      }

      // Calculate initial rating from views & likes if not yet rated
      let calculatedRating: number | null = null;
      let calculatedLikedPct: number | null = null;
      if (stats.viewCount >= 500 && stats.likeCount > 0) {
        const likeRatio = stats.likeCount / stats.viewCount;
        calculatedRating = Math.round(Math.min(9.0, Math.max(5.5, 6.0 + likeRatio * 50)) * 10) / 10;
        calculatedLikedPct = pctLiked(calculatedRating);
      }

      // 2. Update films table (NEVER TOUCHING TITLE!)
      const filmUpdates: any = {
        view_count: stats.viewCount,
        youtube_watch_url: `https://www.youtube.com/watch?v=${videoId}`
      };

      if (!film.trailer_youtube_id) {
        filmUpdates.trailer_youtube_id = videoId;
      }

      if (calculatedRating && (!film.audience_rating || film.audience_rating === 0)) {
        filmUpdates.audience_rating = calculatedRating;
        filmUpdates.audience_rating_count = stats.likeCount;
        if (calculatedLikedPct) filmUpdates.liked_percent = calculatedLikedPct;
        filmUpdates.average_rating = calculatedRating;
      }

      const { error: fuErr } = await supabase
        .from('films')
        .update(filmUpdates)
        .eq('id', film.id);

      if (fuErr) {
        console.error(`   ❌ Failed to update film stats:`, fuErr.message);
      } else {
        statsUpdated++;
        console.log(`   ✓ Saved YouTube statistics & audience rating (${calculatedRating ?? 'N/A'}/10, ${calculatedLikedPct ?? 'N/A'}% liked)`);
      }
    } else {
      console.log(`   ⚠️ Video ${videoId} has no public statistics or was made private.`);
    }

    // 3. Mine comments and reviews from audience
    if (stats && stats.commentCount > 0) {
      console.log(`   💬 Mining viewer comments for audience reviews & rating...`);
      try {
        const mineRes = await mineFilmComments(film.id, videoId, { maxKeep: 6, dryRun: false });
        if (mineRes.status === 'ok') {
          commentsMined++;
          console.log(`   ✨ Mined ${mineRes.kept} review opinions! New Audience Rating: ${mineRes.rating}/10 (${mineRes.likedPercent}% liked)`);
        } else {
          console.log(`   ℹ️ Comment mining status: ${mineRes.status} (${mineRes.reason || 'no comments kept'})`);
        }
      } catch (cErr: any) {
        console.warn(`   ⚠️ Comment mining skipped:`, cErr.message);
      }
    }

    // Small delay to be polite with YouTube & Groq AI APIs
    await sleep(400);
  }

  console.log(`\n============================================================`);
  console.log(`🎉 YouTube Manual Films Sync Complete!`);
  console.log(`   📊 Total Processed: ${totalProcessed}`);
  console.log(`   📈 Stats Updated: ${statsUpdated}`);
  console.log(`   💬 Reviews Mined: ${commentsMined}`);
  console.log(`   🔒 All film titles remained completely unchanged.`);
  console.log(`============================================================`);
}

// CLI Execution Support
const onlyBaggy = process.argv.includes('--baggy-only');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

syncManualYouTubeFilms({ onlyBaggy, limit }).catch(console.error);
