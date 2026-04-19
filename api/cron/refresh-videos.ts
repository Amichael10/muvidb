/**
 * POST /api/cron/refresh-videos
 *
 * Called by Supabase pg_cron 3× per day (6am / 12pm / 4pm UTC = 7am / 1pm / 5pm WAT).
 * Also callable manually from AdminChannels → "↻ Sync" button.
 *
 * What it does per channel:
 *   1. Resolve the YouTube uploads playlist ID from channel handle / URL
 *   2. Fetch the 50 most recent uploads
 *   3. Fetch duration + view-count for every video
 *   4. Upsert rows into channel_videos
 *   5. For videos ≥ 30 min with a known channel owner:
 *      - Create a film record (needs_review = true, source = 'youtube')
 *      - Create a producer credit for the channel owner
 *      - Link channel_video.film_id back to the new film
 *   6. Stamp videos_last_fetched_at on the channel
 *
 * Auth: x-cron-secret header must equal CRON_SECRET env var.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';

// Allow up to 60 s on Vercel Pro; Hobby silently caps at 10 s but we batch small
export const config = { maxDuration: 60 };

const CRON_SECRET  = process.env.CRON_SECRET;
const YT_KEY       = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY;
const YT_BASE      = 'https://www.googleapis.com/youtube/v3';
const FILM_MIN_SEC = 1800; // 30 minutes
const CHANNELS_PER_RUN = 20; // stay well within Vercel timeout

// ── YouTube helper ────────────────────────────────────────────────────────────

async function ytGet(endpoint: string, params: Record<string, string>) {
  const url = new URL(`${YT_BASE}/${endpoint}`);
  Object.entries({ ...params, key: YT_KEY! }).forEach(([k, v]) =>
    url.searchParams.set(k, v),
  );
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YouTube /${endpoint} ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<any>;
}

// Parse ISO 8601 duration → seconds  (e.g. PT1H30M5S → 5405)
function parseDuration(iso: string): number {
  const h = parseInt(iso.match(/(\d+)H/)?.[1] ?? '0');
  const m = parseInt(iso.match(/(\d+)M/)?.[1] ?? '0');
  const s = parseInt(iso.match(/(\d+)S/)?.[1] ?? '0');
  return h * 3600 + m * 60 + s;
}

// Naive title cleaner — strips common YouTube Nollywood junk without AI
function cleanTitle(raw: string): string {
  let t = raw
    // Remove "|| Actor Actor ||" segments
    .replace(/\|\|[^|]+\|\|/g, '')
    // Remove all-caps actor list in parens like "(JOHN EKANEM UCHE MONTANA)"
    .replace(/\([A-Z][A-Z\s,]{6,}\)/g, '')
    // Remove trailing platform/date suffixes
    .replace(/[-–|]+\s*(latest\s+)?(nigerian|nollywood|yoruba|african|ghana(ian)?)\s+movies?\s*\d{0,4}\s*$/gi, '')
    .replace(/\s*\d{4}\s+(latest\s+)?(nigerian|nollywood|yoruba|african)\s+movies?\s*$/gi, '')
    .replace(/[-–|]+\s*$/, '')
    .trim();

  // Title-case (keep all-caps words that are ≤ 3 chars as-is)
  return t
    .split(/\s+/)
    .map(w =>
      w.length <= 3 && w === w.toUpperCase()
        ? w
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join(' ');
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // Auth — skip check when called without a secret (dev / manual sync)
  if (CRON_SECRET && req.headers['x-cron-secret'] !== CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!YT_KEY) return res.status(500).json({ error: 'YOUTUBE_API_KEY not configured' });

  const results = {
    channels_processed: 0,
    videos_upserted: 0,
    films_created: 0,
    credits_created: 0,
    errors: [] as string[],
  };

  // Channels that haven't been refreshed in the last 3.5 h (handles 3×/day schedule)
  const cutoff = new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString();
  const { data: channels, error: chErr } = await supabase
    .from('channels')
    .select('id, name, channel_url, channel_handle, owner_person_id')
    .or(`videos_last_fetched_at.is.null,videos_last_fetched_at.lt.${cutoff}`)
    .limit(CHANNELS_PER_RUN);

  if (chErr) return res.status(500).json({ error: chErr.message });
  if (!channels?.length) {
    return res.status(200).json({ message: 'All channels up to date', ...results });
  }

  for (const ch of channels) {
    try {
      // ── Resolve uploads playlist ID ────────────────────────────────────────
      const handle    = ch.channel_handle?.replace(/^@/, '');
      const idMatch   = ch.channel_url?.match(/\/channel\/(UC[\w-]+)/);
      const ytChannel = idMatch?.[1];

      let uploadsId: string | null = null;

      if (ytChannel) {
        const d = await ytGet('channels', { part: 'contentDetails', id: ytChannel });
        uploadsId = d.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
      } else if (handle) {
        const d = await ytGet('channels', { part: 'contentDetails', forHandle: handle });
        uploadsId = d.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
      }

      if (!uploadsId) {
        results.errors.push(`${ch.name}: could not resolve uploads playlist`);
        continue;
      }

      // ── Fetch 50 most recent uploads ───────────────────────────────────────
      const plData = await ytGet('playlistItems', {
        part: 'snippet',
        playlistId: uploadsId,
        maxResults: '50',
      });
      const items: any[] = plData.items ?? [];
      if (!items.length) continue;

      // ── Fetch durations + stats ────────────────────────────────────────────
      const videoIds = items.map(i => i.snippet.resourceId.videoId).join(',');
      const vData    = await ytGet('videos', {
        part: 'contentDetails,statistics',
        id: videoIds,
      });

      const meta: Record<string, { seconds: number; views: number }> = {};
      for (const v of vData.items ?? []) {
        meta[v.id] = {
          seconds: parseDuration(v.contentDetails?.duration ?? ''),
          views:   parseInt(v.statistics?.viewCount ?? '0', 10),
        };
      }

      // ── Build upsert rows ──────────────────────────────────────────────────
      const videoRows = items.map((item: any) => {
        const vid = item.snippet.resourceId.videoId;
        return {
          channel_id:       ch.id,
          video_id:         vid,
          title:            item.snippet.title,
          thumbnail_url:    item.snippet.thumbnails?.medium?.url
                         ?? item.snippet.thumbnails?.default?.url
                         ?? null,
          published_at:     item.snippet.publishedAt,
          duration_seconds: meta[vid]?.seconds ?? null,
          match_status:     'unmatched',
        };
      });

      const { error: upsertErr } = await supabase
        .from('channel_videos')
        .upsert(videoRows, { onConflict: 'channel_id,video_id' });

      if (upsertErr) {
        results.errors.push(`${ch.name} video upsert: ${upsertErr.message}`);
      } else {
        results.videos_upserted += videoRows.length;
      }

      // ── Auto-create films for 30+ min videos (if channel has owner) ────────
      if (ch.owner_person_id) {
        const longVideos = videoRows.filter(v => (v.duration_seconds ?? 0) >= FILM_MIN_SEC);

        for (const v of longVideos) {
          try {
            // Already processed?
            const { data: cvRow } = await supabase
              .from('channel_videos')
              .select('film_id')
              .eq('channel_id', ch.id)
              .eq('video_id', v.video_id)
              .maybeSingle();
            if (cvRow?.film_id) continue;

            // Film already exists for this video?
            const { data: existingFilm } = await supabase
              .from('films')
              .select('id')
              .eq('source_video_id', v.video_id)
              .maybeSingle();

            let filmId: string;

            if (existingFilm) {
              filmId = existingFilm.id;
            } else {
              const cleanedTitle = cleanTitle(v.title);
              const year = v.published_at
                ? new Date(v.published_at).getFullYear()
                : null;

              const { data: newFilm, error: fErr } = await supabase
                .from('films')
                .insert({
                  title:             cleanedTitle,
                  year,
                  release_type:      'youtube',
                  source:            'youtube',
                  source_video_id:   v.video_id,
                  youtube_watch_url: `https://www.youtube.com/watch?v=${v.video_id}`,
                  trailer_youtube_id: v.video_id,
                  poster_url:        v.thumbnail_url,
                  needs_review:      true,
                  status:            'released',
                })
                .select('id')
                .single();

              if (fErr || !newFilm) {
                results.errors.push(`Film create (${v.video_id}): ${fErr?.message}`);
                continue;
              }
              filmId = newFilm.id;
              results.films_created++;
            }

            // Producer credit (skip if already exists)
            const { data: existingCredit } = await supabase
              .from('credits')
              .select('id')
              .eq('film_id', filmId)
              .eq('person_id', ch.owner_person_id)
              .eq('role', 'producer')
              .maybeSingle();

            if (!existingCredit) {
              const { error: cErr } = await supabase.from('credits').insert({
                film_id:       filmId,
                person_id:     ch.owner_person_id,
                role:          'producer',
                billing_order: 1,
              });
              if (!cErr) results.credits_created++;
            }

            // Link channel_video → film
            await supabase
              .from('channel_videos')
              .update({ film_id: filmId, match_status: 'auto' })
              .eq('channel_id', ch.id)
              .eq('video_id', v.video_id);
          } catch (e: any) {
            results.errors.push(`${ch.name}/${v.video_id}: ${e.message}`);
          }
        }
      }

      // ── Stamp last-fetched ─────────────────────────────────────────────────
      await supabase
        .from('channels')
        .update({ videos_last_fetched_at: new Date().toISOString() })
        .eq('id', ch.id);

      results.channels_processed++;
    } catch (e: any) {
      results.errors.push(`${ch.name}: ${e.message}`);
    }
  }

  return res.status(200).json(results);
}
