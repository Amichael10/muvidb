import dns from 'node:dns';
import { Agent, setGlobalDispatcher } from 'undici';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

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

setGlobalDispatcher(new Agent({
  connect: { lookup: customLookup, timeout: 30000 },
  headersTimeout: 30000,
  bodyTimeout: 30000
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

const accountId = process.env.R2_ACCOUNT_ID || '';
const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
const bucketName = process.env.R2_BUCKET_NAME || '';
const publicUrl = process.env.R2_PUBLIC_URL || `https://${bucketName}.${accountId}.r2.dev`;

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey }
});

async function uploadToR2(url, folder, title) {
  if (!url) return null;
  // If already hosted on R2 or Supabase storage, keep as is!
  if (url.includes('r2.dev') || url.includes('supabase.co/storage')) {
    return url;
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!res.ok) {
      console.warn(`Fetch failed for ${url} (${res.status})`);
      return url;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : (contentType.includes('webp') ? 'webp' : 'jpg');
    const hash = crypto.createHash('md5').update(buffer).digest('hex').slice(0, 8);
    const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30);
    const key = `media/${folder}/${cleanTitle}_${hash}.${ext}`;

    await r2.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType
    }));

    const permanentUrl = `${publicUrl.replace(/\/+$/, '')}/${key}`;
    console.log(`  ☁️ Permanized to R2: ${permanentUrl}`);
    return permanentUrl;
  } catch (err) {
    console.warn(`  ⚠️ Could not upload ${url}:`, err.message);
    return url;
  }
}

async function run() {
  console.log('🚀 Permanizing poster and backdrop assets for Arole films...');

  const titles = ['The Call', 'Wasila Coded Reloaded', 'Knock Out', 'Online', 'Dice', 'Alakada Reloaded'];
  const { data: films } = await supabase
    .from('films')
    .select('id, title, year, poster_url, backdrop_url')
    .in('title', titles);

  for (const film of films || []) {
    console.log(`\nProcessing: "${film.title}"`);
    let newPoster = film.poster_url;
    let newBackdrop = film.backdrop_url;

    if (film.poster_url) {
      newPoster = await uploadToR2(film.poster_url, 'posters', film.title);
    }
    if (film.backdrop_url) {
      newBackdrop = await uploadToR2(film.backdrop_url, 'backdrops', `${film.title}_backdrop`);
    }

    const updates = {};
    if (newPoster !== film.poster_url) updates.poster_url = newPoster;
    if (newBackdrop !== film.backdrop_url) updates.backdrop_url = newBackdrop;
    if (film.title === 'The Call' && !film.year) updates.year = 2019;

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      await supabase.from('films').update(updates).eq('id', film.id);
      console.log(`  ✅ Updated "${film.title}" in DB with permanent storage.`);
    } else {
      console.log(`  ✓ Already in permanent storage.`);
    }
  }

  console.log('\n🎉 Finished asset permanization!');
}

run();
