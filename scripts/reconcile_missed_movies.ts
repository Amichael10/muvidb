import 'dotenv/config';
import { supabase } from '../api/_lib/supabase.js';
import { sendUploadAlert, type UploadCandidate, type ChannelRow } from '../api/_lib/youtube_upload_notify.js';
import { ytGet, parseDuration } from '../api/_lib/yt_service.js';

async function main() {
  console.log('🔍 Checking for recently imported films that missed alerts/drafts...');

  // Get films created in the last 7 days from YouTube
  const sinceDate = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data: films, error: filmsErr } = await supabase
    .from('films')
    .select('id, title, source_video_id, created_at, release_date')
    .not('source_video_id', 'is', null)
    .gte('created_at', sinceDate)
    .order('created_at', { ascending: false });

  if (filmsErr) {
    console.error('Failed to query films:', filmsErr.message);
    return;
  }

  console.log(`Found ${films?.length || 0} films created in the last 7 days.`);

  let alertedCount = 0;

  for (const film of films || []) {
    // Check if alert already sent
    const { data: alert } = await supabase
      .from('youtube_upload_alert_log')
      .select('status, notified_at')
      .eq('video_id', film.source_video_id)
      .maybeSingle();

    if (alert && alert.status === 'notified') {
      console.log(`⏩ [Skipping] ${film.title} (${film.source_video_id}) already alerted at ${alert.notified_at}`);
      continue;
    }

    // Find the channel for this video
    const { data: cv } = await supabase
      .from('channel_videos')
      .select('channel_id, title, duration_seconds, published_at, thumbnail_url')
      .eq('video_id', film.source_video_id)
      .maybeSingle();

    let channelId = cv?.channel_id;
    let channel: ChannelRow | null = null;

    if (channelId) {
      const { data: ch } = await supabase
        .from('channels')
        .select('id, name, channel_handle, channel_id, channel_url')
        .eq('id', channelId)
        .maybeSingle();
      channel = ch as ChannelRow | null;
    }

    if (!channel) {
      // Try to fetch video details directly from YouTube
      try {
        const vData = await ytGet('videos', { part: 'snippet,contentDetails', id: film.source_video_id });
        const item = vData?.items?.[0];
        if (item) {
          const ytChannelId = item.snippet?.channelId;
          const { data: ch } = await supabase
            .from('channels')
            .select('id, name, channel_handle, channel_id, channel_url')
            .or(`channel_id.eq.${ytChannelId},channel_url.ilike.%${ytChannelId}%`)
            .maybeSingle();
          channel = ch as ChannelRow | null;
        }
      } catch (err: any) {
        console.warn(`Could not resolve channel from YouTube for ${film.title}:`, err?.message || err);
      }
    }

    if (!channel) {
      console.warn(`⚠️ Could not find registered channel for ${film.title} (${film.source_video_id}). Skipping.`);
      continue;
    }

    // Build upload candidate
    const candidate: UploadCandidate = {
      video_id: film.source_video_id,
      title: cv?.title || film.title,
      duration_seconds: cv?.duration_seconds || 5400,
      published_at: cv?.published_at || film.created_at,
      thumbnail_url: cv?.thumbnail_url || null,
    };

    console.log(`📢 Sending upload alert & generating Social Studio draft for: "${film.title}" on channel "${channel.name}"...`);
    try {
      const res = await sendUploadAlert(channel, candidate, 'reconciliation_catchup');
      console.log(`   Result:`, res);
      if (res.ok) {
        alertedCount++;
      }
    } catch (e: any) {
      console.error(`   Error alerting for ${film.title}:`, e?.message || e);
    }
  }

  console.log(`\n🎉 Reconciled ${alertedCount} missing film alerts and social drafts!`);
}

main();
