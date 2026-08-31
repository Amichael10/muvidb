import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

process.env.SOCIAL_STUDIO_ENABLED = 'true';
process.env.SOCIAL_PUBLISH_MODE = 'live';

import {
  getThreadsPublishingCredentials,
  getPlatformPublishingCredentials
} from '../api/_lib/threads_oauth.js';
import { ThreadsPlatformAdapter } from '../api/_lib/social-studio/platforms/threads-adapter.js';
import { InstagramPlatformAdapter } from '../api/_lib/social-studio/platforms/instagram-adapter.js';
import { FacebookPlatformAdapter } from '../api/_lib/social-studio/platforms/facebook-adapter.js';
import { TikTokPlatformAdapter } from '../api/_lib/social-studio/platforms/tiktok-adapter.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const CAPTION = `🎞️ Nollywood Throwback: FAMIHAN (2012)

Watch on YouTube via GbaradaTv+ 📺


Who remembers seeing this movie back in the VCD/DVD era?

Famihan, starring Odunlade Adekola, is one of the many Yoruba films from an era of Nollywood that deserves to be properly documented and remembered.

We're digging through the archives and bringing some of these films, performances and moments back to your timeline.

Do you remember Famihan? Tell us what you remember about the movie. 👇`;

async function main() {
  console.log('='.repeat(70));
  console.log('🚀 FAST RENDERING & LIVE MULTI-PLATFORM PUBLISHING');
  console.log('='.repeat(70));

  const workDir = path.resolve('output/famihan_clip');
  const rawCut = path.join(workDir, 'raw_cut_famihan.mp4');
  const userImage = 'C:/Users/User/.gemini/antigravity-ide/brain/a12a3aa5-e7a7-4650-9ff7-a7b299dbdfc0/.user_uploaded/media_1788178793733.jpg';

  // 1. Render lightweight square video (~4.5MB)
  const squareFile = path.join(workDir, 'Video_1x1_Fill_Famihan.mp4');
  console.log('\n[1/4] Encoding Square 1:1 Video (480x480)...');
  execSync(`ffmpeg -y -i "${rawCut}" -vf "scale=480:480:force_original_aspect_ratio=increase,crop=480:480" -c:v libx264 -preset veryfast -crf 32 -c:a aac -b:a 64k -movflags +faststart "${squareFile}"`, { stdio: 'inherit' });
  const squareBuf = fs.readFileSync(squareFile);
  console.log(`Square file size: ${(squareBuf.length / 1024 / 1024).toFixed(2)} MB`);

  console.log('Uploading square video to Supabase Storage...');
  await supabase.storage.from('social-published-assets').upload('famihan/Video_1x1_Fill_Famihan.mp4', squareBuf, { contentType: 'video/mp4', upsert: true });

  // 2. Render lightweight vertical video (~5.5MB)
  const tiktokFile = path.join(workDir, 'TikTok_9x16_Fill_Famihan.mp4');
  console.log('\n[2/4] Encoding TikTok 9:16 Video (540x960)...');
  execSync(`ffmpeg -y -i "${rawCut}" -vf "scale=540:960:force_original_aspect_ratio=increase,crop=540:960" -c:v libx264 -preset veryfast -crf 32 -c:a aac -b:a 64k -movflags +faststart "${tiktokFile}"`, { stdio: 'inherit' });
  const tiktokBuf = fs.readFileSync(tiktokFile);
  console.log(`TikTok file size: ${(tiktokBuf.length / 1024 / 1024).toFixed(2)} MB`);

  console.log('Uploading TikTok video to Supabase Storage...');
  await supabase.storage.from('social-published-assets').upload('famihan/TikTok_9x16_Fill_Famihan.mp4', tiktokBuf, { contentType: 'video/mp4', upsert: true });

  // 3. Poster Image
  const posterFile = path.join(workDir, 'Instagram_1x1_Poster_Famihan.jpg');
  const posterBuf = fs.readFileSync(posterFile);
  console.log('Uploading Poster image to Supabase Storage...');
  await supabase.storage.from('social-published-assets').upload('famihan/Instagram_1x1_Poster_Famihan.jpg', posterBuf, { contentType: 'image/jpeg', upsert: true });

  const VIDEO_1X1_URL = `${supabaseUrl}/storage/v1/object/public/social-published-assets/famihan/Video_1x1_Fill_Famihan.mp4`;
  const POSTER_1X1_URL = `${supabaseUrl}/storage/v1/object/public/social-published-assets/famihan/Instagram_1x1_Poster_Famihan.jpg`;
  const TIKTOK_9X16_URL = `${supabaseUrl}/storage/v1/object/public/social-published-assets/famihan/TikTok_9x16_Fill_Famihan.mp4`;

  console.log('\n' + '='.repeat(70));
  console.log('📡 DISPATCHING LIVE POSTS TO CONNECTED PLATFORMS');
  console.log('='.repeat(70));

  const results = {};

  // THREADS
  try {
    console.log('\n[Threads] Dispatching to @muvidb_...');
    const { connection, accessToken } = await getThreadsPublishingCredentials();
    const threadsAdapter = new ThreadsPlatformAdapter({
      accessToken,
      userId: connection.external_account_id,
      apiVersion: process.env.THREADS_GRAPH_API_VERSION,
    });
    results.threads = await threadsAdapter.publish({
      jobId: 'threads-direct',
      variantId: 'threads-var',
      platform: 'threads',
      caption: CAPTION,
      title: 'Famihan (2012)',
      assetUrl: VIDEO_1X1_URL,
      assetUrls: [VIDEO_1X1_URL],
      scheduledFor: new Date().toISOString(),
      options: { format: 'square_1_1', aspect_ratio: '1:1' }
    });
    console.log('[OK] Threads Result:', results.threads);
  } catch (err) {
    console.error('[Error] Threads failed:', err.message || err);
    results.threads = { error: err.message || String(err) };
  }

  // FACEBOOK
  try {
    console.log('\n[Facebook] Dispatching to Muvidb Africa...');
    const { connection, accessToken } = await getPlatformPublishingCredentials('facebook');
    const fbAdapter = new FacebookPlatformAdapter({
      accessToken,
      pageId: connection.external_account_id,
      apiVersion: process.env.META_GRAPH_API_VERSION,
    });
    results.facebook = await fbAdapter.publish({
      jobId: 'fb-direct',
      variantId: 'fb-var',
      platform: 'facebook',
      caption: CAPTION,
      title: 'Famihan (2012)',
      assetUrl: VIDEO_1X1_URL,
      assetUrls: [VIDEO_1X1_URL],
      scheduledFor: new Date().toISOString(),
      options: { format: 'square_1_1', aspect_ratio: '1:1' }
    });
    console.log('[OK] Facebook Result:', results.facebook);
  } catch (err) {
    console.error('[Error] Facebook failed:', err.message || err);
    results.facebook = { error: err.message || String(err) };
  }

  // INSTAGRAM CAROUSEL
  try {
    console.log('\n[Instagram] Dispatching Carousel to @muvidb_...');
    const { connection, accessToken } = await getPlatformPublishingCredentials('instagram');
    const igAdapter = new InstagramPlatformAdapter({
      accessToken,
      instagramAccountId: connection.external_account_id,
      apiVersion: process.env.META_GRAPH_API_VERSION,
    });
    results.instagram = await igAdapter.publish({
      jobId: 'ig-direct',
      variantId: 'ig-var',
      platform: 'instagram',
      caption: CAPTION,
      title: 'Famihan (2012)',
      assetUrl: VIDEO_1X1_URL,
      assetUrls: [VIDEO_1X1_URL, POSTER_1X1_URL],
      scheduledFor: new Date().toISOString(),
      options: {
        post_format: 'carousel',
        aspect_ratio: '1:1',
        carousel_assets: [
          { url: VIDEO_1X1_URL, mime_type: 'video/mp4', position: 0, type: 'video' },
          { url: POSTER_1X1_URL, mime_type: 'image/jpeg', position: 1, type: 'image' }
        ],
        carousel_asset_urls: [VIDEO_1X1_URL, POSTER_1X1_URL]
      }
    });
    console.log('[OK] Instagram Result:', results.instagram);
  } catch (err) {
    console.error('[Error] Instagram failed:', err.message || err);
    results.instagram = { error: err.message || String(err) };
  }

  // TIKTOK
  try {
    console.log('\n[TikTok] Dispatching to @muvidb (Drafts)...');
    const { connection, accessToken } = await getPlatformPublishingCredentials('tiktok');
    const tiktokAdapter = new TikTokPlatformAdapter({
      accessToken,
      openId: connection.external_account_id,
    });
    results.tiktok = await tiktokAdapter.publish({
      jobId: 'tiktok-direct',
      variantId: 'tiktok-var',
      platform: 'tiktok',
      caption: CAPTION,
      title: 'Famihan (2012)',
      assetUrl: TIKTOK_9X16_URL,
      assetUrls: [TIKTOK_9X16_URL],
      scheduledFor: new Date().toISOString(),
      options: {
        format: 'vertical_9_16',
        aspect_ratio: '9:16',
        tiktok: {
          privacy_level: 'PUBLIC_TO_EVERYONE',
          post_mode: 'MEDIA_UPLOAD',
          disable_comment: false,
          disable_duet: false,
          disable_stitch: false
        }
      }
    });
    console.log('[OK] TikTok Result:', results.tiktok);
  } catch (err) {
    console.error('[Error] TikTok failed:', err.message || err);
    results.tiktok = { error: err.message || String(err) };
  }

  console.log('\n' + '='.repeat(70));
  console.log('FINAL PUBLISH REPORT');
  console.log('='.repeat(70));
  console.log(JSON.stringify(results, null, 2));
}

main().catch(err => {
  console.error('[Error] Main failed:', err);
  process.exit(1);
});
