/**
 * Continuous Indefinite Actor Media Harvester (Photos & Videos)
 * Run concurrently alongside actor filmography enrichment on any machine:
 *   node scripts/run_continuous_actor_media_harvester.mjs
 * Or with custom batch parameters:
 *   node scripts/run_continuous_actor_media_harvester.mjs --batch=15 --delay=1000
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const tmdbKey = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
const tmdbToken = process.env.VITE_TMDB_READ_ACCESS_TOKEN;
const youtubeKey = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY;

const STATE_FILE = path.resolve('scripts/data/actor_media_harvester_state.json');

// --- Cloudflare R2 Upload Utilities (Native AWS Signature v4) ---
function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID || '';
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
  const bucketName = process.env.R2_BUCKET_NAME || '';
  const publicUrl = process.env.R2_PUBLIC_URL || '';

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    return null;
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl };
}

function hmacSha256(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function uploadToR2(fileName, fileBytes, mimeType) {
  const config = getR2Config();
  if (!config) {
    throw new Error('R2 credentials missing. Skipping R2 upload.');
  }

  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
  const region = 'auto';
  const service = 's3';

  const cleanKey = fileName.replace(/^\/+/, '');
  const path = `/${config.bucketName}/${cleanKey}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);

  const payloadHash = sha256Hex(fileBytes);

  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const canonicalHeaders =
    `content-type:${mimeType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest =
    `PUT\n` +
    `${path}\n` +
    `\n` +
    `${canonicalHeaders}\n` +
    `${signedHeaders}\n` +
    `${payloadHash}`;

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign =
    `${algorithm}\n` +
    `${amzDate}\n` +
    `${credentialScope}\n` +
    `${sha256Hex(canonicalRequest)}`;

  const kDate = hmacSha256(`AWS4${config.secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = hmacSha256(kSigning, stringToSign).toString('hex');

  const authorizationHeader =
    `${algorithm} ` +
    `Credential=${config.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, ` +
    `Signature=${signature}`;

  const uploadUrl = `${endpoint}${path}`;
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': mimeType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization: authorizationHeader,
    },
    body: fileBytes,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Cloudflare R2 upload failed (${response.status}): ${errText}`);
  }

  const publicBase = config.publicUrl
    ? config.publicUrl.replace(/\/+$/, '')
    : `https://${config.bucketName}.${config.accountId}.r2.cloudflarestorage.com`;

  const publicUrl = `${publicBase}/${cleanKey}`;

  return {
    url: publicUrl,
    key: cleanKey,
    sizeMb: Number((fileBytes.length / (1024 * 1024)).toFixed(2)),
  };
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      if (!parsed.film_processed_ids) parsed.film_processed_ids = {};
      return parsed;
    }
  } catch {}
  return { processed_ids: {}, film_processed_ids: {}, total_photos: 0, total_videos: 0, total_film_media: 0, last_run_at: null };
}

function saveState(state) {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save state:', err.message);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 1. Fetch High-Res Photos from TMDB (Headshots + Tagged Film Stills)
 */
async function fetchTmdbPhotos(tmdbPersonId) {
  const headers = tmdbToken 
    ? { 'Authorization': `Bearer ${tmdbToken}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
  const queryParam = tmdbKey ? `?api_key=${tmdbKey}` : '';

  const photos = [];

  // A. Person Headshots
  try {
    const imagesUrl = `https://api.themoviedb.org/3/person/${tmdbPersonId}/images${queryParam}`;
    const res = await fetch(imagesUrl, { headers });
    if (res.ok) {
      const data = await res.json();
      for (const p of data.profiles || []) {
        if (p.file_path) {
          photos.push({
            url: `https://image.tmdb.org/t/p/original${p.file_path}`,
            thumbnail_url: `https://image.tmdb.org/t/p/w500${p.file_path}`,
            width: p.width,
            height: p.height,
            aspect_ratio: p.aspect_ratio ? String(p.aspect_ratio.toFixed(2)) : '2:3',
            category: 'headshot',
            title: 'Official Headshot'
          });
        }
      }
    }
  } catch (e) {
    console.warn('  ⚠️ TMDB Images error:', e.message);
  }

  // B. Tagged Production Stills & Film Backdrops
  try {
    const taggedUrl = `https://api.themoviedb.org/3/person/${tmdbPersonId}/tagged_images${queryParam}`;
    const res = await fetch(taggedUrl, { headers });
    if (res.ok) {
      const data = await res.json();
      for (const img of data.results || []) {
        const filePath = img.media?.backdrop_path || img.file_path;
        if (filePath) {
          photos.push({
            url: `https://image.tmdb.org/t/p/original${filePath}`,
            thumbnail_url: `https://image.tmdb.org/t/p/w780${filePath}`,
            width: img.width || 1920,
            height: img.height || 1080,
            aspect_ratio: '16:9',
            category: 'production_still',
            title: img.media?.title || img.media?.name ? `Production Still: ${img.media.title || img.media.name}` : 'Production Still',
            film_tmdb_id: img.media?.id
          });
        }
      }
    }
  } catch (e) {}

  return photos;
}

/**
 * 2. Search YouTube for Showreels, Monologues, and Interviews
 */
async function searchYouTubeMedia(actorName) {
  if (!youtubeKey) return [];
  const queries = [
    { q: `${actorName} showreel monologue`, category: 'showreel' },
    { q: `${actorName} interview nollywood`, category: 'interview' }
  ];

  const videos = [];

  for (const { q, category } of queries) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&maxResults=2&key=${youtubeKey}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();

      for (const item of data.items || []) {
        const videoId = item.id?.videoId;
        if (videoId) {
          videos.push({
            embed_provider: 'youtube',
            embed_id: videoId,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            thumbnail_url: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url,
            title: item.snippet?.title || `${actorName} - ${category}`,
            description: item.snippet?.description || null,
            category,
            year: item.snippet?.publishedAt ? new Date(item.snippet.publishedAt).getFullYear() : null
          });
        }
      }
    } catch (e) {
      console.warn(`  ⚠️ YouTube search error for "${q}":`, e.message);
    }
  }

  return videos;
}

/**
 * 3. Fetch Credited Film Trailers & Scenes for this Actor
 */
async function getCreditedFilmVideos(personId) {
  try {
    const { data: credits } = await supabase
      .from('credits')
      .select('character_name, films(id, title, youtube_watch_url, trailer_youtube_id, release_date)')
      .eq('person_id', personId)
      .limit(10);

    const videos = [];
    for (const c of credits || []) {
      const film = c.films;
      if (!film) continue;
      const ytId = film.trailer_youtube_id || (film.youtube_watch_url ? film.youtube_watch_url.match(/(?:v=|youtu\.be\/)([\w-]+)/)?.[1] : null);
      if (ytId) {
        videos.push({
          embed_provider: 'youtube',
          embed_id: ytId,
          url: `https://www.youtube.com/watch?v=${ytId}`,
          thumbnail_url: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
          title: `Performance in "${film.title}"${c.character_name ? ` as ${c.character_name}` : ''}`,
          category: 'scene_clip',
          film_id: film.id,
          character_name: c.character_name || null,
          year: film.release_date ? new Date(film.release_date).getFullYear() : null
        });
      }
    }
    return videos;
  } catch {
    return [];
  }
}

/**
 * Download an image and upload to Cloudflare R2
 */
async function uploadPhotoBufferToR2(personId, photoUrl, index) {
  const res = await fetch(photoUrl);
  if (!res.ok) throw new Error(`Image download failed: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const fileName = `media/actors/${personId}/photos/${Date.now()}_${index}.jpg`;
  const result = await uploadToR2(fileName, buffer, 'image/jpeg');
  return result;
}

/**
 * Process a single actor for Photos and Videos
 */
async function processActorMedia(person, state) {
  console.log(`\n======================================================`);
  console.log(`📸 Harvesting Media for: "${person.name}" (${person.id})`);

  let newPhotosCount = 0;
  let newVideosCount = 0;

  // Check existing media to avoid duplicate uploads
  const { data: existingMedia } = await supabase
    .from('person_media')
    .select('url, embed_id, category, media_type')
    .eq('person_id', person.id);

  const existingUrls = new Set((existingMedia || []).map(m => m.url));
  const existingEmbeds = new Set((existingMedia || []).map(m => m.embed_id).filter(Boolean));

  // 1. Process Photos
  if (person.tmdb_id) {
    const rawPhotos = await fetchTmdbPhotos(person.tmdb_id);
    console.log(`  🖼️ Found ${rawPhotos.length} potential photos on TMDB`);

    for (let i = 0; i < rawPhotos.length; i++) {
      const p = rawPhotos[i];
      if (existingUrls.has(p.url)) continue;

      try {
        let finalUrl = p.url;
        let r2Key = null;

        // Try R2 upload if configured
        const r2Config = getR2Config();
        if (r2Config) {
          console.log(`  ☁️ Uploading photo ${i + 1}/${rawPhotos.length} to Cloudflare R2...`);
          const r2Result = await uploadPhotoBufferToR2(person.id, p.url, i);
          finalUrl = r2Result.url;
          r2Key = r2Result.key;
          console.log(`    ✅ Stored in R2: ${finalUrl}`);
        } else {
          console.log(`    ℹ️ R2 env not configured, linking direct CDN URL: ${finalUrl}`);
        }

        // Check if film_id needs matching
        let matchedFilmId = null;
        if (p.film_tmdb_id) {
          const { data: film } = await supabase.from('films').select('id').eq('tmdb_id', p.film_tmdb_id).maybeSingle();
          if (film) matchedFilmId = film.id;
        }

        const isPrimary = i === 0 && !existingMedia?.some(m => m.media_type === 'photo');

        await supabase.from('person_media').insert({
          person_id: person.id,
          media_type: 'photo',
          category: p.category,
          title: p.title,
          url: finalUrl,
          thumbnail_url: finalUrl,
          r2_key: r2Key,
          embed_provider: r2Key ? 'r2' : 'tmdb',
          width: p.width,
          height: p.height,
          aspect_ratio: p.aspect_ratio,
          film_id: matchedFilmId,
          is_primary: isPrimary,
          status: 'approved'
        });

        existingUrls.add(finalUrl);
        newPhotosCount++;
        state.total_photos++;
      } catch (err) {
        console.warn(`    ⚠️ Failed photo processing for ${p.url}:`, err.message);
      }
      await sleep(200);
    }
  }

  // 2. Process Videos (YouTube / Vimeo / Scene Clips)
  const ytVideos = await searchYouTubeMedia(person.name);
  const filmVideos = await getCreditedFilmVideos(person.id);
  const allVideos = [...ytVideos, ...filmVideos];

  console.log(`  🎥 Found ${allVideos.length} candidate video links`);

  for (const v of allVideos) {
    if (v.embed_id && existingEmbeds.has(v.embed_id)) continue;

    try {
      await supabase.from('person_media').insert({
        person_id: person.id,
        media_type: 'video',
        category: v.category,
        title: v.title,
        description: v.description,
        url: v.url,
        thumbnail_url: v.thumbnail_url,
        embed_provider: v.embed_provider,
        embed_id: v.embed_id,
        film_id: v.film_id || null,
        character_name: v.character_name || null,
        year: v.year || null,
        status: 'approved'
      });

      if (v.embed_id) existingEmbeds.add(v.embed_id);
      newVideosCount++;
      state.total_videos++;
      console.log(`    🎬 Linked Video [${v.category}]: "${v.title}"`);
    } catch (err) {
      console.warn(`    ⚠️ Error linking video:`, err.message);
    }
  }

  console.log(`  ✨ Summary for ${person.name}: Added ${newPhotosCount} Photos, ${newVideosCount} Videos.`);
}

/**
 * 4. Fetch High-Res Backdrops & Posters for Film
 */
async function fetchTmdbFilmImages(tmdbId) {
  const headers = tmdbToken 
    ? { 'Authorization': `Bearer ${tmdbToken}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
  const queryParam = tmdbKey ? `?api_key=${tmdbKey}` : '';

  const images = [];
  try {
    const res = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}/images${queryParam}`, { headers });
    if (res.ok) {
      const data = await res.json();
      for (const b of data.backdrops || []) {
        if (b.file_path) {
          images.push({
            url: `https://image.tmdb.org/t/p/original${b.file_path}`,
            thumbnail_url: `https://image.tmdb.org/t/p/w780${b.file_path}`,
            width: b.width,
            height: b.height,
            aspect_ratio: b.aspect_ratio ? String(b.aspect_ratio.toFixed(2)) : '16:9',
            category: 'backdrop',
            title: 'Official Backdrop / Wallpaper'
          });
        }
      }
      for (const p of data.posters || []) {
        if (p.file_path) {
          images.push({
            url: `https://image.tmdb.org/t/p/original${p.file_path}`,
            thumbnail_url: `https://image.tmdb.org/t/p/w500${p.file_path}`,
            width: p.width,
            height: p.height,
            aspect_ratio: p.aspect_ratio ? String(p.aspect_ratio.toFixed(2)) : '2:3',
            category: 'poster',
            title: 'Official Theatrical Poster'
          });
        }
      }
    }
  } catch (err) {
    console.warn(`  ⚠️ TMDB Movie Images error for ${tmdbId}:`, err.message);
  }
  return images;
}

/**
 * 5. Fetch Trailers & Clips for Film
 */
async function fetchTmdbFilmVideos(tmdbId) {
  const headers = tmdbToken 
    ? { 'Authorization': `Bearer ${tmdbToken}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
  const queryParam = tmdbKey ? `?api_key=${tmdbKey}` : '';

  const videos = [];
  try {
    const res = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}/videos${queryParam}`, { headers });
    if (res.ok) {
      const data = await res.json();
      for (const v of data.results || []) {
        if (v.site === 'YouTube' && v.key) {
          const cat = v.type?.toLowerCase() === 'trailer' ? 'trailer' : 'clip';
          videos.push({
            embed_provider: 'youtube',
            embed_id: v.key,
            url: `https://www.youtube.com/watch?v=${v.key}`,
            thumbnail_url: `https://i.ytimg.com/vi/${v.key}/hqdefault.jpg`,
            title: v.name || `${cat}`,
            category: cat
          });
        }
      }
    }
  } catch (err) {
    console.warn(`  ⚠️ TMDB Movie Videos error for ${tmdbId}:`, err.message);
  }
  return videos;
}

async function resolveTmdbIdForFilm(film) {
  if (film.tmdb_id) return film.tmdb_id;
  if (!tmdbKey && !tmdbToken) return null;

  try {
    const headers = tmdbToken 
      ? { 'Authorization': `Bearer ${tmdbToken}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
    const queryParam = tmdbKey ? `&api_key=${tmdbKey}` : '';
    const q = encodeURIComponent(film.title);
    const yr = film.year ? `&year=${film.year}` : '';
    const res = await fetch(`https://api.themoviedb.org/3/search/movie?query=${q}${yr}${queryParam}`, { headers });
    if (res.ok) {
      const data = await res.json();
      const first = data.results?.[0];
      if (first && first.id) {
        await supabase.from('films').update({ tmdb_id: first.id }).eq('id', film.id);
        return first.id;
      }
    }
  } catch {}
  return null;
}

/**
 * Process media for a single Film
 */
async function processFilmMedia(film, state) {
  console.log(`\n======================================================`);
  console.log(`🎬 Harvesting Film Media for: "${film.title}" (${film.id})`);

  let newImagesCount = 0;
  let newVideosCount = 0;

  const { data: existingMedia } = await supabase
    .from('film_media')
    .select('url, embed_id, category, media_type')
    .eq('film_id', film.id);

  const existingUrls = new Set((existingMedia || []).map(m => m.url));
  const existingEmbeds = new Set((existingMedia || []).map(m => m.embed_id).filter(Boolean));

  const tmdbId = await resolveTmdbIdForFilm(film);

  if (tmdbId) {
    const rawImages = await fetchTmdbFilmImages(tmdbId);
    console.log(`  🖼️ Found ${rawImages.length} images on TMDB for "${film.title}"`);

    for (let i = 0; i < rawImages.length; i++) {
      const img = rawImages[i];
      if (existingUrls.has(img.url)) continue;

      try {
        let finalUrl = img.url;
        let r2Key = null;

        const r2Config = getR2Config();
        if (r2Config) {
          const res = await fetch(img.url);
          if (res.ok) {
            const buffer = Buffer.from(await res.arrayBuffer());
            const fileName = `media/films/${film.id}/${img.category}/${Date.now()}_${i}.jpg`;
            const r2Result = await uploadToR2(fileName, buffer, 'image/jpeg');
            finalUrl = r2Result.url;
            r2Key = r2Result.key;
            console.log(`    ✅ Stored Film Image in R2 [${img.category}]: ${finalUrl}`);
          }
        }

        const isPrimary = i === 0;

        await supabase.from('film_media').insert({
          film_id: film.id,
          media_type: 'photo',
          category: img.category,
          title: img.title,
          url: finalUrl,
          thumbnail_url: img.thumbnail_url || finalUrl,
          r2_key: r2Key,
          embed_provider: r2Key ? 'r2' : 'tmdb',
          width: img.width,
          height: img.height,
          aspect_ratio: img.aspect_ratio,
          year: film.year || null,
          is_primary: isPrimary,
          status: 'approved'
        });

        // Also backfill poster_url or backdrop_url if missing on films table
        const filmUpdates = {};
        if (img.category === 'poster' && !film.poster_url) {
          filmUpdates.poster_url = finalUrl;
          film.poster_url = finalUrl;
        }
        if (img.category === 'backdrop' && !film.backdrop_url) {
          filmUpdates.backdrop_url = finalUrl;
          film.backdrop_url = finalUrl;
        }
        if (Object.keys(filmUpdates).length > 0) {
          await supabase.from('films').update(filmUpdates).eq('id', film.id);
        }

        existingUrls.add(finalUrl);
        newImagesCount++;
        state.total_film_media = (state.total_film_media || 0) + 1;
      } catch (err) {
        console.warn(`    ⚠️ Failed film photo processing for ${img.url}:`, err.message);
      }
      await sleep(200);
    }

    const videos = await fetchTmdbFilmVideos(tmdbId);
    for (const v of videos) {
      if (v.embed_id && existingEmbeds.has(v.embed_id)) continue;
      try {
        await supabase.from('film_media').insert({
          film_id: film.id,
          media_type: 'video',
          category: v.category,
          title: v.title,
          url: v.url,
          thumbnail_url: v.thumbnail_url,
          embed_provider: v.embed_provider,
          embed_id: v.embed_id,
          year: film.year || null,
          status: 'approved'
        });

        if (!film.trailer_youtube_id && v.category === 'trailer') {
          await supabase.from('films').update({ trailer_youtube_id: v.embed_id }).eq('id', film.id);
          film.trailer_youtube_id = v.embed_id;
        }

        existingEmbeds.add(v.embed_id);
        newVideosCount++;
        console.log(`    🎬 Linked Film Video [${v.category}]: "${v.title}"`);
      } catch (err) {
        console.warn(`    ⚠️ Error linking film video:`, err.message);
      }
    }
  }

  console.log(`  ✨ Summary for Film "${film.title}": Added ${newImagesCount} Images, ${newVideosCount} Videos.`);
}

async function runMediaHarvesterDaemon() {
  console.log('🚀 Starting Continuous Media Harvester Daemon (Films & Actors -> R2 Upload + TMDB/YouTube Links)...');
  const state = loadState();

  const BATCH_SIZE = 15;
  const DELAY_MS = 1000;

  let actorOffset = 0;
  let filmOffset = 0;

  while (true) {
    // 1. Process a batch of Films (prioritizing Box Office Cinema Movies)
    let filmQuery = supabase
      .from('films')
      .select('id, title, year, tmdb_id, poster_url, backdrop_url, trailer_youtube_id, box_office_domestic');

    // Box office films first
    filmQuery = filmQuery
      .gt('box_office_domestic', 0)
      .order('box_office_domestic', { ascending: false })
      .range(filmOffset, filmOffset + BATCH_SIZE - 1);

    const { data: films, error: filmErr } = await filmQuery;

    if (!filmErr && films && films.length > 0) {
      console.log(`\n🎬 Film Media Harvester Batch: ${filmOffset} - ${filmOffset + films.length} (${films.length} box office films)`);
      for (const film of films) {
        try {
          await processFilmMedia(film, state);
          state.film_processed_ids[film.id] = new Date().toISOString();
          saveState(state);
        } catch (err) {
          console.error(`❌ Error harvesting film media for "${film.title}":`, err.message);
        }
        await sleep(DELAY_MS);
      }
      filmOffset += BATCH_SIZE;
    } else {
      filmOffset = 0; // Wrap around
    }

    // 2. Process a batch of Actors
    const { data: people, error: actorErr } = await supabase
      .from('people')
      .select('id, name, tmdb_id, popularity_score, film_count')
      .order('popularity_score', { ascending: false })
      .range(actorOffset, actorOffset + BATCH_SIZE - 1);

    if (!actorErr && people && people.length > 0) {
      console.log(`\n👤 Actor Media Harvester Batch: ${actorOffset} - ${actorOffset + people.length} (${people.length} actors)`);
      for (const p of people) {
        try {
          await processActorMedia(p, state);
          state.processed_ids[p.id] = new Date().toISOString();
          state.last_run_at = new Date().toISOString();
          saveState(state);
        } catch (err) {
          console.error(`❌ Error processing media for ${p.name}:`, err.message);
        }
        await sleep(DELAY_MS);
      }
      actorOffset += BATCH_SIZE;
    } else {
      actorOffset = 0; // Wrap around
    }

    await sleep(2000);
  }
}

runMediaHarvesterDaemon().catch(console.error);

