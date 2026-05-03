import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const stealthPlugin = stealth();
chromium.use(stealthPlugin);

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function scrapeGenesis() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  console.log('🌍 Scraping Genesis Cinemas...');
  
  const locations = [
    { name: 'Genesis Maryland', url: 'https://genesiscinemas.com/maryland-mall-maryland/', cinemaId: '0aef7f74-d8dd-4847-b652-e167285993c0' },
    { name: 'Genesis Lekki', url: 'https://genesiscinemas.com/freedom-way-lekki/', cinemaId: 'c833f1dd-7c40-4f9a-ac31-0d8a4708caa6' },
    { name: 'Genesis Festac', url: 'https://genesiscinemas.com/festival-mall-festac-lagos/', cinemaId: '92ae9a89-7dfc-44fb-9240-0d6c7f1e64f7' },
    { name: 'Genesis Abuja', url: 'https://genesiscinemas.com/ceddi-plaza-abuja/', cinemaId: '3843be4b-7ae3-4a10-9fdf-f6b79c6ae957' },
    { name: 'Genesis Port Harcourt', url: 'https://genesiscinemas.com/genesis-center-port-harcourt/', cinemaId: 'e25ff010-cf5e-4b99-a8fd-4f6b681dd2c1' },
    { name: 'Genesis Owerri', url: 'https://genesiscinemas.com/owerri-mall-owerri/', cinemaId: '7c2945dd-b6c5-431b-81c9-b4ead987033f' },
    { name: 'Genesis Asaba', url: 'https://genesiscinemas.com/asaba-mall-delta-state/', cinemaId: '52a0c538-1cc0-456d-afbc-f6531f8770c8' },
    { name: 'Genesis Warri', url: 'https://genesiscinemas.com/warri-delta-mall-effurun/', cinemaId: '981bd41a-6979-4c44-aa5c-4f120e5cc568' }
  ];

  const today = new Date().toISOString().split('T')[0];

  for (const loc of locations) {
    console.log(`📍 Processing ${loc.name}...`);
    try {
      await page.goto(loc.url, { waitUntil: 'networkidle', timeout: 60000 });
      
      try {
        await page.waitForSelector('.movie-tabs', { timeout: 30000 });
      } catch (e) {
        console.log(`  ⚠️ No movies found or took too long to load for ${loc.name}`);
        continue;
      }

      const films = await page.evaluate(() => {
        const movieNodes = document.querySelectorAll('.movie-tabs');
        return Array.from(movieNodes).map(node => {
          const titleEl = node.querySelector('h3 a');
          const imgEl = node.querySelector('img#jacroappimg');
          const showtimeEls = node.querySelectorAll('.perfbtn');
          const synopsisEl = node.querySelector('header p');

          const showtimes = Array.from(showtimeEls).map(btn => ({
            time: btn.textContent.trim().replace(/\s+VIP$/i, ''),
            format: btn.textContent.toLowerCase().includes('vip') ? 'VIP' : 'Standard',
            ticketUrl: btn.getAttribute('href')
          }));

          return {
            title: titleEl ? titleEl.textContent.trim() : 'Unknown Title',
            posterUrl: imgEl ? imgEl.getAttribute('src') : null,
            synopsis: synopsisEl ? synopsisEl.textContent.trim() : null,
            showtimes
          };
        });
      });

      console.log(`  Found ${films.length} films for ${loc.name}`);
      
      for (const film of films) {
        console.log(`    🔍 Syncing ${film.title}...`);
        
        const cleanTitle = film.title.replace(/\s+VIP$/i, '').trim();
        
        // Find film in DB with fuzzy matching
        let { data: dbFilm, error: filmError } = await supabase
          .from('films')
          .select('id, title')
          .ilike('title', cleanTitle)
          .maybeSingle();

        if (!dbFilm) {
          // Try fuzzy
          const { data: fuzzyFilms } = await supabase
            .from('films')
            .select('id, title')
            .ilike('title', `%${cleanTitle}%`)
            .limit(5);
            
          if (fuzzyFilms && fuzzyFilms.length > 0) {
            // Pick the best match (shortest title that contains cleanTitle)
            dbFilm = fuzzyFilms.sort((a, b) => a.title.length - b.title.length)[0];
            console.log(`      ✨ Fuzzy matched ${cleanTitle} -> ${dbFilm.title}`);
          }
        }

        if (!dbFilm) {
          console.log(`      ⚠️ Film not found in DB: ${cleanTitle}`);
          continue;
        }

        // Deduplicate showtimes by time and format
        const uniqueShowtimes = [];
        const seen = new Set();
        film.showtimes.forEach(s => {
          const key = `${s.time}-${s.format}`;
          if (!seen.has(key)) {
            uniqueShowtimes.push(s);
            seen.add(key);
          }
        });

        // Delete old showtimes for this film/cinema/date
        await supabase
          .from('showtimes')
          .delete()
          .match({ film_id: dbFilm.id, cinema_id: loc.cinemaId, show_date: today });

        // Insert new showtimes
        const showtimesToInsert = uniqueShowtimes.map(s => ({
          film_id: dbFilm.id,
          cinema_id: loc.cinemaId,
          show_date: today,
          show_time: s.time + ':00',
          format: s.format,
          ticket_url: s.ticketUrl,
          source: 'genesis_playwright',
          is_available: true,
          last_seen_at: new Date().toISOString()
        }));

        const { error: insertError } = await supabase
          .from('showtimes')
          .insert(showtimesToInsert);

        if (insertError) {
          console.error(`      ❌ Error inserting showtimes for ${cleanTitle}:`, insertError.message);
        } else {
          console.log(`      ✅ Synced ${showtimesToInsert.length} showtimes`);
        }
      }
      
    } catch (err) {
      console.error(`  ❌ Error scraping ${loc.name}:`, err.message);
    }
  }

  await browser.close();
}

scrapeGenesis();
