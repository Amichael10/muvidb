import { supabase } from '../api/_lib/supabase.js';

async function findOrphanedFilms() {
  console.log('Fetching all channels and films...');

  // 1. Fetch all existing channels
  const { data: channels, error: chErr } = await supabase
    .from('channels')
    .select('id, name');

  if (chErr) {
    console.error('Error fetching channels:', chErr);
    return;
  }
  const existingChannelIds = new Set((channels || []).map(c => c.id));
  console.log(`Found ${existingChannelIds.size} active channels in DB.`);

  // 2. Fetch all channel_videos to see which film_ids are mapped to existing channels
  const { data: cvs, error: cvErr } = await supabase
    .from('channel_videos')
    .select('film_id, channel_id')
    .not('film_id', 'is', null);

  if (cvErr) {
    console.error('Error fetching channel_videos:', cvErr);
  }

  const filmsLinkedViaCV = new Set();
  (cvs || []).forEach(cv => {
    if (cv.film_id && existingChannelIds.has(cv.channel_id)) {
      filmsLinkedViaCV.add(cv.film_id);
    }
  });

  // 3. Fetch all films with a YouTube play / trailer link
  const { data: films, error: fErr } = await supabase
    .from('films')
    .select('id, title, year, release_date, youtube_watch_url, trailer_youtube_id, trailer_external_url, created_at')
    .or('youtube_watch_url.not.is.null,trailer_youtube_id.not.is.null')
    .order('created_at', { ascending: false });

  if (fErr) {
    console.error('Error fetching films:', fErr);
    return;
  }

  console.log(`Scanned ${films?.length || 0} films with YouTube links.`);

  const orphaned = [];

  for (const film of (films || [])) {
    const ytUrl = film.youtube_watch_url || (film.trailer_youtube_id ? `https://www.youtube.com/watch?v=${film.trailer_youtube_id}` : film.trailer_external_url);
    const isLinkedToExistingChannel = filmsLinkedViaCV.has(film.id);

    if (!isLinkedToExistingChannel && ytUrl) {
      orphaned.push({
        id: film.id,
        title: film.title,
        year: film.year || (film.release_date ? film.release_date.slice(0, 4) : 'N/A'),
        youtube_url: ytUrl,
        created_at: film.created_at ? film.created_at.slice(0, 10) : 'N/A'
      });
    }
  }

  console.log(`\n================ ORPHANED FILMS FOUND (${orphaned.length}) ================`);
  console.log(JSON.stringify(orphaned, null, 2));
}

findOrphanedFilms();
