import { chromium } from 'playwright';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen to network requests/responses
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/api/') || url.includes('graphql') || url.includes('.json')) {
      console.log(`[API Response] ${response.status()} ${url}`);
      try {
        const text = await response.text();
        console.log(`  Preview: ${text.slice(0, 300)}`);
      } catch (e) {}
    }
  });

  console.log("Navigating to movie detail page...");
  const targetUrl = process.env.FEED_ZETA_TEST_URL || 'https://web.docuth.com/movies/last-call-ipe-ikeyin-2';
  await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 60000 });

  console.log("Extracting details via DOM evaluation...");
  const pageData = await page.evaluate(() => {
    // Let's grab all text on the page or specific selectors
    const html = document.body.innerHTML;
    const text = document.body.innerText;
    return { html, text };
  });

  console.log("Page innerText length:", pageData.text.length);
  console.log("Page innerText sample:\n", pageData.text.slice(0, 1000));
  
  await browser.close();
}

run().catch(console.error);
