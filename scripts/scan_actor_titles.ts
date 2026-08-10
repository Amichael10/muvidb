import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function scanTitlesWithActorNames() {
  console.log('🔍 Fetching all people to build actor lookup map...');

  // Fetch people with names (min length > 5, 2+ words)
  let allPeople: { id: string; name: string }[] = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('people')
      .select('id, name')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('Error fetching people:', error);
      break;
    }

    if (!data || data.length === 0) break;
    allPeople = allPeople.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  console.log(`Loaded ${allPeople.length} people profiles.`);

  // Filter to multi-word names that look like real actor names (e.g. "Odunlade Adekola")
  const actorNames = allPeople.filter(p => {
    const trimmed = p.name.trim();
    const words = trimmed.split(/\s+/);
    return words.length >= 2 && trimmed.length >= 6 && !trimmed.toLowerCase().includes('movie');
  });

  console.log(`Filtered to ${actorNames.length} actor names for title scan.`);

  // Fetch films in batches
  let matchedCount = 0;
  let filmPage = 0;
  const filmPageSize = 1000;
  const matches: { filmId: string; title: string; actorName: string; personId: string }[] = [];

  while (true) {
    const { data: films, error } = await supabase
      .from('films')
      .select('id, title')
      .range(filmPage * filmPageSize, (filmPage + 1) * filmPageSize - 1);

    if (error) {
      console.error('Error fetching films:', error);
      break;
    }

    if (!films || films.length === 0) break;

    for (const film of films) {
      if (!film.title) continue;
      const titleLower = film.title.toLowerCase();

      for (const actor of actorNames) {
        const actorLower = actor.name.toLowerCase();
        // Check if title contains the actor name, but title is NOT just the actor's name (e.g. documentary or biography)
        if (titleLower.includes(actorLower) && titleLower.trim() !== actorLower.trim()) {
          matches.push({
            filmId: film.id,
            title: film.title,
            actorName: actor.name,
            personId: actor.id
          });
          matchedCount++;
          break; // Avoid double matching same title in initial scan sample
        }
      }
    }

    if (films.length < filmPageSize) break;
    filmPage++;
  }

  console.log(`Found ${matches.length} film titles containing actor names.`);
  console.log('Sample matches (first 25):');
  console.table(matches.slice(0, 25));
}

scanTitlesWithActorNames();
