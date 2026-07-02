import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { cleanTitle } from '../api/_lib/yt_service.js';
import { generateAIContent } from '../api/_lib/ai_service.js';
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

// Dynamic search query based on arguments
const searchPhrase = process.argv[2] || 'nollywood';
const PRIME_SEARCH_URL = `https://www.primevideo.com/search/ref=atv_nb_sug?ie=UTF8&phrase=${encodeURIComponent(searchPhrase)}`;
const LOGIN_URL = 'https://www.amazon.com/ap/signin'; 

async function login(page) {
  const email = process.env.PRIME_EMAIL;
  const password = process.env.PRIME_PASSWORD;

  if (!email || !password) {
    console.log('⚠️ PRIME_EMAIL or PRIME_PASSWORD not set. Attempting as guest...');
    return;
  }

  console.log('🔐 Attempting to login to Amazon/Prime...');
  try {
    await page.goto('https://www.primevideo.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    const signInButton = await page.$('a[href*="/signin"], .pv-nav-sign-in');
    if (!signInButton) {
      console.log('✅ Already logged in (presumably)');
      return;
    }

    await page.goto('https://www.amazon.com/ap/signin?openid.pape.max_auth_age=0&openid.return_to=https%3A%2F%2Fwww.primevideo.com%2Fauth%2Freturn%2F&openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.assoc_handle=amzn_prime_video_desktop_us&openid.mode=checkid_setup&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0', { waitUntil: 'domcontentloaded', timeout: 60000 });

    await page.fill('#ap_email', email);
    await page.click('#continue');
    await page.fill('#ap_password', password);
    await page.click('#signInSubmit');
    
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('✅ Login submitted.');
    
    if (await page.isVisible('#auth-mfa-otpcode')) {
      console.log('⚠️ OTP required! Please handle manually.');
      await page.waitForTimeout(10000);
    }
  } catch (e) {
    console.error('❌ Login failed or timed out:', e.message);
  }
}

function parsePrimeDuration(durationStr: string): number | null {
  if (!durationStr) return null;
  const hMatch = durationStr.match(/(\d+)\s*h/i);
  const mMatch = durationStr.match(/(\d+)\s*min/i);
  let total = 0;
  if (hMatch) total += parseInt(hMatch[1]) * 60;
  if (mMatch) total += parseInt(mMatch[1]);
  return total > 0 ? total : null;
}

async function verifyNollywoodAI(movie) {
  const prompt = `Identify if the following film is a Nollywood (Nigerian) or African production. 
Title: ${movie.title}
Synopsis: ${movie.synopsis}
Cast: ${movie.cast?.join(', ')}

Return ONLY a JSON object: {"isAfrican": true/false, "confidence": 0-1, "reason": "brief reason"}`;

  try {
    const { text } = await generateAIContent(prompt);
    const result = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
    return result.isAfrican && result.confidence > 0.6;
  } catch (e) {
    console.warn(`  ⚠️ AI Verification failed for ${movie.title}, defaulting to true.`);
    return true; 
  }
}

async function scrapePrime() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  await login(page);

  console.log(`🚀 Navigating to Prime Search: ${PRIME_SEARCH_URL}`);
  await page.goto(PRIME_SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000); // Allow results to settle

  try {
    const cookieButton = await page.waitForSelector('#sp-cc-accept, #pv-nav-accept-cookies', { timeout: 3000 });
    if (cookieButton) await cookieButton.click();
  } catch (e) {}

  let movieUrls = new Set<string>();
  let pageNumber = 1;
  const maxPages = 5; // Search specific phrases typically fit in fewer pages

  while (pageNumber <= maxPages) {
    console.log(`📜 Scraping Prime Search Page ${pageNumber}...`);
    let lastHeight = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = 10;

    // Scroll to the bottom to load all dynamic elements
    while (scrollAttempts < maxScrollAttempts) {
      const newHeight = await page.evaluate('document.body.scrollHeight');
      if (newHeight === lastHeight) break;
      lastHeight = newHeight;
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await page.waitForTimeout(2000);
      scrollAttempts++;
    }

    // Extract all links on the current page
    const links = await page.evaluate(() => {
      const containers = Array.from(document.querySelectorAll('.s-result-list-placeholder, .av-grid-container, .f-grid-container, div[data-automation-id="grid"]'));
      let allLinks: string[] = [];
      
      containers.forEach(container => {
        const rowLinks = Array.from(container.querySelectorAll('a.detailLink-zyfcZQ, a[href*="/detail/"], a[href*="/gp/video/detail/"]'));
        rowLinks.forEach(a => {
          const href = (a as HTMLAnchorElement).href.split('?')[0];
          if (href && !href.includes('javascript:')) allLinks.push(href);
        });
      });

      if (allLinks.length === 0) {
        const allElements = Array.from(document.querySelectorAll('a.detailLink-zyfcZQ, a[href*="/detail/"], h2, h3'));
        for (const el of allElements) {
          if (el.tagName.startsWith('H') && (el.textContent?.toLowerCase().includes('related') || el.textContent?.toLowerCase().includes('customers also watched'))) break;
          if (el.tagName === 'A') {
            const href = (el as HTMLAnchorElement).href.split('?')[0];
            if (href && !href.includes('javascript:')) allLinks.push(href);
          }
        }
      }
      return [...new Set(allLinks)];
    });
    
    links.forEach(url => movieUrls.add(url));
    console.log(`  🔍 Found ${links.length} links on page ${pageNumber}. Total unique: ${movieUrls.size}`);

    // Look for the "Next" button
    const nextButton = await page.$('.s-pagination-next:not(.s-pagination-disabled), a[aria-label="Next page"], li.a-last a');
    if (!nextButton) {
      console.log('🏁 No more pages found or Next button is disabled.');
      break;
    }

    console.log('⏭️ Clicking Next Page...');
    try {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
        nextButton.click()
      ]);
      await page.waitForTimeout(3000);
    } catch (e) {
      console.log('⚠️ Failed to navigate to next page:', e.message);
      break;
    }
    
    pageNumber++;
  }

  console.log(`📽️ Discovered ${movieUrls.size} unique movie URLs. Starting deep extraction...`);
  const allMovies: any[] = [];
  const urlList = Array.from(movieUrls);
  
  for (const url of urlList) {
    console.log(`📄 Fetching details for: ${url}`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('h1', { timeout: 8000 }).catch(() => null);

      const details = await page.evaluate(async () => {
        // Scroll a bit to trigger lazy loads
        window.scrollBy(0, 500);
        await new Promise(r => setTimeout(r, 800));

        const titleEl = document.querySelector('h1[data-testid="title"], h1[data-automation-id="title"], h1, .dv-node-dp-title');
        const synopsisEl = document.querySelector('.synopsis-FWBzLL span, span[data-testid="unclipped-text"], div[data-testid="synopsis"] span, [data-automation-id="description-text"], #pv-details-description, .pv-description');
        const metaDescEl = document.querySelector('meta[name="description"]');
        const yearEl = document.querySelector('span[data-testid="release-year"], [data-automation-id="release-year-badge"], .dv-node-dp-release-year, [data-automation-id="release-year"]');
        const runtimeEl = document.querySelector('span[data-testid="runtime"], [data-automation-id="runtime-badge"], [data-automation-id="runtime"]');
        
        // Image Extraction using HTML regex
        const htmlStr = document.documentElement.innerHTML;
        const allUrls = [...new Set(htmlStr.match(/https:\/\/m\.media-amazon\.com\/images\/S\/pv-target-images\/[a-f0-9]{64}[^"'\s\\]*/gi) || [])];
        
        let extractedPosterUrl = null;
        let extractedBackdropUrl = null;

        for (const url of allUrls) {
           if (/(_SX\d+_|_SY\d+_)/i.test(url) && !url.includes('_UR')) {
              if (!extractedPosterUrl) extractedPosterUrl = url;
           }
           if (/(_UR\d+,\d+_|_UX\d+_)/i.test(url)) {
              if (!extractedBackdropUrl) extractedBackdropUrl = url;
           }
        }

        if (!extractedBackdropUrl) {
           const og = document.querySelector('meta[property="og:image"]');
           if (og) extractedBackdropUrl = og.getAttribute('content');
        }
        
        if (!extractedPosterUrl) {
           extractedPosterUrl = allUrls.find(u => !u.includes('_UR') && !u.includes('BottomRightCardGradient')) || null;
        }
        if (!extractedBackdropUrl) {
           extractedBackdropUrl = allUrls.find(u => !u.includes('_SX') && !u.includes('BottomRightCardGradient')) || null;
        }
        
        // Click Details tab if it exists to get full cast/director
        const detailsTabs = Array.from(document.querySelectorAll('#tab-selector-details, [data-automation-id="details-tab"], button, a')) as HTMLElement[];
        const detailsTab = detailsTabs.find(el => el.textContent?.trim() === 'Details');
        if (detailsTab) {
          detailsTab.click();
          await new Promise(r => setTimeout(r, 1500));
        }

        const castEls = Array.from(document.querySelectorAll('a[href*="atv_dp_pd_actors"], a[data-testid="cast"], a[href*="role=actor"], .dv-node-dp-cast a, [data-automation-id="cast-and-crew"] a, a[href*="atv_dp_md_pp"], .dv-node-dp-actors a, .atv-dp-cast-and-crew-item a'));
        const directorEls = Array.from(document.querySelectorAll('a[href*="atv_dp_pd_dir"], a[href*="role=director"], .dv-node-dp-director a, [data-automation-id="director"] a, a[href*="role=director"], .dv-node-dp-directors a, .atv-dp-director-item a'));
        const writerEls = Array.from(document.querySelectorAll('a[href*="atv_dp_pd_wr"], a[href*="role=writer"], .dv-node-dp-writer a, [data-automation-id="writer"] a, .dv-node-dp-writers a, .atv-dp-writer-item a'));
        const genresEls = Array.from(document.querySelectorAll('a[data-testid="genre"], a[href*="genre="], .dv-node-dp-genres a, [data-automation-id="genre"] a'));

        // Detect if it's a series
        const titleText = titleEl?.textContent?.toLowerCase() || '';
        let extractedSynopsis = synopsisEl?.textContent?.trim() || metaDescEl?.getAttribute('content')?.trim() || '';
        if (extractedSynopsis.toLowerCase().includes('cookie') || extractedSynopsis.toLowerCase().includes('javascript')) {
            extractedSynopsis = '';
        }
        const synopsisText = extractedSynopsis.toLowerCase();
        const durationText = runtimeEl?.textContent?.toLowerCase() || '';
        const seasonSelector = !!document.querySelector('[data-automation-id="season-selector"], .dv-node-dp-season-selector, [data-testid="season-selector"], .season-selector');
        const episodeList = !!document.querySelector('[data-automation-id="episodes-list"], .dv-node-dp-episodes, .episode-list, .episode-container');
        
        // Broaden series detection for "Ep 1", "Season 1", etc.
        const seriesRegex = /\b(ep|episode|season|series|anthology)\b\s*\d*|seasons|episodes/i;
        const isSeries = seasonSelector || 
                         episodeList ||
                         seriesRegex.test(titleText) || 
                         seriesRegex.test(durationText) ||
                         seriesRegex.test(synopsisText);

        return {
          title: titleEl?.textContent?.trim() || 'Unknown',
          synopsis: extractedSynopsis,
          year: yearEl?.textContent?.trim() || null,
          runtime: runtimeEl?.textContent?.trim() || null,
          poster_url: extractedPosterUrl,
          backdrop_url: extractedBackdropUrl,
          cast: [...new Set(castEls.map(el => el.textContent?.trim()).filter(Boolean))].slice(0, 50),
          directors: [...new Set(directorEls.map(el => el.textContent?.trim()).filter(Boolean))],
          writers: [...new Set(writerEls.map(el => el.textContent?.trim()).filter(Boolean))],
          genres: [...new Set(genresEls.map(el => el.textContent?.trim()).filter(Boolean))],
          isSeries
        };
      });

      if (details.title !== 'Unknown') {
        const isExcluded = /007|James Bond|Mission Impossible|Marvel|Avengers|Hollywood|Fast & Furious/i.test(details.title);
        if (!isExcluded) {
          allMovies.push({ 
            ...details, 
            url,
            watch_url: url
          });
        } else {
          console.log(`  ⏩ Skipping non-Nollywood title: ${details.title}`);
        }
      }
    } catch (e) {
      console.error(`  ❌ Failed to fetch ${url}: ${e.message}`);
    }
    await page.waitForTimeout(1500 + Math.random() * 2500);
  }

  await browser.close();
  return allMovies;
}

async function upsertPerson(name: string) {
  if (!name) return null;
  const { data: existing } = await supabase.from('people').select('id, source').ilike('name', name).maybeSingle();
  if (existing) {
    if (!existing.source) {
       await supabase.from('people').update({ source: 'prime_video' }).eq('id', existing.id);
    }
    return existing.id;
  }
  const { data: newPerson, error } = await supabase.from('people').insert({ name, source: 'prime_video', nationality: 'Nigerian' }).select('id')
    .single();
  if (error) return null;
  return newPerson.id;
}

async function syncToDatabase(scrapedMovies) {
  let updatedCount = 0; let newCount = 0; let errorCount = 0;

  for (const movie of scrapedMovies) {
    const { isSeries, baseTitle, episodeNum, seasonNum } = detectAndNormalizeSeries(movie.title);
    const cleanedTitle = cleanTitle(baseTitle);
    const movieYear = movie.year ? parseInt(movie.year.match(/\d{4}/)?.[0] || '0') : null;
    const runtimeMinutes = parsePrimeDuration(movie.runtime);

    console.log(`🔄 Processing: ${cleanedTitle} ${episodeNum ? `(Episode ${episodeNum})` : ''} (${movieYear || 'N/A'})`);

    const isAfrican = await verifyNollywoodAI(movie);
    if (!isAfrican) {
      console.log(`  ⏩ AI filtered out non-African content: ${cleanedTitle}`);
      continue;
    }

    try {
      let filmId;

      if (isSeries) {
        // Find or create parent series record
        const cleanedBase = cleanTitle(baseTitle);
        let parentRecord;

        // Search for existing parent series record in DB
        let { data: parentResults } = await supabase.from('films')
          .select('id, poster_url, backdrop_url, streaming_links')
          .ilike('title', cleanedBase)
          .eq('content_type', 'series')
          .is('series_id', null);

        let parentExisting = parentResults?.[0];

        if (parentExisting) {
          parentRecord = parentExisting;
          const parentUpdate: any = {};
          if (!parentExisting.poster_url && movie.poster_url) parentUpdate.poster_url = movie.poster_url;
          if (!parentExisting.backdrop_url && (movie.backdrop_url || movie.poster_url)) parentUpdate.backdrop_url = movie.backdrop_url || movie.poster_url;
          
          const existingLinks = parentExisting.streaming_links || {};
          if (!existingLinks.prime_video) {
            parentUpdate.streaming_links = { ...existingLinks, prime_video: movie.url };
          }
          if (Object.keys(parentUpdate).length > 0) {
            await supabase.from('films').update(parentUpdate).eq('id', parentExisting.id);
          }
        } else {
          // Create new parent series record
          const { data: newParent, error: parentError } = await supabase.from('films').insert({
            title: cleanedBase,
            year: movieYear,
            release_type: 'prime_video',
            source: 'prime_video',
            content_type: 'series',
            poster_url: movie.poster_url,
            backdrop_url: movie.backdrop_url || movie.poster_url,
            synopsis: movie.synopsis || null,
            needs_review: true,
            status: 'released',
            countries: ['Nigeria']
          }).select('id').single();

          if (parentError) throw parentError;
          parentRecord = newParent;
          console.log(`  🎦 Created series parent: "${cleanedBase}"`);
          newCount++;
        }

        const parentId = parentRecord.id;

        // If it's a specific episode
        if (episodeNum !== null) {
          // Find if this specific episode record exists
          let { data: epResults } = await supabase.from('films')
            .select('*')
            .eq('series_id', parentId)
            .eq('episode_number', episodeNum)
            .eq('season_number', seasonNum || 1);

          const epExisting = epResults?.[0];

          if (epExisting) {
            filmId = epExisting.id;
            const updatePayload: any = {
              streaming_links: { ...(epExisting.streaming_links || {}), prime_video: movie.url },
              synopsis: epExisting.synopsis || movie.synopsis,
              runtime_minutes: epExisting.runtime_minutes || runtimeMinutes,
              poster_url: epExisting.poster_url || movie.poster_url,
              backdrop_url: epExisting.backdrop_url || movie.backdrop_url || movie.poster_url
            };
            await supabase.from('films').update(updatePayload).eq('id', epExisting.id);
            updatedCount++;
          } else {
            // Create new episode record
            const { data: insertedEp, error: epError } = await supabase.from('films').insert({
              title: movie.title,
              year: movieYear,
              release_type: 'prime_video',
              source: 'prime_video',
              content_type: 'series',
              series_id: parentId,
              episode_number: episodeNum,
              season_number: seasonNum || 1,
              streaming_links: { prime_video: movie.url },
              runtime_minutes: runtimeMinutes,
              poster_url: movie.poster_url,
              backdrop_url: movie.backdrop_url || movie.poster_url,
              synopsis: movie.synopsis || null,
              status: 'released',
              countries: ['Nigeria'],
              needs_review: true
            }).select('id').single();

            if (epError) throw epError;
            filmId = insertedEp.id;
            newCount++;
            console.log(`  ✨ Created episode ${episodeNum} for series: "${cleanedBase}"`);
          }
        } else {
          filmId = parentId;
        }

      } else {
        let { data: results } = await supabase.from('films').select('*').ilike('title', cleanedTitle).eq('year', movieYear || 0);
        if (!results?.length) {
           ({ data: results } = await supabase.from('films').select('*').ilike('title', cleanedTitle));
        }
        const existing = results?.[0];

        if (existing) {
          filmId = existing.id;
          const updatePayload: any = {
            streaming_links: { ...(existing.streaming_links || {}), prime_video: movie.url },
            synopsis: existing.synopsis || movie.synopsis,
            runtime_minutes: existing.runtime_minutes || runtimeMinutes,
            poster_url: existing.poster_url || movie.poster_url,
            backdrop_url: (existing as any).backdrop_url || movie.backdrop_url || movie.poster_url
          };
          const isSuperPrimary = existing.youtube_watch_url || ['kava', 'ironflix'].includes(existing.release_type);
          if (!isSuperPrimary) updatePayload.release_type = 'prime_video';
          
          if (existing.content_type !== 'movie') updatePayload.content_type = 'movie';

          await supabase.from('films').update(updatePayload).eq('id', existing.id);
          updatedCount++;
        } else {
          const { data: inserted, error } = await supabase.from('films').insert({
            title: cleanedTitle, year: movieYear, synopsis: movie.synopsis, runtime_minutes: runtimeMinutes,
            poster_url: movie.poster_url, backdrop_url: movie.backdrop_url || movie.poster_url,
            release_type: 'prime_video', streaming_links: { prime_video: movie.url }, source: 'prime_video',
            status: 'released', countries: ['Nigeria'], needs_review: true, content_type: 'movie'
          }).select('id').single();
          if (error) throw error;
          filmId = inserted.id;
          newCount++;
        }
      }

      if (movie.genres) {
        for (const gName of movie.genres) {
          const { data: g } = await supabase.from('genres').select('id').ilike('name', gName).maybeSingle();
          if (g) await supabase.from('film_genres').upsert({ film_id: filmId, genre_id: g.id }, { onConflict: 'film_id,genre_id' });
        }
      }

      // Sync Cast
      if (movie.cast) {
        for (const actorName of movie.cast) {
          const pId = await upsertPerson(actorName);
          if (pId) await supabase.from('credits').upsert({ film_id: filmId, person_id: pId, role: 'actor' }, { onConflict: 'film_id,person_id,role' });
        }
      }

      // Sync Directors
      if (movie.directors) {
        for (const directorName of movie.directors) {
          const pId = await upsertPerson(directorName);
          if (pId) await supabase.from('credits').upsert({ film_id: filmId, person_id: pId, role: 'director' }, { onConflict: 'film_id,person_id,role' });
        }
      }

      // Sync Writers
      if (movie.writers) {
        for (const writerName of movie.writers) {
          const pId = await upsertPerson(writerName);
          if (pId) await supabase.from('credits').upsert({ film_id: filmId, person_id: pId, role: 'writer' }, { onConflict: 'film_id,person_id,role' });
        }
      }

    } catch (e) {
      console.error(`  ❌ Error processing ${movie.title}:`, e.message);
      errorCount++;
    }
  }
  console.log(`\n📊 Prime Sync Complete: Updated: ${updatedCount}, New: ${newCount}, Errors: ${errorCount}`);
}

async function run() {
  try {
    const movies = await scrapePrime();
    await syncToDatabase(movies);
  } catch (e) {
    console.error('💀 Fatal error:', e);
    process.exit(1);
  }
}

run();
