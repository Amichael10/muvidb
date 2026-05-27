/**
 * Local Stealth + Gemini adapter — drop-in replacement for the exhausted/deprecated
 * Firecrawl API fallback.
 *
 * Uses local Playwright-Stealth to bypass anti-bot walls (like Cloudflare Turnstile)
 * and fetch webpage text for $0. Then sends it to Gemini Flash via your existing
 * rotation pipeline to extract structured showtime schedules.
 *
 * cinemas.scrape_config must include:
 *   { "url": "https://genesiscinemas.com.ng/movies" }
 *
 * Optional overrides:
 *   { "ticketBaseUrl": "https://genesiscinemas.com.ng/book" }
 */

import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { generateAIContent, parseJSON } from '../ai_service.js';
import type { AdapterResult, CinemaAdapter, CinemaRow, ScrapedShowtime } from './types.js';
import { inferFormat, todayLagos } from './types.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Activate the stealth plugin locally
const stealthPlugin = stealth();
chromium.use(stealthPlugin);

/** The shape we ask Gemini to extract from each page. */
interface ExtractedSchedule {
  films: Array<{
    /** Film title as displayed on the site */
    title: string;
    /** Poster image URL if visible */
    poster_url?: string | null;
    /** Rating/censor certificate if shown (e.g. "PG", "18") */
    rating?: string | null;
    /** All showtimes for this film */
    showtimes: Array<{
      /** Show date in YYYY-MM-DD or human form like "Today", "Saturday April 19" */
      date?: string | null;
      /** Show time in any format — we'll normalize it (e.g. "6:00pm", "18:00") */
      time: string;
      /** Screen/hall name if shown */
      screen?: string | null;
      /** Format indicator if shown (IMAX, 3D, 4DX, Standard, etc.) */
      format?: string | null;
      /** Ticket/booking URL for this specific showtime if available */
      ticket_url?: string | null;
    }>;
  }>;
}

/** Normalize times like "6:00pm", "18:00", "6pm", "18:00:00" → "HH:MM:SS" */
function normalizeTime(raw: string): string | null {
  const s = raw.trim();

  // 12-hour: "6:00pm", "6:00 PM", "6pm"
  const m12 = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (m12) {
    let hr = parseInt(m12[1], 10);
    const min = parseInt(m12[2] ?? '0', 10);
    const ampm = m12[3].toLowerCase();
    if (ampm === 'am') { if (hr === 12) hr = 0; }
    else               { if (hr !== 12) hr += 12; }
    return `${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
  }

  // 24-hour: "18:00", "18:00:00"
  const m24 = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m24) {
    const hr  = parseInt(m24[1], 10);
    const min = parseInt(m24[2], 10);
    if (hr >= 0 && hr <= 23 && min >= 0 && min <= 59) {
      return `${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
    }
  }

  return null;
}

/**
 * Interpret date strings like "Today", "Tomorrow", "Saturday April 19",
 * "April 19", or "2025-04-19" → "YYYY-MM-DD" in Lagos time.
 * Falls back to today if unparseable.
 */
function normalizeDate(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  const s = raw.trim().toLowerCase();

  if (s === 'today')    return fallback;
  if (s === 'tomorrow') return todayLagos(1);

  // Try ISO directly
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return raw.trim().slice(0, 10);

  // "Saturday April 19" or "April 19, 2026" or "April 19"
  const MONTHS = ['january','february','march','april','may','june',
                  'july','august','september','october','november','december'];
  const monthRe = new RegExp(`(${MONTHS.join('|')})\\s+(\\d{1,2})(?:[,\\s]+(\\d{4}))?`, 'i');
  const mm = s.match(monthRe);
  if (mm) {
    const monthIdx = MONTHS.indexOf(mm[1].toLowerCase());
    const day = parseInt(mm[2], 10);
    const nowLagos = new Date(Date.now() + 3600000);
    const year = mm[3] ? parseInt(mm[3], 10) : nowLagos.getUTCFullYear();
    return `${year}-${String(monthIdx + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

  return fallback;
}

async function runScraplingBridge(url: string, options: { wait?: number; solveCloudflare?: boolean; selector?: string } = {}): Promise<{ status: number; text: string; html: string; error?: string }> {
  return new Promise((resolve) => {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const bridgePath = path.resolve(__dirname, '../../../scripts/scrapling_bridge.py');
    
    const args = ['-u', bridgePath, '--url', url, '--timeout', '90000'];
    if (options.wait !== undefined) {
      args.push('--wait', String(options.wait));
    }
    if (options.solveCloudflare) {
      args.push('--solve-cloudflare');
    }
    if (options.selector) {
      args.push('--selector', options.selector);
    }
    
    console.log(`[Scrapling Bridge] Spawning: ${pythonCmd} ${args.join(' ')}`);
    
    const child = spawn(pythonCmd, args, {
      shell: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' }
    });
    
    let stdoutData = '';
    let stderrData = '';
    
    child.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderrData += data.toString();
    });
    
    const timeout = setTimeout(() => {
      console.warn(`[Scrapling Bridge] Timeout reached (120s). Killing process...`);
      child.kill('SIGTERM');
      resolve({ status: 500, text: '', html: '', error: 'Scrapling bridge timed out' });
    }, 120000);
    
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        resolve({ status: 500, text: '', html: '', error: `Process failed with code ${code}: ${stderrData.trim() || 'No stderr'}` });
        return;
      }
      
      try {
        const lines = stdoutData.split('\n');
        let jsonStr = '';
        for (const line of lines) {
          if (line.trim().startsWith('{') && line.trim().endsWith('}')) {
            jsonStr = line.trim();
            break;
          }
        }
        if (!jsonStr) {
          throw new Error('Could not find JSON payload in Scrapling stdout');
        }
        const parsed = JSON.parse(jsonStr);
        resolve(parsed);
      } catch (err: any) {
        resolve({ status: 500, text: '', html: '', error: `Failed to parse output: ${err.message}` });
      }
    });
    
    child.on('error', (err) => {
      clearTimeout(timeout);
      resolve({ status: 500, text: '', html: '', error: err.message });
    });
  });
}

export const firecrawlAdapter: CinemaAdapter = async (cinema: CinemaRow): Promise<AdapterResult> => {
  const cfg = cinema.scrape_config || {};
  const url: string | undefined = cfg.url;
  if (!url) {
    return {
      cinemaId: cinema.id,
      showtimes: [],
      error: 'scrape_config.url is required for firecrawl adapter',
    };
  }

  const ticketBaseUrl: string = cfg.ticketBaseUrl || '';

  // Use Scrapling directly for Filmhouse (requires 5s JavaScript render) or if explicitly set in config
  const useScrapling = cfg.useScrapling === true || url.includes('filmhouseng.com');
  let pageText = '';

  if (useScrapling) {
    console.log(`[Local Scraper] Route fetching via Python Scrapling Bridge for ${cinema.name}...`);
    const bridgeRes = await runScraplingBridge(url, {
      wait: cfg.wait ?? 5000,
      selector: cfg.waitSelector,
      solveCloudflare: cfg.solveCloudflare === true
    });
    if (bridgeRes.error) {
      console.warn(`[Local Scraper] Scrapling Bridge failed: ${bridgeRes.error}. Falling back to plain Playwright...`);
    } else {
      pageText = bridgeRes.text;
    }
  }

  if (!pageText) {
    // 1. Launch a local stealth browser session to fetch the page HTML/Text safely for free
    console.log(`[Local Scraper] Launching stealth browser for ${cinema.name} (${url})...`);
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      const page = await context.newPage();
      
      // Block heavy assets to increase performance
      await page.route('**/*', (route) => {
        const type = route.request().resourceType();
        if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
          route.abort();
        } else {
          route.continue();
        }
      });

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      
      // Retrieve page text content
      pageText = await page.evaluate(() => document.body.innerText);
    } catch (err: any) {
      console.warn(`[Local Scraper] Playwright fetch failed for ${cinema.name}: ${err.message}. Trying Scrapling Bridge fallback...`);
      const bridgeRes = await runScraplingBridge(url, {
        wait: cfg.wait ?? 5000,
        solveCloudflare: cfg.solveCloudflare === true
      });
      if (bridgeRes.error) {
        return {
          cinemaId: cinema.id,
          showtimes: [],
          error: `Both Playwright and Scrapling fetchers failed. Playwright: ${err.message}, Scrapling: ${bridgeRes.error}`,
        };
      }
      pageText = bridgeRes.text;
    } finally {
      await browser.close();
    }
  }

  if (!pageText.trim()) {
    return {
      cinemaId: cinema.id,
      showtimes: [],
      error: 'Scraped page returned empty content',
    };
  }

  // 2. Call your existing AI Provider model rotation (Gemini/Grok/OpenAI) to extract structured JSON showtimes
  console.log(`[Local Scraper] Calling AI Provider to extract schedule for ${cinema.name}...`);
  const aiPrompt = `Analyze the following raw text content of a cinema's "now showing" webpage and extract all currently showing movies and their scheduled showtimes.
  
Webpage Raw Text:
"""
${pageText}
"""

Instructions:
1. Extract ALL films listed.
2. For each film, return the title exactly as shown.
3. Extract all showtimes, including:
   - date: represented as "Today", "Tomorrow", a day of the week (e.g. "Saturday"), or a specific date if shown. If no date is visible, default to "Today".
   - time: represented in any format shown (e.g., "6:00pm", "18:00").
   - screen: the screen/hall name or number (e.g., "Screen 1", "IMAX"), if visible.
   - format: standard format details (e.g., "IMAX", "3D", "VIP", "Standard"), if visible.
   - ticket_url: direct booking link for this showtime slot if available.

Return ONLY a valid JSON object matching this schema (do not include any conversational text or formatting other than valid JSON):
{
  "films": [
    {
      "title": "Movie Title",
      "poster_url": "Optional absolute URL to the poster if visible in text, else null",
      "rating": "Optional rating like PG, 18, else null",
      "showtimes": [
        {
          "date": "Today" or "YYYY-MM-DD" or day name,
          "time": "Show time (e.g. 6:00pm or 18:00)",
          "screen": "Screen name or null",
          "format": "IMAX" or "3D" or "VIP" or "Standard" or null,
          "ticket_url": "Optional slot ticket URL or null"
        }
      ]
    }
  ]
}
`;

  let extracted: ExtractedSchedule;
  try {
    const aiRes = await generateAIContent(aiPrompt);
    const parsed = parseJSON(aiRes.text);
    if (!parsed || !parsed.films) {
      throw new Error('AI Response did not match the required films schema');
    }
    extracted = parsed as ExtractedSchedule;
  } catch (err: any) {
    console.error(`[Local Scraper] AI extraction failed for ${cinema.name}:`, err.message);
    return {
      cinemaId: cinema.id,
      showtimes: [],
      error: `AI extraction failed: ${err.message}`,
    };
  }

  const today = todayLagos(0);
  const showtimes: ScrapedShowtime[] = [];
  const warnings: string[] = [];

  for (const film of extracted.films ?? []) {
    if (!film.title?.trim()) continue;

    for (const st of film.showtimes ?? []) {
      const showTime = normalizeTime(st.time);
      if (!showTime) {
        warnings.push(`Could not parse time "${st.time}" for film "${film.title}"`);
        continue;
      }

      const showDate = normalizeDate(st.date, today);
      const format = inferFormat(st.screen ?? st.format ?? null);
      const ticketUrl = st.ticket_url || (ticketBaseUrl ? ticketBaseUrl : null);

      showtimes.push({
        externalFilmId: `fc-${film.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        filmTitle: film.title.trim(),
        filmMeta: {
          posterUrl: film.poster_url ?? null,
          rating: film.rating ?? null,
        },
        showDate,
        showTime,
        format,
        screenName: st.screen ?? null,
        ticketUrl: ticketUrl ?? null,
      });
    }
  }

  console.log(`[Local Scraper] Successfully extracted ${showtimes.length} showtimes for ${cinema.name}`);
  return {
    cinemaId: cinema.id,
    showtimes,
    warnings: warnings.length ? warnings : undefined,
  };
};

