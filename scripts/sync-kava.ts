import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import { cleanTitle } from '../api/_lib/yt_service.js';
import { detectAndNormalizeSeries } from '../api/_lib/series_utils.js';

// Support .env and .env.local
const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const envDefault = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const env = { ...envDefault, ...envLocal, ...process.env };

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncKava() {
  const startTime = Date.now();
  console.log('🚀 Starting Kava Sync via Playwright...');

  // 1. Create a "running" log entry
  const { data: logEntry } = await supabase.from('sync_logs').insert({
    source: 'kava',
    status: 'running',
    message: 'Scraping Kava.tv catalog...',
    details: { started_at: new Date().toISOString() }
  }).select().single();
  
  const logId = logEntry?.id;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    // Ensure Kava Channel exists
    let { data: channel } = await supabase.from('channels').select('id').eq('name', 'Kava Data').maybeSingle();
    
    if (!channel) {
      console.log('Creating Kava Data channel...');
      const { data: newChannel, error } = await supabase.from('channels').insert([{ 
        name: 'Kava Data', 
        channel_handle: 'kava.tv'
      }]).select().single();
      
      if (error) throw error;
      channel = newChannel;
    }

    console.log('Navigating to Kava.tv...');
    await page.goto('https://kava.tv/category/p1', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForSelector('.dataContents', { timeout: 15000 });

    console.log('Extracting movie data...');
    const movies = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.col-lg-3, .col-md-4, .col-sm-6'));
      return cards.map(card => {
        const titleEl = card.querySelector('.dataContents span');
        const descEl = card.querySelector('.dataContents div');
        const linkEl = card.querySelector('a.dataContents');
        const posterDiv = card.querySelector('.content_img');
        
        if (!titleEl || !linkEl) return null;

        let posterUrl = null;
        if (posterDiv) {
          const style = window.getComputedStyle(posterDiv);
          const bgImage = style.backgroundImage;
          if (bgImage && bgImage !== 'none') {
            const match = bgImage.match(/url\("?(.+?)"?\)/);
            if (match) posterUrl = match[1];
          }
        }

        return {
          title: titleEl.textContent?.trim(),
          synopsis: descEl?.textContent?.trim() || '',
          slug: linkEl.getAttribute('href')?.split('/').pop() || '',
          url: (linkEl as HTMLAnchorElement).href,
          poster_url: posterUrl
        };
      }).filter(m => m !== null && m.title);
    });

    console.log(`✅ Found ${movies.length} movies on Kava.`);

    if (movies.length === 0) {
      console.warn('⚠️ No movies found.');
      if (logId) {
        await supabase.from('sync_logs').update({
          status: 'success',
          message: 'No movies found on Kava.tv',
          duration_ms: Date.now() - startTime
        }).eq('id', logId);
      }
      return;
    }

    const { data: existingFilms } = await supabase
      .from('films')
      .select('source_video_id')
      .eq('source', 'kava');
    const existingSet = new Set(existingFilms?.map(f => f.source_video_id) || []);

    const filmsToUpsert = movies.map(m => {
      const source_video_id = `kava-${m!.slug || m!.title!.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const watchUrl = m!.url || `https://kava.tv/watch/${m!.slug}`;
      const { isSeries, baseTitle, episodeNum } = detectAndNormalizeSeries(m!.title!);
      const cleanedTitle = cleanTitle(baseTitle);
      
      return {
        title: cleanedTitle,
        synopsis: m!.synopsis,
        poster_url: m!.poster_url,
        backdrop_url: m!.poster_url,
        source: 'kava',
        source_video_id,
        youtube_watch_url: watchUrl,
        streaming_links: { kava: watchUrl },
        release_type: 'kava',
        countries: ['Nigeria'],
        needs_review: true,
        status: 'released'
      };
    }).filter(row => !existingSet.has(row.source_video_id));

    let inserted = 0;
    let errors = 0;
    
    for (const film of filmsToUpsert) {
      const { error } = await supabase.from('films').insert([film]);
      if (error) {
        console.error(`Error inserting ${film.title}:`, error.message);
        errors++;
      } else {
        inserted++;
      }
    }

    console.log(`✨ Successfully synced ${inserted} new items. Errors: ${errors}.`);

    if (logId) {
      await supabase.from('sync_logs').update({
        status: errors === 0 ? 'success' : 'partial',
        message: `Kava sync complete. Synced ${inserted} new films.`,
        details: { total_scraped: movies.length, inserted, errors },
        duration_ms: Date.now() - startTime,
        items_processed: movies.length,
        items_updated: inserted,
        items_failed: errors
      }).eq('id', logId);
    }

  } catch (err: any) {
    console.error('❌ Kava Sync Failed:', err.message);
    if (logId) {
      await supabase.from('sync_logs').update({
        status: 'error',
        message: err.message,
        details: { error: err.stack },
        duration_ms: Date.now() - startTime
      }).eq('id', logId);
    }
  } finally {
    await browser.close();
  }
}

syncKava();
