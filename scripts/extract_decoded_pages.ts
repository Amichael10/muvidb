import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function extractDecodedPages() {
  console.log('🚀 Extracting decoded flipbook pages using Playwright...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('https://online.fliphtml5.com/ogfbg/abpz/#p=1', { waitUntil: 'networkidle', timeout: 60000 });
    console.log('Waiting 8 seconds for flipbook JS decoder...');
    await page.waitForTimeout(8000);

    const pagesData = await page.evaluate(() => {
      // @ts-ignore
      return window.htmlConfig?.pages || window.htmlConfig?.fliphtml5_pages || null;
    });

    console.log('Decoded pages data type:', typeof pagesData);
    if (Array.isArray(pagesData)) {
      console.log(`✅ Extracted ${pagesData.length} decoded pages!`);
      const outputPath = path.join(process.cwd(), 'outputs', 'decoded_2025_pages.json');
      fs.writeFileSync(outputPath, JSON.stringify(pagesData, null, 2));
      console.log(`Saved ${outputPath}`);
    } else {
      console.log('Pages data preview:', String(pagesData).slice(0, 300));
    }
  } catch (err: any) {
    console.error('Extraction error:', err.message);
  } finally {
    await browser.close();
  }
}

extractDecodedPages();
