import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials!");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Proxy settings
const PROXY_URL = 'http://sp1j6x1qnt:G741N3s54rP2P3p20o@gate.smartproxy.com:7000';
const proxyAgent = new HttpsProxyAgent(PROXY_URL);

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9'
};

const makeSlug = (title) => {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchHtml(url) {
  try {
    const res = await fetch(url, {
      agent: proxyAgent,
      headers: HEADERS
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    console.error(`Error fetching ${url}:`, err.message);
    return null;
  }
}

async function upsertFilm(filmData) {
  const { title, synopsis, year, duration, poster_url, genres } = filmData;
  if (!title) return { action: 'error', error: 'No title' };

  const slug = makeSlug(title);

  const payload = {
    title,
    synopsis,
    poster_url,
    year,
    duration,
    countries: ['NG'],
    is_nollywood: true,
    mubi_slug: slug,
    slug: slug,
    genres: genres || []
  };

  // Remove undefined/null
  Object.keys(payload).forEach(k => payload[k] == null && delete payload[k]);

  // Check if exists
  const { data: existing } = await supabase
    .from('films')
    .select('id')
    .ilike('title', title)
    .single();

  if (existing) {
    const { error } = await supabase.from('films').update(payload).eq('id', existing.id);
    if (error) return { action: 'error', error: error.message };
    return { action: 'enriched', id: existing.id };
  } else {
    const { data, error } = await supabase.from('films').insert(payload).select();
    if (error) return { action: 'error', error: error.message };
    return { action: 'inserted', id: data[0].id };
  }
}

async function main() {
  console.log("🚀 Starting MUBI Scraper (Node.js version)...");
  
  const baseUrl = "https://mubi.com/en/films?all_films=true&country=Nigeria&sort=popularity_quality_score";
  
  let html = await fetchHtml(baseUrl);
  if (!html) return;
  fs.writeFileSync('mubi_dump.html', html);
  
  let $ = cheerio.load(html);
  
  // MUBI relies heavily on Next.js, try to find __NEXT_DATA__
  const nextDataScript = $('#__NEXT_DATA__').html();
  let filmsList = [];
  
  if (nextDataScript) {
    try {
      const data = JSON.parse(nextDataScript);
      const list = data.props?.pageProps?.initialState?.filmDiscovery?.list || [];
      filmsList = list;
    } catch(err) {
      console.error("Failed to parse NEXT_DATA:", err.message);
    }
  }

  if (filmsList.length === 0) {
    // Try to extract from DOM manually if NEXT_DATA is empty
    $('a.film-tile__link').each((i, el) => {
      filmsList.push({ canonical_url: $(el).attr('href') });
    });
  }

  console.log(`✅ Found ${filmsList.length} movies!`);
  
  let stats = { inserted: 0, enriched: 0, errors: 0 };
  
  for (let f of filmsList) {
    const slugUrl = f.canonical_url || f.url;
    if (!slugUrl) continue;
    
    const url = slugUrl.startsWith('http') ? slugUrl : `https://mubi.com${slugUrl}`;
    console.log(`Fetching ${url}...`);
    
    const filmHtml = await fetchHtml(url);
    if (!filmHtml) {
      stats.errors++;
      continue;
    }
    
    const _$ = cheerio.load(filmHtml);
    const filmNextData = _$('#__NEXT_DATA__').html();
    
    let title, synopsis, year, duration, posterUrl, genres = [];
    
    if (filmNextData) {
      try {
        const data = JSON.parse(filmNextData);
        const filmInfo = data.props?.pageProps?.initialState?.film?.film || {};
        
        title = filmInfo.title || f.title;
        synopsis = filmInfo.synopsis || filmInfo.editorial_synopsis || f.synopsis;
        year = filmInfo.year || f.year;
        duration = filmInfo.duration;
        posterUrl = filmInfo.still_url || filmInfo.promoted_still_url || f.still_url;
        
      } catch(e) {
        console.error("Error parsing film NEXT_DATA:", e.message);
      }
    } else {
      // DOM fallback
      title = _$('h1').text().trim() || f.title;
      synopsis = _$('.film-show__synopsis').text().trim();
      posterUrl = _$('meta[property="og:image"]').attr('content');
    }
    
    const res = await upsertFilm({ title, synopsis, year, duration, poster_url: posterUrl, genres });
    console.log(`  -> ${title}: ${res.action}`);
    if (res.action === 'error') console.log(`     Error: ${res.error}`);
    else stats[res.action]++;
    
    await delay(1000);
  }

  console.log("\\n🎉 MUBI Scrape Complete!");
  console.log(`Inserted: ${stats.inserted}, Enriched: ${stats.enriched}, Errors: ${stats.errors}`);
}

main();
