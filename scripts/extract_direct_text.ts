import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function extractFlipbookTextDirect() {
  console.log('🚀 Extracting text directly from FlipHTML5 DOM elements...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const results: Record<string, string> = {};

  try {
    // Navigate to flipbook
    await page.goto('https://online.fliphtml5.com/ogfbg/abpz/#p=42', { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(5000);

    const targetPages = [40, 41, 42, 43, 80, 81, 82, 83, 84];

    for (const p of targetPages) {
      console.log(`Flipping to page #${p}...`);
      await page.goto(`https://online.fliphtml5.com/ogfbg/abpz/#p=${p}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(3000);

      const pageText = await page.evaluate(() => {
        // Collect text from divs, spans, p, tspan, svg text
        const nodes = Array.from(document.querySelectorAll('.page-content, .page, svg text, span, div.text, div'));
        const texts = nodes.map(n => n.textContent?.trim()).filter(t => t && t.length > 3 && !t.includes('Fullscreen') && !t.includes('Search'));
        return Array.from(new Set(texts)).join('\n');
      });

      console.log(`Page #${p} text count: ${pageText.length} chars`);
      results[`page_${p}`] = pageText;
    }

    const outPath = path.join(process.cwd(), 'outputs', 'yearbook_2025_direct_text.json');
    fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
    console.log(`✅ Saved text results to ${outPath}`);
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

extractFlipbookTextDirect();
