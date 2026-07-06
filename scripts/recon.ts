// Site reconnaissance for new scraping sources. Replaces the one-off
// sniff_*/intercept_*/dump_*/screenshot_* scripts — do not create new ones.
//
// Usage:
//   npm run recon -- <url> [options]
//   npx tsx scripts/recon.ts <url> [options]
//
// Options:
//   --stealth       Use playwright-extra + stealth plugin (for bot-protected sites)
//   --headed        Show the browser window
//   --wait <ms>     Extra wait after networkidle (default: 5000)
//   --filter <str>  Only capture response bodies whose URL contains <str>
//
// Output goes to scratch/recon/<host>/<timestamp>/:
//   page.html        final rendered DOM
//   screenshot.png   full-page screenshot
//   next_data.json   __NEXT_DATA__ payload, if the site is Next.js
//   network.json     every request: method, url, status, type, contentType
//   responses/       bodies of JSON responses (numbered, indexed in network.json)
//   summary.txt      candidate API endpoints ranked by response size
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));
if (!url) {
  console.error('Usage: npm run recon -- <url> [--stealth] [--headed] [--wait ms] [--filter str]');
  process.exit(1);
}
const useStealth = args.includes('--stealth');
const headed = args.includes('--headed');
const wait = parseInt(args[args.indexOf('--wait') + 1] || '', 10) || 5000;
const filter = args.includes('--filter') ? args[args.indexOf('--filter') + 1] : undefined;

async function getChromium() {
  if (useStealth) {
    const { chromium } = await import('playwright-extra');
    const stealth = (await import('puppeteer-extra-plugin-stealth')).default;
    chromium.use(stealth());
    return chromium;
  }
  return (await import('playwright')).chromium;
}

type NetEntry = {
  method: string;
  url: string;
  status?: number;
  type: string;
  contentType?: string;
  bodyFile?: string;
  bodyBytes?: number;
  postData?: string;
  requestHeaders?: Record<string, string>;
};

async function run() {
  const host = new URL(url!).hostname.replace(/^www\./, '');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outDir = path.join('scratch', 'recon', host, stamp);
  const resDir = path.join(outDir, 'responses');
  fs.mkdirSync(resDir, { recursive: true });

  const chromium = await getChromium();
  const browser = await chromium.launch({ headless: !headed });
  const page = await browser.newPage();

  const entries: NetEntry[] = [];
  let bodyCount = 0;

  page.on('response', async (response: any) => {
    const req = response.request();
    const entry: NetEntry = {
      method: req.method(),
      url: response.url(),
      status: response.status(),
      type: req.resourceType(),
      contentType: (response.headers()['content-type'] || '').split(';')[0],
      postData: req.postData() || undefined,
    };
    entries.push(entry);

    const isJson = (entry.contentType || '').includes('json');
    const isDataCall = ['xhr', 'fetch'].includes(entry.type) || isJson;
    if (['xhr', 'fetch'].includes(entry.type)) {
      // auth headers matter for replaying hidden APIs
      entry.requestHeaders = req.headers();
    }
    const passesFilter = !filter || entry.url.includes(filter);
    if (isDataCall && isJson && passesFilter && entry.status === 200) {
      try {
        const body = await response.text();
        entry.bodyBytes = body.length;
        if (body.length > 2) {
          const file = `${String(++bodyCount).padStart(3, '0')}.json`;
          fs.writeFileSync(path.join(resDir, file), body);
          entry.bodyFile = `responses/${file}`;
        }
      } catch {
        /* response body already gone */
      }
    }
  });

  console.log(`Recon: ${url}${useStealth ? ' (stealth)' : ''} -> ${outDir}`);
  try {
    await page.goto(url!, { waitUntil: 'networkidle', timeout: 60000 });
  } catch (e: any) {
    console.warn(`goto: ${e.message} (continuing with whatever loaded)`);
  }
  await page.waitForTimeout(wait);
  // trigger lazy-loaded content
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);

  fs.writeFileSync(path.join(outDir, 'page.html'), await page.content());
  await page.screenshot({ path: path.join(outDir, 'screenshot.png'), fullPage: true });

  const nextData = await page
    .evaluate(() => document.getElementById('__NEXT_DATA__')?.textContent || null)
    .catch(() => null);
  if (nextData) fs.writeFileSync(path.join(outDir, 'next_data.json'), nextData);

  await browser.close();

  fs.writeFileSync(path.join(outDir, 'network.json'), JSON.stringify(entries, null, 2));

  const candidates = entries
    .filter((e) => e.bodyFile)
    .sort((a, b) => (b.bodyBytes || 0) - (a.bodyBytes || 0));
  const summary = [
    `url: ${url}`,
    `requests: ${entries.length}, json bodies captured: ${candidates.length}`,
    nextData ? 'Next.js site: see next_data.json' : 'no __NEXT_DATA__',
    '',
    'candidate API endpoints (largest JSON first):',
    ...candidates
      .slice(0, 25)
      .map((e) => `  ${e.bodyFile}  ${e.bodyBytes} bytes  ${e.method} ${e.url}`),
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'summary.txt'), summary);

  console.log('\n' + summary);
  console.log(`\nDone. Everything saved in ${outDir}`);
}

run();
