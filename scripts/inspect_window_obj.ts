import { chromium } from 'playwright';
import fs from 'fs';

async function inspectWindowObj() {
  console.log('Connecting Playwright to FlipHTML5 page...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('https://online.fliphtml5.com/ogfbg/abpz/#p=1', { waitUntil: 'load', timeout: 45000 });
    await page.waitForTimeout(6000);

    const keys = await page.evaluate(() => {
      const result: any = {};
      // @ts-ignore
      if (window.htmlConfig) {
        // @ts-ignore
        result.htmlConfigKeys = Object.keys(window.htmlConfig);
        // @ts-ignore
        result.pagesType = typeof window.htmlConfig.pages;
        // @ts-ignore
        if (Array.isArray(window.htmlConfig.pages)) {
          // @ts-ignore
          result.pagesLength = window.htmlConfig.pages.length;
          // @ts-ignore
          result.samplePage = window.htmlConfig.pages[0];
        }
      }
      return result;
    });

    console.log('Window evaluation result:', JSON.stringify(keys, null, 2));
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

inspectWindowObj();
