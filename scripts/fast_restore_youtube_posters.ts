import 'dotenv/config';
import { supabase } from './lib/db';

function extractYoutubeId(val: any): string | null {
  if (!val || typeof val !== 'string') return null;
  const str = val.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
  const match = str.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})/i);
  return match?.[1] || null;
}

async function fetchAllFilms() {
  const pageSize = 1000;
  const batches = [];
  for (let i = 0; i < 25; i++) {
    batches.push(
      supabase
        .from('films')
        .select('id, title, year, poster_url, backdrop_url, youtube_watch_url, source_video_id, trailer_youtube_id, source, streaming_links')
        .range(i * pageSize, (i + 1) * pageSize - 1)
    );
  }
  const results = await Promise.all(batches);
  const allFilms: any[] = [];
  for (const r of results) {
    if (r.data) allFilms.push(...r.data);
  }
  return allFilms;
}

async function main() {
  console.log('🚀 Starting Fast YouTube Poster Restoration...');

  const allFilms = await fetchAllFilms();
  console.log(`Loaded ${allFilms.length} films from database.`);

  const toRestore: Array<{ id: string; title: string; year: number; videoId: string; oldPoster: string; newPoster: string }> = [];

  for (const f of allFilms) {
    let ytId = extractYoutubeId(f.source_video_id) || extractYoutubeId(f.youtube_watch_url);

    if (!ytId && Array.isArray(f.streaming_links)) {
      for (const link of f.streaming_links) {
        const idFromLink = extractYoutubeId(link?.url) || extractYoutubeId(link?.source_video_id);
        if (idFromLink) {
          ytId = idFromLink;
          break;
        }
      }
    }

    if (!ytId && f.source === 'youtube') {
      ytId = extractYoutubeId(f.trailer_youtube_id);
    }

    if (!ytId) continue;

    const isTmdb = f.poster_url?.includes('image.tmdb.org');
    const isImdb = f.poster_url?.includes('media-amazon.com') || f.poster_url?.includes('imdb.com');

    if (isTmdb || isImdb) {
      const newThumbnail = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
      toRestore.push({
        id: f.id,
        title: f.title,
        year: f.year,
        videoId: ytId,
        oldPoster: f.poster_url,
        newPoster: newThumbnail
      });
    }
  }

  console.log(`\nIdentified ${toRestore.length} YouTube films with overwritten external posters.`);

  if (toRestore.length === 0) {
    console.log('✅ No overwritten YouTube posters found!');
    return;
  }

  console.log('\nRestoring YouTube movie posters in parallel batches...');
  let successCount = 0;

  // Process in batches of 20 concurrent updates
  for (let i = 0; i < toRestore.length; i += 20) {
    const batch = toRestore.slice(i, i + 20);
    const updatePromises = batch.map(item =>
      supabase
        .from('films')
        .update({
          poster_url: item.newPoster,
          backdrop_url: item.newPoster,
          source: 'youtube'
        })
        .eq('id', item.id)
    );

    const updateResults = await Promise.all(updatePromises);
    for (const res of updateResults) {
      if (!res.error) successCount++;
    }

    console.log(`  -> Restored batch ${Math.floor(i / 20) + 1}/${Math.ceil(toRestore.length / 20)} (Total: ${successCount}/${toRestore.length})`);
  }

  console.log(`\n🎉 Successfully restored all ${successCount} YouTube film posters to their original video thumbnails!`);
}

main().catch(console.error);
