const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const https = require('https');
const cheerio = require('cheerio');
const dotenv = require('dotenv');

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const envDefault = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const env = { ...envDefault, ...envLocal, ...process.env };

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env or .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const IRONFLIX_MOVIES_URL = 'https://www.ironflix.com/movies';

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

async function scrapeIronflix() {
  console.log(`Fetching ${IRONFLIX_MOVIES_URL}...`);
  return new Promise((resolve, reject) => {
    https.get(IRONFLIX_MOVIES_URL, (res) => {
      let html = '';
      res.on('data', chunk => { html += chunk; });
      res.on('end', () => {
        resolve(html);
      });
    }).on('error', reject);
  });
}

async function run() {
  try {
    const html = await scrapeIronflix();
    const $ = cheerio.load(html);
    
    const filmsToUpsert = [];
    
    $('.grid-item-padding').each((i, el) => {
      const linkEl = $(el).find('.browse-item-link');
      if (!linkEl.length) return;
      
      const rawProps = linkEl.attr('data-track-event-properties');
      if (!rawProps) return;
      
      let props;
      try {
        props = JSON.parse(rawProps);
      } catch (e) {
        return;
      }
      
      const id = props.id;
      const title = $(el).find('.browse-item-title strong').text().trim() || props.label;
      const href = linkEl.attr('href');
      const imgRaw = $(el).find('img').attr('src');
      
      // clean image url (remove query params for highest quality if needed, but let's keep them as they might be required)
      const img = imgRaw;
      
      // Find tooltip
      const tooltip = $(`#collection-tooltip-${id}`);
      let description = '';
      let castText = '';
      
      if (tooltip.length) {
        const paragraphs = tooltip.find('.transparent p');
        description = $(paragraphs[0]).text().trim();
        if (paragraphs.length > 1) {
          castText = $(paragraphs[1]).text().trim().replace(/^Cast:\s*/i, '');
        } else if (description.toLowerCase().startsWith('cast:')) {
          castText = description.replace(/^Cast:\s*/i, '');
          description = '';
        }
      }
      
      // Ensure we only ingest African/Nollywood films
      // Ironflix is heavily Nollywood, so we assume Nigeria, but let's be safe:
      const countries = ['Nigeria']; // Base assumption for Ironflix Nollywood focus
      
      // We will map this to the films table structure
      const slug = generateSlug(title);
      
      filmsToUpsert.push({
        title: title,
        synopsis: description,
        poster_url: img,
        backdrop_url: img, // use poster as backdrop fallback
        source: 'ironflix',
        source_video_id: id.toString(),
        youtube_watch_url: href, 
        countries: countries,
        needs_review: false 
      });
    });
    
    console.log(`Found ${filmsToUpsert.length} films to process from Ironflix.`);
    
    if (filmsToUpsert.length === 0) {
      console.log("No films found, perhaps the DOM changed?");
      return;
    }
    
    // Show a sample
    console.log("Sample:", filmsToUpsert[0]);
    
    // Insert into Supabase
    let inserted = 0;
    let errors = 0;
    
    for (const film of filmsToUpsert) {
      // Check if it already exists by source and source_id
      const { data: existing } = await supabase
        .from('films')
        .select('id')
        .eq('source', 'ironflix')
        .eq('source_video_id', film.source_video_id)
        .single();
        
      if (!existing) {
        // Insert
        const { error } = await supabase.from('films').insert([film]);
        if (error) {
          console.error(`Error inserting ${film.title}:`, error.message);
          errors++;
        } else {
          inserted++;
        }
      } else {
        // We could update it, but for now we skip existing
      }
    }
    
    console.log(`\nDONE! Inserted ${inserted} new films from Ironflix. Errors: ${errors}.`);
    
  } catch (err) {
    console.error("Scraping failed:", err);
  }
}

run();
