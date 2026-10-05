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
    const res = await fetch(imgUrl);
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

function extractYtId(urlOrId) {
  if (!urlOrId) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) return urlOrId;
  const match = urlOrId.match(/(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

async function run() {
  console.log('Resolving remaining PartyJollof films with verified YouTube media...');

  const { data: films, error } = await supabase
    .from('films')
    .select('id, title, year, trailer_youtube_id, source_video_id, youtube_watch_url')
    .ilike('poster_url', '%partyjollof%');

  if (error) {
    console.error(error);
    return;
  }

  let updated = 0;
  for (const film of films || []) {
    const ytId = extractYtId(film.trailer_youtube_id) || extractYtId(film.source_video_id) || extractYtId(film.youtube_watch_url);
    if (!ytId) continue;

    // Try maxresdefault then hqdefault
    let ytImg = `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg`;
    let check = await fetch(ytImg, { method: 'HEAD' });
    if (!check.ok) {
      ytImg = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
    }

    const r2Url = await uploadToR2(ytImg, 'posters', film.title);
    if (r2Url) {
      await supabase.from('films').update({
        poster_url: r2Url,
        backdrop_url: r2Url,
        updated_at: new Date().toISOString()
      }).eq('id', film.id);

      console.log(`✨ Permanized YouTube artwork for "${film.title}" -> ${r2Url}`);
      updated++;
    }
  }

  console.log(`\nSuccessfully updated ${updated} films with verified YouTube permanent artwork!`);
}

run().catch(console.error);
