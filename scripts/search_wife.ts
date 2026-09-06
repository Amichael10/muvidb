import { supabase } from '../api/_lib/supabase.js';

async function searchWife() {
  const { data: films, error: fErr } = await supabase
    .from('films')
    .select('id, title, release_date, youtube_watch_url, trailer_youtube_id')
    .ilike('title', '%wife%');
  
  console.log('Search "wife" in films:', films);

  const { data: cvs, error: cvErr } = await supabase
    .from('channel_videos')
    .select('id, title, video_id, channel_id, film_id')
    .ilike('title', '%wife%');

  console.log('\nSearch "wife" in channel_videos:', cvs);

  // Let's also search for "Elonel" in channel_videos
  const { data: elonelCV } = await supabase
    .from('channel_videos')
    .select('id, title, video_id, channel_id, film_id')
    .ilike('title', '%Elonel%');

  console.log('\nSearch "Elonel" in channel_videos:', elonelCV);
}

searchWife();
