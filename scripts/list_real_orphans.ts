import { supabase } from '../api/_lib/supabase.js';

async function listRealOrphans() {
  // 1. Get all active channels
  const { data: channels } = await supabase.from('channels').select('id, name');
  const activeChannelIds = new Set((channels || []).map(c => c.id));
  console.log(`Active channels count: ${activeChannelIds.size}`);

  // 2. Fetch all channel_videos
  let allCVs = [];
  let page = 0;
  while (true) {
    const { data: chunk, error } = await supabase
      .from('channel_videos')
      .select('id, channel_id, video_id, film_id, title')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!chunk || chunk.length === 0) break;
    allCVs = allCVs.concat(chunk);
    page++;
  }
  console.log(`Loaded ${allCVs.length} channel_videos.`);

  // Set of film IDs mapped to active channels
  const linkedFilmIds = new Set();
  const cvByFilmId = new Map();

  allCVs.forEach(cv => {
    if (cv.film_id) {
      cvByFilmId.set(cv.film_id, cv);
      if (activeChannelIds.has(cv.channel_id)) {
        linkedFilmIds.add(cv.film_id);
      }
    }
  });

  // 3. Fetch all films with youtube_watch_url or trailer_youtube_id
  let allFilms = [];
  page = 0;
  while (true) {
    const { data: chunk, error } = await supabase
      .from('films')
      .select('id, title, year, release_date, youtube_watch_url, trailer_youtube_id, trailer_external_url, created_at')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!chunk || chunk.length === 0) break;
    allFilms = allFilms.concat(chunk);
    page++;
  }
  console.log(`Loaded ${allFilms.length} total films from DB.`);

  const filmsWithYouTube = allFilms.filter(f => {
    return Boolean(f.youtube_watch_url || f.trailer_youtube_id || (f.trailer_external_url && /youtube\.com|youtu\.be/i.test(f.trailer_external_url)));
  });
  console.log(`Films with YouTube link: ${filmsWithYouTube.length}`);

  // Orphaned = has YouTube link, but film.id is NOT in linkedFilmIds
  const orphanedList = filmsWithYouTube.filter(f => !linkedFilmIds.has(f.id)).map(f => {
    const ytLink = f.youtube_watch_url || (f.trailer_youtube_id ? `https://www.youtube.com/watch?v=${f.trailer_youtube_id}` : f.trailer_external_url);
    const cv = cvByFilmId.get(f.id);
    return {
      id: f.id,
      title: f.title,
      year: f.year || (f.release_date ? f.release_date.slice(0, 4) : 'N/A'),
      youtube_url: ytLink,
      reason: cv ? 'Linked to deleted channel in channel_videos' : 'YouTube video unattached to any channel',
      created_at: f.created_at ? f.created_at.slice(0, 10) : 'N/A'
    };
  });

  console.log(`\n>>> TOTAL ORPHANED FILMS WITH YOUTUBE LINKS: ${orphanedList.length} <<<`);

  // Write full list to a JSON file so we can read and format into markdown table
  import('fs').then(fs => {
    fs.writeFileSync('orphaned_films_report.json', JSON.stringify(orphanedList, null, 2));
    console.log('Saved orphaned_films_report.json');
  });

  console.log('Sample 20:');
  console.log(JSON.stringify(orphanedList.slice(0, 20), null, 2));
}

listRealOrphans();
