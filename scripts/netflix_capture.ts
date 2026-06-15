import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import dotenv from 'dotenv';

const stealthPlugin = stealth();
chromium.use(stealthPlugin);
dotenv.config();

const STATE_FILE = 'netflix_playwright_state.json';
const LOGIN_URL = 'https://www.netflix.com/login';

async function captureState() {
  const launchOptions: any = { headless: false };
  
  const proxyServer = process.env.SMARTPROXY_HOST && process.env.SMARTPROXY_PORT 
    ? `${process.env.SMARTPROXY_HOST}:${process.env.SMARTPROXY_PORT}` 
    : null;
  let proxyUser = process.env.SMARTPROXY_USER;
  const proxyPass = process.env.SMARTPROXY_PASS;

  if (proxyServer && proxyUser && proxyPass) {
    if (!proxyUser.includes('-session-')) {
        proxyUser = `${proxyUser}-session-netflixsync`;
    }
    console.log(`🛡️ Configuring browser to use SmartProxy: ${proxyServer} with user ${proxyUser}`);
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
  const email = process.env.NETFLIX_EMAIL;
  const password = process.env.NETFLIX_PASSWORD;

  console.log(`🚀 Navigating to Netflix Login...`);
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

  if (email && password) {
    console.log('📧 Entering email...');
    const emailInput = await page.waitForSelector('input[name="userLoginId"], input[name="email"], input[type="email"]', { timeout: 15000 }).catch(() => null);
    if (emailInput) {
      await emailInput.fill(email);
      await page.waitForTimeout(1000);
      const continueBtn = await page.$('button[type="submit"], button[data-uia="nmhp-card-cta-continue"], .btn-red, button[data-uia="login-submit-button"]');
      if (continueBtn) {
          await continueBtn.click();
          await page.waitForTimeout(2000);
      }
    }

    console.log('🔑 Entering password...');
    const pwInput = await page.waitForSelector('input[name="password"]', { timeout: 15000 }).catch(() => null);
    if (pwInput) {
      await pwInput.fill(password);
      await page.waitForTimeout(1000);
      const submitBtn = await page.waitForSelector('button[type="submit"], button[data-uia="login-submit-button"], .login-button', { timeout: 10000 });
      await submitBtn.click();
    }
  }

  console.log('\n\n🚨 🚨 🚨 ATTENTION 🚨 🚨 🚨');
  console.log('The script has logged in. If you see the "Household" screen, manually click "Watch Temporarily".');
  console.log('Waiting 2 minutes for you to resolve any blocks...');
  
  // Wait for 2 minutes for the user to manually click watch temporarily
  await page.waitForTimeout(120000);

  // Save state after the user has logged in
  await context.storageState({ path: STATE_FILE });
  console.log(`\n✅ Login state saved successfully to ${STATE_FILE}!`);
  
  await browser.close();
}

captureState();
