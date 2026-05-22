import dotenv from 'dotenv';
import fs from 'fs';

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const envDefault = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const env = { ...envDefault, ...envLocal, ...process.env };

const TMDB_KEY = env.TMDB_API_KEY;

export async function findAndInsertMissingFilm(supabase: any, title: string) {
  if (!TMDB_KEY) {
    console.warn('⚠️ No TMDB API Key found. Skipping auto-insert.');
    return null;
  }

  console.log(`      🌐 Searching TMDB for "${title}"...`);
  const query = encodeURIComponent(title);
  const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${query}`;
  
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const data = await r.json();
    
    if (!data.results || data.results.length === 0) {
      console.log(`      ⚠️ Film not found on TMDB: ${title}`);
      return null;
    }
    
    // Pick the most likely match (first one)
    const tmdbFilm = data.results[0];
    
    const newFilm = {
      title: tmdbFilm.title,
      synopsis: tmdbFilm.overview,
      year: tmdbFilm.release_date ? parseInt(tmdbFilm.release_date.split('-')[0]) : null,
      poster_url: tmdbFilm.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbFilm.poster_path}` : null,
      source: 'tmdb_cinema',
      release_type: 'cinema',
      is_in_cinemas: true,
      tmdb_id: tmdbFilm.id,
      mubi_slug: tmdbFilm.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      needs_review: true
    };

    console.log(`      ✨ Inserting missing film from TMDB: ${newFilm.title}`);
    const { data: insertedFilm, error } = await supabase
      .from('films')
      .insert(newFilm)
      .select()
      .maybeSingle();

    if (error) {
      if (error.code === '23505' || error.message.includes('duplicate key')) {
        // Film already exists (probably found via TMDB but slug conflicted with an existing one)
        const { data: existingFilm } = await supabase
          .from('films')
          .select()
          .eq('mubi_slug', newFilm.mubi_slug)
          .maybeSingle();
        if (existingFilm) return existingFilm;
      }
      
      console.error(`      ❌ Error inserting film ${newFilm.title}:`, error.message);
      return null;
    }

    return insertedFilm;
  } catch (err) {
    console.error('      ❌ TMDB Error:', err);
    return null;
  }
}
