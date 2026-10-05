import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import dns from 'node:dns';
import { Agent, setGlobalDispatcher } from 'undici';
import crypto from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

dotenv.config({ path: '.env.local' });
dotenv.config();

const customLookup = (hostname, options, callback) => {
  if (hostname === 'pkenrmorywmuvnzfoylp.supabase.co') {
    if (options && options.all) {
      return callback(null, [{ address: '172.64.149.246', family: 4 }]);
    }
    return callback(null, '172.64.149.246', 4);
  }
  return dns.lookup(hostname, options, callback);
};

setGlobalDispatcher(new Agent({ connect: { lookup: customLookup, timeout: 30000 } }));

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY;

const accountId = process.env.R2_ACCOUNT_ID || '';
const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
const bucketName = process.env.R2_BUCKET_NAME || '';
const publicUrl = process.env.R2_PUBLIC_URL || (`https://${bucketName}.${accountId}.r2.dev`);

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey }
});

async function uploadToR2(imgUrl, folder, title) {
  if (!imgUrl) return null;
  try {
    const res = await fetch(imgUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.imdb.com/'
      }
    });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const hash = crypto.createHash('md5').update(buffer).digest('hex').slice(0, 8);
    const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 35);
    const key = `media/${folder}/${cleanTitle}_${hash}.jpg`;
    await r2.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: 'image/jpeg'
    }));
    return `${publicUrl.replace(/\/+$/, '')}/${key}`;
  } catch (err) {
    return null;
  }
}

function normalizeTitle(t) {
  return String(t || '')
    .toLowerCase()
    .replace(/\s*\(\d{4}\).*/, '')
    .replace(/\s*-\s*partyjollof.*/, '')
    .replace(/official poster.*/, '')
    .replace(/the movie.*/, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * High-precision search for Nollywood films on IMDb
 */
async function searchImdbForFilm(title, year, knownActors = []) {
  const normTitle = normalizeTitle(title);
  if (!normTitle || normTitle.length < 2) return null;

  const queries = [
    normTitle,
    normTitle.replace(/^(the|a|an)\s+/, ''),
    year ? `${normTitle} ${year}` : null,
    normTitle.replace(/\b5\b/g, 'five').replace(/\b2\b/g, 'two')
  ].filter(Boolean);

  const seenQueries = new Set();

  for (const q of queries) {
    const cleanQuery = q.replace(/\s+/g, '_');
    if (seenQueries.has(cleanQuery)) continue;
    seenQueries.add(cleanQuery);

    const url = `https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(cleanQuery)}.json`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) continue;
      const json = await res.json();
      const candidates = json.d || [];

      for (const item of candidates) {
        if (!item.id || !item.id.startsWith('tt')) continue;
        if (!item.i || !item.i.imageUrl) continue;

        const candTitleNorm = normalizeTitle(item.l);
        const exactTitle = candTitleNorm === normTitle || candTitleNorm === normTitle.replace(/^(the|a|an)\s+/, '');
        const candYear = item.y;
        const yearMatches = year ? Math.abs(candYear - year) <= 1 : true;

        let actorMatches = false;
        if (knownActors.length > 0 && item.s) {
          const starsLower = item.s.toLowerCase();
          for (const act of knownActors) {
            if (starsLower.includes(act.toLowerCase())) {
              actorMatches = true;
              break;
            }
          }
        }

        if ((exactTitle && yearMatches) || (actorMatches && yearMatches)) {
          const highRes = item.i.imageUrl.replace(/\._V1_.*\.jpg$/, '._V1_FMjpg_UX1000_.jpg');
          return {
            imdb_id: item.id,
            title: item.l,
            year: item.y,
            poster_url: highRes
          };
        }
      }
    } catch (e) {}
  }

  return null;
}

/**
 * Fallback to Firecrawl search if actor names are present
 */
async function searchImdbViaFirecrawl(title, year, actors = []) {
  if (!FIRECRAWL_KEY || actors.length === 0) return null;

  for (const actor of actors.slice(0, 2)) {
    const query = `site:imdb.com/title "${title}" "${actor}"`;
    try {
      const resp = await fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${FIRECRAWL_KEY}`
        },
        body: JSON.stringify({ query, limit: 1 })
      });
      if (!resp.ok) continue;
      const json = await resp.json();
      const hit = (json.data || [])[0];
      if (hit && hit.url) {
        const urlMatch = hit.url.match(/imdb\.com\/title\/(tt\d+)/i);
        if (urlMatch) {
          const imdbId = urlMatch[1];
          const directUrl = `https://v3.sg.media-imdb.com/suggestion/x/${imdbId}.json`;
          const res = await fetch(directUrl);
          const j = await res.json();
          const cand = (j.d || []).find(d => d.id === imdbId);
          if (cand?.i?.imageUrl) {
            return {
              imdb_id: imdbId,
              title: cand.l || hit.title,
              year: cand.y,
              poster_url: cand.i.imageUrl.replace(/\._V1_.*\.jpg$/, '._V1_FMjpg_UX1000_.jpg')
            };
          }
        }
      }
    } catch (e) {}
  }

  return null;
}

async function processFilm(film, index, total) {
  try {
    // 1. Fetch credits for verification
    const { data: creds } = await supabase
      .from('credits')
      .select('people(name)')
      .eq('film_id', film.id)
      .limit(3);

    const actors = (creds || []).map(c => c.people?.name).filter(Boolean);

    // 2. High-precision IMDb matching
    let match = await searchImdbForFilm(film.title, film.year, actors);
    if (!match && actors.length > 0) {
      match = await searchImdbViaFirecrawl(film.title, film.year, actors);
    }

    if (match) {
      console.log(`[${index + 1}/${total}] 🎯 Matched: "${match.title}" (${match.year}) [${match.imdb_id}] for "${film.title}"`);
      const r2Url = await uploadToR2(match.poster_url, 'posters', film.title);
      if (r2Url) {
        const updatePayload = {
          poster_url: r2Url,
          backdrop_url: r2Url,
          updated_at: new Date().toISOString()
        };
        if (!film.imdb_id) updatePayload.imdb_id = match.imdb_id;
        if (!film.year && match.year) updatePayload.year = match.year;

        const { error: updErr } = await supabase.from('films').update(updatePayload).eq('id', film.id);
        if (updErr && updErr.message.includes('films_imdb_id_uidx')) {
          delete updatePayload.imdb_id;
          await supabase.from('films').update(updatePayload).eq('id', film.id);
        }
        console.log(`   ✨ Saved R2 poster: ${r2Url}`);
        return { status: 'matched', r2Url };
      }
    }

    // 3. If no match found, clear dead partyjollof URL
    console.log(`[${index + 1}/${total}] 🧹 No match for "${film.title}" (${film.year}) - clearing dead partyjollof URL`);
    await supabase.from('films').update({
      poster_url: null,
      backdrop_url: null,
      updated_at: new Date().toISOString()
    }).eq('id', film.id);
    return { status: 'cleared' };
  } catch (err) {
    console.warn(`[${index + 1}/${total}] ⚠️ Error on "${film.title}":`, err.message);
    return { status: 'error' };
  }
}

async function run() {
  console.log('🚀 Starting Intelligent PartyJollof Poster Ingestion & Cleanup...');

  const { data: films, error } = await supabase
    .from('films')
    .select('id, title, year, imdb_id, poster_url')
    .ilike('poster_url', '%partyjollof%')
    .order('year', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('Database error:', error);
    return;
  }

  console.log(`Found ${films.length} remaining films with partyjollof poster_url.`);

  let matched = 0;
  let cleared = 0;

  // Process in chunks of 5 concurrently for polite speed
  const chunkSize = 5;
  for (let i = 0; i < films.length; i += chunkSize) {
    const chunk = films.slice(i, i + chunkSize);
    const results = await Promise.all(
      chunk.map((film, chunkIdx) => processFilm(film, i + chunkIdx, films.length))
    );

    for (const r of results) {
      if (r.status === 'matched') matched++;
      else if (r.status === 'cleared') cleared++;
    }

    // Brief pause between chunks
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n=============================================');
  console.log(`🎉 PARTYJOLLOF POSTER PROCESSING COMPLETE:`);
  console.log(`Total processed: ${films.length}`);
  console.log(`IMDb posters matched & uploaded to R2: ${matched}`);
  console.log(`Dead 404 links safely cleared: ${cleared}`);
  console.log('=============================================');
}

run().catch(console.error);
