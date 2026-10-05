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
  const res = await fetch(imgUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://www.imdb.com/'
    }
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
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
  const permUrl = `${publicUrl.replace(/\/+$/, '')}/${key}`;
  console.log(`  ☁️ Permanized to R2: ${permUrl}`);
  return permUrl;
}

async function fixSpecificFilms() {
  console.log('1. Fixing Made in Heaven (tt14605638)...');
  const madeInHeavenPoster = 'https://m.media-amazon.com/images/M/MV5BYjhhODJjOWUtY2IwZi00Zjc0LTg4ZTQtMzlkMTdlOWMxNDBmXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg';
  const r2Made = await uploadToR2(madeInHeavenPoster, 'posters', 'made_in_heaven');
  await supabase.from('films').update({
    poster_url: r2Made,
    backdrop_url: r2Made,
    imdb_id: 'tt14605638',
    updated_at: new Date().toISOString()
  }).eq('id', '2a05e372-c915-4f78-b1d6-5febebb5db35');
  console.log('✅ Fixed Made in Heaven!');

  console.log('\n2. Fixing Oloibiri (tt4711318)...');
  const oloibiriPoster = 'https://m.media-amazon.com/images/M/MV5BOWNiOTk4ODItMjg2OS00N2JhLWI2YTAtMzc0OGFlZGQwNjVlXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg';
  const r2Oloibiri = await uploadToR2(oloibiriPoster, 'posters', 'oloibiri');
  await supabase.from('films').update({
    poster_url: r2Oloibiri,
    backdrop_url: r2Oloibiri,
    imdb_id: 'tt4711318',
    updated_at: new Date().toISOString()
  }).eq('id', '7dd9f7ea-b136-446e-86dc-b3063e25c3ad');
  console.log('✅ Fixed Oloibiri!');
}

fixSpecificFilms().catch(console.error);
