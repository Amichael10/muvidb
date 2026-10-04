/**
 * Harvest IMDb Actor Media (Photos, Stills, Videos) to Cloudflare R2
 *
 * Usage:
 *   npx tsx scripts/harvest_imdb_actor_media.ts --actor "Odunlade Adekola"
 *   npx tsx scripts/harvest_imdb_actor_media.ts --imdb nm2513600 --name "Genevieve Nnaji"
 *   npx tsx scripts/harvest_imdb_actor_media.ts --limit 5
 *   npx tsx scripts/harvest_imdb_actor_media.ts --all
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const firecrawlKey = process.env.FIRECRAWL_API_KEY || process.env.VITE_FIRECRAWL_API_KEY || '';
const tmdbKey = process.env.VITE_TMDB_API_KEY || process.env.TMDB_API_KEY || '';
const CACHE_FILE = path.resolve('scripts/data/actor_imdb_cache.json');

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// --- Cloudflare R2 Config & Upload ---
function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID || '';
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
  const bucketName = process.env.R2_BUCKET_NAME || '';
  const publicUrl = process.env.R2_PUBLIC_URL || '';

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error('Cloudflare R2 environment variables missing (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME).');
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl };
}

let s3ClientInstance: S3Client | null = null;
function getS3Client(): S3Client {
  if (!s3ClientInstance) {
    const config = getR2Config();
    s3ClientInstance = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return s3ClientInstance;
}

async function uploadBufferToR2(fileName: string, fileBytes: Buffer, mimeType: string) {
  const config = getR2Config();
  const s3 = getS3Client();
  const cleanKey = fileName.replace(/^\/+/, '');

  await s3.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: cleanKey,
      Body: fileBytes,
      ContentType: mimeType,
    })
  );

  const publicBase = config.publicUrl
    ? config.publicUrl.replace(/\/+$/, '')
    : `https://${config.bucketName}.${config.accountId}.r2.dev`;

  // Encode path components for public CDN URL while preserving slashes
  const encodedPath = cleanKey.split('/').map(encodeURIComponent).join('/');
  const publicUrl = `${publicBase}/${encodedPath}`;

  return {
    url: publicUrl,
    key: cleanKey,
    sizeKb: Math.round(fileBytes.length / 1024),
  };
}

// --- IMDb & Scraper Helpers ---
function loadCache(): Record<string, string> {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    }
  } catch {}
  return {};
}

function saveCache(cache: Record<string, string>) {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch {}
}

async function scrapeUrlWithFirecrawl(url: string): Promise<{ html?: string; markdown?: string }> {
  if (!firecrawlKey) {
    throw new Error('FIRECRAWL_API_KEY is not configured in .env');
  }

  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${firecrawlKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      formats: ['html', 'markdown'],
      onlyMainContent: false,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Firecrawl scrape error (${res.status}): ${errText}`);
  }

  const json = await res.json();
  if (!json.success || !json.data) {
    throw new Error(json.error || 'Firecrawl failed to scrape page');
  }

  return { html: json.data.html || '', markdown: json.data.markdown || '' };
}

/**
 * Resolve IMDb NM ID via TMDB external_ids or IMDb search
 */
async function resolveImdbIdForPerson(person: { id: string; name: string; tmdb_id?: number | null }): Promise<string | null> {
  const cache = loadCache();
  if (cache[person.id]) return cache[person.id];
  if (cache[person.name]) return cache[person.name];

  // 1. Check TMDB external_ids if person has tmdb_id
  if (person.tmdb_id && tmdbKey) {
    try {
      const tmdbUrl = `https://api.themoviedb.org/3/person/${person.tmdb_id}/external_ids?api_key=${tmdbKey}`;
      const res = await fetch(tmdbUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.imdb_id) {
          cache[person.id] = data.imdb_id;
          cache[person.name] = data.imdb_id;
          saveCache(cache);
          return data.imdb_id;
        }
      }
    } catch (e: any) {
      console.warn(`  ⚠️ TMDB external_ids error for ${person.name}:`, e.message);
    }
  }

  // 2. Search IMDb via Firecrawl
  if (firecrawlKey) {
    try {
      console.log(`  🔎 Searching IMDb for: "${person.name}"...`);
      const searchUrl = `https://www.imdb.com/find/?q=${encodeURIComponent(person.name)}&s=nm`;
      const { html = '', markdown = '' } = await scrapeUrlWithFirecrawl(searchUrl);
      const match = html.match(/\/name\/(nm\d+)\//) || markdown.match(/\/name\/(nm\d+)\//);
      if (match) {
        const imdbId = match[1];
        cache[person.id] = imdbId;
        cache[person.name] = imdbId;
        saveCache(cache);
        return imdbId;
      }
    } catch (e: any) {
      console.warn(`  ⚠️ IMDb search error for ${person.name}:`, e.message);
    }
  }

  return null;
}

/**
 * Cleans an IMDb image URL to get the full-resolution master asset
 */
function toHighResImdbImage(url: string): string {
  if (!url) return url;
  // Replace thumb sizing with uncropped high-res
  // e.g. ._V1_QL75_UX380_CR0,0,380,214_.jpg -> ._V1_.jpg
  return url.replace(/\._V1_.*?\.(jpg|png|jpeg)/i, '._V1_.$1');
}

interface ExtractedMedia {
  url: string;
  title: string;
  description: string | null;
  category: 'headshot' | 'production_still' | 'behind_the_scenes' | 'red_carpet' | 'scene_clip';
  media_type: 'photo' | 'video';
  is_primary?: boolean;
}

/**
 * Scrapes IMDb profile and mediaindex gallery for all media assets
 */
async function fetchActorImdbMedia(imdbId: string, actorName: string): Promise<ExtractedMedia[]> {
  const mediaList: ExtractedMedia[] = [];
  const seenUrls = new Set<string>();

  // 1. Scrape main IMDb Name page
  const profileUrl = `https://www.imdb.com/name/${imdbId}/`;
  console.log(`  📄 Scraping profile: ${profileUrl}...`);
  const profileData = await scrapeUrlWithFirecrawl(profileUrl);
  const $profile = cheerio.load(profileData.html || '');

  // A. Primary Hero Photo / Poster
  let heroPhoto =
    $profile('[data-testid="hero-media__poster"] img.ipc-image').attr('src') ||
    $profile('img[data-testid="hero-media__poster"]').attr('src') ||
    ($profile('meta[property="og:image"]').attr('content') || '');

  if (heroPhoto && !heroPhoto.includes('imdb_logo') && !heroPhoto.includes('amazon-adsystem')) {
    const fullRes = toHighResImdbImage(heroPhoto);
    if (!seenUrls.has(fullRes)) {
      seenUrls.add(fullRes);
      mediaList.push({
        url: fullRes,
        title: `${actorName} - Official IMDb Portrait`,
        description: `Official actor profile headshot from IMDb (${imdbId}).`,
        category: 'headshot',
        media_type: 'photo',
        is_primary: true,
      });
    }
  }

  // B. Known For and Featured Still Posters
  const md = profileData.markdown || '';
  const mdImageMatches = [...md.matchAll(/!\[(.*?)\]\((https:\/\/m\.media-amazon\.com\/images\/.*?)\)/g)];
  for (const match of mdImageMatches) {
    const alt = (match[1] || '').trim();
    let imgUrl = match[2];
    if (imgUrl.includes('amazon-adsystem') || imgUrl.includes('imdb_logo') || imgUrl.includes('Base64')) continue;
    imgUrl = toHighResImdbImage(imgUrl);

    if (!seenUrls.has(imgUrl)) {
      seenUrls.add(imgUrl);
      const isStill = alt.toLowerCase().includes('still') || alt.toLowerCase().includes('scene');
      mediaList.push({
        url: imgUrl,
        title: alt ? `Still: ${alt}` : `${actorName} - Film Still`,
        description: alt ? `Promotional media still for ${alt}.` : `Production media from IMDb for ${actorName}.`,
        category: isStill ? 'production_still' : 'headshot',
        media_type: 'photo',
      });
    }
  }

  // 2. Scrape IMDb Media Gallery (/mediaindex/)
  try {
    const mediaIndexUrl = `https://www.imdb.com/name/${imdbId}/mediaindex/`;
    console.log(`  🖼️ Scraping gallery: ${mediaIndexUrl}...`);
    const galleryData = await scrapeUrlWithFirecrawl(mediaIndexUrl);
    const $gallery = cheerio.load(galleryData.html || '');

    // Extract all media items from the media gallery
    $gallery('img.ipc-image, .media_index_thumb_list img').each((_, el) => {
      let src = $gallery(el).attr('src');
      const alt = ($gallery(el).attr('alt') || '').trim();
      if (!src || src.includes('amazon-adsystem') || src.includes('imdb_logo')) return;

      src = toHighResImdbImage(src);
      if (!seenUrls.has(src)) {
        seenUrls.add(src);

        let category: ExtractedMedia['category'] = 'production_still';
        const lowerAlt = alt.toLowerCase();
        if (lowerAlt.includes('headshot') || lowerAlt.includes('portrait')) {
          category = 'headshot';
        } else if (lowerAlt.includes('premiere') || lowerAlt.includes('red carpet') || lowerAlt.includes('event')) {
          category = 'red_carpet';
        } else if (lowerAlt.includes('behind the scenes') || lowerAlt.includes('bts')) {
          category = 'behind_the_scenes';
        }

        mediaList.push({
          url: src,
          title: alt || `${actorName} - Production Still`,
          description: alt ? `IMDb gallery asset: ${alt}` : `Media still for ${actorName}.`,
          category,
          media_type: 'photo',
        });
      }
    });
  } catch (err: any) {
    console.warn(`  ⚠️ Could not fetch mediaindex for ${imdbId}:`, err.message);
  }

  return mediaList;
}

/**
 * Downloads image from IMDb and uploads it neatly to Cloudflare R2
 * under `media/actors/{actorName}/{cleanFileName}` (matching Chidinma's folder convention).
 */
async function processAndUploadMediaItem(
  person: { id: string; name: string },
  item: ExtractedMedia,
  index: number
): Promise<{ r2Url: string; r2Key: string } | null> {
  try {
    // 1. Download image buffer
    const res = await fetch(item.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to download image (${res.status}): ${item.url}`);
    }

    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : 'jpg';

    // 2. Organize in Cloudflare R2 folder:
    // folder: media/actors/{person.name}/
    // filename: {slug}_{hash}.{ext}
    const cleanActorFolder = person.name.trim();
    const slugTitle = item.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .slice(0, 40);
    const hash = crypto.createHash('md5').update(buffer).digest('hex').slice(0, 8);
    const fileName = `${slugTitle}_${hash}.${ext}`;

    const r2Key = `media/actors/${cleanActorFolder}/${fileName}`;

    console.log(`    ☁️ Uploading to R2: "${r2Key}" (${Math.round(buffer.length / 1024)} KB)...`);
    const r2Result = await uploadBufferToR2(r2Key, buffer, contentType);

    return { r2Url: r2Result.url, r2Key: r2Result.key };
  } catch (err: any) {
    console.error(`    ❌ Failed to process ${item.url}:`, err.message);
    return null;
  }
}

/**
 * Main Harvest Execution for an Actor
 */
async function harvestActor(person: { id: string; name: string; tmdb_id?: number | null }, forcedImdbId?: string) {
  console.log(`\n======================================================`);
  console.log(`🎭 Ingesting IMDb Media for: "${person.name}" (${person.id})`);

  const imdbId = forcedImdbId || (await resolveImdbIdForPerson(person));
  if (!imdbId) {
    console.log(`  ❌ No IMDb ID found for "${person.name}". Skipping.`);
    return;
  }

  console.log(`  🎯 IMDb ID: ${imdbId} -> https://www.imdb.com/name/${imdbId}/`);

  // Check existing media for this person to prevent duplicates
  const { data: existingMedia } = await supabase
    .from('person_media')
    .select('id, url, r2_key, title, media_type')
    .eq('person_id', person.id);

  const existingR2Keys = new Set((existingMedia || []).map((m) => m.r2_key).filter(Boolean));
  const existingTitles = new Set((existingMedia || []).map((m) => m.title?.toLowerCase()).filter(Boolean));
  const hasPhotos = (existingMedia || []).some((m) => m.media_type === 'photo');

  // Scrape all media from IMDb
  const items = await fetchActorImdbMedia(imdbId, person.name);
  console.log(`  📦 Discovered ${items.length} media items on IMDb`);

  let addedCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // Deduplication check
    if (existingTitles.has(item.title.toLowerCase())) {
      console.log(`    ⏭️ Skipping already existing asset: "${item.title}"`);
      continue;
    }

    // Upload to Cloudflare R2
    const uploaded = await processAndUploadMediaItem(person, item, i);
    if (!uploaded) continue;

    if (existingR2Keys.has(uploaded.r2Key)) {
      console.log(`    ⏭️ R2 key already logged in DB: ${uploaded.r2Key}`);
      continue;
    }

    // Insert into person_media
    const isPrimary = !hasPhotos && i === 0;

    const { error: dbErr } = await supabase.from('person_media').insert({
      person_id: person.id,
      media_type: item.media_type,
      category: item.category,
      title: item.title,
      description: item.description,
      url: uploaded.r2Url,
      thumbnail_url: uploaded.r2Url,
      r2_key: uploaded.r2Key,
      embed_provider: 'r2',
      is_primary: isPrimary,
      status: 'approved',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (dbErr) {
      console.error(`    ⚠️ Failed saving to DB:`, dbErr.message);
    } else {
      console.log(`    ✅ Saved to person_media [${item.category}]: "${item.title}"`);
      addedCount++;
      existingR2Keys.add(uploaded.r2Key);
      existingTitles.add(item.title.toLowerCase());
    }

    // Gentle delay between downloads
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log(`🎉 Finished "${person.name}": Successfully ingested ${addedCount} media assets into Cloudflare R2!`);
}

/**
 * CLI Entrypoint
 */
async function main() {
  const args = process.argv.slice(2);
  const getArg = (...flags: string[]) => {
    for (const flag of flags) {
      const idx = args.indexOf(flag);
      if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('--')) {
        return args[idx + 1];
      }
      const eqArg = args.find((a) => a.startsWith(`${flag}=`));
      if (eqArg) {
        return eqArg.slice(flag.length + 1).replace(/^["']|["']$/g, '');
      }
    }
    return null;
  };

  let actorArg = getArg('--actor', '--name', '--person');
  const imdbArg = getArg('--imdb');
  const limitArg = parseInt(getArg('--limit') || '10', 10);
  const runAll = args.includes('--all');

  // If no explicit flag was used, look for positional or mis-flagged actor name (e.g. `--Richard Mofe-Damijo` or `"Richard Mofe-Damijo"`)
  if (!actorArg && !imdbArg && !runAll) {
    const candidateTokens: string[] = [];
    for (let i = 0; i < args.length; i++) {
      const token = args[i];
      if (token === '--limit' || token.startsWith('--limit=')) {
        if (!token.includes('=')) i++;
        continue;
      }
      if (token === '--imdb' || token.startsWith('--imdb=')) {
        if (!token.includes('=')) i++;
        continue;
      }
      if (token === '--all') continue;
      // Strip leading dashes if someone typed `--Richard` instead of `Richard` or `--name "Richard"`
      const cleaned = token.replace(/^--+/, '').trim();
      if (cleaned) candidateTokens.push(cleaned);
    }
    if (candidateTokens.length > 0) {
      actorArg = candidateTokens.join(' ');
    }
  }

  console.log('🚀 Starting IMDb Actor Media Harvester to Cloudflare R2...');

  if (actorArg) {
    // Specific Actor by Name
    const { data: person, error } = await supabase
      .from('people')
      .select('id, name, tmdb_id, slug')
      .ilike('name', `%${actorArg}%`)
      .order('popularity_score', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !person) {
      console.error(`❌ Could not find actor matching "${actorArg}" in database.`);
      process.exit(1);
    }

    await harvestActor(person, imdbArg || undefined);
    return;
  }

  if (imdbArg && !actorArg) {
    console.error('❌ When providing --imdb, please also specify the actor name via --name "Actor Name"');
    process.exit(1);
  }

  // Batch Mode: Top actors with tmdb_id or high popularity
  console.log(`📋 Running in batch mode (Limit: ${limitArg})...`);
  const { data: people, error } = await supabase
    .from('people')
    .select('id, name, tmdb_id, popularity_score, film_count')
    .not('tmdb_id', 'is', null)
    .order('popularity_score', { ascending: false })
    .limit(limitArg);

  if (error || !people || people.length === 0) {
    console.error('❌ Could not fetch candidates from database:', error?.message);
    process.exit(1);
  }

  console.log(`Found ${people.length} candidate actors with TMDB/IMDb profiles.`);

  for (const person of people) {
    try {
      await harvestActor(person);
    } catch (err: any) {
      console.error(`❌ Error harvesting ${person.name}:`, err.message);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log('\n🏁 Completed all scheduled IMDb actor media ingestion jobs!');
}

main().catch((err) => {
  console.error('Fatal script error:', err);
  process.exit(1);
});
