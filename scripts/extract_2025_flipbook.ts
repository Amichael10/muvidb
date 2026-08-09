import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function extract2025Pages() {
  console.log('🚀 Extracting 2025 Box Office Yearbook pages from FlipHTML5...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 2000 } });

  const outputDir = path.join(process.cwd(), 'outputs', 'yearbook_2025_pages');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    // Pages usually containing rankings: 40 to 90
    const pagesToExtract = [];
    for (let i = 35; i <= 90; i++) {
      pagesToExtract.push(i);
    }

    console.log(`Extracting ${pagesToExtract.length} pages (pages 35-90)...`);

    for (const pNum of pagesToExtract) {
      const pageUrl = `https://online.fliphtml5.com/ogfbg/abpz/#p=${pNum}`;
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(2000);

      // Extract any text content visible in DOM / SVG / Canvas
      const pageText = await page.evaluate(() => {
        const textElems = Array.from(document.querySelectorAll('text, span, div, p'));
        return textElems.map(el => el.textContent?.trim()).filter(Boolean).join(' | ');
      });

      const outJsonPath = path.join(outputDir, `page_${pNum}.json`);
      fs.writeFileSync(outJsonPath, JSON.stringify({ page: pNum, url: pageUrl, domText: pageText }, null, 2));

      const screenshotPath = path.join(outputDir, `page_${pNum}.png`);
      await page.screenshot({ path: screenshotPath });

      console.log(`  ✓ Processed page #${pNum}`);
    }

    console.log('✅ Finished 2025 Yearbook page extraction!');
  } catch (err: any) {
    console.error('Extraction error:', err.message);
  } finally {
    await browser.close();
  }
}

extract2025Pages();
