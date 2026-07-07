import { chromium } from 'playwright';

async function run() {
  console.log('Launching browser to sniff kavaapi...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('request', request => {
    const url = request.url();
    if (url.includes('muvi.com') || url.includes('kava')) {
      console.log(`[REQ] ${request.method()} ${url}`);
      const headers = request.headers();
      if (url.includes('kavaapi.muvi.com')) {
        console.log('Headers:', JSON.stringify(headers, null, 2));
        const postData = request.postData();
        if (postData) console.log('PostData:', postData);
      }
    }
  });

  page.on('response', async response => {
    const url = response.url();
    if (url.includes('kavaapi.muvi.com')) {
      console.log(`[RES] ${response.status()} ${url}`);
      try {
        const text = await response.text();
        console.log('Response excerpt:', text.slice(0, 1000));
      } catch (e) {
        console.warn('Could not read response text');
      }
    }
  });

  try {
    await page.goto('https://kava.tv/', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(5000);
  } catch (e) {
    console.error(e);
  } finally {
    await browser.close();
  }
}

run();
