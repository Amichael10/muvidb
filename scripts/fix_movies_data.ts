import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Starting DB scan and fix (Pass 2)...");

  // 1. Copy poster_url to backdrop_url if backdrop_url is null and poster_url is not null
  // We'll loop to handle pagination since Supabase limits to 1000 per request
  let totalBackdropsUpdated = 0;
  while (true) {
    const { data: moviesToFixBackdrop, error: err1 } = await supabase
      .from('films')
      .select('id, poster_url, backdrop_url')
      .not('poster_url', 'is', null)
      .is('backdrop_url', null)
      .limit(1000);

    if (err1) {
      console.error("Error fetching movies to fix backdrop:", err1);
      break;
    }
    
    if (!moviesToFixBackdrop || moviesToFixBackdrop.length === 0) {
      break; // No more to fix
    }

    console.log(`Found ${moviesToFixBackdrop.length} movies with missing backdrop but existing poster. Updating...`);
    for (const movie of moviesToFixBackdrop) {
      if (!movie.poster_url) continue;
      await supabase
        .from('films')
        .update({ backdrop_url: movie.poster_url })
        .eq('id', movie.id);
      totalBackdropsUpdated++;
    }
    
    if (moviesToFixBackdrop.length < 1000) break;
  }
  console.log(`Successfully updated ${totalBackdropsUpdated} backdrops in total.`);


  // 2. Set genre to Drama if no genre exists
  const { data: dramaGenre, error: genreErr } = await supabase
    .from('genres')
    .select('id')
    .ilike('name', 'Drama')
    .limit(1)
    .single();

  if (genreErr || !dramaGenre) {
    console.error("Could not find 'Drama' genre:", genreErr);
  } else {
    console.log(`Found 'Drama' genre ID: ${dramaGenre.id}`);
    
    let totalGenresUpdated = 0;
    let offset = 0;
    while(true) {
      // Fetch films and their genres
      const { data: filmsBatch, error: filmsErr } = await supabase
        .from('films')
        .select('id, film_genres(genre_id)')
        .range(offset, offset + 999);
        
      if (filmsErr || !filmsBatch || filmsBatch.length === 0) break;

      const filmsWithoutGenres = filmsBatch.filter(f => !f.film_genres || f.film_genres.length === 0);
      
      if (filmsWithoutGenres.length > 0) {
        const inserts = filmsWithoutGenres.map(f => ({
          film_id: f.id,
          genre_id: dramaGenre.id
        }));
        
        const { error: insertErr } = await supabase
          .from('film_genres')
          .insert(inserts, { ignoreDuplicates: true }); // ignore if somehow they exist
          
        if (insertErr) {
          console.error("Error inserting genres chunk:", insertErr);
        } else {
          totalGenresUpdated += inserts.length;
        }
      }
      
      offset += 1000;
      if (filmsBatch.length < 1000) break;
    }
    console.log(`Successfully added 'Drama' genre to ${totalGenresUpdated} movies.`);
  }

  // 3. For movies without platforms or links, choose youtube
  let totalPlatformsUpdated = 0;
  let pOffset = 0;
  while(true) {
    const { data: batch, error: pErr } = await supabase
      .from('films')
      .select('id, source, release_type, streaming_links, youtube_watch_url')
      .range(pOffset, pOffset + 999);

    if (pErr || !batch || batch.length === 0) break;

    const moviesToUpdate = batch.filter(m => {
      const noSource = !m.source || m.source.trim() === '';
      const noYt = !m.youtube_watch_url || m.youtube_watch_url.trim() === '';
      // check if streaming_links is null or an empty array or empty string
      let noLinks = false;
      if (!m.streaming_links) {
        noLinks = true;
      } else if (Array.isArray(m.streaming_links) && m.streaming_links.length === 0) {
        noLinks = true;
      } else if (typeof m.streaming_links === 'string' && m.streaming_links.trim() === '') {
        noLinks = true;
      }
      
      return noSource && noYt && noLinks;
    });

    if (moviesToUpdate.length > 0) {
      for (const m of moviesToUpdate) {
        await supabase.from('films')
          .update({ source: 'youtube', release_type: 'youtube' })
          .eq('id', m.id);
        totalPlatformsUpdated++;
      }
    }

    pOffset += 1000;
    if (batch.length < 1000) break;
  }
  
  console.log(`Successfully set source='youtube' for ${totalPlatformsUpdated} movies.`);

  console.log("DB scan and fix completed.");
  process.exit(0);
}

main().catch(console.error);
