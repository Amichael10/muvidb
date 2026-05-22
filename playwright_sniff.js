import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

chromium.use(stealth());

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  console.log('Navigating...');
  await page.goto('https://filmhouseng.com/', { waitUntil: 'networkidle', timeout: 30000 });
  const html = await page.content();
  fs.writeFileSync('playwright_stealth_dump.html', html);
  console.log('Saved playwright_stealth_dump.html');
  await browser.close();
}
run().catch(console.error);
