import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const DRY_RUN = process.argv.includes('--dry-run');
const limitIdx = process.argv.indexOf('--limit');
const LIMIT = limitIdx !== -1 && process.argv[limitIdx + 1] ? parseInt(process.argv[limitIdx + 1], 10) : null;
const filterIdx = process.argv.indexOf('--filter');
const FILTER = filterIdx !== -1 && process.argv[filterIdx + 1] ? process.argv[filterIdx + 1].toLowerCase() : null;

function normalizeTitleForMatch(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cleanKavaTitle(rawTitle: string): string {
  let t = rawTitle.replace(/\s*-\s*Kava\s*TV\s*$/i, '').trim();

  // Known special Nollywood title mappings
  if (t.toLowerCase().includes('warlord') && t.toLowerCase().includes('olori ogun')) {
    return 'Warlord: Olori Ogun';
  }

  // Deduplicate repeated names in titles (e.g. "10 DAYS IN SUNCITY - 10 DAYS IN SUNCITY")
  const parts = t.split(/\s+-\s+/);
  if (parts.length >= 2) {
    if (parts[0].trim().toLowerCase() === parts[1].trim().toLowerCase()) {
      t = parts[0].trim();
    } else if (parts.length === 3 && parts[0].trim().toLowerCase() === parts[2].trim().toLowerCase()) {
      t = parts[0].trim() + ': ' + parts[1].trim();
    } else if (parts.length === 2 && parts[1].trim().toLowerCase().includes('mp4')) {
      t = parts[0].trim();
    }
  }

  // Handle ALL-CAPS titles nicely
  if (t === t.toUpperCase() && t.length > 3) {
    t = t.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  return t.replace(/\s*-\s*mp4$/i, '').replace(/-\s*$/, '').trim();
}

function detectAndNormalizeSeries(title: string) {
  const sMatch = title.match(/season\s+(\d+)/i);
  const eMatch = title.match(/episode\s+(\d+)/i);
  return {
    isSeries: !!(sMatch || eMatch),
    baseTitle: title.replace(/season\s+\d+/i, '').replace(/episode\s+\d+/i, '').trim(),
    episodeNum: eMatch ? parseInt(eMatch[1], 10) : null
  };
}

async function scrapeKavaVideoPage(url: string) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(15_000)
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    const ogTitle = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
    const ogDesc = $('meta[property="og:description"]').attr('content') || '';
    const ogImg = $('meta[property="og:image"]').attr('content') || null;

    const title = cleanKavaTitle(ogTitle);

    let genres: string[] = [];
    let year: number | null = null;
    let cast: string[] = [];
    let directors: string[] = [];

    // Genre extraction from on-page tags with strict whitelist
    const bodyText = $('body').text();
    const VALID_GENRE_NAMES = new Set([
      'action', 'adventure', 'animation', 'biography', 'comedy', 'crime', 'documentary',
      'drama', 'family', 'fantasy', 'history', 'horror', 'music', 'mystery', 'romance',
      'sci-fi', 'thriller', 'war', 'western', 'faith', 'epic', 'epics', 'melodrama', 'legal drama'
    ]);
    const genreMatch = bodyText.match(/•\s*([A-Za-z,\s/]+?)(?:\s*•|\s*\n|DRAMA|COMEDY|ACTION|ROMANCE)/i);
    if (genreMatch) {
      genres = genreMatch[1]
        .split(/[,/]/)
        .map(s => s.trim().toLowerCase())
        .filter(s => s.length >= 3 && s.length <= 25 && !s.includes('\n') && !s.includes('cast') && VALID_GENRE_NAMES.has(s))
        .map(s => s.charAt(0).toUpperCase() + s.slice(1));
    }

    const yearMatch = ogDesc.match(/\b(19\d\d|20\d\d)\b/);
    if (yearMatch) {
      year = parseInt(yearMatch[1], 10);
    }

    const dirMatch = ogDesc.match(/Directed by\s+([^.\n]+)/i);
    if (dirMatch) {
      directors = dirMatch[1].split(/,|\band\b/).map(s => s.trim()).filter(s => s.length > 2 && s.length < 50);
    }

    // Extract cast from description
    const lines = ogDesc.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (line.includes('Directed by')) continue;
      if (line.match(/^(DRAMA|COMEDY|ACTION|THRILLER|ROMANCE|HORROR|DOCUMENTARY)/i) && line.includes('|')) continue;
      if (line.split(',').length >= 2 && !line.includes('rules through') && line.length < 300) {
        cast = line.split(',').map(c => c.trim()).filter(c => c.length > 2 && c.length < 50);
        break;
      }
    }

    // Clean synopsis: remove header lines with metadata/directors/cast
    let cleanSynopsis = ogDesc;
    if (lines.length > 1) {
      const storyLines = lines.filter(l => !l.includes('Directed by') && !(l.includes('|') && l.match(/\b20\d\d\b/)));
      if (storyLines.length > 0) {
        cleanSynopsis = storyLines[storyLines.length - 1];
      }
    }

    const slug = url.split('/videos/').pop()?.split('?')[0] || url.split('/').pop()?.split('?')[0] || '';

    return {
      url,
      slug,
      rawTitle: ogTitle,
      title,
      year,
      genres,
      cast,
      directors,
      posterUrl: ogImg,
      synopsis: cleanSynopsis.length > 20 ? cleanSynopsis : ogDesc
    };
  } catch (err: any) {
    console.warn(`[Kava] Error scraping ${url}: ${err.message}`);
    return null;
  }
}

async function syncFeedKappa() {
  console.log('🚀 Starting Feed Kappa (Kava TV) Sync via watch.kava.tv Sitemap...');
  const startTime = Date.now();
  let logId: string | null = null;

  if (!DRY_RUN) {
    try {
      const { data: logData } = await supabase.from('sync_logs').insert({
        source: 'kava',
        status: 'running',
        message: 'Started Kava OTT sitemap sync'
      }).select('id').single();
      logId = logData?.id || null;
    } catch (err) {}
  }

  try {
    let sitemapUrl = process.env.FEED_KAPPA_SITEMAP_URL || 'https://watch.kava.tv/sitemap.xml';
    if (sitemapUrl === 'https://kava.tv/sitemap.xml') {
      sitemapUrl = 'https://watch.kava.tv/sitemap.xml';
    }
    console.log(`[Kava] Fetching sitemap from ${sitemapUrl}...`);
    const sitemapRes = await fetch(sitemapUrl);
    if (!sitemapRes.ok) {
      throw new Error(`Failed to fetch sitemap: HTTP ${sitemapRes.status}`);
    }
    const xml = await sitemapRes.text();
    const $ = cheerio.load(xml, { xmlMode: true });

    let urls = $('loc').map((_, el) => $(el).text()).get()
      .filter((u: string) => u.includes('/videos/'));

    console.log(`[Kava] Found ${urls.length} video URLs in sitemap.`);

    if (FILTER) {
      urls = urls.filter(u => u.toLowerCase().includes(FILTER));
      console.log(`[Kava] Filtered to ${urls.length} URLs matching "${FILTER}".`);
    }

    if (LIMIT && LIMIT > 0) {
      urls = urls.slice(0, LIMIT);
      console.log(`[Kava] Limited to first ${urls.length} URLs.`);
    }

    let inserted = 0;
    let updated = 0;
    let errors = 0;

    // Process in batches of 5 concurrent requests
    const BATCH_SIZE = 5;
    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      const batchUrls = urls.slice(i, i + BATCH_SIZE);
      const scrapedResults = await Promise.all(batchUrls.map(u => scrapeKavaVideoPage(u)));

      for (const item of scrapedResults) {
        if (!item || !item.title) {
          errors++;
          continue;
        }

        const sourceVideoId = `kava-${item.slug}`;
        const watchUrl = item.url;
        const { baseTitle } = detectAndNormalizeSeries(item.title);
        const cleanedTitle = cleanKavaTitle(baseTitle);

        console.log(`\n[Kava] Processing: "${cleanedTitle}" (${item.url})`);

        if (DRY_RUN) {
          console.log(`  [DRY-RUN] Title: ${cleanedTitle} | Year: ${item.year} | Genres: ${item.genres.join(', ')}`);
          console.log(`  [DRY-RUN] Cast: ${item.cast.join(', ')}`);
          console.log(`  [DRY-RUN] Directors: ${item.directors.join(', ')}`);
          console.log(`  [DRY-RUN] Poster: ${item.posterUrl ? 'YES' : 'NO'}`);
          continue;
        }

        // 1. Check existing film in DB
        // First check by source_video_id
        let existingFilm: any = null;
        const { data: bySource } = await supabase
          .from('films')
          .select('id, title, source_video_id, streaming_links, poster_url, backdrop_url, synopsis, release_type')
          .eq('source_video_id', sourceVideoId)
          .maybeSingle();

        if (bySource) {
          existingFilm = bySource;
        } else {
          // Check by exact or case-insensitive title
          const { data: byTitle } = await supabase
            .from('films')
            .select('id, title, source_video_id, streaming_links, poster_url, backdrop_url, synopsis, release_type')
            .ilike('title', cleanedTitle)
            .limit(1)
            .maybeSingle();

          if (byTitle) {
            existingFilm = byTitle;
          } else {
            // Check by normalized title match (ignoring punctuation/spaces)
            const norm = normalizeTitleForMatch(cleanedTitle);
            const words = cleanedTitle.split(/[:\s-]+/).filter(w => w.length > 2);
            if (words.length > 0) {
              const { data: candidates } = await supabase
                .from('films')
                .select('id, title, source_video_id, streaming_links, poster_url, backdrop_url, synopsis, release_type')
                .ilike('title', `%${words[0]}%`)
                .limit(20);

              if (candidates) {
                existingFilm = candidates.find(c => normalizeTitleForMatch(c.title) === norm) || null;
              }
            }
          }
        }

        let filmId: string;

        if (existingFilm) {
          filmId = existingFilm.id;
          const currentLinks = typeof existingFilm.streaming_links === 'object' && existingFilm.streaming_links
            ? existingFilm.streaming_links
            : {};
          const newLinks = { ...currentLinks, kava: watchUrl };

          const updatePayload: any = {
            streaming_links: newLinks,
            status: 'released'
          };

          if (!existingFilm.poster_url && item.posterUrl) {
            updatePayload.poster_url = item.posterUrl;
          }
          if (!existingFilm.backdrop_url && item.posterUrl) {
            updatePayload.backdrop_url = item.posterUrl;
          }
          if ((!existingFilm.synopsis || existingFilm.synopsis.length < 40) && item.synopsis) {
            updatePayload.synopsis = item.synopsis;
          }
          if (!existingFilm.source_video_id) {
            updatePayload.source_video_id = sourceVideoId;
          }

          const { error: updErr } = await supabase.from('films').update(updatePayload).eq('id', filmId);
          if (updErr) {
            console.error(`  ❌ Error updating existing film ${filmId}: ${updErr.message}`);
            errors++;
            continue;
          }
          console.log(`  ✅ Updated existing film: ${existingFilm.title} (${filmId}) -> Added Kava link.`);
          updated++;
        } else {
          // Insert new film
          const newFilm = {
            title: cleanedTitle,
            synopsis: item.synopsis,
            poster_url: item.posterUrl,
            backdrop_url: item.posterUrl,
            source: 'kava',
            source_video_id: sourceVideoId,
            youtube_watch_url: watchUrl,
            streaming_links: { kava: watchUrl },
            release_type: 'kava',
            countries: ['Nigeria'],
            year: item.year,
            genres: item.genres,
            needs_review: true,
            status: 'released'
          };

          const { data: insertedData, error: insErr } = await supabase
            .from('films')
            .insert([newFilm])
            .select('id')
            .single();

          if (insErr || !insertedData) {
            console.error(`  ❌ Error inserting film "${cleanedTitle}": ${insErr?.message}`);
            errors++;
            continue;
          }
          filmId = insertedData.id;
          console.log(`  ✨ Created new film: ${cleanedTitle} (${filmId})`);
          inserted++;
        }

        // 2. Upsert platform_new_releases entry
        try {
          await supabase.from('platform_new_releases').upsert({
            platform: 'kava',
            film_id: filmId,
            display_order: -1,
            entry_source: 'auto',
            is_hidden: false
          }, { onConflict: 'platform,film_id' });
        } catch (_) {}

        // 3. Sync genres
        if (item.genres && item.genres.length > 0) {
          for (const gName of item.genres) {
            const cleanG = gName.trim();
            if (!cleanG || cleanG.length < 3 || cleanG.length > 25 || cleanG.includes('\n') || cleanG.toLowerCase().includes('cast')) continue;
            let genreId: string | null = null;
            const { data: g } = await supabase.from('genres').select('id').ilike('name', cleanG).maybeSingle();
            if (g) {
              genreId = g.id;
            } else {
              const { data: newG } = await supabase.from('genres').insert({ name: cleanG }).select('id').single();
              genreId = newG?.id || null;
            }
            if (genreId) {
              await supabase.from('film_genres').upsert(
                { film_id: filmId, genre_id: genreId },
                { onConflict: 'film_id,genre_id', ignoreDuplicates: true }
              );
            }
          }
        }

        // 4. Sync Cast & Directors respecting Zero-Duplicate Actor Guarantee (AGENTS.md)
        // Fetch all existing credits for this film first
        const { data: existingCredits } = await supabase
          .from('credits')
          .select('id, person_id, role')
          .eq('film_id', filmId);

        const existingPersonIds = new Set((existingCredits || []).map(c => c.person_id));

        // Sync Directors
        for (const dirName of item.directors) {
          if (!dirName || dirName.length < 3) continue;
          let personId: string | null = null;
          const { data: p } = await supabase.from('people').select('id').ilike('name', dirName).maybeSingle();
          if (p) {
            personId = p.id;
          } else {
            const { data: newP } = await supabase.from('people').insert({ name: dirName }).select('id').single();
            personId = newP?.id || null;
          }
          if (personId) {
            const hasDirectorCredit = existingCredits?.some(c => c.person_id === personId && c.role === 'director');
            if (!hasDirectorCredit) {
              await supabase.from('credits').insert({
                film_id: filmId,
                person_id: personId,
                role: 'director'
              });
            }
          }
        }

        // Sync Cast
        for (let idx = 0; idx < item.cast.length; idx++) {
          const castName = item.cast[idx];
          if (!castName || castName.length < 3) continue;
          let personId: string | null = null;
          const { data: p } = await supabase.from('people').select('id').ilike('name', castName).maybeSingle();
          if (p) {
            personId = p.id;
          } else {
            const { data: newP } = await supabase.from('people').insert({ name: castName }).select('id').single();
            personId = newP?.id || null;
          }
          if (personId && !existingPersonIds.has(personId)) {
            existingPersonIds.add(personId);
            await supabase.from('credits').insert({
              film_id: filmId,
              person_id: personId,
              role: 'cast',
              billing_order: idx + 1
            });
          }
        }
      }

      console.log(`[Kava] Progress: ${Math.min(i + BATCH_SIZE, urls.length)}/${urls.length} URLs done.`);
    }

    console.log(`\n🎉 Kava Sync Completed! Created: ${inserted}, Updated: ${updated}, Errors: ${errors}`);

    if (logId) {
      await supabase.from('sync_logs').update({
        status: errors === 0 ? 'success' : 'partial',
        message: `Kava sync complete. Created: ${inserted}, Updated: ${updated}`,
        details: { total_scraped: urls.length, inserted, updated, errors },
        duration_ms: Date.now() - startTime,
        items_processed: urls.length,
        items_updated: updated + inserted,
        items_failed: errors
      }).eq('id', logId);
    }
  } catch (err: any) {
    console.error('❌ Feed Kappa Sync Failed:', err.message);
    if (logId) {
      await supabase.from('sync_logs').update({
        status: 'error',
        message: err.message,
        details: { error: err.stack },
        duration_ms: Date.now() - startTime
      }).eq('id', logId);
    }
  }
}

syncFeedKappa().catch(console.error);
