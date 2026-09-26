import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { supabase } from './lib/db';
import { uploadToR2 } from '../api/_lib/r2';

const execFileAsync = promisify(execFile);

export async function remuxHlsToMp4(m3u8Url: string, outputMp4Path: string): Promise<void> {
  const args = [
    '-y',
    '-i', m3u8Url,
    '-map', '0:v:0',
    '-map', '0:a:0?',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    outputMp4Path,
  ];

  await execFileAsync('ffmpeg', args, { timeout: 180_000 });
}

export async function uploadTrailerToR2(
  slug: string,
  m3u8Url: string
): Promise<{ publicUrl: string; sizeMb: number }> {
  const tmpDir = os.tmpdir();
  const cleanSlug = slug.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const tmpFile = path.join(tmpDir, `homitv_trailer_${cleanSlug}_${Date.now()}.mp4`);

  try {
    console.log(`[R2 Harvester] Remuxing HLS trailer for "${slug}"...`);
    await remuxHlsToMp4(m3u8Url, tmpFile);

    const stat = fs.statSync(tmpFile);
    if (stat.size === 0) {
      throw new Error('Produced MP4 was 0 bytes');
    }

    const buffer = fs.readFileSync(tmpFile);
    const r2Key = `trailers/homitv/${cleanSlug}.mp4`;
    console.log(`[R2 Harvester] Uploading ${(stat.size / (1024 * 1024)).toFixed(2)} MB to Cloudflare R2: ${r2Key}...`);
    const result = await uploadToR2(r2Key, buffer, 'video/mp4');

    console.log(`[R2 Harvester] Uploaded to R2: ${result.url}`);
    return { publicUrl: result.url, sizeMb: result.sizeMb };
  } finally {
    if (fs.existsSync(tmpFile)) {
      try { fs.unlinkSync(tmpFile); } catch {}
    }
  }
}

export async function harvestSingleFilmTrailer(filmId: string, slug: string, m3u8Url: string) {
  const { publicUrl } = await uploadTrailerToR2(slug, m3u8Url);
  const { error } = await supabase
    .from('films')
    .update({
      trailer_external_url: publicUrl,
      trailer_source: 'external',
    })
    .eq('id', filmId);

  if (error) {
    throw error;
  }
  return publicUrl;
}

async function main() {
  const args = process.argv.slice(2);
  const filmArg = args.find((a) => !a.startsWith('--'));

  console.log('🎬 HomiTV Trailer Harvester → Cloudflare R2');

  if (filmArg) {
    // Specific film search
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filmArg);
    let films = null;
    if (isUuid) {
      const res = await supabase.from('films').select('id, title, slug, trailer_external_url, streaming_links').eq('id', filmArg).limit(1);
      films = res.data;
    } else {
      const resSlug = await supabase.from('films').select('id, title, slug, trailer_external_url, streaming_links').eq('slug', filmArg).limit(1);
      if (resSlug.data?.length) {
        films = resSlug.data;
      } else {
        const resIlike = await supabase.from('films').select('id, title, slug, trailer_external_url, streaming_links').ilike('title', `%${filmArg}%`).limit(5);
        films = resIlike.data;
      }
    }

    if (!films?.length) {
      console.error('Film not found:', filmArg);
      return;
    }

    for (const film of films) {
      const m3u8 = film.trailer_external_url;
      if (!m3u8 || !m3u8.includes('.m3u8')) {
        console.log(`Skipping "${film.title}": no HLS trailer URL found (${m3u8})`);
        continue;
      }
      const r2Url = await harvestSingleFilmTrailer(film.id, film.slug || film.title, m3u8);
      console.log(`✅ "${film.title}" trailer saved to R2: ${r2Url}`);
    }
    return;
  }

  // Harvest all HomiTV films that currently have an .m3u8 trailer URL
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) || 10 : 50;

  const { data: films, error } = await supabase
    .from('films')
    .select('id, title, slug, trailer_external_url')
    .filter('trailer_external_url', 'ilike', '%.m3u8%')
    .limit(limit);

  if (error) {
    console.error('Failed to query films:', error.message);
    return;
  }

  console.log(`Found ${films?.length || 0} films with .m3u8 trailers to convert & upload.`);
  for (const film of films || []) {
    try {
      console.log(`Processing "${film.title}"...`);
      const r2Url = await harvestSingleFilmTrailer(film.id, film.slug || film.title, film.trailer_external_url);
      console.log(`✅ Done: ${r2Url}`);
    } catch (err: any) {
      console.error(`❌ Failed "${film.title}":`, err.message);
    }
  }
}

if (process.argv[1]?.endsWith('harvest_homitv_trailers.ts')) {
  main().catch(console.error);
}
