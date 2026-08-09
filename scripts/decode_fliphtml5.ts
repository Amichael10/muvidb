import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function decodeFlipbookFull() {
  console.log('🚀 Running Playwright browser to extract decoded page texts...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('https://online.fliphtml5.com/ogfbg/abpz/#p=1', { waitUntil: 'load', timeout: 30000 });
    // Wait until LoadingJS completes decoding
    await page.waitForFunction(() => {
      // @ts-ignore
      return window.htmlConfig && (Array.isArray(window.htmlConfig.pages) || window.htmlConfig.fliphtml5_pages);
    }, { timeout: 15000 }).catch(() => {});

    await page.waitForTimeout(5000);

    const result = await page.evaluate(() => {
      // @ts-ignore
      const cfg = window.htmlConfig || {};
      return {
        pages: cfg.pages || null,
        fliphtml5_pages: typeof cfg.fliphtml5_pages,
        pageEditor: cfg.pageEditor || null
      };
    });

    console.log('Decoded pages count:', Array.isArray(result.pages) ? result.pages.length : 'not an array');
    fs.writeFileSync('outputs/yearbook_2025_decoded_result.json', JSON.stringify(result, null, 2));
    console.log('Saved outputs/yearbook_2025_decoded_result.json!');
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

decodeFlipbookFull();
