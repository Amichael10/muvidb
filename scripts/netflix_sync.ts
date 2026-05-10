import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
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

const NETFLIX_URL = 'https://www.netflix.com/browse/genre/1138254?bc=34399';
const LOGIN_URL = 'https://www.netflix.com/login';
const STATE_FILE = 'netflix_playwright_state.json';

async function login(page) {
  const email = process.env.NETFLIX_EMAIL;
  const password = process.env.NETFLIX_PASSWORD;

  if (!email || !password) {
    console.log('⚠️ NETFLIX_EMAIL or NETFLIX_PASSWORD not set. Attempting to proceed without login...');
    return;
  }

  console.log('🔐 Attempting to login to Netflix...');
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

  try {
    // 0. Handle initial "Sign In" button if on landing page
    const signInBtn = await page.$('a[href*="/login"], .authLinks, .login-button');
    if (signInBtn && page.url().includes('netflix.com/') && !page.url().includes('/login')) {
       console.log('➡️ Clicking initial "Sign In" button...');
       await signInBtn.click();
       await page.waitForURL(url => url.includes('/login'), { timeout: 15000 });
    }

    // 1. Enter Email
    console.log('📧 Checking for email field...');
    const emailInput = await page.waitForSelector('input[name="userLoginId"], input[name="email"], input[type="email"]', { timeout: 15000 }).catch(() => null);
    
    if (emailInput) {
      console.log('📧 Entering email...');
      await emailInput.fill(email);
      await page.waitForTimeout(1000);
      
      const continueBtn = await page.$('button[type="submit"], button[data-uia="nmhp-card-cta-continue"], .btn-red, button[data-uia="login-submit-button"]');
      if (continueBtn) {
        const text = await continueBtn.textContent();
        if (text?.toLowerCase().includes('next') || text?.toLowerCase().includes('continue')) {
          console.log('➡️ Clicking "Next/Continue"...');
          await continueBtn.click();
          await page.waitForTimeout(2000);
        }
      }
    }

    // 2. Handle "Sign-in Code" or "Email me a code" flow (Multi-step)
    // Sometimes Netflix pushes the "Email me a code" flow. We need to click "Get Help" -> "Use password instead"
    const signinWithCode = await page.$('button[data-uia="login-with-code-button"], .login-with-code-button');
    if (signinWithCode || page.url().includes('login/otp')) {
      console.log('🛡️ Netflix is asking for a code. Attempting to switch to password flow...');
      const helpLink = await page.$('button[data-uia="login-help-link"], a[href*="/LoginHelp"], .login-help-link');
      if (helpLink) {
        await helpLink.click();
        await page.waitForTimeout(2000);
        const usePasswordBtn = await page.$('button[data-uia="login-password-button"], .login-password-button, button:has-text("Use password instead")');
        if (usePasswordBtn) {
          console.log('🔑 Switching to password flow...');
          await usePasswordBtn.click();
          await page.waitForTimeout(2000);
        }
      }
    }

    // 3. Enter Password
    console.log('⏳ Waiting for password field...');
    const pwInput = await page.waitForSelector('input[name="password"]', { timeout: 15000 }).catch(() => null);
    
    if (pwInput) {
      console.log('🔑 Entering password...');
      await pwInput.fill(password);
      await page.waitForTimeout(1000);
      
      const submitBtn = await page.waitForSelector('button[type="submit"], button[data-uia="login-submit-button"], .login-button', { timeout: 10000 });
      await submitBtn.click();
    } else {
      console.log('ℹ️ Password field did not appear, checking if already submitted or redirected.');
    }
    
    // 4. Finalize Login
    console.log('⌛ Waiting for login to finalize...');
    await page.waitForURL(url => url.includes('/browse') || url.includes('/ProfilesGate') || url.includes('/browse/genre/'), { timeout: 30000 }).catch(() => {
      console.log('⚠️ Navigation timeout after login. Checking for errors...');
    });
    
    // Handle CAPTCHA or error messages
    const errorMsg = await page.$('.ui-message-error, [data-uia="login-error"], .recaptcha-error');
    if (errorMsg) {
      const text = await errorMsg.textContent();
      console.log(`❌ Login Issue detected: ${text}`);
      await page.screenshot({ path: 'netflix-login-error.png' });
    }

    // 5. Handle Profile Selection
    if (page.url().includes('/ProfilesGate') || page.url().includes('/profiles')) {
      console.log('👤 Profile selection detected in login flow...');
      await handleProfileSelection(page);
    }
    
    const isStillOnLogin = page.url().includes('/login');
    if (isStillOnLogin) {
      console.log('❌ Still on login page. CAPTCHA or security challenge likely.');
      await page.screenshot({ path: 'netflix-login-blocked.png' });
    } else {
      console.log('✅ Login successful or past login screen.');
      await page.screenshot({ path: 'netflix-post-login.png' });
    }
  } catch (e) {
    console.log('ℹ️ Login flow encountered an issue:', e.message);
    await page.screenshot({ path: 'netflix-login-exception.png' });
  }
}

async function handleProfileSelection(page) {
  try {
    const profileSelectors = [
      'a[data-uia="profile-link"]',
      'ul.choose-profile a.profile-link',
      '.profile-link',
      '.profile-icon',
      'li.profile a',
      '.choose-profile a',
      '.profile-name',
      '.profile'
    ];
    
    console.log('👀 Checking for profile selection screen...');
    
    // Wait for any of the profile selectors to appear
    const foundSelector = await Promise.any(
      profileSelectors.map(selector => 
        page.waitForSelector(selector, { timeout: 10000 }).then(() => selector)
      )
    ).catch(() => null);

    if (foundSelector) {
      console.log(`✅ Found profile with selector: ${foundSelector}`);
      const profileEl = await page.$(foundSelector);
      if (profileEl) {
        console.log(`🖱️ Clicking profile...`);
        await profileEl.click({ force: true });
        
        // Wait for navigation or the browse page to load
        console.log('⌛ Waiting for redirect to /browse...');
        await page.waitForURL(url => url.includes('/browse'), { timeout: 45000 }).catch(() => {
          console.log('⚠️ Navigation to /browse timed out after profile selection. Checking if we are already there.');
        });
        
        await page.waitForTimeout(5000); 
        await page.screenshot({ path: 'netflix-post-profile.png' });
        return true;
      }
    } else {
      console.log('ℹ️ No profile selection detected or timed out.');
      if (page.url().includes('/ProfilesGate') || page.url().includes('/profiles')) {
        console.log('⚠️ On profile gate but no clickable elements found.');
        await page.screenshot({ path: 'netflix-profile-gate-stuck.png' });
      }
    }
  } catch (e) {
    console.log('ℹ️ Error during profile selection:', e.message);
    await page.screenshot({ path: 'netflix-profile-error.png' });
  }
  return false;
}

async function scrapeNetflix() {
  const browser = await chromium.launch({ headless: true });
  
  // Use persistent context or storage state if available
  let context;
  if (fs.existsSync(STATE_FILE)) {
    console.log('📄 Loading existing session state...');
    context = await browser.newContext({
      storageState: STATE_FILE,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
  } else {
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
  }

  const page = await context.newPage();

  console.log(`🚀 Navigating to: ${NETFLIX_URL}`);
  await page.goto(NETFLIX_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Check if we were redirected to login
  if (page.url().includes('/login')) {
    console.log('ℹ️ Redirected to login. Starting authentication flow...');
    await login(page);
    
    // Save state after login
    await context.storageState({ path: STATE_FILE });
    console.log(`💾 Session state saved to ${STATE_FILE}`);
    
    // After login, go back to the target URL
    console.log(`🚀 Returning to: ${NETFLIX_URL}`);
    await page.goto(NETFLIX_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } else {
    console.log('✅ Already logged in or no redirect.');
  }

  // Handle profile selection if it appears
  const profileSelected = await handleProfileSelection(page);
  
  // If we selected a profile, save the state again to capture the profile selection cookies
  if (profileSelected) {
    await context.storageState({ path: STATE_FILE });
    console.log(`💾 Session state updated after profile selection.`);
  }

  console.log('⌛ Waiting for titles to appear...');
  try {
    // Discovery Improvement: Wait for common title card selectors or the main content container
    await page.waitForSelector('.slider-item, .title-card, [data-testid="title-card"], a.slider-refocus, a[href*="/watch/"], a[data-uia="video-canvas"], .rowContainer, .lolomo', { timeout: 60000 });
  } catch (e) {
    console.warn('⚠️ Timeout waiting for titles. Page might be lazy loading or empty.');
    // Check if we are still on profile gate
    if (page.url().includes('/ProfilesGate') || page.url().includes('/profiles')) {
      console.log('🔄 Still on profile gate after timeout. Retrying selection...');
      await handleProfileSelection(page);
    }
    await page.screenshot({ path: 'netflix-titles-timeout.png' });
  }

  console.log('📜 Scrolling to load all Nollywood titles...');
  // Infinite scroll to trigger lazy loading of all rows
  let lastHeight = await page.evaluate('document.body.scrollHeight');
  for (let i = 0; i < 25; i++) {
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
    await page.waitForTimeout(2500);
    let newHeight = await page.evaluate('document.body.scrollHeight');
    if (newHeight === lastHeight) {
      // Try one more time with a longer wait and a small scroll up to shake it
      await page.evaluate('window.scrollBy(0, -200)');
      await page.waitForTimeout(1000);
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await page.waitForTimeout(3000);
      newHeight = await page.evaluate('document.body.scrollHeight');
      if (newHeight === lastHeight) break;
    }
    lastHeight = newHeight;
    console.log(`   - Scrolled to ${newHeight}px...`);
  }

  const movies = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.lolomoRow, .rowContainer, .slider-item'));
    const movieMap = new Map();

    rows.forEach(row => {
      const rowTitle = row.querySelector('.rowTitle, .row-header-title, h2')?.textContent || '';
      
      // Expanded African/Nollywood keywords for row discovery.
      // We also include thematic terms like 'Lagos', 'Yoruba', etc.
      const isAfricanRow = /African|Nigerian|Nollywood|South African|Ghanaian|Kenya|Senegal|Egypt|Ethiopia|Cameroon|Morocco|Lagos|Yoruba|Hausa|Igbo|Accra|Nairobi|Dakar|Johannesburg|Soil|Culture|Heritage/i.test(rowTitle);
      
      // Personalized/Algorithmic rows that might contain non-African content
      const isAlgorithmicRow = /Top Picks|Next Watch|New on Netflix|My List|Trending|Popular|Favorites/i.test(rowTitle) && !isAfricanRow;

      // On the Nollywood genre page, we allow all rows for discovery.
      // We will filter out non-African content later in the sync phase using detail-page metadata.
      const isOnGenrePage = window.location.href.includes('1138254');
      if (isAlgorithmicRow && !isOnGenrePage) return;
      if (!isAfricanRow && !isOnGenrePage) return;

      const links = Array.from(row.querySelectorAll('a[href*="/title/"], a[href*="/watch/"], a.slider-refocus, a[data-uia="video-canvas"]'));
      
      links.forEach(linkEl => {
        const href = linkEl.getAttribute('href') || '';
        const idMatch = href.match(/\/(watch|title)\/(\d+)/);
        if (!idMatch) return;
        
        const watchId = idMatch[2];
        if (movieMap.has(watchId)) return;

        let titleText = linkEl.getAttribute('aria-label') || 
                        linkEl.querySelector('img')?.getAttribute('alt') || 
                        linkEl.querySelector('.fallback-text')?.textContent?.trim() ||
                        linkEl.textContent?.trim();

        if (titleText) {
          titleText = titleText.replace(/^(Watch|Go to|Play|View)\s+/i, '').trim();
        }

        if (titleText && titleText !== 'Unknown' && titleText.length > 1) {
          movieMap.set(watchId, {
            title: titleText,
            netflix_id: watchId,
            url: `https://www.netflix.com/title/${watchId}`,
            watch_url: `https://www.netflix.com/watch/${watchId}`,
            poster_url: linkEl.querySelector('img')?.src || null,
            isAfricanDiscovery: isAfricanRow
          });
        }
      });
    });

    return Array.from(movieMap.values());
  });

  if (movies.length === 0) {
    console.log('📸 Saving debug screenshot...');
    await page.screenshot({ path: 'netflix-debug.png', fullPage: true });
    console.log('⚠️ No titles found. Check netflix-debug.png to see what the scraper saw.');
  } else {
    console.log(`🎬 Found ${movies.length} Nollywood titles on Netflix.`);
  }
  
  const detailedMovies: any[] = [];
  for (const movie of movies) {
    if (!movie.url) continue;
    console.log(`📄 Fetching details for: ${movie.title} (${movie.url})`);
    try {
      await page.goto(movie.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // 0. Handle intermittent Profile Gate or Login issues
      if (page.url().includes('/ProfilesGate') || page.url().includes('/profiles') || page.url().includes('/login')) {
        console.log('  👤 Re-authenticating or selecting profile...');
        if (page.url().includes('/login')) await login(page);
        await handleProfileSelection(page);
        await page.goto(movie.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      }

      // 1. Wait for core content or the "About" section
      await page.waitForSelector('.about-container, [data-uia="about-container"], .title-info-metadata-wrapper', { timeout: 10000 }).catch(() => {
        console.log('  ⚠️ Metadata container not found, proceeding with fallback...');
      });
      
      // Extra wait for async content
      await page.waitForTimeout(2000);
      
      const rawData: any = await page.evaluate(() => {
        const videoId = window.location.href.match(/\/title\/(\d+)/)?.[1];
        const cache = (window as any).netflix?.falcorCache || {};
        const videoData = videoId ? (cache.videos?.[videoId] || {}) : {};
        
        const getFromLabels = (labelName: string) => {
          const labels = Array.from(document.querySelectorAll('.label, .item-label, .about-item-label, [data-uia$="-label"]'));
          for (const l of labels) {
            const text = l.textContent?.toLowerCase() || '';
            if (text.includes(labelName.toLowerCase())) {
              const container = l.closest('.about-item, .more-details-item, .item-container, .previewModal--about');
              const contentEl = container?.querySelector('.content, .about-item-content, .item-text, [data-uia$="-content"]');
              if (contentEl) return contentEl.textContent?.split(',').map(s => s.trim()).filter(Boolean);
              if (l.nextElementSibling) return l.nextElementSibling.textContent?.split(',').map(s => s.trim()).filter(Boolean);
            }
          }
          return null;
        };

        // 1. Direct DOM Selectors
        let synopsis = document.querySelector('[data-uia="video-metadata--synopsis"], [data-uia="video-description"], .description-text')?.textContent?.trim() || '';
        
        // Broaden cast selectors
        let cast = Array.from(document.querySelectorAll('.about-item[data-uia="about-item-cast"] .about-item-content, .item-cast, .more-details-item-cast, .ptrack-content[data-uia="about-item-cast"]'))
                        .map(el => el.textContent?.trim().split(',')).flat().map(s => s?.trim()).filter(Boolean);
        
        let directors = Array.from(document.querySelectorAll('.about-item[data-uia="about-item-director"] .about-item-content, .item-directors, .more-details-item-director'))
                        .map(el => el.textContent?.trim().split(',')).flat().map(s => s?.trim()).filter(Boolean);

        let writers = Array.from(document.querySelectorAll('.about-item[data-uia="about-item-writer"] .about-item-content, .item-writers, .more-details-item-writer'))
                        .map(el => el.textContent?.trim().split(',')).flat().map(s => s?.trim()).filter(Boolean);

        let genres = Array.from(document.querySelectorAll('.about-item[data-uia="about-item-genre"] .about-item-content, .item-genres, .more-details-item-genre'))
                          .map(el => el.textContent?.trim().split(',')).flat().map(s => s?.trim()).filter(Boolean);
        
        // 2. Label-based fallbacks
        if (cast.length === 0) cast = getFromLabels('Cast') || [];
        if (directors.length === 0) directors = getFromLabels('Director') || getFromLabels('Directors') || [];
        if (genres.length === 0) genres = getFromLabels('Genres') || getFromLabels('Genre') || [];

        // 3. Falcor Cache Fallback (Targeted to THIS video) - Much more robust
        if (videoData) {
          if (!synopsis) synopsis = videoData.synopsis?.value || videoData.synopsis || '';
          
          // Try to extract cast from cache if DOM failed
          if (cast.length === 0 && videoData.cast) {
            const cacheCast = videoData.cast.value || videoData.cast;
            if (Array.isArray(cacheCast)) {
              cast = cacheCast.map(c => c.name || c).filter(Boolean);
            }
          }

          if (genres.length === 0) {
            const videoCacheStr = JSON.stringify(videoData);
            const genreKeywords = ['Nollywood', 'Nigerian', 'African', 'South African', 'Ghanaian', 'Kenyan', 'Senegalese', 'Egyptian', 'Cameroonian'];
            genres = genreKeywords.filter(k => videoCacheStr.includes(k));
          }
        }

        // Strict African check: Must have African keywords in genres, synopsis, or cache
        const africanPattern = /Nollywood|Nigerian|African|South African|Ghanaian|Kenyan|Senegalese|Egyptian|Cameroonian|Yoruba|Hausa|Igbo|Naija/i;
        const isAfrican = genres.some(g => africanPattern.test(g)) || 
                         africanPattern.test(synopsis) || 
                         africanPattern.test(JSON.stringify(videoData));

        const yearEl = document.querySelector('[data-uia="year"], [data-uia="video-year"], .year, .release-year');
        const runtimeEl = document.querySelector('[data-uia="duration"], [data-uia="video-runtime"], .duration');
        const detailTitleEl = document.querySelector('[data-uia="video-title"], .title-title, h1');
        
        // Detect if it's a series
        const titleText = (detailTitleEl?.textContent || '').toLowerCase();
        const synopsisText = (synopsis || '').toLowerCase();
        const durationText = (runtimeEl?.textContent || '').toLowerCase();
        
        // Check for common series markers in title, synopsis, or metadata
        // Added more markers like Ep, Season, Series
        const seriesRegex = /\b(ep|episode|vol|volume|part|pt|season|series|anthology)\b\s*\d*|seasons|episodes/i;
        const hasSeriesKeywords = seriesRegex.test(titleText) || 
                                 seriesRegex.test(durationText) ||
                                 seriesRegex.test(synopsisText);
        
        const hasSeriesSelectors = !!document.querySelector('.duration-badge, [data-uia="duration-badge"], .season-count, [data-uia="season-selector"], .episode-list, [data-uia="episode-list"], .series-title');
        
        const isSeries = hasSeriesSelectors || hasSeriesKeywords;

        return {
          title: detailTitleEl?.textContent?.trim() || null,
          synopsis: synopsis || '',
          year: yearEl?.textContent?.trim() || videoData.releaseYear?.value || videoData.releaseYear || null,
          runtimeStr: runtimeEl?.textContent?.trim() || (videoData.runtime?.value ? (Math.floor(videoData.runtime.value / 60) + 'm') : null),
          cast: Array.from(new Set(cast)).slice(0, 50), 
          directors: Array.from(new Set(directors)),
          writers: Array.from(new Set(writers)),
          genres: Array.from(new Set(genres)),
          isAfrican,
          isSeries
        };
      });

      const parseRuntime = (str: string | null) => {
        if (!str) return null;
        const hMatch = str.match(/(\d+)\s*h/i);
        const mMatch = str.match(/(\d+)\s*m/i);
        let total = 0;
        if (hMatch) total += parseInt(hMatch[1]) * 60;
        if (mMatch) total += parseInt(mMatch[1]);
        return total > 0 ? total : null;
      };

      detailedMovies.push({ 
        ...movie, 
        ...rawData,
        title: movie.title === 'Unknown' ? (rawData.title || movie.title) : movie.title,
        runtime_minutes: parseRuntime(rawData.runtimeStr),
        isAfrican: rawData.isAfrican,
        type: rawData.isSeries ? 'series' : 'movie',
        streaming_links: { 
          netflix: movie.url,
          netflix_watch: movie.watch_url
        }
      });
    } catch (e) {
      console.warn(`  ❌ Failed to get details for ${movie.title}: ${e.message}`);
      detailedMovies.push({
        ...movie,
        isAfrican: movie.isAfricanDiscovery,
        type: movie.title.toLowerCase().match(/\b(ep|episode|season)\b/) ? 'series' : 'movie'
      });
    }
    await page.waitForTimeout(1000 + Math.random() * 1000);
  }

  await browser.close();
  return detailedMovies;
}

async function upsertPerson(name: string) {
  if (!name) return null;
  const { data: existing } = await supabase.from('people').select('id, source').ilike('name', name).maybeSingle();
  if (existing) {
    if (!existing.source) {
       await supabase.from('people').update({ source: 'netflix' }).eq('id', existing.id);
    }
    return existing.id;
  }

  // Tier 2: Fuzzy matching (only if name is long enough to be unique)
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
  
  // Tier 3: Create new record
  const { data: newPerson, error } = await supabase
    .from('people')
    .insert({ name, source: 'netflix', nationality: 'Nigerian' })
    .select('id')
    .single();
    
  if (error) {
    console.error(`  ⚠️ Error creating person ${name}:`, error.message);
    return null;
  }
  return newPerson.id;
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
    console.warn(`  ⚠️ AI Verification failed for ${movie.title}, defaulting to genre-based check.`);
    return null; 
  }
}

async function syncToDatabase(scrapedMovies) {
  let updatedCount = 0;
  let newCount = 0;
  let errorCount = 0;

  for (const movie of scrapedMovies) {
    const { isSeries, baseTitle, episodeNum } = detectAndNormalizeSeries(movie.title);
    const cleanedTitle = cleanTitle(baseTitle);
    const movieYear = movie.year ? parseInt(movie.year.toString().match(/\d{4}/)?.[0] || '0') : null;
    
    // Check for African identity
    const isAfricanScraped = movie.isAfrican || movie.genres?.some(g => /Nollywood|Nigerian|African/i.test(g));
    
    // Determine countries based on genres
    const countries: string[] = [];
    if (movie.genres?.some(g => /Nollywood|Nigerian|Yoruba|Hausa|Igbo/i.test(g))) countries.push('Nigeria');
    if (movie.genres?.some(g => /South African/i.test(g))) countries.push('South Africa');
    if (movie.genres?.some(g => /Ghanaian/i.test(g))) countries.push('Ghana');
    if (movie.genres?.some(g => /Kenyan/i.test(g))) countries.push('Kenya');
    if (movie.genres?.some(g => /Egyptian/i.test(g))) countries.push('Egypt');
    if (countries.length === 0 && isAfricanScraped) countries.push('Nigeria'); 

    console.log(`🔄 Processing: ${movie.title} (Cleaned: ${cleanedTitle}, Year: ${movieYear || 'N/A'})`);

    // Strict Title Filter
    const isExcluded = /007|James Bond|Mission Impossible|Marvel|Avengers|Hollywood|Fast & Furious/i.test(movie.title);
    if (isExcluded) {
      console.log(`  ⏩ Skipping non-Nollywood blockbuster: ${movie.title}`);
      continue;
    }

    try {
      // 1. Try to find existing film with multi-tier matching
      let existing = null;
      
      // Tier 1: Exact cleaned title match
      const { data: exactResults } = await supabase
        .from('films')
        .select('id, title, year, streaming_links, release_type, youtube_watch_url, synopsis, poster_url, runtime_minutes, countries')
        .ilike('title', cleanedTitle);
      
      if (exactResults && exactResults.length > 0) {
        if (movieYear) {
          existing = exactResults.find(r => r.year === movieYear) || 
                     exactResults.find(r => Math.abs((r.year || 0) - movieYear) <= 1) || 
                     exactResults[0];
        } else {
          existing = exactResults[0];
        }
      }

      // Tier 2: Partial title match if no exact match found
      if (!existing && cleanedTitle.length > 3) {
        const { data: fuzzyResults } = await supabase
          .from('films')
          .select('id, title, year, streaming_links, release_type, youtube_watch_url, synopsis, poster_url, runtime_minutes, countries')
          .ilike('title', `%${cleanedTitle}%`)
          .limit(5);
        
        if (fuzzyResults && fuzzyResults.length > 0) {
          // If we have a year, be more strict about the fuzzy match
          if (movieYear) {
            existing = fuzzyResults.find(r => r.year === movieYear) || 
                       fuzzyResults.find(r => Math.abs((r.year || 0) - movieYear) <= 1);
          } else {
            // If no year, only take it if it's a very close match (e.g. title is subset)
            existing = fuzzyResults.find(r => r.title.toLowerCase() === cleanedTitle.toLowerCase());
          }
        }
      }

      let filmId;

      if (existing) {
        filmId = existing.id;
        const currentLinks = existing.streaming_links || {};
        
        const updatePayload: any = {
          streaming_links: { 
            ...currentLinks, 
            netflix: movie.url,
            netflix_watch: movie.watch_url || currentLinks.netflix_watch
          },
          synopsis: existing.synopsis || movie.synopsis,
          runtime_minutes: existing.runtime_minutes || movie.runtime_minutes,
          poster_url: existing.poster_url || movie.poster_url,
          backdrop_url: existing.backdrop_url || movie.poster_url,
          type: movie.type || existing.type || 'movie'
        };

        if (['announced', 'coming_soon'].includes(existing.status)) {
          updatePayload.status = 'released';
        }

        const isSuperPrimary = existing.youtube_watch_url || ['kava', 'ironflix'].includes(existing.release_type);
        if (!isSuperPrimary && existing.release_type !== 'netflix') {
          updatePayload.release_type = 'netflix';
        }

        const { error: updateError } = await supabase.from('films').update(updatePayload).eq('id', existing.id);
        if (updateError) throw updateError;
        
        updatedCount++;
        console.log(`  🆙 Updated existing film record.`);

      } else {
        // If NO existing record, we MUST be sure it's African before creating new
        let isConfirmedAfrican = isAfricanScraped;
        
        // Use AI verification if genre check is ambiguous
        if (!isConfirmedAfrican || movie.title.split(' ').length < 2) {
           const aiConfirmed = await verifyNollywoodAI(movie);
           if (aiConfirmed !== null) isConfirmedAfrican = aiConfirmed;
        }

        if (!isConfirmedAfrican) {
          console.log(`  ⏭️ Skipping new non-African title: ${movie.title} (Genres: ${movie.genres?.join(', ') || 'None'})`);
          continue;
        }

        const { data: inserted, error } = await supabase.from('films').insert({
          title: cleanedTitle,
          year: movieYear,
          synopsis: movie.synopsis,
          runtime_minutes: movie.runtime_minutes,
          poster_url: movie.poster_url,
          backdrop_url: movie.poster_url,
          release_type: 'netflix',
          streaming_links: { 
            netflix: movie.url,
            netflix_watch: movie.watch_url
          },
          source: 'netflix',
          status: 'released',
          countries: countries.length > 0 ? countries : ['Nigeria'],
          needs_review: true,
          type: movie.type || 'movie'
        }).select('id').single();

        if (error) throw error;
        filmId = inserted.id;
        newCount++;
        console.log(`  ✨ Created new African film record.`);
      }

      // 2. Sync Genres & Cast (Only if we have them and it's a valid record)
      if (filmId) {
        if (movie.genres && movie.genres.length > 0) {
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

        if (movie.cast && movie.cast.length > 0) {
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
      }
    } catch (e) {
      console.error(`  ❌ Error processing ${movie.title}:`, e.message);
      errorCount++;
    }
  }

  console.log(`\n📊 Sync Complete:`);
  console.log(`   - Updated: ${updatedCount}`);
  console.log(`   - New: ${newCount}`);
  console.log(`   - Errors: ${errorCount}`);
}

async function run() {
  try {
    const movies = await scrapeNetflix();
    await syncToDatabase(movies);
  } catch (e) {
    console.error('💀 Fatal error:', e);
    process.exit(1);
  }
}

run();
