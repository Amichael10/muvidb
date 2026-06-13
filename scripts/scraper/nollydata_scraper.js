const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BASE_URL = 'https://www.nollydata.com';
const MOVIES_INDEX_URL = `${BASE_URL}/moviess`;
const SEARCH_URL = `${BASE_URL}/search`;

// Helper for delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function scrapeMoviesIndex() {
  console.log(`Fetching movies index from ${MOVIES_INDEX_URL}`);
  try {
    const { data } = await axios.get(MOVIES_INDEX_URL);
    const $ = cheerio.load(data);
    
    const movieUrls = [];
    // Adjust selector based on actual nollydata HTML structure
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (href && href.includes('/movie/')) {
        movieUrls.push(href.startsWith('http') ? href : `${BASE_URL}${href}`);
      }
    });
    
    // Deduplicate
    return [...new Set(movieUrls)];
  } catch (error) {
    console.error('Error fetching movies index:', error.message);
    return [];
  }
}

async function scrapeMovieDetails(url) {
  console.log(`Scraping movie details from ${url}`);
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    
    // Adjust these selectors based on the actual HTML structure
    const title = $('h1').first().text().trim();
    const synopsis = $('.synopsis, .description').first().text().trim(); // Example class
    const releaseYear = $('.release-year').first().text().trim();
    const duration = $('.duration').first().text().trim();
    const genre = [];
    $('.genre-tag').each((i, el) => genre.push($(el).text().trim()));
    
    const cast = [];
    $('.cast-member').each((i, el) => {
        const name = $(el).find('.name').text().trim();
        const url = $(el).find('a').attr('href');
        if (name) {
            cast.push({ name, url: url?.startsWith('http') ? url : `${BASE_URL}${url}` });
        }
    });

    return {
      title,
      synopsis,
      release_year: releaseYear,
      duration,
      genre: genre.join(', '),
      cast
    };
  } catch (error) {
    console.error(`Error fetching movie ${url}:`, error.message);
    return null;
  }
}

async function scrapePersonDetails(url) {
  if (!url) return null;
  console.log(`Scraping person details from ${url}`);
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    
    const name = $('h1').first().text().trim();
    const about = $('.about, .bio').first().text().trim();
    
    let twitter = null;
    let instagram = null;
    
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (href) {
        if (href.includes('twitter.com') || href.includes('x.com')) twitter = href;
        if (href.includes('instagram.com')) instagram = href;
      }
    });

    return { name, about, twitter, instagram };
  } catch (error) {
    console.error(`Error fetching person ${url}:`, error.message);
    return null;
  }
}

async function saveMovieToSupabase(movie) {
  if (!movie || !movie.title) return;
  console.log(`Saving movie to Supabase: ${movie.title}`);
  
  const { data, error } = await supabase
    .from('films')
    .upsert({
      title: movie.title,
      synopsis: movie.synopsis,
      release_year: movie.release_year,
      duration: movie.duration,
      // map other fields as necessary based on your database schema
    }, { onConflict: 'title' })
    .select()
    .single();
    
  if (error) {
    console.error(`Error saving movie ${movie.title}:`, error.message);
  } else {
    console.log(`Saved movie ID: ${data.id}`);
  }
}

async function savePersonToSupabase(person) {
  if (!person || !person.name) return;
  console.log(`Saving person to Supabase: ${person.name}`);
  
  const { data, error } = await supabase
    .from('people')
    .upsert({
      name: person.name,
      about: person.about,
      twitter_url: person.twitter,
      instagram_url: person.instagram,
      // map other fields
    }, { onConflict: 'name' })
    .select()
    .single();
    
  if (error) {
    console.error(`Error saving person ${person.name}:`, error.message);
  } else {
    console.log(`Saved person ID: ${data.id}`);
  }
}

async function main() {
  console.log('Starting NollyData scraper...');
  
  // 1. Get movie URLs
  const movieUrls = await scrapeMoviesIndex();
  console.log(`Found ${movieUrls.length} movies.`);
  
  // For testing, just take the first 3 movies
  const testUrls = movieUrls.slice(0, 3);
  
  for (const url of testUrls) {
    const movieData = await scrapeMovieDetails(url);
    if (movieData) {
      await saveMovieToSupabase(movieData);
      
      // Also scrape the cast for this movie
      for (const castMember of movieData.cast) {
        if (castMember.url) {
          const personData = await scrapePersonDetails(castMember.url);
          if (personData) {
            await savePersonToSupabase(personData);
          }
          await delay(1000); // 1 second delay between requests
        }
      }
    }
    await delay(1000); // 1 second delay
  }
  
  console.log('Done!');
}

main();
