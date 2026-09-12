import 'dotenv/config';
import dns from 'node:dns';
import { Agent, fetch as undiciFetch } from 'undici';
import { supabase } from './lib/db';

dns.setDefaultResultOrder('ipv4first');
const dispatcher = new Agent({ connect: { timeout: 15000, lookup: (h, o, cb) => dns.lookup(h, { ...o, family: 4 }, cb) } });

function extractYoutubeId(val: any): string | null {
  if (!val || typeof val !== 'string') return null;
  const str = val.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
  const match = str.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})/i);
  return match?.[1] || null;
}

async function getBestYoutubeThumbnail(videoId: string): Promise<string> {
  const maxResUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  try {
    const res = await undiciFetch(maxResUrl, { method: 'HEAD', dispatcher });
    if (res.ok && res.status === 200) {
      return maxResUrl;
    }
  } catch (e) {}
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
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
  console.log('🚀 Starting YouTube Film Poster Restoration Process...\n');

  console.log('Fetching all films in DB...');
  const allFilms = await fetchAllFilms();
  console.log(`Loaded ${allFilms.length} total films.`);

  const toRestore: Array<{ id: string; title: string; year: number; videoId: string; oldPoster: string; newPoster: string }> = [];

  for (const f of allFilms) {
    // Determine if this is a YouTube film
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

    // Check if the poster is currently an overwritten TMDB or IMDb poster
    const isTmdb = f.poster_url?.includes('image.tmdb.org');
    const isImdb = f.poster_url?.includes('media-amazon.com') || f.poster_url?.includes('imdb.com');

    if (isTmdb || isImdb) {
      const bestThumbnail = await getBestYoutubeThumbnail(ytId);
      toRestore.push({
        id: f.id,
        title: f.title,
        year: f.year,
        videoId: ytId,
        oldPoster: f.poster_url,
        newPoster: bestThumbnail
      });
    }
  }

  console.log(`\nFound ${toRestore.length} YouTube films with overwritten posters.`);

  if (toRestore.length === 0) {
    console.log('✅ No overwritten YouTube posters found. Everything is in order!');
    return;
  }

  console.log('\nSample films to restore:');
  for (const item of toRestore.slice(0, 15)) {
    console.log(`- "${item.title}" (${item.year}) [Video ID: ${item.videoId}]`);
    console.log(`    Replaced: ${item.oldPoster}`);
    console.log(`    Restored: ${item.newPoster}`);
  }

  console.log(`\nRestoring ${toRestore.length} posters in database...`);
  let updatedCount = 0;
  for (const item of toRestore) {
    const { error } = await supabase
      .from('films')
      .update({
        poster_url: item.newPoster,
        backdrop_url: item.newPoster, // Ensure backdrop also matches high-res video thumbnail
        source: 'youtube'
      })
      .eq('id', item.id);

    if (!error) {
      updatedCount++;
    } else {
      console.error(`Error restoring ${item.title}:`, error.message);
    }
  }

  console.log(`\n🎉 Successfully restored ${updatedCount}/${toRestore.length} YouTube movie posters to their original video thumbnails!`);
}

main().catch(console.error);
