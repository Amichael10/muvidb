import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './supabase.js';
import { isValidAuth } from './auth.js';
import { ytGet, parseDuration, cleanTitle } from './yt_service.js';

/**
 * Manual/Targeted Video Refresh
 * Used by the Admin UI to sync a specific channel or all channels.
 * Includes auto-promotion logic for long videos.
 */

export const config = { maxDuration: 300 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end();
  
  // Auth check
  if (!(await isValidAuth(req)).valid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { channelId } = req.query;
  let totalProcessed = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalFailed = 0;

  // 1. Create a "running" log entry
  const { data: logEntry } = await supabase.from('sync_logs').insert({
    source: 'youtube_manual',
    status: 'running',
    message: `Started sync for ${channelId ? 'channel ' + channelId : 'all channels'}...`,
    details: { channelId, started_at: new Date().toISOString() }
  }).select().single();

  const logId = logEntry?.id;

  try {
    let channelsToProcess = [];
    if (channelId) {
      const { data: channel, error: chFetchErr } = await supabase.from('channels').select('*').eq('id', channelId).single();
      if (chFetchErr || !channel) return res.status(404).json({ error: 'Channel not found' });
      channelsToProcess = [channel];
    } else {
      const { data: channels, error: listErr } = await supabase.from('channels').select('*');
      if (listErr) throw new Error(`Failed to list channels: ${listErr.message}`);
      channelsToProcess = channels || [];
    }

    const processResults = [];

    for (const ch of channelsToProcess) {
      try {
        const { data: hiddenVids } = await supabase.from('channel_videos').select('video_id').eq('channel_id', ch.id).eq('is_hidden', true);
        const hiddenSet = new Set(hiddenVids?.map(v => v.video_id) || []);

        const handle = ch.channel_handle?.replace(/^@/, '');
        let uploadsId = '';
        let discoveredChannelId = ch.channel_id;

        // 1. Resolve uploads playlist ID & update metadata
        let ytChannelData = null;
        if (discoveredChannelId) {
          ytChannelData = await ytGet('channels', { part: 'snippet,contentDetails,statistics,brandingSettings', id: discoveredChannelId });
        } else if (handle) {
          ytChannelData = await ytGet('channels', { part: 'snippet,contentDetails,statistics,brandingSettings', forHandle: handle });
        }

        if (ytChannelData?.items?.[0]) {
          const item = ytChannelData.items[0];
          discoveredChannelId = item.id;
          uploadsId = item.contentDetails?.relatedPlaylists?.uploads;
          
          await supabase.from('channels').update({
            channel_id: discoveredChannelId,
            subscriber_count: parseInt(item.statistics?.subscriberCount || '0'),
            thumbnail_url: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url,
            banner_url: item.brandingSettings?.image?.bannerExternalUrl || ch.banner_url
          }).eq('id', ch.id);
        }

        if (!uploadsId) {
          processResults.push({ name: ch.name, status: 'skipped', reason: 'No uploads playlist' });
          continue;
        }

        // 2. Fetch latest videos incrementally
        const { data: latestVid } = await supabase.from('channel_videos').select('published_at').eq('channel_id', ch.id).order('published_at', { ascending: false }).limit(1).single();
        const latestDate = latestVid ? new Date(latestVid.published_at) : new Date(0);
        
        let nextPageToken = '';
        let fetchedCount = 0;
        let stopFetching = false;
        const allVideoRows = [];

        while (!stopFetching && fetchedCount < 200) {
          const plData = await ytGet('playlistItems', { 
            part: 'snippet', playlistId: uploadsId, maxResults: '50', pageToken: nextPageToken
          });
          if (!plData.items?.length) break;

          const videoIds = plData.items.map((i: any) => i.snippet.resourceId.videoId).join(',');
          const vData = await ytGet('videos', { part: 'contentDetails,snippet', id: videoIds });

          const promotableVids = vData.items.filter((v: any) => parseDuration(v.contentDetails.duration) >= 900 && !hiddenSet.has(v.id));

          // 1. Bulk check existing films
          const existingFilmsMap = new Map();
          if (promotableVids.length > 0) {
            const vIds = promotableVids.map((v: any) => v.id);
            const { data: existingFilms } = await supabase.from('films').select('id, source_video_id').in('source_video_id', vIds);
            if (existingFilms) existingFilms.forEach((f: any) => existingFilmsMap.set(f.source_video_id, f.id));
          }

          // 2. Auto-promote
          const filmsToInsert = promotableVids.filter((v: any) => !existingFilmsMap.has(v.id)).map((v: any) => ({
            title: cleanTitle(v.snippet.title),
            synopsis: v.snippet.description || '',
            poster_url: v.snippet.thumbnails?.high?.url || v.snippet.thumbnails?.medium?.url,
            release_type: 'youtube',
            youtube_watch_url: `https://www.youtube.com/watch?v=${v.id}`,
            source_video_id: v.id,
            year: new Date(v.snippet.publishedAt).getFullYear(),
            runtime_minutes: Math.round(parseDuration(v.contentDetails.duration) / 60),
            language: ch.primary_language || 'English'
          }));

          let insertedFilms: any[] = [];
          if (filmsToInsert.length > 0) {
            const { data: newFilms } = await supabase.from('films').insert(filmsToInsert).select();
            if (newFilms) {
              insertedFilms = newFilms;
              insertedFilms.forEach((f: any) => {
                existingFilmsMap.set(f.source_video_id, f.id);
                totalCreated++;
              });
            }
          }

          // 3. Auto-credit owner
          if (ch.owner_person_id && insertedFilms.length > 0) {
            await supabase.from('credits').insert(insertedFilms.map(f => ({
              film_id: f.id, person_id: ch.owner_person_id, role: 'Actor', billing_order: 1
            })));
          }

          // 4. Construct video rows
          for (const v of vData.items) {
            if (hiddenSet.has(v.id)) continue;
            const duration = parseDuration(v.contentDetails.duration);
            const row: any = {
              channel_id: ch.id,
              video_id: v.id,
              title: v.snippet.title,
              thumbnail_url: v.snippet.thumbnails?.high?.url || v.snippet.thumbnails?.medium?.url,
              published_at: v.snippet.publishedAt,
              duration_seconds: duration,
              match_status: (duration >= 900 && existingFilmsMap.has(v.id)) ? 'matched' : 'unmatched',
              film_id: (duration >= 900) ? existingFilmsMap.get(v.id) : null
            };
            allVideoRows.push(row);
          }

          fetchedCount += vData.items.length;
          const oldestInPage = new Date(vData.items[vData.items.length - 1].snippet.publishedAt);
          if (oldestInPage <= latestDate) stopFetching = true;
          nextPageToken = plData.nextPageToken;
          if (!nextPageToken) stopFetching = true;
        }

        if (allVideoRows.length > 0) {
          const { error: upsertErr } = await supabase.from('channel_videos').upsert(allVideoRows, { onConflict: 'channel_id,video_id' });
          if (upsertErr) {
            totalFailed++;
            processResults.push({ name: ch.name, status: 'error', reason: upsertErr.message });
          } else {
            totalUpdated += allVideoRows.length;
            totalProcessed += allVideoRows.length;
            await supabase.from('channels').update({ videos_last_fetched_at: new Date().toISOString() }).eq('id', ch.id);
            processResults.push({ name: ch.name, status: 'success', count: allVideoRows.length });
          }
        } else {
          processResults.push({ name: ch.name, status: 'skipped', reason: 'No new videos' });
        }
      } catch (err: any) {
        totalFailed++;
        processResults.push({ name: ch.name, status: 'error', reason: err.message });
      }
    }

    const duration = Date.now() - startTime;
    if (logId) {
      await supabase.from('sync_logs').update({
        status: totalFailed === 0 ? 'success' : (totalProcessed > 0 ? 'partial' : 'error'),
        message: `Processed ${channelsToProcess.length} channels. Created ${totalCreated} films.`,
        details: { processResults, completed_at: new Date().toISOString() },
        duration_ms: duration,
        items_processed: totalProcessed,
        items_created: totalCreated,
        items_updated: totalUpdated,
        items_failed: totalFailed
      }).eq('id', logId);
    }

    return res.status(200).json({ success: true, videos_upserted: totalUpdated, channels_processed: channelsToProcess.length, results: processResults });

  } catch (err: any) {
    if (logId) {
      await supabase.from('sync_logs').update({ status: 'error', message: err.message, duration_ms: Date.now() - startTime, items_failed: 1, details: { error: err.stack } }).eq('id', logId);
    }
    return res.status(500).json({ error: err.message });
  }
}
