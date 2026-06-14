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

function parseRuntime(text: string): number | null {
  const matchH = text.match(/(\d+)h\s+(\d+)m/);
  if (matchH) return parseInt(matchH[1]) * 60 + parseInt(matchH[2]);
  
  const matchM = text.match(/(\d+)m\s+(\d+)s/);
  if (matchM) return parseInt(matchM[1]);

  const matchOnlyM = text.match(/^(\d+)m$/);
  if (matchOnlyM) return parseInt(matchOnlyM[1]);

  return null;
}

const decodeHtmlEntities = (text: string) => {
  return text.replace(/&#x([0-9A-Fa-f]+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 16)))
             .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
             .replace(/&amp;/g, '&');
};

async function syncKava() {
  console.log('🚀 Starting Kava Sync via Sitemap + Playwright...');
  let logId;
  const startTime = Date.now();
  
  try {
    const { data: logData } = await supabase.from('sync_logs').insert({
      source: 'kava',
      status: 'running',
      message: 'Started sitemap sync'
    }).select('id').single();
    logId = logData?.id;
  } catch (err) {}

  let browser;
  try {
    console.log('Fetching Kava.tv sitemap...');
    const sitemapUrl = 'https://kava.tv/sitemap.xml';
    const sitemapRes = await fetch(sitemapUrl);
    const xml = await sitemapRes.text();
    const sitemapDoc = cheerio.load(xml, { xmlMode: true });
    const urls = sitemapDoc('loc').map((_, el) => sitemapDoc(el).text()).get()
      .filter((u: string) => u.includes('/content/'));
      
    console.log(`Found ${urls.length} content URLs. Launching browser for metadata extraction...`);

    browser = await chromium.launch({ headless: true });
    
    console.log(`Preparing to process ${urls.length} urls...`);

    const { data: existingFilms } = await supabase.from('films').select('source_video_id, id').eq('source', 'kava');
    const existingMap = new Map(existingFilms?.map(f => [f.source_video_id, f.id]) || []);

    let inserted = 0;
    let errors = 0;
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const page = await browser.newPage();
      
      let apiTitle, apiSynopsis, apiPoster;
      let apiGenres: string[] = [];
      let apiCast: any[] = [];
      
      page.on('response', async response => {
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
            }
          } catch (e) {}
        }
      });

      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(10000);
      } catch (navError) {
        console.warn(`Navigation or timeout error for ${url}`);
      }

      const html = await page.content();
      const getMeta = (prop: string) => {
        const regex = new RegExp(`<meta\\s+property="${prop}"\\s+content="([^"]+)"`, 'i');
        const m = html.match(regex);
        return m ? decodeHtmlEntities(m[1]) : null;
      };
      
      const title = getMeta('og:title');
      const description = getMeta('og:description') || '';
      const posterUrl = getMeta('og:image');
      const slug = url.split('/').pop();
      
      const runtime_minutes = await page.evaluate(() => {
         const text = document.body.innerText;
         const match = text.match(/(\d+)h\s*(\d+)m|(\d+)m\s*(\d+)s|(\d+)m/);
         if (!match) return null;
         if (match[1] && match[2]) return parseInt(match[1]) * 60 + parseInt(match[2]);
         if (match[3]) return parseInt(match[3]);
         if (match[5]) return parseInt(match[5]);
         return null;
      });

      await page.close();

      if (!title || !slug) continue;
      
      const m = {
        title: title || apiTitle,
        slug,
        url,
        poster_url: posterUrl || apiPoster,
        synopsis: apiSynopsis || description,
        genres: apiGenres,
        cast: apiCast,
        runtime_minutes
      };
      
      const source_video_id = `kava-${m.slug}`;
      const watchUrl = m.url;
      const { baseTitle } = detectAndNormalizeSeries(m.title!);
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

      let filmId = existingMap.get(source_video_id);
      
      if (filmId) {
        const { error: filmError } = await supabase.from('films').update({
          runtime_minutes: film.runtime_minutes,
          genres: film.genres,
          synopsis: film.synopsis,
          poster_url: film.poster_url,
          backdrop_url: film.backdrop_url
        }).eq('id', filmId);
        if (filmError) { console.error(`Error updating ${film.title}:`, filmError.message); errors++; continue; }
      } else {
        const { data: insertedFilm, error: filmError } = await supabase.from('films').insert([film]).select('id').single();
        if (filmError) { console.error(`Error inserting ${film.title}:`, filmError.message); errors++; continue; }
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
               const { error: fgError } = await supabase.from('film_genres').insert({ film_id: filmId, genre_id: genreId });
               if (fgError) console.error("film_genres insert error:", fgError.message);
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
               const { error: cError } = await supabase.from('credits').insert({ film_id: filmId, person_id: personId, role: 'cast', billing_order: idx });
               if (cError) console.error("credits insert error:", cError.message);
            }
         }
      }
      
      console.log(`Processed ${i + 1}/${urls.length} urls...`);
    }

    console.log(`✨ Successfully synced ${inserted} items. Errors: ${errors}.`);

    if (logId) {
      await supabase.from('sync_logs').update({
        status: errors === 0 ? 'success' : 'partial',
        message: `Kava sync complete. Synced ${inserted} films.`,
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
