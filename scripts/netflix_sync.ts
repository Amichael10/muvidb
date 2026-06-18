import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import { cleanTitle } from '../api/_lib/yt_service.js';
import { generateAIContent } from '../api/_lib/ai_service.js';
import { detectAndNormalizeSeries, normalizeSeriesTitle } from '../api/_lib/series_utils.js';

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

const NETFLIX_URLS = [
  'https://www.netflix.com/browse/genre/1138254?so=su', // Nollywood
  'https://www.netflix.com/browse/genre/3761?so=su', // African Movies & TV
  'https://www.netflix.com/search?q=Nollywood' // General search includes TV shows
];
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
    await page.waitForURL(url => url.includes('/browse') || url.includes('/ProfilesGate') || url.includes('/browse/genre/') || url.includes('/account') || url.includes('/household'), { timeout: 30000 }).catch(() => {
      console.log('⚠️ Navigation timeout after login. Checking for errors...');
    });
    
    // Handle Household Block
    await handleHouseholdBlock(page);

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

async function handleHouseholdBlock(page) {
  try {
    console.log('🛡️ Checking for Household Block...');
    for (let i = 0; i < 6; i++) {
      try {
        const watchTempBtn = await page.$('button:has-text("Watch Temporarily"), [data-uia="watch-temporarily-button"], a:has-text("Watch Temporarily"), :text-is("Watch Temporarily")');
        if (watchTempBtn) {
          console.log('🛡️ Detected Household Block. Clicking "Watch Temporarily"...');
          await watchTempBtn.click({ force: true });
          await page.waitForTimeout(5000);
          await page.screenshot({ path: 'netflix-post-household.png' });
          return;
        }
      } catch (e) {
        // ignore navigation errors during check
      }
      await page.waitForTimeout(2000);
    }
  } catch (e) {
    console.log('ℹ️ Error handling household block:', e.message);
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
  // Use NETFLIX_HEADLESS=false to run in visible mode (useful for manual CAPTCHA solving)
  const headless = process.env.NETFLIX_HEADLESS !== 'false';
  const launchOptions: any = { headless, channel: 'chrome' };

  // Skip proxy if NETFLIX_NO_PROXY=true — the SmartProxy triggers Netflix CAPTCHAs
  const skipProxy = process.env.NETFLIX_NO_PROXY === 'true';

  if (!skipProxy) {
    const proxyServer = process.env.SMARTPROXY_HOST && process.env.SMARTPROXY_PORT 
      ? `${process.env.SMARTPROXY_HOST}:${process.env.SMARTPROXY_PORT}` 
      : null;
    const proxyUser = process.env.SMARTPROXY_USER;
    const proxyPass = process.env.SMARTPROXY_PASS;

    if (proxyServer && proxyUser && proxyPass) {
      console.log(`🛡️ Configuring browser to use SmartProxy: ${proxyServer}`);
      launchOptions.proxy = {
        server: proxyServer,
        username: proxyUser,
        password: proxyPass
      };
    }
  } else {
    console.log('ℹ️ Proxy disabled via NETFLIX_NO_PROXY=true — using direct connection.');
  }

  if (!headless) {
    console.log('👁️ Running in HEADFUL mode — browser window will open. Handle any CAPTCHA manually.');
  }

  const browser = await chromium.launch(launchOptions);
  
  // Use persistent context or storage state if available
  let context;
  if (fs.existsSync(STATE_FILE)) {
    console.log('📄 Loading existing session state...');
    try {
      context = await browser.newContext({
        storageState: STATE_FILE,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
      });
    } catch (err: any) {
      console.error('💀 Fatal error: browser.newContext: Error setting storage state:', err.message);
      console.log('   Removing corrupt state file and trying again...');
      try { fs.unlinkSync(STATE_FILE); } catch (err) {}
      context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 },
      });
    }
  } else {
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
    });
  }

  // Create an anonymous context for fetching clean JSON-LD metadata from public title pages
  const anonContext = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
  });
  
  const page = await context.newPage();
  const anonPage = await anonContext.newPage();
  let movies: any[] = [];
  const globalMovieMap = new Map();

  for (const targetUrl of NETFLIX_URLS) {
    console.log(`\n🚀 Navigating to: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Check if we were redirected to login
    if (page.url().includes('/login')) {
      console.log('ℹ️ Redirected to login. Starting authentication flow...');
      await login(page);
      
      // Save state after login
      await context.storageState({ path: STATE_FILE });
      console.log(`💾 Session state saved to ${STATE_FILE}`);
      
      // After login, go back to the target URL
      console.log(`🚀 Returning to: ${targetUrl}`);
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    } else {
      console.log('✅ Already logged in or no redirect.');
    }

    // Handle profile selection if it appears
    const profileSelected = await handleProfileSelection(page);
    
    // If we selected a profile, save the state again to capture the profile selection cookies
    if (profileSelected) {
      await context.storageState({ path: STATE_FILE });
      console.log(`💾 Session state updated after profile selection.`);
      console.log(`🚀 Returning to target genre page: ${targetUrl}`);
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    }

    console.log('⌛ Waiting for titles to appear...');
    try {
      // Discovery Improvement: Wait for common title card selectors or the main content container
      await page.waitForSelector('.slider-item, .title-card, [data-testid="title-card"], a.slider-refocus, a[href*="/watch/"], a[data-uia="video-canvas"], .rowContainer, .lolomo', { timeout: 60000 });
    } catch (e) {
      console.warn('⚠️ Timeout waiting for titles. Page might be lazy loading or empty.');
      // Sometimes we land on the profile gate again?
      if (page.url().includes('/ProfilesGate') || page.url().includes('/profiles')) {
        await handleProfileSelection(page);
      }
    }

    console.log('📜 Scrolling to load all titles on this page...');
    let lastHeight = await page.evaluate('document.body.scrollHeight');
    let noChangeCount = 0;
    for (let i = 0; i < 25; i++) {
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await page.waitForTimeout(2500);
      let newHeight = await page.evaluate('document.body.scrollHeight');
      
      if (newHeight === lastHeight) {
        // Try scrolling up a bit and back down to trigger lazy loading
        await page.evaluate('window.scrollBy(0, -200)');
        await page.waitForTimeout(1000);
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        await page.waitForTimeout(3000);
        
        newHeight = await page.evaluate('document.body.scrollHeight');
        if (newHeight === lastHeight) {
          noChangeCount++;
          if (noChangeCount >= 2) break; // Break if no change twice
        } else {
          noChangeCount = 0;
        }
      } else {
        noChangeCount = 0;
      }
      lastHeight = newHeight;
    }

    // Extract basic information from the DOM
    const pageMovies = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.lolomoRow, .rowContainer, .slider-item, .galleryLockups'));
      const map = new Map();

      rows.forEach(row => {
        const rowTitle = row.querySelector('.rowTitle, .row-header-title, h2')?.textContent || '';
        
        // Very lenient check for African content row names
        const isAfricanRow = /African|Nigerian|Nollywood|South African|Ghanaian|Kenya|Senegal|Egypt|Ethiopia|Cameroon|Morocco|Lagos|Yoruba|Hausa|Igbo|Accra|Nairobi|Dakar|Johannesburg|Soil|Culture|Heritage/i.test(rowTitle);
        const isAlgorithmicRow = /Top Picks|Next Watch|New on Netflix|My List|Trending|Popular|Favorites/i.test(rowTitle) && !isAfricanRow;
        
        // If we are on a specific African genre page, we can be more lenient and take everything.
        const isOnGenrePage = window.location.href.includes('1138254') || window.location.href.includes('3761');

        if (isAlgorithmicRow && !isOnGenrePage) return;
        if (!isAfricanRow && !isOnGenrePage && !window.location.href.includes('search')) return;

        const links = Array.from(row.querySelectorAll('a[href*="/title/"], a[href*="/watch/"], a.slider-refocus, a[data-uia="video-canvas"], a.slider-item-link'));
        
        links.forEach(linkEl => {
          const href = linkEl.getAttribute('href') || '';
          const idMatch = href.match(/\/(watch|title)\/(\d+)/);
          
          if (!idMatch) return;
          
          const watchId = idMatch[2];
          
          if (map.has(watchId)) return;

          let titleText = linkEl.getAttribute('aria-label') || 
                          linkEl.querySelector('img')?.getAttribute('alt') || 
                          linkEl.querySelector('.fallback-text')?.textContent?.trim() ||
                          linkEl.textContent?.trim();

          if (titleText) {
             titleText = titleText.replace(/^(Watch|Go to|Play|View)\s+/i, '').trim();
          }

          if (titleText && titleText !== 'Unknown' && titleText.length > 1) {
            map.set(watchId, {
              title: titleText,
              netflix_id: watchId,
              url: `https://www.netflix.com/title/${watchId}`,
              watch_url: `https://www.netflix.com/watch/${watchId}`,
              poster_url: linkEl.querySelector('img')?.src || null,
              isAfricanDiscovery: isAfricanRow || window.location.href.includes('search')
            });
          }
        });
      });

      return Array.from(map.values());
    });

    console.log(`🎬 Found ${pageMovies.length} titles on ${targetUrl}`);
    pageMovies.forEach(m => {
      if (!globalMovieMap.has(m.netflix_id)) {
        globalMovieMap.set(m.netflix_id, m);
      }
    });
  }

  movies = Array.from(globalMovieMap.values());

  if (movies.length === 0) {
    console.log('📸 Saving debug screenshot...');
    await page.screenshot({ path: 'netflix-debug.png', fullPage: true });
    console.log('⚠️ No titles found across all pages. Try checking netflix-debug.png to see what Netflix is serving.');
  } else {
    console.log(`🎬 Found ${movies.length} UNIQUE titles across all Netflix pages.`);
  }
  
  const detailedMovies: any[] = [];
  for (const movie of movies) {
    if (!movie.url) continue;
    console.log(`📄 Fetching details for: ${movie.title} (${movie.url})`);
    try {
      // Use the anonymous page for metadata extraction so we get the public SEO page (with JSON-LD)
      await anonPage.goto(movie.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Wait for core content
      await anonPage.waitForSelector('.about-container, [data-uia="about-container"], .title-info-metadata-wrapper, script[type="application/ld+json"]', { timeout: 20000 }).catch(() => {
        console.log('  ⚠️ Metadata container not found, proceeding with fallback...');
      });
      
      // Extra wait for async content
      await anonPage.waitForTimeout(4000);
      
      const rawData: any = await anonPage.evaluate(() => {
        const videoId = window.location.href.match(/\/title\/(\d+)/)?.[1];
        const cache = (window as any).netflix?.falcorCache || {};
        const videoData = videoId ? (cache.videos?.[videoId] || {}) : {};
        
        // 1. Direct DOM Selectors (Metadata)
        let synopsis = document.querySelector('[data-uia="video-metadata--synopsis"], [data-uia="video-description"], .description-text')?.textContent?.trim() || '';
        let releaseYear = document.querySelector('.item-year, [data-uia="item-year"]')?.textContent?.trim() || '';
        let duration = document.querySelector('.item-runtime, [data-uia="item-runtime"]')?.textContent?.trim() || '';
        let maturityRating = document.querySelector('.item-maturity, .maturity-rating, [data-uia="item-maturity"]')?.textContent?.trim() || '';
        
        // 2. JSON-LD Schema (Most robust for cast/crew)
        let cast: string[] = [];
        let directors: string[] = [];
        let writers: string[] = [];
        
        const schemaScript = document.querySelector('script[type="application/ld+json"]');
        if (schemaScript && schemaScript.textContent) {
           try {
              const schema = JSON.parse(schemaScript.textContent);
              if (schema.actors) cast = (Array.isArray(schema.actors) ? schema.actors : [schema.actors]).map((a: any) => a.name).filter(Boolean);
              else if (schema.actor) cast = (Array.isArray(schema.actor) ? schema.actor : [schema.actor]).map((a: any) => a.name).filter(Boolean);
              
              if (schema.directors) directors = (Array.isArray(schema.directors) ? schema.directors : [schema.directors]).map((d: any) => d.name).filter(Boolean);
              else if (schema.director) directors = (Array.isArray(schema.director) ? schema.director : [schema.director]).map((d: any) => d.name).filter(Boolean);
              
              if (schema.creators) writers = (Array.isArray(schema.creators) ? schema.creators : [schema.creators]).map((c: any) => c.name).filter(Boolean);
              else if (schema.creator) writers = (Array.isArray(schema.creator) ? schema.creator : [schema.creator]).map((c: any) => c.name).filter(Boolean);
           } catch(e) {}
        }

        // 2. Direct DOM Selectors (Legacy)
        if (cast.length === 0) {
           cast = Array.from(document.querySelectorAll('.cast-list .cast-item, [data-uia="info-starring"] .item-content'))
                           .map(el => el.textContent?.trim().split(',')).flat().map(s => s?.trim()).filter(Boolean);
        }
        if (directors.length === 0) {
           directors = Array.from(document.querySelectorAll('.director-list .director-item, [data-uia="info-creators"] .item-content'))
                                .map(el => el.textContent?.trim().split(',')).flat().map(s => s?.trim()).filter(Boolean);
        }
        if (writers.length === 0) {
           writers = Array.from(document.querySelectorAll('.writer-list .writer-item, [data-uia="info-writers"] .item-content'))
                                .map(el => el.textContent?.trim().split(',')).flat().map(s => s?.trim()).filter(Boolean);
        }
        
        let genres = Array.from(document.querySelectorAll('.genre-list .genre-item, [data-uia="info-genres"] .item-content'))
                          .map(el => el.textContent?.trim().split(',')).flat().map(s => s?.trim()).filter(Boolean);
        
        // 3. Label-based fallbacks
        const allLabels = Array.from(document.querySelectorAll('.label, .item-label, .about-item-label, [data-uia$="-label"]'));
        
        // 4. Raw Text fallback (for obfuscated classes)
        if (cast.length === 0) {
           const bodyText = document.body.innerText;
           const starringMatch = bodyText.match(/Starring:\s*([^\n]+)/i);
           if (starringMatch) cast = starringMatch[1].split(',').map(s => s.trim()).filter(Boolean);
        }

        if (cast.length === 0) {
           for(let i = 0; i < allLabels.length; i++) {
              if (allLabels[i].textContent?.toLowerCase().includes('cast')) {
                 const container = allLabels[i].closest('.about-item, .more-details-item, .item-container, .previewModal--about');
                 const contentEl = container?.querySelector('.content, .about-item-content, .item-text, [data-uia$="-content"]');
                 if (contentEl) { cast = contentEl.textContent?.split(',').map(s => s.trim()).filter(Boolean) || []; break; }
                 if (allLabels[i].nextElementSibling) { cast = allLabels[i].nextElementSibling.textContent?.split(',').map(s => s.trim()).filter(Boolean) || []; break; }
              }
           }
        }
        if (directors.length === 0) {
           for(let i = 0; i < allLabels.length; i++) {
              if (allLabels[i].textContent?.toLowerCase().includes('director')) {
                 const container = allLabels[i].closest('.about-item, .more-details-item, .item-container, .previewModal--about');
                 const contentEl = container?.querySelector('.content, .about-item-content, .item-text, [data-uia$="-content"]');
                 if (contentEl) { directors = contentEl.textContent?.split(',').map(s => s.trim()).filter(Boolean) || []; break; }
                 if (allLabels[i].nextElementSibling) { directors = allLabels[i].nextElementSibling.textContent?.split(',').map(s => s.trim()).filter(Boolean) || []; break; }
              }
           }
        }
        if (writers.length === 0) {
           for(let i = 0; i < allLabels.length; i++) {
              if (allLabels[i].textContent?.toLowerCase().includes('writer') || allLabels[i].textContent?.toLowerCase().includes('creator')) {
                 const container = allLabels[i].closest('.about-item, .more-details-item, .item-container, .previewModal--about');
                 const contentEl = container?.querySelector('.content, .about-item-content, .item-text, [data-uia$="-content"]');
                 if (contentEl) { writers = contentEl.textContent?.split(',').map(s => s.trim()).filter(Boolean) || []; break; }
                 if (allLabels[i].nextElementSibling) { writers = allLabels[i].nextElementSibling.textContent?.split(',').map(s => s.trim()).filter(Boolean) || []; break; }
              }
           }
        }
        if (genres.length === 0) {
           for(let i = 0; i < allLabels.length; i++) {
              if (allLabels[i].textContent?.toLowerCase().includes('genre')) {
                 const container = allLabels[i].closest('.about-item, .more-details-item, .item-container, .previewModal--about');
                 const contentEl = container?.querySelector('.content, .about-item-content, .item-text, [data-uia$="-content"]');
                 if (contentEl) { genres = contentEl.textContent?.split(',').map(s => s.trim()).filter(Boolean) || []; break; }
                 if (allLabels[i].nextElementSibling) { genres = allLabels[i].nextElementSibling.textContent?.split(',').map(s => s.trim()).filter(Boolean) || []; break; }
              }
           }
        }

        // 5. Falcor Cache Fallback (Targeted to THIS video) - Much more robust
        if (videoData) {
          if (!synopsis) synopsis = videoData.synopsis?.value || videoData.synopsis || '';
          
          // Try to extract cast and crew from cache if DOM failed
          if (cast.length === 0 && videoData.cast) {
            const cacheCast = videoData.cast.value || videoData.cast;
            if (Array.isArray(cacheCast)) {
              cast = cacheCast.map(c => c.name || c).filter(Boolean);
            }
          }
          if (directors.length === 0 && videoData.directors) {
            const cacheDirectors = videoData.directors.value || videoData.directors;
            if (Array.isArray(cacheDirectors)) directors = cacheDirectors.map(c => c.name || c).filter(Boolean);
          }
          if (writers.length === 0 && videoData.writers) {
            const cacheWriters = videoData.writers.value || videoData.writers;
            if (Array.isArray(cacheWriters)) writers = cacheWriters.map(c => c.name || c).filter(Boolean);
          }
          if (writers.length === 0 && videoData.creators) {
            const cacheCreators = videoData.creators.value || videoData.creators;
            if (Array.isArray(cacheCreators)) writers = cacheCreators.map(c => c.name || c).filter(Boolean);
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
        
        // ── Series Detection ──────────────────────────────────────────────
        const titleText = (detailTitleEl?.textContent || '').toLowerCase();
        const synopsisText = (synopsis || '').toLowerCase();
        const durationText = (runtimeEl?.textContent || '').toLowerCase();
        
        const seriesRegex = /\b(ep|episode|vol|volume|part|pt|season|series|anthology)\b\s*\d*|seasons|episodes/i;
        const hasSeriesKeywords = seriesRegex.test(titleText) || 
                                 seriesRegex.test(durationText) ||
                                 seriesRegex.test(synopsisText);
        
        const hasSeriesSelectors = !!document.querySelector(
          '.duration-badge, [data-uia="duration-badge"], .season-count, ' +
          '[data-uia="season-selector"], .episode-list, [data-uia="episode-list"], ' +
          '.series-title, [data-uia="episodes-container"]'
        );
        
        const isSeries = hasSeriesSelectors || hasSeriesKeywords ||
          !!(videoData.numberSeasonsLabel?.value || videoData.numberOfSeasons?.value);

        // ── Season / Episode Counts ───────────────────────────────────────
        let seasonCount: number | null = null;
        let episodeCount: number | null = null;

        if (isSeries) {
          // 1. From falcorCache
          const cacheSeasons = videoData.numberOfSeasons?.value || videoData.numberSeasonsLabel?.value;
          const cacheEpisodes = videoData.episodeCount?.value || videoData.numberOfEpisodes?.value;
          if (cacheSeasons) seasonCount = parseInt(String(cacheSeasons).match(/\d+/)?.[0] || '0') || null;
          if (cacheEpisodes) episodeCount = parseInt(String(cacheEpisodes).match(/\d+/)?.[0] || '0') || null;

          // 2. From DOM season selector (dropdown options = number of seasons)
          if (!seasonCount) {
            const seasonOptions = document.querySelectorAll('[data-uia="season-selector"] option, select.season-selector option');
            if (seasonOptions.length > 0) seasonCount = seasonOptions.length;
          }

          // 3. From a "X Seasons" text pattern
          if (!seasonCount) {
            const allText = document.body.innerText;
            const seasonsMatch = allText.match(/(\d+)\s+seasons?/i);
            if (seasonsMatch) seasonCount = parseInt(seasonsMatch[1]);
          }

          // 4. From episode list items
          if (!episodeCount) {
            const epItems = document.querySelectorAll('[data-uia="episode-item"], .episode-item, .episodeCard');
            if (epItems.length > 0) episodeCount = epItems.length;
          }
        }

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
          isSeries,
          seasonCount,
          episodeCount
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

      const detailedMovie = { 
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
      };
      
      console.log(`    ↳ Extracted: Cast (${detailedMovie.cast?.length || 0}), Directors (${detailedMovie.directors?.length || 0}), Writers (${detailedMovie.writers?.length || 0})`);
      if (detailedMovie.cast?.length === 0) {
        console.log(`    ↳ ⚠️ Failed to extract cast from DOM or cache!`);
      }
      
      detailedMovies.push(detailedMovie);
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
    // Use raw series detection from scrape OR from title
    const isSeries = movie.isSeries || movie.type === 'series';
    const { isSeries: titleIsSeries, baseTitle, episodeNum, seasonNum } = detectAndNormalizeSeries(movie.title);
    const isSeriesFinal = isSeries || titleIsSeries;
    // Normalize: strip "Blood Sisters: Season 2" → "Blood Sisters"
    const normalizedTitle = isSeriesFinal ? normalizeSeriesTitle(baseTitle) : baseTitle;
    const cleanedTitle = cleanTitle(normalizedTitle);
    const contentType = isSeriesFinal ? 'series' : 'movie';
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
            netflix_watch: movie.watch_url || currentLinks.netflix_watch,
            // First-seen-on-Netflix timestamp. Preserve it once set so the
            // "New on Netflix" rail can surface freshly discovered catalog titles
            // even when the film row itself (created_at) is old.
            netflix_added_at: currentLinks.netflix_added_at || new Date().toISOString()
          },
          synopsis: existing.synopsis || movie.synopsis,
          runtime_minutes: existing.runtime_minutes || movie.runtime_minutes,
          poster_url: existing.poster_url || movie.poster_url,
          backdrop_url: existing.backdrop_url || movie.poster_url,
          // Always update series metadata
          content_type: contentType,
          ...(movie.seasonCount != null && { season_count: movie.seasonCount }),
          ...(movie.episodeCount != null && { episode_count: movie.episodeCount }),
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
        console.log(`  🆙 Updated existing film record (${contentType}, ${movie.seasonCount ?? '?'} seasons).`);

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
          // Series: no runtime — movies get it if available
          runtime_minutes: contentType === 'movie' ? movie.runtime_minutes : null,
          poster_url: movie.poster_url,
          backdrop_url: movie.poster_url,
          release_type: 'netflix',
          streaming_links: {
            netflix: movie.url,
            netflix_watch: movie.watch_url,
            netflix_added_at: new Date().toISOString()
          },
          source: 'netflix',
          status: 'released',
          countries: countries.length > 0 ? countries : ['Nigeria'],
          needs_review: true,
          content_type: contentType,
          season_count: movie.seasonCount || null,
          episode_count: movie.episodeCount || null,
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

        if (movie.directors && movie.directors.length > 0) {
          for (const directorName of movie.directors) {
            const personId = await upsertPerson(directorName);
            if (personId) {
              await supabase.from('credits').upsert({
                film_id: filmId,
                person_id: personId,
                role: 'director'
              }, { onConflict: 'film_id,person_id,role' });
            }
          }
        }

        if (movie.writers && movie.writers.length > 0) {
          for (const writerName of movie.writers) {
            const personId = await upsertPerson(writerName);
            if (personId) {
              await supabase.from('credits').upsert({
                film_id: filmId,
                person_id: personId,
                role: 'writer'
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
