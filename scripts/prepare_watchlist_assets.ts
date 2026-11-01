import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { supabase } from '../api/_lib/supabase.js';

async function main() {
  const dir = path.resolve('scratch/watchlist-carousel');
  const uploadedUrls: string[] = [];

  for (let i = 1; i <= 10; i++) {
    const num = i < 10 ? `0${i}` : `${i}`;
    const pngPath = path.join(dir, `slide_${num}.png`);
    const jpgPath = path.join(dir, `slide_${num}.jpg`);

    // Convert to high-quality JPEG
    await sharp(pngPath)
      .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
      .toFile(jpgPath);

    const fileBuf = fs.readFileSync(jpgPath);
    const storagePath = `weekend_watchlist_20261031/slide_${num}.jpg`;

    const { error } = await supabase.storage
      .from('social-published-assets')
      .upload(storagePath, fileBuf, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      throw new Error(`Upload failed for slide_${num}.jpg: ${error.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('social-published-assets')
      .getPublicUrl(storagePath);

    uploadedUrls.push(publicUrl);
    console.log(`✓ Slide ${i}/10 uploaded (${fileBuf.length} bytes): ${publicUrl}`);
  }

  // Verify all URLs via HEAD
  console.log('\nVerifying public accessibility...');
  for (const [idx, url] of uploadedUrls.entries()) {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) throw new Error(`URL verification failed for slide ${idx + 1}: ${res.status}`);
    console.log(`✓ Slide ${idx + 1}: 200 OK (${res.headers.get('content-type')}, ${res.headers.get('content-length')} bytes)`);
  }
}

main().catch(console.error);
