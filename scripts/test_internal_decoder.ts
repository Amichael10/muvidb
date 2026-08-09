import { chromium } from 'playwright';
import fs from 'fs';

async function testInternalDecoder() {
  console.log('🚀 Inspecting internal Flipbook decoder functions in Playwright...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('https://online.fliphtml5.com/ogfbg/abpz/#p=42', { waitUntil: 'load', timeout: 45000 });
    await page.waitForTimeout(6000);

    const fnInfo = await page.evaluate(() => {
      // Search window for functions matching 'decode', 'page', 'Text', 'parse'
      const winKeys = Object.keys(window).filter(k => /page|text|decode|parse|book/i.test(k));
      return {
        winKeys,
        // @ts-ignore
        hasLoadingJS: typeof LoadingJS !== 'undefined',
        // @ts-ignore
        hasBookViewer: typeof BookViewer !== 'undefined',
      };
    });

    console.log('Function inspection result:', fnInfo);
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

testInternalDecoder();
