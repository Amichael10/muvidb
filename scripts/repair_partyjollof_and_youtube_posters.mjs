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
    if (!res.ok) {
      console.warn(`    ⚠️ Fetch image failed (${res.status}): ${imgUrl}`);
      return null;
    }
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
    console.warn(`    ⚠️ R2 upload error:`, err.message);
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
async function searchImdbForFilm(title, year) {
  const normTitle = normalizeTitle(title);
  if (!normTitle || normTitle.length < 2) return null;

  const cleanQuery = normTitle.replace(/\s+/g, '_');
  const url = `https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(cleanQuery)}.json`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    if (!res.ok) return null;
    const json = await res.json();
    const candidates = json.d || [];

    for (const item of candidates) {
      // Must be a title
      if (!item.id || !item.id.startsWith('tt')) continue;
      // Must have an image
      if (!item.i || !item.i.imageUrl) continue;

      const candTitleNorm = normalizeTitle(item.l);
      // Check title match - STRICT exact title match only! No partial or prefix match!
      const exactTitle = candTitleNorm === normTitle;

      // Check year match
      const candYear = item.y;
      const yearMatches = year ? Math.abs(candYear - year) <= 1 : true;

      // STRICT: Must be EXACT title AND year match to guarantee 100% correct posters
      if (exactTitle && yearMatches) {
        const highRes = item.i.imageUrl.replace(/\._V1_.*\.jpg$/, '._V1_FMjpg_UX1000_.jpg');
        return {
          imdb_id: item.id,
          title: item.l,
          year: item.y,
          poster_url: highRes
        };
      }
    }
  } catch (err) {
    console.warn(`    ⚠️ IMDb search error for "${title}":`, err.message);
  }

  return null;
}

async function run() {
  console.log('🚀 Starting PartyJollof Poster Repair & R2 Permanizer (High Precision Mode)...');

  // Fetch films whose poster_url contains partyjollof
  const { data: films, error } = await supabase
    .from('films')
    .select('id, title, year, imdb_id, poster_url')
    .ilike('poster_url', '%partyjollof%')
    .order('year', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('Database error:', error);
    return;
  }

  console.log(`Found ${films.length} PartyJollof films to repair.`);

  let matched = 0;
  let skipped = 0;
  let updated = 0;

  for (let i = 0; i < films.length; i++) {
    const film = films[i];
    console.log(`\n[${i + 1}/${films.length}] Processing: "${film.title}" (${film.year || 'N/A'})...`);

    let match = null;

    // 1. If film already has imdb_id, fetch suggestion by that ID
    if (film.imdb_id) {
      console.log(`  Film has existing imdb_id: ${film.imdb_id}`);
      const directUrl = `https://v3.sg.media-imdb.com/suggestion/x/${film.imdb_id}.json`;
      try {
        const res = await fetch(directUrl);
        const json = await res.json();
        const cand = (json.d || []).find(d => d.id === film.imdb_id);
        if (cand && cand.i?.imageUrl) {
          match = {
            imdb_id: film.imdb_id,
            title: cand.l,
            year: cand.y,
            poster_url: cand.i.imageUrl.replace(/\._V1_.*\.jpg$/, '._V1_FMjpg_UX1000_.jpg')
          };
        }
      } catch (e) {}
    }

    // 2. Otherwise search high precision
    if (!match) {
      match = await searchImdbForFilm(film.title, film.year);
    }

    if (!match) {
      console.log(`  ⚠️ No safe high-precision IMDb match for "${film.title}" (${film.year}). Skipping to protect accuracy.`);
      skipped++;
      continue;
    }

    matched++;
    console.log(`  🎯 High-Precision Match: "${match.title}" (${match.year}) [${match.imdb_id}]`);

    // Permanize to R2
    const r2Url = await uploadToR2(match.poster_url, 'posters', film.title);
    if (!r2Url) {
      console.warn(`  ❌ Failed uploading to R2 for ${film.title}`);
      continue;
    }

    // Update film in Supabase
    const updatePayload = {
      poster_url: r2Url,
      backdrop_url: r2Url,
      updated_at: new Date().toISOString()
    };
    if (!film.imdb_id) updatePayload.imdb_id = match.imdb_id;
    if (!film.year && match.year) updatePayload.year = match.year;

    const { error: updErr } = await supabase.from('films').update(updatePayload).eq('id', film.id);
    if (updErr) {
      if (updErr.message.includes('films_imdb_id_uidx')) {
        // Another row already has this imdb_id, update poster anyway
        delete updatePayload.imdb_id;
        const { error: retryErr } = await supabase.from('films').update(updatePayload).eq('id', film.id);
        if (!retryErr) {
          console.log(`  ✨ Saved to Supabase (poster updated): ${r2Url}`);
          updated++;
        } else {
          console.error(`  ❌ Failed updating DB on retry:`, retryErr.message);
        }
      } else {
        console.error(`  ❌ Failed updating DB:`, updErr.message);
      }
    } else {
      console.log(`  ✨ Saved to Supabase: ${r2Url}`);
      updated++;
    }

    // Sleep 150ms between requests to be polite
    await new Promise(r => setTimeout(r, 150));
  }

  console.log('\n=============================================');
  console.log(`🎉 PARTYJOLLOF REPAIR SUMMARY:`);
  console.log(`Total processed: ${films.length}`);
  console.log(`High-precision matches found: ${matched}`);
  console.log(`Updated in Supabase with R2 posters: ${updated}`);
  console.log(`Skipped (safely avoided false positives): ${skipped}`);
  console.log('=============================================');
}

run().catch(console.error);
