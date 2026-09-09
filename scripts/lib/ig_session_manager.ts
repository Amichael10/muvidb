/**
 * Instagram Scout Account Session Manager
 *
 * Runs an interactive headed Playwright session so you can log into
 * your dedicated Instagram outreach / scout account safely.
 * Saves session cookies and storage state to scratch/ig_session.json.
 *
 * Usage:
 *   npm run ig:login
 *   npx tsx scripts/lib/ig_session_manager.ts
 *   npx tsx scripts/lib/ig_session_manager.ts --check
 */
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

// Apply stealth plugin to avoid immediate bot flags
chromium.use(stealthPlugin());

const SESSION_DIR = path.resolve(process.cwd(), 'scratch');
const SESSION_FILE = path.join(SESSION_DIR, 'ig_session.json');

export function getSessionPath(): string {
  return SESSION_FILE;
}

export function isSessionSaved(): boolean {
  if (!fs.existsSync(SESSION_FILE)) return false;
  try {
    const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    const cookies = data.cookies || [];
    const hasSessionId = cookies.some(
      (c: any) => c.name === 'sessionid' && (!c.expires || c.expires * 1000 > Date.now())
    );
    return hasSessionId;
  } catch {
    return false;
  }
}

export async function loginInteractive(): Promise<boolean> {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  console.log('========================================================');
  console.log('📸 MUVIDB INSTAGRAM SCOUT ACCOUNT SETUP');
  console.log('========================================================');
  console.log('Opening browser for login...');
  console.log('Tip: Use a dedicated scout / brand account for outreach.');
  console.log('--------------------------------------------------------');

  const hasExisting = isSessionSaved();
  const launchOptions: any = {
    headless: false,
    slowMo: 50,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  };

  const browser = await chromium.launch(launchOptions);
  const contextOptions: any = {
    viewport: { width: 1280, height: 800 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  };

  if (hasExisting) {
    console.log('Found existing session file, loading state...');
    contextOptions.storageState = SESSION_FILE;
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle' }).catch(() => {});

  // Check if already authenticated
  const cookies = await context.cookies('https://www.instagram.com');
  let hasAuthCookie = cookies.some((c) => c.name === 'sessionid');

  if (hasAuthCookie) {
    console.log('✅ Active session already detected!');
  } else {
    console.log('\n👉 Please log into Instagram in the opened browser window.');
    console.log('👉 Complete 2FA / verification if prompted.');
    console.log('Waiting for successful login (up to 3 minutes)...');

    // Wait until sessionid cookie appears or home page loaded
    const startTime = Date.now();
    const maxWaitMs = 180000; // 3 mins

    while (Date.now() - startTime < maxWaitMs) {
      await page.waitForTimeout(3000);
      const currentCookies = await context.cookies('https://www.instagram.com');
      hasAuthCookie = currentCookies.some((c) => c.name === 'sessionid');

      // Or check if user is on direct or feed
      const currentUrl = page.url();
      if (
        hasAuthCookie ||
        currentUrl.includes('/direct/') ||
        (currentUrl === 'https://www.instagram.com/' && (await page.$('svg[aria-label="Home"], svg[aria-label="Direct"]')))
      ) {
        hasAuthCookie = true;
        break;
      }
    }
  }

  if (hasAuthCookie) {
    console.log('💾 Saving session cookies to scratch/ig_session.json...');
    await page.waitForTimeout(2000);
    await context.storageState({ path: SESSION_FILE });
    console.log('🎉 Instagram session successfully saved!');
    console.log('You can now run automated outreach batches.');
    await browser.close();
    return true;
  } else {
    console.error('❌ Login timed out or was not completed.');
    await browser.close();
    return false;
  }
}

async function main() {
  const isCheckMode = process.argv.includes('--check');
  if (isCheckMode) {
    const saved = isSessionSaved();
    if (saved) {
      console.log(JSON.stringify({ status: 'connected', file: SESSION_FILE }));
    } else {
      console.log(JSON.stringify({ status: 'disconnected', file: SESSION_FILE }));
    }
    return;
  }

  const ok = await loginInteractive();
  process.exit(ok ? 0 : 1);
}

if (process.argv[1] && (process.argv[1].endsWith('ig_session_manager.ts') || process.argv[1].endsWith('ig_session_manager.js'))) {
  main().catch((err) => {
    console.error('Session manager error:', err);
    process.exit(1);
  });
}
