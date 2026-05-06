import { chromium } from 'playwright';
import { generateAIContent } from '../api/_lib/ai_service.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * ScrapeGraph-style AI Extraction Demo
 * This approach uses our AI service (Groq/Gemini/OpenAI) to "understand" 
 * the page instead of writing fragile CSS selectors.
 */
async function scrapeWithAI(url: string) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log(`🚀 Navigating to: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  
  // Wait for the page to render fully
  await page.waitForTimeout(5000);
  
  // Get the entire HTML body
  // In a real ScrapeGraph setup, we'd clean this up to save tokens
  const html = await page.evaluate(() => {
    // Remove scripts and styles to save tokens
    const scripts = document.querySelectorAll('script, style, noscript, iframe, svg');
    scripts.forEach(s => s.remove());
    return document.body.innerText; // Using innerText is cheaper for tokens than innerHTML
  });

  const prompt = `Extract movie metadata from the following text content of a Prime Video page.
URL: ${url}
CONTENT:
${html.substring(0, 10000)} // Limit to first 10k chars for safety

Extract the following in JSON format:
- title
- release_year
- synopsis
- cast (list)
- director (list)
- poster_url (look for image links)
- backdrop_url (look for large image links)

Return ONLY JSON.`;

  console.log('🤖 Sending content to AI for extraction...');
  try {
    const { text, telemetry } = await generateAIContent(prompt);
    console.log(`✅ Extracted via ${telemetry.engine}:`);
    console.log(text);
  } catch (e) {
    console.error('❌ AI Extraction failed:', e.message);
  }

  await browser.close();
}

const target = 'https://www.primevideo.com/detail/0S8V0U8Q7U8R/';
scrapeWithAI(target);
