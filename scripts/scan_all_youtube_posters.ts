import 'dotenv/config';
import { supabase } from './lib/db';

async function checkAllFilmsForOverwrittenPosters() {
  console.log('Scanning all films in DB for YouTube movies with TMDB posters...');

  let page = 0;
  const pageSize = 1000;
  const overwrittenFilms: any[] = [];
  let totalYoutubeFilms = 0;

  while (true) {
    const { data: batch, error } = await supabase
      .from('films')
      .select('id, title, year, poster_url, backdrop_url, youtube_watch_url, source_video_id, source, streaming_links')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error || !batch || batch.length === 0) break;

    for (const f of batch) {
      const isYoutube = !!(
        f.source_video_id ||
        f.youtube_watch_url ||
        f.source === 'youtube' ||
        (Array.isArray(f.streaming_links) && f.streaming_links.some((l: any) => l.platform?.toLowerCase().includes('youtube') || l.url?.includes('youtu')))
      );

      if (isYoutube) {
        totalYoutubeFilms++;
        const isTmdbPoster = f.poster_url?.includes('image.tmdb.org');
        const isImdbPoster = f.poster_url?.includes('media-amazon.com');
        if (isTmdbPoster || isImdbPoster) {
          overwrittenFilms.push(f);
        }
      }
    }

    if (batch.length < pageSize) break;
    page++;
  }

  console.log(`\nScan complete!`);
  console.log(`Total YouTube films in database: ${totalYoutubeFilms}`);
  console.log(`Total Overwritten YouTube films found: ${overwrittenFilms.length}`);
  console.log('\nSample list of overwritten titles:');
  for (const f of overwrittenFilms.slice(0, 20)) {
    console.log(`- [${f.id}] "${f.title}" (${f.year})`);
    console.log(`  Current poster: ${f.poster_url}`);
    console.log(`  Video ID: ${f.source_video_id || f.youtube_watch_url}`);
  }
}

checkAllFilmsForOverwrittenPosters();
