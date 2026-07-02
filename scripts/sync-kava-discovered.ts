import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

function cleanTitle(title: string) {
  return title.replace(/season\s+\d+/i, '').replace(/episode\s+\d+/i, '').replace(/-\s*$/, '').trim();
}

function detectAndNormalizeSeries(title: string) {
  const sMatch = title.match(/season\s+(\d+)/i);
  const eMatch = title.match(/episode\s+(\d+)/i);
  return {
    isSeries: !!(sMatch || eMatch),
    baseTitle: cleanTitle(title),
    episodeNum: eMatch ? parseInt(eMatch[1]) : null
  };
}

const decodeHtmlEntities = (text: string) => {
  return text.replace(/&#x([0-9A-Fa-f]+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 16)))
             .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
             .replace(/&amp;/g, '&');
};

async function discoverUrls(page: any): Promise<string[]> {
  const startUrls = [
    'https://kava.tv/',
    'https://kava.tv/category/video',
    'https://kava.tv/category/series',
    'https://kava.tv/category/crime-action',
    'https://kava.tv/category/coming-soon'
  ];

  const discoveredUrls = new Set<string>();

  for (const url of startUrls) {
    console.log(`🌐 Discovering URLs from: ${url}`);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      
      // Scroll multiple times to lazy load
      let lastHeight = await page.evaluate('document.body.scrollHeight');
      for (let i = 0; i < 15; i++) {
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        await page.waitForTimeout(1000);
        const newHeight = await page.evaluate('document.body.scrollHeight');
        if (newHeight === lastHeight) break;
        lastHeight = newHeight;
      }

      const links = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href*="/content/"]'));
        return anchors.map(a => (a as HTMLAnchorElement).href.split('?')[0]);
      });

      links.forEach(l => {
        if (l && !l.includes('undefined')) {
          discoveredUrls.add(l);
        }
      });
    } catch (e: any) {
      console.warn(`  Warning: failed to discover from ${url}:`, e.message);
    }
  }

  return Array.from(discoveredUrls);
}

async function syncKava() {
  console.log('🚀 Starting Kava Sync via Discovery + Playwright...');
  let logId;
  const startTime = Date.now();
  
  try {
    const { data: logData } = await supabase.from('sync_logs').insert({
      source: 'kava',
      status: 'running',
      message: 'Started discovered sync'
    }).select('id').single();
    logId = logData?.id;
  } catch (err) {}

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    console.log('🔍 Discovering content URLs on Kava.tv...');
    const urls = await discoverUrls(page);
    console.log(`✨ Discovered ${urls.length} unique content URLs.`);

    const { data: existingFilms } = await supabase.from('films').select('source_video_id, id').eq('source', 'kava');
    const existingMap = new Map(existingFilms?.map(f => [f.source_video_id, f.id]) || []);

    let inserted = 0;
    let errors = 0;
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      let pageInstance;
      try {
        pageInstance = await browser.newPage();
        
        let apiCast: any[] = [];
        let apiGenres: string[] = [];
        
        const responsePromise = new Promise<void>(resolve => {
          pageInstance.on('response', async response => {
            if (response.url().includes('kavaapi.muvi.com/content') && response.request().method() === 'POST') {
              try {
                const json = await response.json();
                if (json?.data?.contentList?.content_list && json.data.contentList.content_list.length > 0) {
                  const movieData = json.data.contentList.content_list[0];
                  if (movieData?.cast_details && movieData.cast_details.length > 0) {
                    apiCast = movieData.cast_details.map((c: any) => ({
                      name: c.cast_name,
                      image: c.no_image_available_url !== 'https://d3ggjyip6a9ibw.cloudfront.net/images/users/default_cast.png' ? c.no_image_available_url : null
                    }));
                  }
                  if (movieData?.categories && movieData.categories.length > 0) {
                    apiGenres = movieData.categories.map((c: any) => c.category_name);
                  }
                  resolve();
                }
              } catch (e) {
                resolve();
              }
            }
          });
        });

        try {
          await pageInstance.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await Promise.race([
            responsePromise,
            pageInstance.waitForTimeout(4000)
          ]);
        } catch (navError) {
          console.warn(`Navigation or timeout error for ${url}`);
        }

        const html = await pageInstance.content();
        const getMeta = (prop: string) => {
          const regex = new RegExp(`<meta\\s+property="${prop}"\\s+content="([^"]+)"`, 'i');
          const m = html.match(regex);
          return m ? decodeHtmlEntities(m[1]) : null;
        };
        
        const title = getMeta('og:title');
        const description = getMeta('og:description') || '';
        const posterUrl = getMeta('og:image');
        const slug = url.split('/').pop();
        
        const runtime_minutes = await pageInstance.evaluate(() => {
           const text = document.body.innerText;
           const match = text.match(/(\d+)h\s*(\d+)m|(\d+)m\s*(\d+)s|(\d+)m/);
           if (!match) return null;
           if (match[1] && match[2]) return parseInt(match[1]) * 60 + parseInt(match[2]);
           if (match[3]) return parseInt(match[3]);
           if (match[5]) return parseInt(match[5]);
           return null;
        });

        await pageInstance.close();
        pageInstance = null;

        if (!title || !slug) {
          console.warn(`Skipping invalid title or slug for URL: ${url}`);
          continue;
        }
        
        const m = {
          title,
          slug,
          url,
          poster_url: posterUrl,
          synopsis: description,
          genres: apiGenres,
          cast: apiCast,
          runtime_minutes
        };
        
        const source_video_id = `kava-${m.slug}`;
        const watchUrl = m.url;
        const { baseTitle } = detectAndNormalizeSeries(m.title);
        const cleanedTitle = cleanTitle(baseTitle);
        
        const film = {
          title: cleanedTitle,
          synopsis: m.synopsis,
          poster_url: m.poster_url,
          backdrop_url: m.poster_url,
          source: 'kava',
          source_video_id,
          youtube_watch_url: watchUrl,
          streaming_links: { kava: watchUrl },
          release_type: 'kava',
          countries: ['Nigeria'],
          runtime_minutes: m.runtime_minutes,
          genres: m.genres,
          needs_review: true,
          status: 'released'
        };

        console.log(`🔄 Processing discovered Kava film: "${film.title}" (${slug})`);

        let filmId = existingMap.get(source_video_id);
        
        if (filmId) {
          const { error: filmError } = await supabase.from('films').update({
            runtime_minutes: film.runtime_minutes,
            genres: film.genres,
            synopsis: film.synopsis,
            poster_url: film.poster_url,
            backdrop_url: film.backdrop_url
          }).eq('id', filmId);
          if (filmError) throw filmError;
        } else {
          const { data: insertedFilm, error: filmError } = await supabase.from('films').insert([film]).select('id').single();
          if (filmError) throw filmError;
          filmId = insertedFilm.id;
          existingMap.set(source_video_id, filmId);
        }
        inserted++;

        if (m.genres && m.genres.length > 0) {
           for (const gName of m.genres) {
              if (!gName) continue;
              let genreId;
              const { data: g } = await supabase.from('genres').select('id').ilike('name', gName).maybeSingle();
              if (g) genreId = g.id;
              else {
                 const { data: newG } = await supabase.from('genres').insert({ name: gName }).select('id').single();
                 genreId = newG?.id;
              }
              if (genreId) {
                 await supabase.from('film_genres').upsert({ film_id: filmId, genre_id: genreId }, { onConflict: 'film_id,genre_id' });
              }
           }
        }

        if (m.cast && m.cast.length > 0) {
           for (let idx = 0; idx < m.cast.length; idx++) {
              const castMember = m.cast[idx];
              if (!castMember.name) continue;
              let personId;
              const { data: p } = await supabase.from('people').select('id').eq('name', castMember.name).maybeSingle();
              if (p) personId = p.id;
              else {
                 const pData: any = { name: castMember.name };
                 if (castMember.image && castMember.image !== 'https://d3ggjyip6a9ibw.cloudfront.net/images/users/default_cast.png') {
                     pData.profile_path = castMember.image;
                 }
                 const { data: newP } = await supabase.from('people').insert(pData).select('id').single();
                 personId = newP?.id;
              }
              if (personId) {
                 await supabase.from('credits').upsert({ film_id: filmId, person_id: personId, role: 'cast', billing_order: idx }, { onConflict: 'film_id,person_id,role' });
              }
           }
        }
      } catch (e: any) {
        console.error(`  ❌ Error processing discovered Kava film ${url}:`, e.message);
        errors++;
      } finally {
        if (pageInstance) {
          try {
            await pageInstance.close();
          } catch (closeErr) {}
        }
      }
      
      console.log(`Processed ${i + 1}/${urls.length} urls...`);
    }

    console.log(`✨ Successfully synced ${inserted} items. Errors: ${errors}.`);

    if (logId) {
      await supabase.from('sync_logs').update({
        status: errors === 0 ? 'success' : 'partial',
        message: `Kava discovered sync complete. Synced ${inserted} films.`,
        details: { total_scraped: urls.length, inserted, errors },
        duration_ms: Date.now() - startTime,
        items_processed: urls.length,
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
    if (browser) await browser.close();
  }
}

syncKava();
