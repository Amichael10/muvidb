import { chromium } from 'playwright';

async function run() {
  console.log('Launching browser for discovery...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const startUrls = [
    'https://kava.tv/',
    'https://kava.tv/category/video',
    'https://kava.tv/category/series',
    'https://kava.tv/category/crime-action',
    'https://kava.tv/category/coming-soon'
  ];

  const discoveredUrls = new Set<string>();

  for (const url of startUrls) {
    console.log(`🌐 Scraping: ${url}`);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      
      // Scroll multiple times to lazy load
      let lastHeight = await page.evaluate('document.body.scrollHeight');
      for (let i = 0; i < 15; i++) {
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        await page.waitForTimeout(1500);
        const newHeight = await page.evaluate('document.body.scrollHeight');
        if (newHeight === lastHeight) break;
        lastHeight = newHeight;
      }

      // Extract all content links
      const links = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href*="/content/"]'));
        return anchors.map(a => (a as HTMLAnchorElement).href.split('?')[0]);
      });

      links.forEach(l => discoveredUrls.add(l));
      console.log(`  Found ${links.length} content links. Total unique: ${discoveredUrls.size}`);
    } catch (e: any) {
      console.error(`  Error scraping ${url}:`, e.message);
    }
  }

  const list = Array.from(discoveredUrls);
  console.log('\n🏁 Total Unique Discovered Content URLs:', list.length);
  console.log(JSON.stringify(list, null, 2));

  await browser.close();
}

run();
