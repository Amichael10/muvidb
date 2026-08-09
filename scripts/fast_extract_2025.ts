import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function fastExtract2025() {
  console.log('🚀 Fast extracting 2025 Box Office Yearbook text...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Navigate with domcontentloaded
    await page.goto('https://online.fliphtml5.com/ogfbg/abpz/#p=1', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);

    const pagesData = await page.evaluate(() => {
      // @ts-ignore
      if (window.htmlConfig) {
        // @ts-ignore
        return window.htmlConfig;
      }
      return null;
    });

    if (pagesData) {
      console.log('✅ Captured window.htmlConfig!');
      console.log('Meta:', pagesData.meta);
      fs.writeFileSync('outputs/yearbook_2025_htmlconfig_dump.json', JSON.stringify(pagesData, null, 2));
      console.log('Saved outputs/yearbook_2025_htmlconfig_dump.json!');
    }
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

fastExtract2025();
