import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import dotenv from 'dotenv';
import { supabase } from './lib/db';
import { cleanTitle } from '../api/_lib/yt_service.js';

dotenv.config();
chromium.use(stealth());

type NolliVideo = {
  _id: string;
  title?: string;
  description?: string;
  category?: string[];
  thumbnail?: string;
  duration?: string;
  cast?: string[];
  director?: string[];
  video_approve_status?: boolean;
};

function isTrailerOrPromo(title: string) {
  const t = title || '';
  if (/\btrailer\b/i.test(t) || /\bteaser\b/i.test(t)) return true;
  if (/nollistream/i.test(t)) return true;
  if (/what'?s next|african stories deserve|wonders of nollywood/i.test(t)) return true;
  if (/^test\b|upload|resume file|mkmk|^wizkid$/i.test(t.trim())) return true;
  return false;
}

function cleanSynopsis(value?: string) {
  if (!value) return null;
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').replace(/\.\.+/g, '.').trim() || null;
}

function parseRuntime(value?: string) {
  if (!value) return null;
  const parts = value.split(':').map(Number);
  if (parts.some(Number.isNaN)) return null;
  if (parts.length === 3) return Math.max(0, parts[0] * 60 + parts[1] + Math.round(parts[2] / 60));
  if (parts.length === 2) return Math.max(0, parts[0] + Math.round(parts[1] / 60));
  return null;
}

function normalizePersonName(name: string) {
  return name
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

async function scrapePublicNollistream() {
  console.log('🚀 Starting NolliStream Scraper (Public Web & API Interception)...');

  const byId = new Map<string, NolliVideo>();

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  page.on('response', async (response) => {
    try {
      const url = response.url();
      if (!url.includes('nollistream.net/api/video/')) return;
      if (response.status() !== 200) return;
      const json = await response.json().catch(() => null);
      if (!json) return;

      if (Array.isArray(json.sections)) {
        for (const section of json.sections) {
          for (const video of section.videos || []) {
            if (video?._id && video?.title) byId.set(String(video._id), video);
          }
        }
      }
      for (const video of json.data || json.videos || []) {
        if (video?._id && video?.title) byId.set(String(video._id), video);
      }
    } catch {
      // Ignore non-json responses
    }
  });

  try {
    console.log('Navigating to https://nollistream.net ...');
    await page.goto('https://nollistream.net', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Scroll down to load all rails
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 1000));
      await page.waitForTimeout(1500);
    }

    console.log(`Discovered ${byId.size} unique movies from home page!`);

    // Let's also navigate to movies page / search page if present
    await page.goto('https://nollistream.net/movies', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 1000));
      await page.waitForTimeout(1500);
    }
  } catch (err: any) {
    console.error('Browser navigation warning:', err.message);
  } finally {
    await browser.close();
  }

  console.log(`\nTotal NolliStream videos captured: ${byId.size}`);

  if (byId.size === 0) {
    console.log('No videos captured via public home page. Checking API search...');
  }

  let matchedCount = 0;
  let updatedCount = 0;
  let createdCount = 0;

  for (const video of byId.values()) {
    const rawTitle = video.title || '';
    if (isTrailerOrPromo(rawTitle)) continue;

    const title = cleanTitle(rawTitle).trim();
    if (!title || isTrailerOrPromo(title)) continue;

    const watchUrl = `https://nollistream.net/movie/${video._id}`;
    const posterUrl = video.thumbnail || null;
    const synopsis = cleanSynopsis(video.description);
    const runtimeMinutes = parseRuntime(video.duration);
    const cast = [...new Set((video.cast || []).map(normalizePersonName).filter((n) => n.length >= 2))];

    // Check existing film by title in Supabase
    const { data: existing } = await supabase
      .from('films')
      .select('id, title, streaming_links, poster_url, synopsis')
      .ilike('title', title)
      .maybeSingle();

    if (existing) {
      matchedCount++;
      const currentLinks = existing.streaming_links || {};
      const updatedLinks = {
        ...currentLinks,
        nollistream: watchUrl
      };

      const updatePayload: Record<string, any> = {
        streaming_links: updatedLinks,
        updated_at: new Date().toISOString()
      };

      if (!existing.poster_url && posterUrl) updatePayload.poster_url = posterUrl;
      if (!existing.synopsis && synopsis) updatePayload.synopsis = synopsis;

      const { error: updateErr } = await supabase.from('films').update(updatePayload).eq('id', existing.id);
      if (!updateErr) updatedCount++;
    } else {
      // Create new film entry with needs_review = true
      const slug = title.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '-');
      const newFilm = {
        title,
        slug,
        synopsis,
        runtime_minutes: runtimeMinutes,
        poster_url: posterUrl,
        backdrop_url: posterUrl,
        release_type: 'nollistream',
        streaming_links: { nollistream: watchUrl },
        needs_review: true,
        source: 'nollistream',
        status: 'released',
        updated_at: new Date().toISOString()
      };

      const { error: insErr } = await supabase.from('films').insert([newFilm]);
      if (!insErr) createdCount++;
    }
  }

  console.log('\n=== NOLLISTREAM SYNC RESULTS ===');
  console.log(`Matched existing titles: ${matchedCount}`);
  console.log(`Updated streaming links: ${updatedCount}`);
  console.log(`New titles added: ${createdCount}`);
  console.log('=================================');
}

scrapePublicNollistream();
