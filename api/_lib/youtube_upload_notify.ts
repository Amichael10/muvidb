/**
 * Telegram alerts when a monitored YouTube channel uploads a new film-length video.
 * Idempotent via youtube_upload_alert_log.
 */
import { supabase } from './supabase.js';
import { sendTelegramMessage, telegramConfigured } from './telegram.js';
import { ytGet, parseDuration } from './yt_service.js';

const FILM_MIN_SEC = 1800;

function isFilmLengthDuration(seconds: number | null | undefined): boolean {
  return (seconds ?? 0) >= FILM_MIN_SEC;
}

export type ChannelRow = {
  id: string;
  name: string;
  channel_handle?: string | null;
  channel_id?: string | null;
  channel_url?: string | null;
};

export type UploadCandidate = {
  video_id: string;
  title: string;
  duration_seconds: number;
  published_at?: string | null;
  thumbnail_url?: string | null;
};

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  const mins = m % 60;
  if (h > 0) return `${h}h ${mins}m`;
  return `${m}m`;
}

async function claimAlert(channelId: string, video: UploadCandidate, source: string): Promise<boolean> {
  const { error } = await supabase.from('youtube_upload_alert_log').insert({
    channel_id: channelId,
    video_id: video.video_id,
    title: video.title?.slice(0, 500) || null,
    notified_at: new Date().toISOString(),
    status: 'processing',
    source,
  });
  if (!error) return true;
  if (error.code === '23505') return false;
  throw error;
}

async function markNotified(channelId: string, video: UploadCandidate) {
  const { error } = await supabase
    .from('youtube_upload_alert_log')
    .update({
      title: video.title?.slice(0, 500) || null,
      notified_at: new Date().toISOString(),
      status: 'notified',
      last_error: null,
    })
    .eq('channel_id', channelId)
    .eq('video_id', video.video_id);
  if (error) {
    console.warn('[youtube_upload_notify] alert log update failed:', error.message);
  }
}

async function releaseFailedClaim(channelId: string, videoId: string, message: string) {
  const { error } = await supabase
    .from('youtube_upload_alert_log')
    .delete()
    .eq('channel_id', channelId)
    .eq('video_id', videoId)
    .eq('status', 'processing');
  if (error) console.warn('[youtube_upload_notify] failed claim cleanup:', message, error.message);
}

async function sendUploadAlert(channel: ChannelRow, video: UploadCandidate, source: string) {
  if (!telegramConfigured()) return { ok: false, skipped: 'telegram not configured' };
  if (!(await claimAlert(channel.id, video, source))) return { ok: false, skipped: 'already claimed' };

  const url = `https://www.youtube.com/watch?v=${video.video_id}`;
  const mins = formatDuration(video.duration_seconds || 0);
  const published = video.published_at ? new Date(video.published_at).toISOString().slice(0, 16).replace('T', ' ') : '';

  const message = [
    '🎬 New YouTube upload',
    `Channel: ${channel.name}${channel.channel_handle ? ` (@${String(channel.channel_handle).replace(/^@/, '')})` : ''}`,
    `Title: ${video.title}`,
    `Length: ${mins}${published ? ` · ${published} UTC` : ''}`,
    url,
    '',
    'Auto-import runs on the next YouTube sync unless you hide it below.',
  ].join('\n');

  const sent = await sendTelegramMessage({
    text: message,
    disablePreview: false,
    replyMarkup: {
      inline_keyboard: [
        [
          { text: '▶ Open', url },
          {
            text: '🙈 Hide (skip import)',
            callback_data: `hide_yt:${channel.id}:${video.video_id}`,
          },
        ],
      ],
    },
  });

  if (!sent.ok) {
    console.warn('[youtube_upload_notify] telegram failed:', sent.error);
    await releaseFailedClaim(channel.id, video.video_id, sent.error || 'Telegram delivery failed');
    return { ok: false, error: sent.error };
  }

  await markNotified(channel.id, video);
  return { ok: true };
}

/** Notify for uploads not yet in DB buffer and not yet alerted. */
export async function notifyYouTubeUploads(
  channel: ChannelRow,
  candidates: UploadCandidate[],
  options: {
    baselineAt?: string | null;
    source?: 'websub' | 'reconciliation' | 'full_sync';
  } = {},
) {
  if (!telegramConfigured() || !candidates.length) {
    return { notified: 0, skipped: candidates.length };
  }

  let baselineAt = options.baselineAt || null;
  if (!baselineAt) {
    const { data: subscription, error: baselineError } = await supabase
      .from('youtube_websub_subscriptions')
      .select('baseline_at')
      .eq('channel_id', channel.id)
      .maybeSingle();
    if (baselineError) throw baselineError;
    baselineAt = subscription?.baseline_at || null;
  }

  // No state means this is the first observation of the channel. Establishing
  // a subscription/reconciliation baseline must happen before alerts are sent;
  // otherwise the first run would announce a backlog as if it were new.
  if (!baselineAt)
    return {
      notified: 0,
      skipped: candidates.length,
      reason: 'baseline_missing',
    };

  // The baseline is the primary no-backfill boundary. The 48-hour ceiling is a
  // secondary guard against corrupt timestamps or a stale subscription.
  const MAX_UPLOAD_AGE_MS = 48 * 3600 * 1000;
  const now = Date.now();
  const baselineTime = new Date(baselineAt).getTime();
  const recentFilmLength = candidates.filter((v) => {
    if (!isFilmLengthDuration(v.duration_seconds || 0)) return false;
    if (!v.published_at) return false;
    const pubTime = new Date(v.published_at).getTime();
    return (
      !isNaN(pubTime) &&
      !isNaN(baselineTime) &&
      pubTime > baselineTime &&
      pubTime <= now + 5 * 60 * 1000 &&
      now - pubTime <= MAX_UPLOAD_AGE_MS
    );
  });

  if (!recentFilmLength.length) return { notified: 0, skipped: candidates.length };

  const candidateIds = recentFilmLength.map((v) => v.video_id);

  // Check which candidate videos are already imported into channel_videos
  const { data: existingRows } = await supabase
    .from('channel_videos')
    .select('video_id')
    .eq('channel_id', channel.id)
    .in('video_id', candidateIds);

  const existingSet = new Set((existingRows || []).map((r) => r.video_id));

  // Check which candidate videos have already been alerted on
  const { data: alertedRows } = await supabase
    .from('youtube_upload_alert_log')
    .select('video_id,status,notified_at')
    .eq('channel_id', channel.id)
    .in('video_id', candidateIds);

  const staleClaimCutoff = now - 15 * 60 * 1000;
  const staleClaims = (alertedRows || []).filter(
    (row) => row.status === 'processing' && new Date(row.notified_at || 0).getTime() < staleClaimCutoff,
  );
  if (staleClaims.length) {
    await supabase
      .from('youtube_upload_alert_log')
      .delete()
      .eq('channel_id', channel.id)
      .eq('status', 'processing')
      .in(
        'video_id',
        staleClaims.map((row) => row.video_id),
      );
  }
  const staleIds = new Set(staleClaims.map((row) => row.video_id));
  const alertedSet = new Set(
    (alertedRows || [])
      .filter((row) => !staleIds.has(row.video_id) && row.status !== 'failed')
      .map((row) => row.video_id),
  );

  let notified = 0;
  for (const video of recentFilmLength) {
    if (existingSet.has(video.video_id)) continue;
    if (alertedSet.has(video.video_id)) continue;

    const sent = await sendUploadAlert(channel, video, options.source || 'full_sync');
    if (sent.ok) notified += 1;
  }
  return { notified, skipped: candidates.length - notified };
}

/** Lightweight poll — first playlist page only (for frequent watch cron). */
export async function pollChannelUploads(channel: ChannelRow): Promise<UploadCandidate[]> {
  const handle = channel.channel_handle?.replace(/^@/, '');
  const idMatch = channel.channel_url?.match(/\/channel\/(UC[\w-]+)/);
  let ytChannelId = channel.channel_id || idMatch?.[1];
  let uploadsId = '';

  let ytChannelData = null;
  if (ytChannelId) {
    ytChannelData = await ytGet('channels', {
      part: 'contentDetails',
      id: ytChannelId,
    });
  } else if (handle) {
    ytChannelData = await ytGet('channels', {
      part: 'contentDetails',
      forHandle: handle,
    });
  }

  if (ytChannelData?.items?.[0]) {
    ytChannelId = ytChannelData.items[0].id;
    uploadsId = ytChannelData.items[0].contentDetails?.relatedPlaylists?.uploads;
  }
  if (!uploadsId) return [];

  const plData = await ytGet('playlistItems', {
    part: 'snippet',
    playlistId: uploadsId,
    maxResults: '15',
  });
  if (!plData.items?.length) return [];

  const ids = plData.items.map((i: any) => i.snippet.resourceId.videoId).join(',');
  const vData = await ytGet('videos', { part: 'contentDetails', id: ids });
  const durations = new Map<string, number>(
    (vData.items || []).map((v: any) => [v.id, parseDuration(v.contentDetails?.duration ?? '')]),
  );

  return plData.items.map((item: any) => {
    const vid = item.snippet.resourceId.videoId;
    return {
      video_id: vid,
      title: item.snippet.title,
      published_at: item.snippet.publishedAt,
      thumbnail_url: item.snippet.thumbnails?.medium?.url ?? null,
      duration_seconds: durations.get(vid) ?? 0,
    };
  });
}

/** Run from GitHub Actions — alert before the full sync auto-imports. */
export async function runYouTubeUploadWatch() {
  if (process.env.ENABLE_YOUTUBE_WATCH === 'false') {
    return {
      ok: true,
      message: 'YouTube upload watch is currently paused/disabled.',
      channels: 0,
      notified: 0,
    };
  }

  if (!telegramConfigured()) {
    return {
      ok: false,
      message: 'Telegram not configured (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID)',
    };
  }

  const { data: channels, error } = await supabase
    .from('channels')
    .select('id, name, channel_handle, channel_id, channel_url')
    .eq('sync_enabled', true)
    .order('name');

  if (error) throw error;
  if (!channels?.length) return { ok: true, channels: 0, notified: 0 };

  let totalNotified = 0;
  const details: { channel: string; notified: number; status?: string }[] = [];

  for (const ch of channels) {
    try {
      const uploads = await pollChannelUploads(ch);
      const { data: existingState, error: stateError } = await supabase
        .from('youtube_websub_subscriptions')
        .select('baseline_at')
        .eq('channel_id', ch.id)
        .maybeSingle();
      if (stateError) throw stateError;

      if (!existingState) {
        const nowIso = new Date().toISOString();
        const externalId = ch.channel_id || ch.channel_url?.match(/\/channel\/(UC[\w-]+)/)?.[1];
        if (!externalId) {
          details.push({
            channel: ch.name,
            notified: 0,
            status: 'awaiting_websub_setup',
          });
          continue;
        }
        const { error: baselineError } = await supabase.from('youtube_websub_subscriptions').insert({
          channel_id: ch.id,
          youtube_channel_id: externalId,
          topic_url: `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(externalId)}`,
          status: 'pending',
          baseline_at: nowIso,
          last_reconciled_at: nowIso,
        });
        if (baselineError) throw baselineError;
        details.push({
          channel: ch.name,
          notified: 0,
          status: 'baseline_initialized',
        });
        continue;
      }

      const result = await notifyYouTubeUploads(ch, uploads, {
        baselineAt: existingState.baseline_at,
        source: 'reconciliation',
      });
      totalNotified += result.notified;
      await supabase
        .from('youtube_websub_subscriptions')
        .update({
          last_reconciled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('channel_id', ch.id);
      if (result.notified > 0) {
        details.push({ channel: ch.name, notified: result.notified });
      }
    } catch (e: any) {
      console.warn(`[youtube_upload_watch] ${ch.name}:`, e?.message || e);
    }
  }

  return {
    ok: true,
    channels: channels.length,
    notified: totalNotified,
    details,
  };
}
