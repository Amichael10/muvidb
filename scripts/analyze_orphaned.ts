import { supabase } from '../api/_lib/supabase.js';

async function analyzeOrphaned() {
  // 1. Get all active channel IDs
  const { data: channels } = await supabase.from('channels').select('id, name');
  const channelMap = new Map((channels || []).map(c => [c.id, c.name]));
  console.log(`Active channels in 'channels' table: ${channelMap.size}`);

  // 2. Get all channel_videos
  let allCVs = [];
  let page = 0;
  while (true) {
    const { data: cvChunk } = await supabase
      .from('channel_videos')
      .select('id, channel_id, video_id, film_id, title')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!cvChunk || cvChunk.length === 0) break;
    allCVs = allCVs.concat(cvChunk);
    page++;
  }
  console.log(`Total channel_videos records: ${allCVs.length}`);

  // Find channel_videos whose channel_id is NOT in channels table
  const orphanedCV = allCVs.filter(cv => !channelMap.has(cv.channel_id));
  console.log(`channel_videos with deleted/missing channel_id: ${orphanedCV.length}`);

  // Distinct missing channel IDs
  const missingChannelIds = [...new Set(orphanedCV.map(c => c.channel_id))];
  console.log(`Distinct missing channel IDs: ${missingChannelIds.length}`);

  // Film IDs linked to deleted channels
  const filmIdsFromDeletedChannels = [...new Set(orphanedCV.map(c => c.film_id).filter(Boolean))];
  console.log(`Films linked to deleted channels in channel_videos: ${filmIdsFromDeletedChannels.length}`);

  // Query details of these films
  let orphanedFilms = [];
  for (let i = 0; i < filmIdsFromDeletedChannels.length; i += 50) {
    const chunk = filmIdsFromDeletedChannels.slice(i, i + 50);
    const { data: fChunk } = await supabase
      .from('films')
      .select('id, title, year, release_date, youtube_watch_url, trailer_youtube_id, created_at')
      .in('id', chunk);
    if (fChunk) orphanedFilms = orphanedFilms.concat(fChunk);
  }

  // Also, find films with YouTube links that have NO record in channel_videos at all
  const cvFilmIdsSet = new Set(allCVs.map(c => c.film_id).filter(Boolean));
  
  let allFilmsWithYT = [];
  page = 0;
  while (true) {
    const { data: fChunk } = await supabase
      .from('films')
      .select('id, title, year, release_date, youtube_watch_url, trailer_youtube_id, created_at')
      .or('youtube_watch_url.not.is.null,trailer_youtube_id.not.is.null')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!fChunk || fChunk.length === 0) break;
    allFilmsWithYT = allFilmsWithYT.concat(fChunk);
    page++;
  }
  console.log(`Total films with YouTube links: ${allFilmsWithYT.length}`);

  const filmsWithNoCV = allFilmsWithYT.filter(f => !cvFilmIdsSet.has(f.id));
  console.log(`Films with YouTube links but NO channel_video record at all: ${filmsWithNoCV.length}`);

  // Combine and format list for user
  console.log('\n================ SAMPLE ORPHANED FILMS (From Deleted Channels) ================');
  console.log(`Total films belonging to deleted channels: ${orphanedFilms.length}`);
  console.log(JSON.stringify(orphanedFilms.slice(0, 15), null, 2));

  console.log('\n================ SAMPLE FILMS UNATTACHED TO ANY CHANNEL ================');
  console.log(JSON.stringify(filmsWithNoCV.slice(0, 15), null, 2));
}

analyzeOrphaned();
