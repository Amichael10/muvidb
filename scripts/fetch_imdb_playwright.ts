import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function main() {
  console.log('🚀 Scraping IMDb nm18080070...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
  });

  const page = await context.newPage();
  const imdbUrl = 'https://www.imdb.com/name/nm18080070/';
  
  try {
    const res = await page.goto(imdbUrl, { waitUntil: 'load', timeout: 45000 });
    console.log('HTTP Status:', res?.status());

    await page.waitForTimeout(2000);
    const title = await page.title();
    console.log('📄 IMDb Page Title:', title);

    const jsonLd = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      return scripts.map(s => {
        try { return JSON.parse(s.textContent || '{}'); } catch(e) { return null; }
      }).filter(Boolean);
    });

    console.log('📌 JSON-LD Data:', JSON.stringify(jsonLd, null, 2));

    const pageText = await page.evaluate(() => document.body.innerText);
    console.log('\n--- BODY TEXT SAMPLE ---');
    console.log(pageText.substring(0, 2000));

  } catch (err) {
    console.error('❌ Scrape Error:', err);
  }

  // Check DB
  const { data: laura } = await supabase.from('people').select('*').eq('id', '6ee6425f-9e69-4db3-91f1-db31d4ee4389').single();
  console.log('\n👤 Laura Lambo DB Record:', JSON.stringify(laura, null, 2));

  await browser.close();
}

main().catch(console.error);
