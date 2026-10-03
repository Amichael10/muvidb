import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

function extractYoutubeId(url: string | null): string | null {
  if (!url) return null;
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

async function run() {
  const companyId = '2023564b-9d17-4aa9-a0f1-88e70bc16a8c';
  const channelId = '238be1a9-dace-496c-8143-33db6a3ac827'; // Baggyland channel

  // 1. Get all film_companies for Baggyland
  const { data: fcLinks } = await supabase
    .from('film_companies')
    .select('film_id, films(*)')
    .eq('company_id', companyId);

  console.log(`Found ${fcLinks?.length} films in film_companies for Baggyland`);

  // Collect all unique film IDs
  const filmIds = new Set<string>();
  fcLinks?.forEach(link => {
    if (link.film_id) filmIds.add(link.film_id);
  });

  // Also check if any films have Baggyland in title, synopsis, or distributor
  const { data: textFilms } = await supabase
    .from('films')
    .select('*')
    .or('title.ilike.%baggyland%,synopsis.ilike.%baggyland%');
  textFilms?.forEach(f => filmIds.add(f.id));

  console.log(`Total unique films for Baggyland: ${filmIds.size}`);

  const filmList: any[] = [];
  for (const id of filmIds) {
    const { data: f } = await supabase.from('films').select('*').eq('id', id).single();
    if (f) filmList.push(f);
  }

  let lockedCount = 0;
  let linkedToChannelCount = 0;

  for (const film of filmList) {
    const videoId = film.source_video_id || extractYoutubeId(film.youtube_watch_url);

    console.log(`Processing: "${film.title}" (ID: ${film.id}) | Current title_locked: ${film.title_locked} | videoId: ${videoId}`);

    // Update film: lock title, and set source_video_id if missing
    const filmUpdatePayload: any = {
      title_locked: true,
    };
    if (videoId && !film.source_video_id) {
      filmUpdatePayload.source_video_id = videoId;
    }

    const { error: filmUpdateErr } = await supabase
      .from('films')
      .update(filmUpdatePayload)
      .eq('id', film.id);

    if (filmUpdateErr) {
      console.error(`Error locking title for ${film.title}:`, filmUpdateErr);
    } else {
      lockedCount++;
    }

    // Now link to channel_videos for Baggyland channel
    if (videoId) {
      // Check if this video_id is already in channel_videos
      const { data: existingCV } = await supabase
        .from('channel_videos')
        .select('*')
        .eq('video_id', videoId);

      if (existingCV && existingCV.length > 0) {
        // Update all matching rows to ensure film_id and channel_id are correct
        for (const row of existingCV) {
          const { error: updateErr } = await supabase
            .from('channel_videos')
            .update({
              film_id: film.id,
              channel_id: channelId,
            })
            .eq('id', row.id);
          if (updateErr) console.error(`Error updating CV ${row.id}:`, updateErr);
          else linkedToChannelCount++;
        }
      } else {
        // Insert new record into channel_videos
        const { error: insertErr } = await supabase
          .from('channel_videos')
          .insert({
            channel_id: channelId,
            video_id: videoId,
            film_id: film.id,
            title: film.title,
            thumbnail_url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            duration_seconds: film.runtime_minutes ? film.runtime_minutes * 60 : 3600,
            match_status: 'manual',
            published_at: film.release_date ? new Date(film.release_date).toISOString() : new Date(film.created_at).toISOString(),
            is_hidden: false,
          });

        if (insertErr) {
          console.error(`Error inserting CV for ${film.title} (${videoId}):`, insertErr);
        } else {
          linkedToChannelCount++;
          console.log(`  ✅ Inserted new channel_videos row for "${film.title}" -> Baggyland Channel`);
        }
      }
    } else {
      console.log(`  ⚠️ Film "${film.title}" has no youtube video ID.`);
    }
  }

  console.log(`\n🎉 Summary:`);
  console.log(`- Locked titles for ${lockedCount} films.`);
  console.log(`- Linked / synced ${linkedToChannelCount} videos to Baggyland's channel.`);
}

run().catch(console.error);
