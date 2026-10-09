/**
 * Harvest IMDb Actor Media (Photos, Stills, Videos) to Cloudflare R2
 *
 * Usage:
 *   npx tsx scripts/harvest_imdb_actor_media.ts --actor "Odunlade Adekola"
 *   npx tsx scripts/harvest_imdb_actor_media.ts --imdb nm2513600 --name "Genevieve Nnaji"
 *   npx tsx scripts/harvest_imdb_actor_media.ts --limit 5
 *   npx tsx scripts/harvest_imdb_actor_media.ts --all
 */

import dns from 'node:dns';
import { Agent, setGlobalDispatcher } from 'undici';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });
dotenv.config();

const customLookup = (hostname: string, options: any, callback: any) => {
  if (hostname === 'pkenrmorywmuvnzfoylp.supabase.co') {
    if (options && options.all) {
      return callback(null, [{ address: '172.64.149.246', family: 4 }]);
    }
    return callback(null, '172.64.149.246', 4);
  }
  return (dns.lookup as any)(hostname, options, callback);
};

setGlobalDispatcher(new Agent({
  connect: {
    lookup: customLookup,
    timeout: 30000
  },
  headersTimeout: 30000,
  bodyTimeout: 30000,
  keepAliveTimeout: 10000
}));

const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://pkenrmorywmuvnzfoylp.supabase.co').trim();
const supabaseKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  ''
).trim();

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

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

/**
 * Resolve IMDb NM ID via TMDB external_ids or free IMDb Suggestion API
 */
async function resolveImdbIdForPerson(person: { id: string; name: string; tmdb_id?: number | null }): Promise<string | null> {
  const cache = loadCache();
  if (cache[person.id]) return cache[person.id];
  if (cache[person.name]) return cache[person.name];

  // 1. Check TMDB external_ids if person has tmdb_id, or search TMDB
  if (tmdbKey) {
    try {
      let tmdbPersonId = person.tmdb_id;
      if (!tmdbPersonId) {
        const sRes = await fetch(`https://api.themoviedb.org/3/search/person?api_key=${tmdbKey}&query=${encodeURIComponent(person.name)}`);
        if (sRes.ok) {
          const sData = await sRes.json();
          if (sData.results?.[0]?.id) {
            tmdbPersonId = sData.results[0].id;
          }
        }
      }

      if (tmdbPersonId) {
        const tmdbUrl = `https://api.themoviedb.org/3/person/${tmdbPersonId}/external_ids?api_key=${tmdbKey}`;
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
      }
    } catch (e: any) {
      console.warn(`  ⚠️ TMDB lookup error for ${person.name}:`, e.message);
    }
  }

  // 2. Query free IMDb Suggestion API (Free, Instant JSON, $0)
  try {
    const cleanQuery = encodeURIComponent(person.name.trim());
    const res = await fetch(`https://v3.sg.media-imdb.com/suggestion/x/${cleanQuery}.json`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    if (res.ok) {
      const data = await res.json();
      const match = (data.d || []).find((item: any) => item.id?.startsWith('nm'));
      if (match) {
        const imdbId = match.id;
        cache[person.id] = imdbId;
        cache[person.name] = imdbId;
        saveCache(cache);
        return imdbId;
      }
    }
  } catch (e: any) {
    console.warn(`  ⚠️ IMDb Suggest API lookup error for ${person.name}:`, e.message);
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
  category: 'headshot' | 'production_still' | 'behind_the_scenes' | 'red_carpet' | 'scene_clip' | 'showreel' | 'interview' | 'monologue';
  media_type: 'photo' | 'video';
  is_primary?: boolean;
  thumbnail_url?: string | null;
  embed_provider?: 'r2' | 'direct' | 'youtube' | 'imdb' | 'vimeo' | null;
  embed_id?: string | null;
  duration_seconds?: number | null;
  film_id?: string | null;
  character_name?: string | null;
}

/**
 * Harvests high-resolution actor media (Headshots, Stills, Tagged Photos)
 * completely free from TMDB API and IMDb public CDN endpoints.
 */
async function fetchActorImdbMedia(imdbId: string, actorName: string, tmdbPersonId?: number | null): Promise<ExtractedMedia[]> {
  const mediaList: ExtractedMedia[] = [];
  const seenUrls = new Set<string>();

  console.log(`  📸 Fetching high-resolution media for "${actorName}" via TMDB & IMDb CDN ($0)...`);

  // 1. Fetch TMDB Master Image Galleries (Up to 2000x3000px crystal-clear studio portraits)
  if (tmdbKey) {
    try {
      let resolvedTmdbId = tmdbPersonId;
      if (!resolvedTmdbId) {
        const sRes = await fetch(`https://api.themoviedb.org/3/search/person?api_key=${tmdbKey}&query=${encodeURIComponent(actorName)}`);
        if (sRes.ok) {
          const sData = await sRes.json();
          resolvedTmdbId = sData.results?.[0]?.id;
        }
      }

      if (resolvedTmdbId) {
        // A. Profile Headshots
        const imgRes = await fetch(`https://api.themoviedb.org/3/person/${resolvedTmdbId}/images?api_key=${tmdbKey}`);
        if (imgRes.ok) {
          const imgData = await imgRes.json();
          for (const p of imgData.profiles || []) {
            const fullUrl = `https://image.tmdb.org/t/p/original${p.file_path}`;
            if (!seenUrls.has(fullUrl)) {
              seenUrls.add(fullUrl);
              mediaList.push({
                url: fullUrl,
                title: `${actorName} - Official Portrait`,
                description: `High-resolution studio portrait for ${actorName} (${p.width}x${p.height}).`,
                category: 'headshot',
                media_type: 'photo',
                is_primary: mediaList.length === 0,
              });
            }
          }
        }

        // B. Tagged Production Stills (Actor in movies / BTS / Red Carpet)
        const tagRes = await fetch(`https://api.themoviedb.org/3/person/${resolvedTmdbId}/tagged_images?api_key=${tmdbKey}`);
        if (tagRes.ok) {
          const tagData = await tagRes.json();
          for (const t of tagData.results || []) {
            if (t.file_path) {
              const fullUrl = `https://image.tmdb.org/t/p/original${t.file_path}`;
              if (!seenUrls.has(fullUrl)) {
                seenUrls.add(fullUrl);
                const title = t.media?.title || t.media?.name || `${actorName} - Production Still`;
                mediaList.push({
                  url: fullUrl,
                  title: `Still: ${title}`,
                  description: `Production media still from ${title}.`,
                  category: 'production_still',
                  media_type: 'photo',
                });
              }
            }
          }
        }
      }
    } catch (e: any) {
      console.warn(`  ⚠️ TMDB media extraction error for ${actorName}:`, e.message);
    }
  }

  // 2. Fetch IMDb Public CDN Headshot via free Suggestion API
  try {
    const res = await fetch(`https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(actorName.trim())}.json`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    if (res.ok) {
      const data = await res.json();
      const match = (data.d || []).find((item: any) => item.id === imdbId || item.l?.toLowerCase() === actorName.toLowerCase());
      if (match?.i?.imageUrl) {
        const highRes = toHighResImdbImage(match.i.imageUrl);
        if (!seenUrls.has(highRes)) {
          seenUrls.add(highRes);
          mediaList.push({
            url: highRes,
            title: `${actorName} - IMDb Master Portrait`,
            description: `High-resolution headshot from IMDb (${match.id}).`,
            category: 'headshot',
            media_type: 'photo',
            is_primary: mediaList.length === 0,
          });
        }
      }
    }
  } catch (e: any) {
    console.warn(`  ⚠️ IMDb Suggest image fetch error:`, e.message);
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
): Promise<{ r2Url: string; r2Key: string | null } | null> {
  try {
    const isVideo = item.media_type === 'video';

    // For videos (YouTube, IMDb stream, etc.), direct CDN streaming is instant and reliable
    if (isVideo) {
      console.log(`    🎬 Registering video stream asset [${item.embed_provider || 'video'}]: ${item.title}`);
      return { r2Url: item.url, r2Key: null };
    }

    // 1. Download photo buffer
    console.log(`    📥 Downloading photo: ${item.title}...`);
    const res = await fetch(item.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) {
      // If direct video download fails, fallback to streaming url
      if (isVideo) {
        console.warn(`    ⚠️ Video download returned ${res.status}. Falling back to streaming URL.`);
        return { r2Url: item.url, r2Key: null };
      }
      throw new Error(`Failed to download asset (${res.status}): ${item.url}`);
    }

    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    let contentType = res.headers.get('content-type') || (isVideo ? 'video/mp4' : 'image/jpeg');
    if (isVideo && !contentType.includes('video')) contentType = 'video/mp4';
    const ext = isVideo ? 'mp4' : (contentType.includes('png') ? 'png' : 'jpg');

    // 2. Organize in Cloudflare R2 folder:
    // folder: media/actors/{person.name}/
    // filename: {slug}_{hash}.{ext}
    const cleanActorFolder = person.name.trim();
    const slugTitle = item.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .slice(0, 40);
    const hash = crypto.createHash('md5').update(buffer).digest('hex').slice(0, 8);
    const prefix = isVideo ? 'video_' : '';
    const fileName = `${prefix}${slugTitle}_${hash}.${ext}`;

    const r2Key = `media/actors/${cleanActorFolder}/${fileName}`;

    console.log(`    ☁️ Uploading to R2: "${r2Key}" (${Math.round(buffer.length / 1024)} KB)...`);
    const r2Result = await uploadBufferToR2(r2Key, buffer, contentType);

    return { r2Url: r2Result.url, r2Key: r2Result.key };
  } catch (err: any) {
    if (item.media_type === 'video') {
      console.warn(`    ⚠️ Video processing fallback to original stream URL for ${item.title}:`, err.message);
      return { r2Url: item.url, r2Key: null };
    }
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

  // Fetch high-resolution media (photos, stills, tagged images) via TMDB & IMDb CDN ($0)
  const items = await fetchActorImdbMedia(imdbId, person.name, person.tmdb_id);
  const seenUrls = new Set<string>(items.map((i) => i.url));

  // Also query actor's films from Supabase for official trailers & videos
  const { data: creditsWithFilms } = await supabase
    .from('credits')
    .select(`
      character_name,
      films (
        id, title, trailer_youtube_id, youtube_watch_url, streaming_links
      )
    `)
    .eq('person_id', person.id)
    .limit(10);

  for (const row of creditsWithFilms || []) {
    const film: any = row.films;
    if (!film) continue;
    let ytId = film.trailer_youtube_id;
    if (!ytId && film.streaming_links?.youtube) {
      const match = String(film.streaming_links.youtube).match(/(?:v=|youtu\.be\/|embed\/)([\w-]+)/);
      if (match) ytId = match[1];
    }
    if (!ytId && film.youtube_watch_url) {
      const match = String(film.youtube_watch_url).match(/(?:v=|youtu\.be\/|embed\/)([\w-]+)/);
      if (match) ytId = match[1];
    }

    if (ytId) {
      const ytUrl = `https://www.youtube.com/watch?v=${ytId}`;
      const ytThumb = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
      const videoTitle = `${film.title} - Official Trailer`;

      if (!seenUrls.has(ytUrl) && !existingTitles.has(videoTitle.toLowerCase())) {
        seenUrls.add(ytUrl);
        items.push({
          url: ytUrl,
          title: videoTitle,
          description: `Official trailer for ${film.title} featuring ${person.name}.`,
          category: 'scene_clip',
          media_type: 'video',
          thumbnail_url: ytThumb,
          embed_provider: 'youtube',
          embed_id: ytId,
          film_id: film.id,
          character_name: row.character_name,
        });
        console.log(`  🎬 Added credited film trailer: "${videoTitle}"`);
      }
    }
  }

  console.log(`  📦 Total Discovered Media: ${items.length} items (${items.filter(i => i.media_type === 'video').length} videos, ${items.filter(i => i.media_type === 'photo').length} photos)`);

  let addedCount = 0;

  const VALID_CATEGORIES = new Set([
    'showreel',
    'monologue',
    'scene_clip',
    'interview',
    'headshot',
    'production_still',
    'red_carpet',
    'behind_the_scenes',
  ]);

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

    if (uploaded.r2Key && existingR2Keys.has(uploaded.r2Key)) {
      console.log(`    ⏭️ R2 key already logged in DB: ${uploaded.r2Key}`);
      continue;
    }

    // Insert into person_media
    const isPrimary = !hasPhotos && item.media_type === 'photo' && i === 0;

    let validCategory = item.category as string;
    if (!VALID_CATEGORIES.has(validCategory)) {
      validCategory = item.media_type === 'video' ? 'scene_clip' : 'production_still';
    }

    const { error: dbErr } = await supabase.from('person_media').insert({
      person_id: person.id,
      media_type: item.media_type,
      category: validCategory,
      title: item.title,
      description: item.description,
      url: uploaded.r2Url,
      thumbnail_url: item.thumbnail_url || uploaded.r2Url,
      r2_key: uploaded.r2Key,
      embed_provider: uploaded.r2Key ? 'r2' : (item.embed_provider || (item.media_type === 'video' ? (uploaded.r2Url.includes('youtube') ? 'youtube' : 'imdb') : 'r2')),
      embed_id: item.embed_id || null,
      duration_seconds: item.duration_seconds || null,
      film_id: item.film_id || null,
      character_name: item.character_name || null,
      is_primary: isPrimary,
      status: 'approved',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (dbErr) {
      console.error(`    ⚠️ Failed saving to DB:`, dbErr.message);
    } else {
      console.log(`    ✅ Saved to person_media [${item.media_type} - ${item.category}]: "${item.title}"`);
      addedCount++;
      if (uploaded.r2Key) existingR2Keys.add(uploaded.r2Key);
      existingTitles.add(item.title.toLowerCase());
    }

    // Gentle delay between downloads
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log(`🎉 Finished "${person.name}": Successfully ingested ${addedCount} media assets!`);
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
  const runAll = args.includes('--all');
  const force = args.includes('--force');
  const offsetArg = parseInt(getArg('--offset') || '0', 10);
  const rawLimit = getArg('--limit');
  const maxTotalToProcess = rawLimit ? parseInt(rawLimit, 10) : (runAll ? Infinity : 10);

  // If no explicit flag was used, look for positional or mis-flagged actor name (e.g. `--Richard Mofe-Damijo` or `"Richard Mofe-Damijo"`)
  if (!actorArg && !imdbArg && !runAll) {
    const candidateTokens: string[] = [];
    for (let i = 0; i < args.length; i++) {
      const token = args[i];
      if (token === '--limit' || token.startsWith('--limit=')) {
        if (!token.includes('=')) i++;
        continue;
      }
      if (token === '--offset' || token.startsWith('--offset=')) {
        if (!token.includes('=')) i++;
        continue;
      }
      if (token === '--imdb' || token.startsWith('--imdb=')) {
        if (!token.includes('=')) i++;
        continue;
      }
      if (token === '--all' || token === '--force') continue;
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

  // Batch Mode: Paginate across actors in chunks
  const BATCH_SIZE = 50;
  let currentOffset = offsetArg;
  let processedCount = 0;
  let ingestedActors = 0;

  console.log(`📋 Running in batch mode (Target: ${runAll ? 'ALL actors' : maxTotalToProcess}, Offset: ${offsetArg}, Force: ${force})...`);

  while (processedCount < maxTotalToProcess) {
    const fetchLimit = Math.min(BATCH_SIZE, maxTotalToProcess - processedCount);
    const rangeEnd = currentOffset + fetchLimit - 1;

    console.log(`\n⏳ Fetching actors batch from offset ${currentOffset} to ${rangeEnd}...`);
    const { data: people, error } = await supabase
      .from('people')
      .select('id, name, tmdb_id, popularity_score, film_count')
      .order('popularity_score', { ascending: false, nullsFirst: false })
      .range(currentOffset, rangeEnd);

    if (error) {
      console.error('❌ Supabase error fetching people candidates:', error.message);
      break;
    }

    if (!people || people.length === 0) {
      console.log('🏁 Reached the end of the actors catalogue!');
      break;
    }

    for (const person of people) {
      if (processedCount >= maxTotalToProcess) break;
      processedCount++;

      // Check if actor already has media unless --force is set
      if (!force) {
        const { count, error: countErr } = await supabase
          .from('person_media')
          .select('id', { count: 'exact', head: true })
          .eq('person_id', person.id);

        if (!countErr && typeof count === 'number' && count > 0) {
          console.log(`  ⏭️ [${person.name}] Already has ${count} media items in person_media. Skipping (use --force to re-harvest).`);
          continue;
        }
      }

      try {
        await harvestActor(person);
        ingestedActors++;
      } catch (err: any) {
        console.error(`❌ Error harvesting ${person.name}:`, err.message);
      }

      await new Promise((r) => setTimeout(r, 1200));
    }

    currentOffset += people.length;
  }

  console.log(`\n🏁 Completed! Total checked: ${processedCount} actors (${ingestedActors} ingested/updated).`);
}

main().catch((err) => {
  console.error('Fatal script error:', err);
  process.exit(1);
});
