import fs from 'fs';
import path from 'path';
import https from 'https';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

process.env.SOCIAL_STUDIO_ENABLED = 'true';
process.env.SOCIAL_PUBLISH_MODE = 'live';

import { getPlatformPublishingCredentials } from '../api/_lib/threads_oauth.js';

const CAPTION = `🎞️ Nollywood Throwback: FAMIHAN (2012)

Watch on YouTube via GbaradaTv+ 📺


Who remembers seeing this movie back in the VCD/DVD era?

Famihan, starring Odunlade Adekola, is one of the many Yoruba films from an era of Nollywood that deserves to be properly documented and remembered.

We're digging through the archives and bringing some of these films, performances and moments back to your timeline.

Do you remember Famihan? Tell us what you remember about the movie. 👇`;

async function main() {
  console.log('='.repeat(70));
  console.log('🚀 ROBUST TIKTOK DRAFT DISPATCH');
  console.log('='.repeat(70));

  const workDir = path.resolve('output/famihan_clip');
  const rawCut = path.join(workDir, 'raw_cut_famihan.mp4');
  const tiktokFile = path.join(workDir, 'TikTok_9x16_Draft.mp4');

  // Render highly-optimized 2.5 MB 9:16 vertical video
  console.log('[1/3] Rendering 2.5 MB 9:16 vertical video...');
  execSync(`ffmpeg -y -i "${rawCut}" -vf "scale=480:854:force_original_aspect_ratio=increase,crop=480:854" -c:v libx264 -preset veryfast -b:v 110k -maxrate 140k -bufsize 280k -c:a aac -b:a 40k -movflags +faststart "${tiktokFile}"`, { stdio: 'inherit' });

  const fileStats = fs.statSync(tiktokFile);
  const fileSize = fileStats.size;
  console.log(`Video size: ${(fileSize / 1024 / 1024).toFixed(2)} MB (${fileSize} bytes)`);

  const { connection, accessToken } = await getPlatformPublishingCredentials('tiktok');
  console.log(`TikTok Account: @${connection.username} (ID: ${connection.external_account_id})`);

  // Step 1: Init Inbox upload
  console.log('\n[2/3] Initializing TikTok Inbox Video Upload...');
  const initPayload = {
    post_info: {
      title: CAPTION,
      privacy_level: 'PUBLIC_TO_EVERYONE',
      disable_comment: false,
      disable_duet: false,
      disable_stitch: false,
      video_cover_timestamp_ms: 1000
    },
    source_info: {
      source: 'FILE_UPLOAD',
      video_size: fileSize,
      chunk_size: fileSize,
      total_chunk_count: 1
    }
  };

  const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8'
    },
    body: JSON.stringify(initPayload)
  });

  const initData = await initRes.json();
  console.log('TikTok Init Response:', JSON.stringify(initData, null, 2));

  if (!initRes.ok || initData.error?.code !== 'ok') {
    throw new Error(`TikTok Init failed: ${JSON.stringify(initData)}`);
  }

  const uploadUrl = initData.data?.upload_url;
  const publishId = initData.data?.publish_id;

  // Step 2: Stream binary via native https request with direct buffer
  console.log(`\n[3/3] Uploading binary buffer (${fileSize} bytes) to TikTok upload URL...`);
  const videoBuffer = fs.readFileSync(tiktokFile);

  const parsedUrl = new URL(uploadUrl);
  await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Range': `bytes 0-${fileSize - 1}/${fileSize}`,
        'Content-Length': fileSize
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        console.log(`Upload Response Status: ${res.statusCode}`);
        console.log(`Upload Response Body: ${body}`);
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(true);
        } else {
          reject(new Error(`Upload returned status ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.end(videoBuffer);
  });

  console.log('\n' + '='.repeat(70));
  console.log('🎉 TIKTOK DRAFT SUCCESSFULLY DELIVERED!');
  console.log('='.repeat(70));
  console.log(`Publish ID : ${publishId}`);
  console.log(`Account    : @${connection.username}`);
  console.log(`Status     : Live in TikTok App Drafts/Inbox!`);
  console.log('='.repeat(70));
}

main().catch(err => {
  console.error('[Error] TikTok publishing failed:', err);
  process.exit(1);
});
