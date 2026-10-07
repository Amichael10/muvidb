import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
);

function normalizeTitle(t: string): string {
  return (t || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function scan() {
  console.log('Fetching films from scraper sources...');
  
  // Scraper sources to inspect:
  const scraperSources = ['docuth_sync', 'prime_video', 'circuits', 'partyjollof', 'afinolly', 'imdb', 'tmdb', 'netflix', 'showmax', 'irokotv'];
  
  let allFilms: any[] = [];
  let page = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('films')
      .select('id, title, year, source, poster_url, backdrop_url, synopsis, source_video_id, content_type, release_type, streaming_links, created_at')
      .in('source', scraperSources)
      .range(page * pageSize, (page + 1) * pageSize - 1);
      
    if (error) {
      console.error('Error fetching films:', error);
      break;
    }
    if (!data || data.length === 0) break;
    allFilms = allFilms.concat(data);
    page++;
    if (data.length < pageSize) break;
  }
  
  console.log(`Total films from scraper sources: ${allFilms.length}`);
  
  // Also fetch any films that might match titles of these scraper films
  const titleMap = new Map<string, any[]>();
  for (const film of allFilms) {
    const norm = normalizeTitle(film.title);
    if (!norm) continue;
    const yearKey = film.year ? `${norm}__${film.year}` : `${norm}__unknown`;
    if (!titleMap.has(yearKey)) {
      titleMap.set(yearKey, []);
    }
    titleMap.get(yearKey)!.push(film);
  }
  
  // Find duplicate clusters
  const clusters: any[] = [];
  for (const [key, films] of titleMap.entries()) {
    if (films.length > 1) {
      clusters.push({
        key,
        count: films.length,
        films: films.map(f => ({
          id: f.id,
          title: f.title,
          year: f.year,
          source: f.source,
          youtube_id: f.youtube_id,
          has_poster: !!f.poster_url,
          has_synopsis: !!f.synopsis
        }))
      });
    }
  }
  
  clusters.sort((a, b) => b.count - a.count);
  console.log(`Found ${clusters.length} duplicate scraper clusters!`);
  console.log('Top 20 clusters:');
  for (const c of clusters.slice(0, 20)) {
    console.log(`- ${c.key} (${c.count} copies):`);
    for (const f of c.films) {
      console.log(`    [${f.id}] "${f.title}" (${f.year}) source=${f.source} yt=${f.youtube_id} poster=${f.has_poster}`);
    }
  }
}

scan();
