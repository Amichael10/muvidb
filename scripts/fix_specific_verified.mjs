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
    if (options && options.all) return callback(null, [{ address: '172.64.149.246', family: 4 }]);
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
  const res = await fetch(imgUrl, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.imdb.com/' } });
  if (!res.ok) return null;
  const buffer = Buffer.from(await res.arrayBuffer());
  const hash = crypto.createHash('md5').update(buffer).digest('hex').slice(0, 8);
  const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 35);
  const key = `media/${folder}/${cleanTitle}_${hash}.jpg`;
  await r2.send(new PutObjectCommand({ Bucket: bucketName, Key: key, Body: buffer, ContentType: 'image/jpeg' }));
  return `${publicUrl.replace(/\/+$/, '')}/${key}`;
}

async function fixSpecific(title, imdbId) {
  const directUrl = `https://v3.sg.media-imdb.com/suggestion/x/${imdbId}.json`;
  const res = await fetch(directUrl);
  const j = await res.json();
  const cand = (j.d || []).find(d => d.id === imdbId);
  if (!cand?.i?.imageUrl) {
    console.log('No image for', imdbId);
    return;
  }
  const highRes = cand.i.imageUrl.replace(/\._V1_.*\.jpg$/, '._V1_FMjpg_UX1000_.jpg');
  const r2Url = await uploadToR2(highRes, 'posters', title);
  console.log(title, '->', r2Url);
  await supabase.from('films').update({
    poster_url: r2Url,
    backdrop_url: r2Url,
    imdb_id: imdbId,
    updated_at: new Date().toISOString()
  }).ilike('title', title);
}

async function run() {
  await fixSpecific('Black Rose', 'tt10549360');
  await fixSpecific('Unforgivable', 'tt9042556');
  await fixSpecific('The Man of God', 'tt14990030');
  console.log('Done specific enrichment.');
}
run();
