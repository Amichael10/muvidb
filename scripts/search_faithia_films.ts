import { supabase } from '../api/_lib/supabase.ts';

async function searchFaithiaFilms() {
  const titles = ['Aje Oja', 'Anu Omo', 'Ara Mi', 'Open Marriage', 'Beyond Trust', 'Intruder', 'Faithia'];
  console.log('Searching films in DB for FB NOLLY / Faithia titles...');

  for (const t of titles) {
    const { data: films } = await supabase
      .from('films')
      .select('id, title, year, youtube_watch_url, trailer_youtube_id, synopsis')
      .ilike('title', `%${t}%`);

    if (films && films.length > 0) {
      console.log(`\nFound ${films.length} match(es) for "${t}":`);
      for (const f of films) {
        // Check credits
        const { data: credits } = await supabase
          .from('credits')
          .select('id, role, raw_name, person_id')
          .eq('film_id', f.id);

        console.log(`- [${f.id}] "${f.title}" (${f.year}) | URL: ${f.youtube_watch_url} | Credits count: ${credits?.length || 0}`);
        if (credits && credits.length > 0) {
          console.log(`  Credits sample:`, credits.slice(0, 4));
        }
      }
    }
  }

  // Also check if any channel exists with Faithia or Balogun
  const { data: faithiaChannels } = await supabase
    .from('channels')
    .select('*')
    .or('name.ilike.%faithia%,name.ilike.%fbnolly%,name.ilike.%balogun%');
  console.log('\nChannels in DB matching Faithia/FBNOLLY:', faithiaChannels);
}

searchFaithiaFilms().catch(console.error);
