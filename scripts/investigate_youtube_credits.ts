import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import { supabase } from './lib/db';

function extractYoutubeId(val: any): string | null {
  if (!val || typeof val !== 'string') return null;
  const str = val.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
  const match = str.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})/i);
  return match?.[1] || null;
}

function isYoutubeFilm(f: any): boolean {
  if (f.source === 'youtube') return true;
  if (extractYoutubeId(f.source_video_id) || extractYoutubeId(f.youtube_watch_url) || extractYoutubeId(f.trailer_youtube_id)) return true;
  if (Array.isArray(f.streaming_links)) {
    return f.streaming_links.some((l: any) =>
      l?.platform?.toLowerCase?.().includes('youtube') ||
      l?.url?.includes('youtu') ||
      !!extractYoutubeId(l?.url) ||
      !!extractYoutubeId(l?.source_video_id)
    );
  }
  return false;
}

async function main() {
  console.log('🔍 Auditing All Credits on YouTube Films...\n');

  // 1. Fetch all credits where source = 'imdb_continuous_sync'
  const { data: syncCredits, error: syncErr } = await supabase
    .from('credits')
    .select('id, film_id, person_id, role, character_name, source, created_at, films(id, title, year, source, poster_url, youtube_watch_url, source_video_id, trailer_youtube_id, streaming_links), people(id, name, tmdb_id, nationality)')
    .eq('source', 'imdb_continuous_sync');

  if (syncErr) {
    console.error('Error fetching sync credits:', syncErr);
    return;
  }

  console.log(`Total credits in DB with source = 'imdb_continuous_sync': ${syncCredits?.length || 0}`);

  const mismatchedCredits: any[] = [];

  for (const c of syncCredits || []) {
    const film = (c as any).films;
    if (film && isYoutubeFilm(film)) {
      mismatchedCredits.push(c);
    }
  }

  console.log(`\nFound ${mismatchedCredits.length} credits added by continuous sync to YouTube films:\n`);

  for (const item of mismatchedCredits) {
    const film = item.films;
    const person = item.people;
    console.log(`• Credit ID: ${item.id}`);
    console.log(`  Film: "${film?.title}" (${film?.year || 'N/A'}) [ID: ${film?.id}]`);
    console.log(`  Person: "${person?.name}" (Role: ${item.role}, Character: ${item.character_name || 'N/A'})`);
    console.log(`  Added: ${item.created_at}`);
    console.log('---');
  }

  // Check if any other credits exist on the 118 restored films
  console.log('\n--- Checking the 118 Restored Films for any other credits ---');
  // We can select films where poster_url contains i.ytimg.com
  const { data: ytPosterFilms } = await supabase
    .from('films')
    .select('id, title, year, poster_url, source')
    .ilike('poster_url', '%i.ytimg.com%')
    .limit(500);

  console.log(`Found ${ytPosterFilms?.length || 0} films with i.ytimg.com posters in DB.`);

  const ytFilmIds = (ytPosterFilms || []).map(f => f.id);
  const { data: allCreditsOnYtPosters } = await supabase
    .from('credits')
    .select('id, film_id, person_id, role, character_name, source, created_at, people(name)')
    .in('film_id', ytFilmIds.slice(0, 150));

  console.log(`Total credits on these YouTube films: ${allCreditsOnYtPosters?.length || 0}`);
  
  const sourcesGroup: Record<string, number> = {};
  for (const c of allCreditsOnYtPosters || []) {
    const s = c.source || 'null/original';
    sourcesGroup[s] = (sourcesGroup[s] || 0) + 1;
  }
  console.log('Credit sources breakdown on these films:', sourcesGroup);
}

main().catch(console.error);
