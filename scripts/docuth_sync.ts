import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { cleanTitle } from '../api/_lib/yt_service.js';
import { detectAndNormalizeSeries } from '../api/_lib/series_utils.js';

// Load stealth plugin
const stealthPlugin = stealth();
chromium.use(stealthPlugin);

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const DOCUTH_HOME_URL = 'https://web.docuth.com/home';

function parseDocuthDuration(durationStr: string | null): number | null {
  if (!durationStr) return null;
  const hMatch = durationStr.match(/(\d+)\s*h/i);
  const mMatch = durationStr.match(/(\d+)\s*m/i);
  const sMatch = durationStr.match(/(\d+)\s*s/i);
  let total = 0;
  if (hMatch) total += parseInt(hMatch[1]) * 60;
  if (mMatch) total += parseInt(mMatch[1]);
  if (sMatch && !hMatch && !mMatch) {
    total += Math.ceil(parseInt(sMatch[1]) / 60);
  }
  return total > 0 ? total : null;
}

async function scrapeDocuth() {
  console.log('🚀 Launching browser...');
  
  const proxyServer = process.env.SMARTPROXY_HOST && process.env.SMARTPROXY_PORT
    ? `http://${process.env.SMARTPROXY_HOST}:${process.env.SMARTPROXY_PORT}`
    : null;
  const proxyUser = process.env.SMARTPROXY_USER;
  const proxyPass = process.env.SMARTPROXY_PASS;

  const launchOptions: any = { headless: true };
  if (proxyServer && proxyUser && proxyPass) {
    console.log(`🛡️ Configuring browser to use SmartProxy: ${proxyServer}`);
    launchOptions.proxy = {
      server: proxyServer,
      username: proxyUser,
      password: proxyPass
    };
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  console.log(`🚀 Navigating to Docuth Home: ${DOCUTH_HOME_URL}`);
  await page.goto(DOCUTH_HOME_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3500); // Allow initial content to load

  console.log('📜 Scrolling to lazy-load all movies...');
  let lastHeight = await page.evaluate('document.body.scrollHeight');
  for (let i = 0; i < 8; i++) {
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
    await page.waitForTimeout(2000);
    const newHeight = await page.evaluate('document.body.scrollHeight');
    if (newHeight === lastHeight) break;
    lastHeight = newHeight;
  }

  // Extract all movie detail page URLs
  const movieUrls = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href^="/movies/"]'));
    const urls = anchors.map(a => (a as HTMLAnchorElement).href).filter(Boolean);
    return [...new Set(urls)];
  });

  console.log(`📽️ Discovered ${movieUrls.length} unique movie URLs on Docuth. Crawling details...`);
  const scrapedMovies: any[] = [];

  for (const url of movieUrls) {
    console.log(`📄 Fetching details for: ${url}`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('h4', { timeout: 10000 }).catch(() => null);
      await page.waitForTimeout(1500); // Allow dynamic contents to settle

      const details = await page.evaluate(() => {
        // 1. Extract Title
        const titleEl = document.querySelector('h4');
        const title = titleEl ? titleEl.textContent?.trim() : 'Unknown';

        // 2. Extract Creator / Director
        const creatorLink = document.querySelector('a[href^="/creators/"]');
        const creator = creatorLink ? creatorLink.textContent?.trim() : '';

        // 3. Extract Release Year
        let year = null;
        const h6s = Array.from(document.querySelectorAll('h6'));
        for (const h6 of h6s) {
          const txt = h6.textContent || '';
          const m = txt.match(/\b(19|20)\d{2}\b/);
          if (m) {
            year = parseInt(m[0]);
            break;
          }
        }

        // 4. Extract Runtime Duration (e.g. "44m 10s" or "1h 30m")
        let durationStr = '';
        const bodyText = document.body.innerText;
        const durationMatch = bodyText.match(/\b\d+(h|m|s)\s+\d+(m|s)\b|\b\d+m\b|\b\d+h\b/i);
        if (durationMatch) {
          durationStr = durationMatch[0];
        } else {
          const spans = Array.from(document.querySelectorAll('span, p, h6'));
          for (const el of spans) {
            const txt = el.textContent || '';
            if (/^\s*\d+h\s*\d+m\s*$/i.test(txt) || /^\s*\d+m\s*\d+s\s*$/i.test(txt)) {
              durationStr = txt.trim();
              break;
            }
          }
        }

        // 5. Extract Synopsis / Story Description
        let synopsis = '';
        const pTags = Array.from(document.querySelectorAll('p'));
        for (const p of pTags) {
          const txt = p.textContent?.trim() || '';
          if (txt.length > 30 && !txt.includes('Starring') && !txt.includes('PG-') && !txt.includes('Copyright')) {
            synopsis = txt;
            break;
          }
        }
        if (!synopsis) {
          const starringHeader = Array.from(document.querySelectorAll('h5, h6, p')).find(el => el.textContent?.includes('Starring'));
          if (starringHeader) {
            let prev = starringHeader.previousElementSibling;
            while (prev) {
              const txt = prev.textContent?.trim() || '';
              if (txt.length > 20 && !txt.includes('PG-') && !txt.includes('202')) {
                synopsis = txt;
                break;
              }
              prev = prev.previousElementSibling;
            }
          }
        }

        // 6. Extract Genres
        const genres: string[] = [];
        const ratingEl = Array.from(document.querySelectorAll('span, p, h6')).find(el => /^(G|PG|PG-13|R|13\+|16\+|18\+)$/i.test(el.textContent?.trim() || ''));
        if (ratingEl) {
          let sib = ratingEl.nextElementSibling;
          while (sib && genres.length < 5) {
            const txt = sib.textContent?.trim() || '';
            if (txt && !txt.includes('•') && txt.length < 20) {
              genres.push(txt);
            }
            sib = sib.nextElementSibling;
          }
        }
        if (genres.length === 0) {
          const genreWords = ['Action', 'Drama', 'Comedy', 'Thriller', 'Romance', 'Documentary', 'Horror', 'Adventure', 'Sci-Fi', 'Fantasy', 'Crime', 'Family', 'Mystery', 'Biography', 'History'];
          const spans = Array.from(document.querySelectorAll('span'));
          spans.forEach(span => {
            const txt = span.textContent?.trim() || '';
            if (genreWords.includes(txt) && !genres.includes(txt)) {
              genres.push(txt);
            }
          });
        }

        // 7. Extract Cast Members
        const cast: string[] = [];
        const starringEl = Array.from(document.querySelectorAll('h5, h6, p, div')).find(el => el.textContent?.trim() === 'Starring');
        if (starringEl) {
          const next = starringEl.nextElementSibling;
          if (next) {
            const castLinks = next.querySelectorAll('a, p, span');
            if (castLinks.length > 0) {
              castLinks.forEach(c => {
                const txt = c.textContent?.trim() || '';
                if (txt && txt.length > 2 && txt.length < 50 && !cast.includes(txt) && !txt.includes('Starring')) {
                  cast.push(txt);
                }
              });
            } else {
              const txt = next.textContent?.trim() || '';
              if (txt) {
                txt.split(',').forEach(s => {
                  const cleaned = s.trim();
                  if (cleaned) cast.push(cleaned);
                });
              }
            }
          }
        }

        // 8. Extract Banner / Poster Image
        let poster_url = null;
        const divs = Array.from(document.querySelectorAll('div'));
        for (const div of divs) {
          const bg = window.getComputedStyle(div).backgroundImage;
          if (bg && bg !== 'none' && bg.startsWith('url(')) {
            const cleanBg = bg.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
            if (cleanBg.includes('http') || cleanBg.includes('supabase.co') || cleanBg.includes('docuth')) {
              poster_url = cleanBg;
              break;
            }
          }
        }
        if (!poster_url) {
          const img = document.querySelector('img[src*="poster"], img[src*="cover"], img[src*="banner"], img');
          if (img) {
            poster_url = (img as HTMLImageElement).src;
          }
        }

        return {
          title,
          creator,
          year,
          durationStr,
          synopsis,
          genres,
          cast,
          poster_url
        };
      });

      if (details.title !== 'Unknown') {
        scrapedMovies.push({
          ...details,
          url
        });
        console.log(`  ✓ Successfully scraped: ${details.title}`);
      } else {
        console.warn(`  ⚠️ Failed to scrape valid title for: ${url}`);
      }
    } catch (e: any) {
      console.error(`  ❌ Failed to fetch detail page ${url}:`, e.message);
    }
    await page.waitForTimeout(1000 + Math.random() * 1000);
  }

  await browser.close();
  return scrapedMovies;
}

async function upsertPerson(name: string) {
  if (!name) return null;
  const { data: existing } = await supabase.from('people').select('id, source').ilike('name', name).maybeSingle();
  if (existing) {
    if (!existing.source) {
       await supabase.from('people').update({ source: 'docuth' }).eq('id', existing.id);
    }
    return existing.id;
  }

  if (name.length > 5) {
    const { data: partial } = await supabase
      .from('people')
      .select('id, name')
      .ilike('name', `%${name}%`)
      .limit(1)
      .maybeSingle();

    if (partial) {
      console.log(`  🔍 Fuzzy matched "${name}" to existing person "${partial.name}"`);
      return partial.id;
    }
  }

  const { data: newPerson, error } = await supabase
    .from('people')
    .insert({ name, source: 'docuth', nationality: 'Nigerian' })
    .select('id')
    .single();

  if (error) {
    console.error(`  ⚠️ Error creating person ${name}:`, error.message);
    return null;
  }
  return newPerson.id;
}

async function syncToDatabase(movies: any[]) {
  let updatedCount = 0;
  let newCount = 0;
  let errorCount = 0;

  for (const movie of movies) {
    const { isSeries, baseTitle, episodeNum } = detectAndNormalizeSeries(movie.title);
    const cleanedTitle = cleanTitle(baseTitle);
    const movieYear = movie.year || new Date().getFullYear();
    const runtimeMinutes = parseDocuthDuration(movie.durationStr);

    console.log(`🔄 Processing Docuth Movie: "${cleanedTitle}" (Year: ${movieYear})`);

    try {
      // 1. Check for existing film by exact cleaned title and year
      let existing = null;
      const { data: results } = await supabase
        .from('films')
        .select('id, title, year, streaming_links, status, release_type, synopsis, poster_url, runtime_minutes')
        .ilike('title', cleanedTitle);

      if (results && results.length > 0) {
        existing = results.find(r => r.year === movieYear) ||
                   results.find(r => Math.abs((r.year || 0) - movieYear) <= 1) ||
                   results[0];
      }

      let filmId;

      if (existing) {
        filmId = existing.id;
        const currentLinks = existing.streaming_links || {};

        const updatePayload: any = {
          streaming_links: {
            ...currentLinks,
            docuth: movie.url
          },
          synopsis: existing.synopsis || movie.synopsis,
          runtime_minutes: existing.runtime_minutes || runtimeMinutes,
          poster_url: existing.poster_url || movie.poster_url,
          backdrop_url: existing.backdrop_url || movie.poster_url
        };

        if (['announced', 'coming_soon'].includes(existing.status)) {
          updatePayload.status = 'released';
        }

        const { error: updateError } = await supabase.from('films').update(updatePayload).eq('id', existing.id);
        if (updateError) throw updateError;

        updatedCount++;
        console.log(`  🆙 Updated existing film record.`);
      } else {
        // Create new film
        const { data: inserted, error } = await supabase
          .from('films')
          .insert({
            title: cleanedTitle,
            year: movieYear,
            synopsis: movie.synopsis,
            runtime_minutes: runtimeMinutes,
            poster_url: movie.poster_url,
            backdrop_url: movie.poster_url,
            release_type: 'docuth',
            streaming_links: {
              docuth: movie.url
            },
            source: 'docuth_sync',
            status: 'released',
            countries: ['Nigeria'],
            needs_review: true
          })
          .select('id')
          .single();

        if (error) throw error;
        filmId = inserted.id;
        newCount++;
        console.log(`  ✨ Created new African film record.`);
      }

      // 2. Sync Genres
      if (filmId && movie.genres && movie.genres.length > 0) {
        for (const gName of movie.genres) {
          const { data: genreRow } = await supabase
            .from('genres')
            .select('id')
            .ilike('name', gName)
            .maybeSingle();
          if (genreRow) {
            await supabase.from('film_genres').upsert({
              film_id: filmId,
              genre_id: genreRow.id
            }, { onConflict: 'film_id,genre_id' });
          }
        }
      }

      // 3. Sync Creator as director
      if (filmId && movie.creator) {
        const creatorId = await upsertPerson(movie.creator);
        if (creatorId) {
          await supabase.from('credits').upsert({
            film_id: filmId,
            person_id: creatorId,
            role: 'director'
          }, { onConflict: 'film_id,person_id,role' });
        }
      }

      // 4. Sync Cast
      if (filmId && movie.cast && movie.cast.length > 0) {
        for (const actorName of movie.cast) {
          const personId = await upsertPerson(actorName);
          if (personId) {
            await supabase.from('credits').upsert({
              film_id: filmId,
              person_id: personId,
              role: 'actor'
            }, { onConflict: 'film_id,person_id,role' });
          }
        }
      }
    } catch (e: any) {
      console.error(`  ❌ Error syncing ${movie.title}:`, e.message);
      errorCount++;
    }
  }

  console.log(`\n📊 Docuth Sync complete:`);
  console.log(`   - Updated: ${updatedCount}`);
  console.log(`   - New: ${newCount}`);
  console.log(`   - Errors: ${errorCount}`);
}

async function run() {
  try {
    const movies = await scrapeDocuth();
    await syncToDatabase(movies);
  } catch (e) {
    console.error('💀 Fatal error:', e);
    process.exit(1);
  }
}

run();
