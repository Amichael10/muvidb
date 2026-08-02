import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { cleanTitle } from '../api/_lib/yt_service.js';
import { detectAndNormalizeSeries } from '../api/_lib/series_utils.js';

const stealthPlugin = stealth();
chromium.use(stealthPlugin);

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * post-home redirects to a marketing wall when logged out, so we scrape the
 * public category shelves that make up the catalog instead.
 *
 * Status: EbonyLife's "Coming Soon" category is a marketing shelf — titles there
 * are usually already playable ("PLAY NOW"). We ingest everything as released
 * unless the API row has a clear future release_date.
 */
type FilmStatus = 'released' | 'upcoming';

const EBONY_SOURCES: { url: string; label: string }[] = [
  { url: 'https://ebonylifeonplus.com/category/nollywood-gold', label: 'nollywood-gold' },
  { url: 'https://ebonylifeonplus.com/category/drama-series', label: 'drama-series' },
  { url: 'https://ebonylifeonplus.com/category/feature-films', label: 'feature-films' },
  { url: 'https://ebonylifeonplus.com/category/mo-abudu-films', label: 'mo-abudu-films' },
  { url: 'https://ebonylifeonplus.com/category/drama', label: 'drama' },
  { url: 'https://ebonylifeonplus.com/category/coming-soon', label: 'coming-soon' },
  { url: 'https://ebonylifeonplus.com/category/yoruba', label: 'yoruba' },
  { url: 'https://ebonylifeonplus.com/category/igbo', label: 'igbo' },
  { url: 'https://ebonylifeonplus.com/category/hausa', label: 'hausa' },
  { url: 'https://ebonylifeonplus.com/category/urban', label: 'urban' },
  { url: 'https://ebonylifeonplus.com/category/epic', label: 'epic' },
];

type ScrapedItem = {
  content_name?: string;
  title?: string;
  content_permalink?: string;
  content_desc?: string;
  posters?: { website?: { file_url?: string }[] };
  banners?: { website?: { file_url?: string }[] };
  video_details?: { duration?: string };
  cast_details?: any[];
  release_date?: string | null;
  content_publish_date?: string | null;
  _status: FilmStatus;
  _sourceLabel: string;
};

/** Only mark upcoming when API gives a clear future date; else released. */
function statusFromApiRow(item: any): FilmStatus {
  const raw =
    item?.release_date
    || item?.content_publish_date
    || item?.publish_date
    || item?.available_from
    || null;
  if (!raw || typeof raw !== 'string') return 'released';
  const ts = Date.parse(raw);
  if (Number.isNaN(ts)) return 'released';
  // Future calendar day (UTC) → upcoming; anything else is already out
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (ts > today.getTime()) return 'upcoming';
  return 'released';
}

function extractContentList(json: any): any[] {
  const cats = json?.data?.categoryContentList?.categories;
  if (Array.isArray(cats)) {
    const list = cats[0]?.category_content_list?.content_list;
    if (Array.isArray(list) && list.length) return list;
  }
  const direct = json?.data?.contentList?.content_list;
  if (Array.isArray(direct) && direct.length) return direct;
  return [];
}

async function scrapeEbonyLife(): Promise<ScrapedItem[]> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // permalink → item (released wins over upcoming if seen on multiple shelves)
  const byPermalink = new Map<string, ScrapedItem>();

  for (const source of EBONY_SOURCES) {
    let latestList: any[] = [];

    const onResponse = async (response: any) => {
      const url = response.url();
      if (!url.includes('ebonylifeapi.muvi.com/content')) return;
      try {
        const json = await response.json();
        const list = extractContentList(json);
        if (list.length) latestList = list;
      } catch {}
    };

    page.on('response', onResponse);
    console.log(`🚀 ${source.label}: ${source.url}`);
    try {
      await page.goto(source.url, { waitUntil: 'networkidle', timeout: 90000 });
      await page.waitForTimeout(4000);
      for (let i = 0; i < 3; i++) {
        await page.mouse.wheel(0, 1800);
        await page.waitForTimeout(800);
      }
    } catch (e: any) {
      console.log(`  ⚠️ navigate failed: ${e.message}`);
    }
    page.off('response', onResponse);

    console.log(`  → intercepted ${latestList.length} titles`);
    for (const item of latestList) {
      const permalink = String(item.content_permalink || item.permalink || '').trim();
      if (!permalink) continue;
      const status = statusFromApiRow(item);
      const existing = byPermalink.get(permalink);
      // Never downgrade released → upcoming when the same title appears twice
      if (existing?._status === 'released' && status === 'upcoming') {
        continue;
      }
      byPermalink.set(permalink, {
        ...item,
        _status: status,
        _sourceLabel: source.label,
      });
    }
  }

  await browser.close();
  const all = [...byPermalink.values()];
  console.log(`\n✅ Unique titles across shelves: ${all.length}`);
  console.log(
    `   upcoming (future API date): ${all.filter((x) => x._status === 'upcoming').length} · released: ${all.filter((x) => x._status === 'released').length}`,
  );
  return all;
}

async function upsertPerson(name: string) {
  if (!name) return null;
  const { data: id, error } = await supabase.rpc('upsert_person_by_name', {
    p_name: name,
    p_extra: { nationality: 'Nigerian', source: 'ebonylife' },
  });
  if (error || !id) return null;
  return id;
}

function parseDurationStr(durationStr?: string) {
  if (!durationStr) return null;
  const parts = durationStr.split(':');
  if (parts.length === 3) {
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }
  if (parts.length === 2) {
    return parseInt(parts[0]);
  }
  return null;
}

async function syncToDatabase(scrapedMovies: ScrapedItem[]) {
  let updatedCount = 0;
  let newCount = 0;
  let errorCount = 0;
  let comingSoonCount = 0;

  for (const movie of scrapedMovies) {
    const rawTitle = movie.content_name || movie.title;
    const { isSeries, baseTitle, episodeNum, seasonNum } = detectAndNormalizeSeries(rawTitle || '');
    const cleanedTitle = cleanTitle(baseTitle);
    if (!cleanedTitle) continue;

    const movieYear = null;
    const runtimeMinutes = parseDurationStr(movie.video_details?.duration);
    const filmStatus: FilmStatus = movie._status;
    if (filmStatus === 'upcoming') comingSoonCount++;

    let poster_url: string | null = null;
    let backdrop_url: string | null = null;
    if (movie.posters?.website?.length) poster_url = movie.posters.website[0].file_url || null;
    if (movie.banners?.website?.length) backdrop_url = movie.banners.website[0].file_url || null;
    if (!poster_url && backdrop_url) poster_url = backdrop_url;

    const watchUrl = `https://ebonylifeonplus.com/content/${movie.content_permalink}`;

    console.log(
      `🔄 [${movie._sourceLabel}] ${cleanedTitle}${episodeNum ? ` (Ep ${episodeNum})` : ''}${filmStatus === 'upcoming' ? ' [coming soon]' : ''}`,
    );

    try {
      let filmId: string | undefined;

      if (isSeries) {
        const cleanedBase = cleanTitle(baseTitle);
        let parentRecord: any;

        const { data: parentResults } = await supabase
          .from('films')
          .select('id, poster_url, backdrop_url, streaming_links, status')
          .ilike('title', cleanedBase)
          .eq('content_type', 'series')
          .is('series_id', null);

        const parentExisting = parentResults?.[0];

        if (parentExisting) {
          parentRecord = parentExisting;
          const parentUpdate: any = {};
          if (!parentExisting.poster_url && poster_url) parentUpdate.poster_url = poster_url;
          if (!parentExisting.backdrop_url && (backdrop_url || poster_url)) {
            parentUpdate.backdrop_url = backdrop_url || poster_url;
          }
          const existingLinks = parentExisting.streaming_links || {};
          if (!existingLinks.ebonylife) {
            parentUpdate.streaming_links = { ...existingLinks, ebonylife: watchUrl };
          }
          // Don't downgrade a released series parent to upcoming
          if (filmStatus === 'upcoming' && parentExisting.status !== 'released') {
            parentUpdate.status = 'upcoming';
          }
          if (Object.keys(parentUpdate).length > 0) {
            await supabase.from('films').update(parentUpdate).eq('id', parentExisting.id);
          }
        } else {
          const { data: newParent, error: parentError } = await supabase
            .from('films')
            .insert({
              title: cleanedBase,
              year: movieYear,
              release_type: 'ebonylife',
              source: 'ebonylife',
              content_type: 'series',
              poster_url,
              backdrop_url: backdrop_url || poster_url,
              synopsis: movie.content_desc || null,
              needs_review: true,
              status: filmStatus,
              countries: ['Nigeria'],
              streaming_links: { ebonylife: watchUrl },
            })
            .select('id')
            .single();

          if (parentError) throw parentError;
          parentRecord = newParent;
          console.log(`  🎦 Created series parent: "${cleanedBase}"`);
          newCount++;
        }

        const parentId = parentRecord.id;

        if (episodeNum !== null) {
          const { data: epResults } = await supabase
            .from('films')
            .select('*')
            .eq('series_id', parentId)
            .eq('episode_number', episodeNum)
            .eq('season_number', seasonNum || 1);

          const epExisting = epResults?.[0];

          if (epExisting) {
            filmId = epExisting.id;
            const updatePayload: any = {
              streaming_links: { ...(epExisting.streaming_links || {}), ebonylife: watchUrl },
              synopsis: epExisting.synopsis || movie.content_desc,
              runtime_minutes: epExisting.runtime_minutes || runtimeMinutes,
              poster_url: epExisting.poster_url || poster_url,
              backdrop_url: epExisting.backdrop_url || backdrop_url || poster_url,
            };
            if (filmStatus === 'upcoming' && epExisting.status !== 'released') {
              updatePayload.status = 'upcoming';
            }
            await supabase.from('films').update(updatePayload).eq('id', epExisting.id);
            updatedCount++;
          } else {
            const { data: insertedEp, error: epError } = await supabase
              .from('films')
              .insert({
                title: movie.content_name || movie.title,
                year: movieYear,
                release_type: 'ebonylife',
                source: 'ebonylife',
                content_type: 'series',
                series_id: parentId,
                episode_number: episodeNum,
                season_number: seasonNum || 1,
                streaming_links: { ebonylife: watchUrl },
                runtime_minutes: runtimeMinutes,
                poster_url,
                backdrop_url: backdrop_url || poster_url,
                synopsis: movie.content_desc || null,
                status: filmStatus,
                countries: ['Nigeria'],
                needs_review: true,
              })
              .select('id')
              .single();

            if (epError) throw epError;
            filmId = insertedEp.id;
            newCount++;
            console.log(`  ✨ Created episode ${episodeNum} for series: "${cleanedBase}"`);
          }
        } else {
          filmId = parentId;
          updatedCount++;
        }
      } else {
        const { data: results } = await supabase.from('films').select('*').ilike('title', cleanedTitle);
        const existing = results?.[0];

        if (existing) {
          filmId = existing.id;
          const updatePayload: any = {
            streaming_links: { ...(existing.streaming_links || {}), ebonylife: watchUrl },
            synopsis: existing.synopsis || movie.content_desc,
          };
          if (!existing.runtime_minutes && runtimeMinutes) updatePayload.runtime_minutes = runtimeMinutes;
          if (!existing.poster_url && poster_url) updatePayload.poster_url = poster_url;
          if (!existing.backdrop_url && backdrop_url) updatePayload.backdrop_url = backdrop_url;

          const isSuperPrimary =
            existing.youtube_watch_url || ['kava', 'ironflix', 'prime_video'].includes(existing.release_type);
          if (!isSuperPrimary) updatePayload.release_type = 'ebonylife';

          // Promote announced/upcoming → released when found on a released shelf;
          // set upcoming only if the row isn't already released.
          if (filmStatus === 'released' && ['announced', 'upcoming', 'in_production', 'filming', 'post-production'].includes(existing.status)) {
            updatePayload.status = 'released';
          } else if (filmStatus === 'upcoming' && existing.status !== 'released') {
            updatePayload.status = 'upcoming';
          }

          await supabase.from('films').update(updatePayload).eq('id', existing.id);
          updatedCount++;
        } else {
          const { data: inserted, error } = await supabase
            .from('films')
            .insert({
              title: cleanedTitle,
              year: movieYear,
              synopsis: movie.content_desc,
              runtime_minutes: runtimeMinutes,
              poster_url,
              backdrop_url: backdrop_url || poster_url,
              release_type: 'ebonylife',
              streaming_links: { ebonylife: watchUrl },
              source: 'ebonylife',
              status: filmStatus,
              countries: ['Nigeria'],
              needs_review: true,
              content_type: 'movie',
            })
            .select('id')
            .single();

          if (error) throw error;
          filmId = inserted.id;
          newCount++;
          console.log(`  ✨ New film: "${cleanedTitle}" (${filmStatus})`);
        }
      }

      if (movie.cast_details && filmId) {
        for (const cast of movie.cast_details) {
          const roleName = cast.cast_type_details?.cast_type_name?.toLowerCase();
          const role =
            roleName === 'actor' || roleName === 'cast'
              ? 'actor'
              : roleName === 'director'
                ? 'director'
                : 'writer';
          const pId = await upsertPerson(cast.cast_name);
          if (pId) {
            await supabase
              .from('credits')
              .upsert({ film_id: filmId, person_id: pId, role }, { onConflict: 'film_id,person_id,role' });
          }
        }
      }
    } catch (e: any) {
      console.error(`  ❌ Error processing ${cleanedTitle}:`, e.message);
      errorCount++;
    }
  }

  console.log(
    `\n📊 EbonyLife Sync Complete: Updated: ${updatedCount}, New: ${newCount}, Coming-soon shelf items: ${comingSoonCount}, Errors: ${errorCount}`,
  );
}

async function run() {
  try {
    const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];
    if (only) {
      const keep = new Set(only.split(',').map((s) => s.trim()));
      for (let i = EBONY_SOURCES.length - 1; i >= 0; i--) {
        if (!keep.has(EBONY_SOURCES[i].label)) EBONY_SOURCES.splice(i, 1);
      }
    }
    console.log(
      'ℹ️ post-home is membership-gated when logged out — scraping public category shelves instead.\n',
    );
    const movies = await scrapeEbonyLife();
    if (movies.length > 0) {
      await syncToDatabase(movies);
    } else {
      console.log('No movies found.');
    }
  } catch (e) {
    console.error('💀 Fatal error:', e);
    process.exit(1);
  }
}

run();
