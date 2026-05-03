import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

const stealthPlugin = stealth();
chromium.use(stealthPlugin);

async function probeFilmhouse() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('🌍 Probing Filmhouse Home...');
  try {
    await page.goto('https://filmhouseng.com/', { waitUntil: 'networkidle', timeout: 60000 });
    
    // Wait for content
    await page.waitForTimeout(5000);
    
    const data = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const locationEl = allElements.find(el => el.textContent.includes('Lekki') || el.textContent.includes('Samonda') || el.className.includes('location'));
      
      return {
        locationSelector: locationEl ? {
          tag: locationEl.tagName,
          class: locationEl.className,
          text: locationEl.textContent.trim()
        } : null,
        possibleMovieTitles: Array.from(document.querySelectorAll('h1, h2, h3'))
          .map(h => h.textContent.trim())
          .filter(t => t.length > 1 && t.length < 50),
        allClasses: Array.from(new Set(allElements.map(el => el.className))).filter(c => c.length > 0).slice(0, 50)
      };
    });
    
    console.log('Probe Data:', JSON.stringify(data, null, 2));
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await browser.close();
  }
}

probeFilmhouse();
