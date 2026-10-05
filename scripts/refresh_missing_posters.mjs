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

/**
 * Extracts high-res poster from an IMDb title page via Firecrawl or direct fetch
 */
async function fetchImdbPoster(imdbId) {
  const url = `https://www.imdb.com/title/${imdbId}/`;
  try {
    const resp = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FIRECRAWL_KEY}`
      },
      body: JSON.stringify({
        url,
        formats: ['html']
      })
    });
    const json = await resp.json();
    if (json.data && json.data.html) {
      const html = json.data.html;
      // Look for og:image
      const ogMatch = html.match(/<meta[^>]+property=['"]og:image['"][^>]+content=['"]([^'"]+)['"]/i) ||
                      html.match(/<meta[^>]+content=['"]([^'"]+)['"][^>]+property=['"]og:image['"]/i);
      if (ogMatch && ogMatch[1] && ogMatch[1].includes('m.media-amazon.com')) {
        // Upgrade to high-res
        const highRes = ogMatch[1].replace(/\._V1_.*\.jpg$/, '._V1_FMjpg_UX1000_.jpg');
        return highRes;
      }
      // Fallback: search for media-amazon poster patterns
      const imgs = html.match(/https:\/\/m\.media-amazon\.com\/images\/M\/[^\s"']+\.jpg/gi) || [];
      for (const img of imgs) {
        if (!img.includes('logo') && !img.includes('icon') && !img.includes('ad')) {
          return img.replace(/\._V1_.*\.jpg$/, '._V1_FMjpg_UX1000_.jpg');
        }
      }
    }
  } catch (err) {
    console.warn(`    ⚠️ Scrape failed for ${imdbId}:`, err.message);
  }
  return null;
}

async function refreshBatch(limit = 10) {
  console.log(`🔍 Scanning for films with missing or broken posters (batch size: ${limit})...`);

  // Query films with missing posters that have imdb_id
  const { data: films, error } = await supabase
    .from('films')
    .select('id, title, year, imdb_id, poster_url')
    .not('imdb_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('Error fetching films:', error);
    return;
  }

  const targets = films.filter(f => !f.poster_url || f.poster_url.trim() === '' || f.poster_url.includes('partyjolloftv') || f.poster_url.includes('wikimedia')).slice(0, limit);

  console.log(`Found ${targets.length} priority targets to refresh:`);
  for (const t of targets) {
    console.log(` - "${t.title}" (${t.year}) [IMDb: ${t.imdb_id}]`);
  }

  for (const film of targets) {
    console.log(`\nRefreshing poster for: "${film.title}" (${film.imdb_id})...`);
    const rawPoster = await fetchImdbPoster(film.imdb_id);
    if (!rawPoster) {
      console.log(`  ❌ No poster found on IMDb for ${film.title}`);
      continue;
    }
    console.log(`  Found raw poster: ${rawPoster}`);
    const r2Url = await uploadToR2(rawPoster, 'posters', film.title);
    if (r2Url) {
      const { error: updateErr } = await supabase
        .from('films')
        .update({
          poster_url: r2Url,
          backdrop_url: r2Url,
          updated_at: new Date().toISOString()
        })
        .eq('id', film.id);

      if (updateErr) {
        console.error(`  ❌ Failed updating DB for ${film.title}:`, updateErr.message);
      } else {
        console.log(`  ✨ Successfully permanized and updated poster in Supabase: ${r2Url}`);
      }
    }
  }

  console.log('\n🎉 Batch refresh complete!');
}

refreshBatch(5).catch(console.error);
