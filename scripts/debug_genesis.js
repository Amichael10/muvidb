import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import dotenv from 'dotenv';
import fs from 'fs';

const stealthPlugin = stealth();
chromium.use(stealthPlugin);

dotenv.config();

async function debugGenesis() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🌍 Debugging Genesis Maryland...');
  try {
    await page.goto('https://genesiscinemas.com/maryland-mall-maryland/', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(5000); // Wait for extra JS
    const content = await page.content();
    fs.writeFileSync('genesis_debug.html', content);
    console.log('✅ Saved content to genesis_debug.html');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await browser.close();
  }
}

debugGenesis();
