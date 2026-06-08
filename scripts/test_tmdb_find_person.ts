import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
  const TMDB_API_KEY = process.env.TMDB_API_KEY;
  const imdbPersonId = 'nm10583915'; // Charity Awoke
  const findUrl = `https://api.themoviedb.org/3/find/${imdbPersonId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
  
  console.log(`Searching TMDB for ${imdbPersonId}...`);
  try {
    const res = await fetch(findUrl).then(r => r.json());
    console.log(JSON.stringify(res, null, 2));
  } catch (err: any) {
    console.error(err);
  }
}

test();
