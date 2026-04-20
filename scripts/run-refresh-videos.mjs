/**
 * Local runner for the YouTube video refresh pipeline.
 * Equivalent to POST /api/cron/refresh-videos — fetches latest uploads for
 * every channel that hasn't been synced in the last 3.5 hours.
 *
 * Usage: npx tsx scripts/run-refresh-videos.mjs
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const YT_KEY = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY;
const YT_BASE = 'https://www.googleapis.com/youtube/v3';
const FILM_MIN_SEC = 1800;

if (!YT_KEY) { console.error('YOUTUBE_API_KEY not set'); process.exit(1); }

async function ytGet(endpoint, params) {
  const url = new URL(`${YT_BASE}/${endpoint}`);
  Object.entries({ ...params, key: YT_KEY }).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) { const t = await res.text(); throw new Error(`YT /${endpoint} ${res.status}: ${t.slice(0,200)}`); }
  return res.json();
}

function parseDuration(iso) {
  const h = parseInt(iso.match(/(\d+)H/)?.[1] ?? '0');
  const m = parseInt(iso.match(/(\d+)M/)?.[1] ?? '0');
  const s = parseInt(iso.match(/(\d+)S/)?.[1] ?? '0');
  return h * 3600 + m * 60 + s;
}

function cleanTitle(raw) {
  let t = raw
    .replace(/\|\|[^|]+\|\|/g, '')
    .replace(/\([A-Z][A-Z\s,]{6,}\)/g, '')
    .replace(/[-–|]+\s*(latest\s+)?(nigerian|nollywood|yoruba|african|ghanaian?)\s+movies?\s*\d{0,4}\s*$/gi, '')
    .replace(/\s*\d{4}\s+(latest\s+)?(nigerian|nollywood|yoruba|african)\s+movies?\s*$/gi, '')
    .replace(/[-–|]+\s*$/, '')
    .trim();
  return t.split(/\s+/).map(w =>
    w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join(' ');
}

// Fetch all channels that need refresh (no cutoff limit — run all stale ones)
const { data: channels } = await supabase
  .from('channels')
  .select('id, name, channel_url, channel_handle, owner_person_id, videos_last_fetched_at')
  .or('videos_last_fetched_at.is.null,videos_last_fetched_at.lt.' + new Date(Date.now() - 3.5*3600*1000).toISOString())
  .order('videos_last_fetched_at', { ascending: true, nullsFirst: true });

console.log(`Refreshing ${channels?.length ?? 0} channels…\n`);

let videosTotal = 0, filmsTotal = 0, errorsTotal = 0;

for (const ch of channels ?? []) {
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

    const videoIds = items.map(i => i.snippet.resourceId.videoId).join(',');
    const vData    = await ytGet('videos', { part: 'contentDetails,statistics', id: videoIds });
    const meta = {};
    for (const v of vData.items ?? []) {
      meta[v.id] = { seconds: parseDuration(v.contentDetails?.duration ?? ''), views: parseInt(v.statistics?.viewCount ?? '0') };
    }

    const videoRows = items.map(item => {
      const vid = item.snippet.resourceId.videoId;
      return {
        channel_id: ch.id,
        video_id:   vid,
        title:      item.snippet.title,
        thumbnail_url: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? null,
        published_at:  item.snippet.publishedAt,
        duration_seconds: meta[vid]?.seconds ?? null,
        match_status: 'unmatched',
      };
    });

    const { error: upsertErr } = await supabase
      .from('channel_videos')
      .upsert(videoRows, { onConflict: 'channel_id,video_id', ignoreDuplicates: false });

    if (upsertErr) { console.log(`  ✗ ${ch.name} upsert: ${upsertErr.message}`); errorsTotal++; continue; }
    videosTotal += videoRows.length;

    // Auto-create films for 30+ min videos from channels with an owner
    let newFilms = 0;
    if (ch.owner_person_id) {
      const longVideos = videoRows.filter(v => (v.duration_seconds ?? 0) >= FILM_MIN_SEC);
      for (const v of longVideos) {
        const { data: existing } = await supabase.from('channel_videos').select('film_id').eq('channel_id', ch.id).eq('video_id', v.video_id).maybeSingle();
        if (existing?.film_id) continue;

        const { data: existingFilm } = await supabase.from('films').select('id').eq('source_video_id', v.video_id).maybeSingle();
        let filmId = existingFilm?.id;

        if (!filmId) {
          const { data: newFilm } = await supabase.from('films').insert({
            title: cleanTitle(v.title), year: v.published_at ? new Date(v.published_at).getFullYear() : null,
            release_type: 'youtube', source: 'youtube', source_video_id: v.video_id,
            youtube_watch_url: `https://www.youtube.com/watch?v=${v.video_id}`,
            trailer_youtube_id: v.video_id, poster_url: v.thumbnail_url,
            needs_review: true, status: 'released',
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
  } catch (err) {
    console.log(`  ✗ ${ch.name.padEnd(40)} → ${err.message}`);
    errorsTotal++;
  }
}

console.log(`\n✅ Done. ${videosTotal} videos upserted · ${filmsTotal} films created · ${errorsTotal} errors.`);
