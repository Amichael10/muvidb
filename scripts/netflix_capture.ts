/**
 * Attach to YOUR real Chrome (already logged into Netflix) and save session state.
 *
 * Why: Playwright-launched Chrome is flagged by Netflix even when headed + no proxy.
 * Your normal browser session does not carry over into that window.
 *
 * Steps (PowerShell):
 *   1. Quit Chrome completely (tray icon too)
 *   2. Start Chrome with remote debugging on your real profile:
 *
 *      $chrome = "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
 *      & $chrome --remote-debugging-port=9222 --profile-directory="Default"
 *
 *   3. In that Chrome window, open netflix.com and confirm you are on Browse
 *   4. Run:
 *
 *      npx tsx scripts/netflix_capture.ts
 *
 *   5. Then sync (still no proxy):
 *
 *      $env:NETFLIX_NO_PROXY="true"; npx tsx scripts/netflix_sync.ts
 *
 * Optional: NETFLIX_CDP=http://127.0.0.1:9222  (default)
 */
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import dotenv from 'dotenv';
import path from 'path';

chromium.use(stealth());
dotenv.config({ path: '.env.local' });
dotenv.config();

const STATE_FILE = path.resolve('netflix_playwright_state.json');
const CDP = (process.env.NETFLIX_CDP || 'http://127.0.0.1:9222').replace(/\/$/, '');

async function captureState() {
  console.log(`Connecting to your Chrome at ${CDP} …`);
  console.log('(If this fails, Chrome is not running with --remote-debugging-port=9222)\n');

  let browser;
  try {
    browser = await chromium.connectOverCDP(CDP);
  } catch (e: any) {
    console.error(`Cannot connect: ${e.message}`);
    console.error(`
Start Chrome like this (close ALL Chrome windows first):

  $chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
  & $chrome --remote-debugging-port=9222 --remote-allow-origins=* https://www.netflix.com/browse

Then sign into https://www.netflix.com/browse, pick a profile, and re-run this script.
`);
    process.exit(1);
  }

  const context = browser.contexts()[0];
  if (!context) {
    console.error('No browser context found on CDP Chrome.');
    process.exit(1);
  }

  let page = context.pages().find((p) => /netflix\.com/i.test(p.url()));
  if (!page) {
    page = context.pages()[0] || (await context.newPage());
    await page.goto('https://www.netflix.com/browse', { waitUntil: 'domcontentloaded', timeout: 60000 });
  }

  const url = page.url();
  console.log(`Active tab: ${url}`);

  if (/\/login/i.test(url)) {
    console.error('That Chrome tab is still on the login page.');
    console.error('Log in normally in THAT window (not a Playwright window), then re-run.');
    process.exit(1);
  }

  if (!/netflix\.com/i.test(url)) {
    console.log('Opening Netflix Browse in your Chrome…');
    await page.goto('https://www.netflix.com/browse', { waitUntil: 'domcontentloaded', timeout: 60000 });
  }

  // Give profile gate a chance if needed
  if (/ProfilesGate|profiles/i.test(page.url())) {
    console.log('Profile gate detected — pick a profile in Chrome, waiting up to 2 minutes…');
    await page.waitForURL((u) => /\/browse/i.test(u.href) && !/ProfilesGate/i.test(u.href), {
      timeout: 120000,
    }).catch(() => null);
  }

  if (/\/login/i.test(page.url())) {
    console.error('Still on login after navigate — aborting without saving.');
    process.exit(1);
  }

  await context.storageState({ path: STATE_FILE });
  console.log(`\nSaved session cookies → ${STATE_FILE}`);
  console.log('You can close the debug Chrome window now.');
  console.log('\nNext:');
  console.log('  $env:NETFLIX_NO_PROXY="true"; npx tsx scripts/netflix_sync.ts');

  // Do not browser.close() — that would quit the user's Chrome
  await browser.close().catch(() => null); // disconnect only for CDP
}

captureState().catch((e) => {
  console.error(e);
  process.exit(1);
});
