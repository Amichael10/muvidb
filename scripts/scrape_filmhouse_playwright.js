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

async function scrapeFilmhouse() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🌍 Scraping Filmhouse Cinemas...');
  
  const locations = [
    { name: 'Lekki IMAX', cinemaId: '6c9c38f0-f790-4573-aaa0-483d96ccaa43' },
    { name: 'Circle Mall', cinemaId: '13641c31-b2f2-4300-bcdd-23173e33c4f8' },
    { name: 'Surulere', cinemaId: '6201cbdf-dcf7-44b4-982c-bc860bb70230' },
    { name: 'Samonda', cinemaId: 'a2b15cfa-b044-491a-9c0f-13d2ff853886' },
    { name: 'Landmark', cinemaId: '314079fe-6416-469b-9241-2ce049954662' }
  ];

  const today = new Date().toISOString().split('T')[0];

  try {
    await page.goto('https://filmhouseng.com/', { waitUntil: 'networkidle', timeout: 60000 });
    
    for (const loc of locations) {
      console.log(`📍 Processing ${loc.name}...`);
      
      try {
        // Open location dropdown - use a more specific selector and click the first visible one
        await page.waitForSelector('.dropdownHeader', { timeout: 10000 });
        const headers = await page.$$('.dropdownHeader');
        let clicked = false;
        for (const header of headers) {
          if (await header.isVisible()) {
            await header.click();
            clicked = true;
            break;
          }
        }
        
        if (!clicked) {
          console.log('  ⚠️ No visible dropdown header found');
          continue;
        }
        
        await page.waitForTimeout(2000);
        
        // Find and click the location by name in the dropdownBody
        const found = await page.evaluate((locName) => {
          const bodies = Array.from(document.querySelectorAll('.dropdownBody'));
          const visibleBody = bodies.find(b => b.offsetParent !== null);
          if (!visibleBody) return false;
          
          const items = Array.from(visibleBody.querySelectorAll('.item, div'));
          const item = items.find(i => i.textContent.trim().toLowerCase().includes(locName.toLowerCase()));
          if (item) {
            item.click();
            return true;
          }
          return false;
        }, loc.name);
        
        if (!found) {
          console.log(`  ⚠️ Could not find ${loc.name} in dropdown`);
          continue;
        }

        // Wait for movies to load
        await page.waitForTimeout(3000);
        
        const films = await page.evaluate(() => {
          const movieNodes = document.querySelectorAll('.pc-movie-item, .movie-card-wrap, [class*="movie-item"]');
          return Array.from(movieNodes).map(node => {
            const titleEl = node.querySelector('h1, h2, h3, .pc-movie-title');
            const showtimeEls = node.querySelectorAll('.pc-show-time, .showtime');

            const showtimes = Array.from(showtimeEls).map(btn => {
              const timeText = btn.textContent.trim();
              return {
                time: timeText,
                format: 'Standard', // Default for now
                ticketUrl: null
              };
            });

            return {
              title: titleEl ? titleEl.textContent.trim() : null,
              showtimes
            };
          }).filter(f => f.title && f.showtimes.length > 0);
        });

        console.log(`  Found ${films.length} films for ${loc.name}`);
        
        for (const film of films) {
          console.log(`    🔍 Syncing ${film.title}...`);
          
          let { data: dbFilm } = await supabase
            .from('films')
            .select('id, title')
            .ilike('title', film.title)
            .maybeSingle();

          if (!dbFilm) {
            const { data: fuzzy } = await supabase
              .from('films')
              .select('id, title')
              .ilike('title', `%${film.title}%`)
              .limit(1);
            dbFilm = fuzzy ? fuzzy[0] : null;
          }

          if (!dbFilm) {
            console.log(`      ⚠️ Film not found in DB: ${film.title}`);
            continue;
          }

          await supabase
            .from('showtimes')
            .delete()
            .match({ film_id: dbFilm.id, cinema_id: loc.cinemaId, show_date: today });

          const showtimesToInsert = film.showtimes.map(s => {
            // Convert "10:40AM" to "10:40:00"
            let [time, modifier] = s.time.split(/(AM|PM)/i);
            let [hours, minutes] = time.split(':');
            if (hours === '12') hours = '00';
            if (modifier?.toUpperCase() === 'PM') hours = parseInt(hours, 10) + 12;
            const formattedTime = `${String(hours).padStart(2, '0')}:${minutes}:00`;

            return {
              film_id: dbFilm.id,
              cinema_id: loc.cinemaId,
              show_date: today,
              show_time: formattedTime,
              format: s.format,
              source: 'filmhouse_playwright',
              is_available: true,
              last_seen_at: new Date().toISOString()
            };
          });

          const { error } = await supabase.from('showtimes').insert(showtimesToInsert);
          if (error) console.error(`      ❌ Error: ${error.message}`);
          else console.log(`      ✅ Synced ${showtimesToInsert.length} showtimes`);
        }
        
      } catch (e) {
        console.error(`  ❌ Error processing ${loc.name}:`, e.message);
      }
    }
    
  } finally {
    await browser.close();
  }
}

scrapeFilmhouse();
