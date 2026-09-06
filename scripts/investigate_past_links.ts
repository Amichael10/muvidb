import { supabase } from '../api/_lib/supabase.js';

async function investigatePastChannelLinks() {
  console.log('Investigating historical channel links for the 6,314 unattached films...');

  // 1. Fetch all channel_videos records
  let allCVs = [];
  let page = 0;
  while (true) {
    const { data: chunk } = await supabase
      .from('channel_videos')
      .select('id, channel_id, video_id, film_id, title')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!chunk || chunk.length === 0) break;
    allCVs = allCVs.concat(chunk);
    page++;
  }
  console.log(`Total channel_videos in DB: ${allCVs.length}`);

  // Build maps by film_id and video_id
  const cvByFilmId = new Map();
  const cvByVideoId = new Map();
  allCVs.forEach(cv => {
    if (cv.film_id) cvByFilmId.set(cv.film_id, cv);
    if (cv.video_id) cvByVideoId.set(cv.video_id, cv);
  });

  // 2. Load the orphaned report
  const fs = await import('fs');
  let orphaned = [];
  if (fs.existsSync('orphaned_films_report.json')) {
    orphaned = JSON.parse(fs.readFileSync('orphaned_films_report.json', 'utf8'));
  }
  console.log(`Analyzing ${orphaned.length} unattached films...`);

  // 3. Inspect film columns
  const { data: sampleFilm } = await supabase.from('films').select('*').limit(1);
  console.log('Available columns in films table:', Object.keys(sampleFilm?.[0] || {}));

  // 4. Check how many of the 6,314 have a match in channel_videos (by film_id or video_id)
  let matchedByFilmId = 0;
  let matchedByVideoId = 0;
  let noHistoryInCV = 0;

  const sampleMatched = [];

  for (const item of orphaned) {
    let vidMatch = null;
    const match = item.youtube_url?.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
    const videoId = match ? match[1] : null;

    if (cvByFilmId.has(item.id)) {
      matchedByFilmId++;
      if (sampleMatched.length < 5) sampleMatched.push({ ...item, matched_by: 'film_id', cv: cvByFilmId.get(item.id) });
    } else if (videoId && cvByVideoId.has(videoId)) {
      matchedByVideoId++;
      if (sampleMatched.length < 5) sampleMatched.push({ ...item, matched_by: 'video_id', cv: cvByVideoId.get(videoId) });
    } else {
      noHistoryInCV++;
    }
  }

  console.log('\n--- FINDINGS ---');
  console.log(`1. Films directly recorded in channel_videos by film_id: ${matchedByFilmId}`);
  console.log(`2. Films whose YouTube video_id exists in channel_videos: ${matchedByVideoId}`);
  console.log(`3. Films with NO trace in channel_videos: ${noHistoryInCV}`);

  console.log('\nSample Matched items:', JSON.stringify(sampleMatched, null, 2));

  // 5. Check YouTube oEmbed capability for finding channel from YouTube URL
  if (orphaned.length > 0) {
    const testUrl = orphaned[0].youtube_url;
    console.log(`\nTesting YouTube oEmbed resolution on: ${testUrl}`);
    try {
      const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(testUrl)}&format=json`);
      if (oembedRes.ok) {
        const oembedData = await oembedRes.json();
        console.log('oEmbed Author/Channel Info:', {
          title: oembedData.title,
          author_name: oembedData.author_name,
          author_url: oembedData.author_url,
        });
      } else {
        console.log('oEmbed status:', oembedRes.status);
      }
    } catch (e) {
      console.log('oEmbed error:', e.message);
    }
  }
}

investigatePastChannelLinks();
