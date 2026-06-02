import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { ytGet, parseDuration, cleanTitle } from '../api/_lib/yt_service.js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

const FILM_MIN_SEC = 1800;

async function run() {
  // Fetch all channels that need refresh
  const { data: channels } = await supabase
    .from('channels')
    .select('id, name, channel_url, channel_handle, owner_person_id, videos_last_fetched_at, primary_language')
    .or('videos_last_fetched_at.is.null,videos_last_fetched_at.lt.' + new Date(Date.now() - 3.5*3600*1000).toISOString())
    .order('videos_last_fetched_at', { ascending: true, nullsFirst: true });

  if (!channels || channels.length === 0) {
    console.log('No channels need syncing right now.');
    return;
  }

  console.log(`Refreshing ${channels.length} channels…\n`);

  let videosTotal = 0, filmsTotal = 0, errorsTotal = 0;

  for (const ch of channels) {
    const t0 = Date.now();
    try {
      const handle   = ch.channel_handle?.replace(/^@/, '');
      const idMatch  = ch.channel_url?.match(/\/channel\/(UC[\w-]+)/);
      const ytChId   = idMatch?.[1];

      let uploadsId = null;
      if (ytChId) {
        const d = await ytGet('channels', { part: 'contentDetails', id: ytChId });
        uploadsId = d.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
      } else if (handle) {
        const d = await ytGet('channels', { part: 'contentDetails', forHandle: handle });
        uploadsId = d.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
      }

      if (!uploadsId) {
        console.log(`  ✗ ${ch.name.padEnd(40)} → could not resolve uploads playlist`);
        errorsTotal++; continue;
      }

      const plData = await ytGet('playlistItems', { part: 'snippet', playlistId: uploadsId, maxResults: '50' });
      const items = plData.items ?? [];
      if (!items.length) {
        console.log(`  ~ ${ch.name.padEnd(40)} → 0 videos`);
        continue;
      }

      const videoIds = items.map((i: any) => i.snippet.resourceId.videoId).join(',');
      const vData    = await ytGet('videos', { part: 'contentDetails,statistics', id: videoIds });
      const meta: Record<string, any> = {};
      for (const v of vData.items ?? []) {
        meta[v.id] = { seconds: parseDuration(v.contentDetails?.duration ?? ''), views: parseInt(v.statistics?.viewCount ?? '0') };
      }

      // Fetch hidden videos for this channel to avoid re-promoting them
      const { data: hiddenVids } = await supabase
        .from('channel_videos')
        .select('video_id')
        .eq('channel_id', ch.id)
        .eq('is_hidden', true);
      
      const hiddenSet = new Set(hiddenVids?.map((v: any) => v.video_id) || []);

      const videoRows = items.map((item: any) => {
        const vid = item.snippet.resourceId.videoId;
        return {
          channel_id: ch.id,
          video_id:   vid,
          title:      item.snippet.title,
          thumbnail_url: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? null,
          published_at:  item.snippet.publishedAt,
          duration_seconds: meta[vid]?.seconds ?? null,
        };
      }).filter((row: any) => !hiddenSet.has(row.video_id));

      const { error: upsertErr } = await supabase
        .from('channel_videos')
        .upsert(videoRows, { onConflict: 'channel_id,video_id' });

      if (upsertErr) { console.log(`  ✗ ${ch.name} upsert: ${upsertErr.message}`); errorsTotal++; continue; }
      videosTotal += videoRows.length;

      // Auto-create films for 30+ min videos from channels with an owner
      let newFilms = 0;
      if (ch.owner_person_id) {
        const longVideos = videoRows.filter((v: any) => (v.duration_seconds ?? 0) >= FILM_MIN_SEC);
        for (const v of longVideos) {
          const { data: existing } = await supabase.from('channel_videos').select('film_id').eq('channel_id', ch.id).eq('video_id', v.video_id).maybeSingle();
          if (existing?.film_id) continue;

          const { data: existingFilm } = await supabase.from('films').select('id').eq('source_video_id', v.video_id).maybeSingle();
          let filmId = existingFilm?.id;

          if (!filmId) {
            const { data: newFilm } = await supabase.from('films').insert({
              title: cleanTitle(v.title), 
              year: v.published_at ? new Date(v.published_at).getFullYear() : null,
              release_type: 'youtube', 
              source: 'youtube', 
              source_video_id: v.video_id,
              youtube_watch_url: `https://www.youtube.com/watch?v=${v.video_id}`,
              trailer_youtube_id: v.video_id, 
              poster_url: v.thumbnail_url,
              needs_review: true, 
              status: 'released',
              runtime_minutes: Math.round((v.duration_seconds || 0) / 60),
              language: ch.primary_language || 'English'
            }).select('id').single();
            filmId = newFilm?.id;
            if (filmId) newFilms++;
          }

          if (filmId) {
            const { data: ec } = await supabase.from('credits').select('id').eq('film_id', filmId).eq('person_id', ch.owner_person_id).eq('role', 'producer').maybeSingle();
            if (!ec) await supabase.from('credits').insert({ film_id: filmId, person_id: ch.owner_person_id, role: 'producer', billing_order: 1 });
            await supabase.from('channel_videos').update({ film_id: filmId, match_status: 'auto' }).eq('channel_id', ch.id).eq('video_id', v.video_id);
          }
        }
      }
      filmsTotal += newFilms;

      await supabase.from('channels').update({ videos_last_fetched_at: new Date().toISOString() }).eq('id', ch.id);
      const owner = ch.owner_person_id ? '👤' : '  ';
      console.log(`  ✓ ${owner} ${ch.name.padEnd(38)} → ${videoRows.length} videos · ${newFilms} films  (${Date.now()-t0}ms)`);
    } catch (err: any) {
      console.log(`  ✗ ${ch.name.padEnd(40)} → ${err.message}`);
      errorsTotal++;
    }
  }

  console.log(`\n✅ Done. ${videosTotal} videos upserted · ${filmsTotal} films created · ${errorsTotal} errors.`);
}

run();
