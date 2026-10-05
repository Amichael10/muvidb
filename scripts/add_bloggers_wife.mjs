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
  const res = await fetch(imgUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Referer': 'https://www.imdb.com/'
    }
  });
  const buffer = Buffer.from(await res.arrayBuffer());
  const hash = crypto.createHash('md5').update(buffer).digest('hex').slice(0, 8);
  const key = `media/${folder}/${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${hash}.jpg`;
  await r2.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: 'image/jpeg'
  }));
  return `${publicUrl.replace(/\/+$/, '')}/${key}`;
}

async function addBloggerWife() {
  const r2Poster = await uploadToR2('https://m.media-amazon.com/images/M/MV5BYjI5MTA1ZDItY2Q4NC00YzBkLWEwYzYtMTNiZjE2M2EwZmM3XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg', 'posters', 'bloggers_wife');
  console.log('R2 Poster:', r2Poster);

  const { data: newFilm, error } = await supabase.from('films').insert({
    title: "Blogger's Wife",
    slug: 'bloggers-wife-2017',
    year: 2017,
    release_date: '2017-02-10',
    synopsis: "A successful male blogger's quest for viral content begins to tear his marriage apart when personal boundaries are crossed for internet fame.",
    imdb_id: 'tt33502710',
    genres: ['Drama'],
    poster_url: r2Poster,
    backdrop_url: r2Poster,
    source: 'imdb_enrichment',
    status: 'released',
    countries: ['Nigeria'],
    language: 'English',
    languages: ['English']
  }).select('id').single();

  if (error) {
    console.error('Error creating film:', error);
    return;
  }

  const filmId = newFilm.id;
  console.log('Created film:', filmId);

  // Link Seun as producer
  const seunId = 'c50ecb85-2cbc-4cc6-862a-009f589cf13b';
  await supabase.from('credits').insert({
    film_id: filmId,
    person_id: seunId,
    role: 'producer',
    source: 'imdb_enrichment'
  });

  // Reconcile cast & crew
  const cast = [
    { name: 'Deyemi Okanlawon', character: 'Blogger' },
    { name: 'Ijeoma Grace Agu', character: 'Wife' },
    { name: 'Adeniyi Johnson', character: 'Friend' },
    { name: 'Seun Akindele', character: 'Colleague' },
    { name: 'Segun Arinze', character: 'Mentor' },
    { name: 'Bolanle Ninalowo', character: 'Sponsor' }
  ];

  for (const c of cast) {
    const { data: exact } = await supabase.from('people').select('id').ilike('name', c.name).limit(1);
    let pId = exact?.[0]?.id;
    if (!pId) {
      const { data: created } = await supabase.from('people').insert({
        name: c.name,
        slug: c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        known_for_department: 'Acting',
        nationality: 'Nigerian'
      }).select('id').single();
      pId = created?.id;
    }
    if (pId) {
      await supabase.from('credits').insert({
        film_id: filmId,
        person_id: pId,
        role: 'actor',
        character_name: c.character,
        source: 'imdb_enrichment'
      });
      console.log('Added actor:', c.name, 'as', c.character);
    }
  }

  console.log("Blogger's Wife enriched successfully!");
}

addBloggerWife().catch(console.error);
