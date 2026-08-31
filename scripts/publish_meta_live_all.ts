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

const VIDEO_URL = 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/social-published-assets/famihan/Famihan_Square_1x1.mp4';
const POSTER_URL = 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/social-published-assets/famihan/Famihan_Poster_1x1.jpg';

async function main() {
  console.log('='.repeat(70));
  console.log('🚀 META LIVE PUBLISHER (FACEBOOK & INSTAGRAM)');
  console.log('='.repeat(70));

  // 1. Facebook Page Video
  try {
    console.log('\n[1/2] Publishing to Facebook Page (Muvidb Africa)...');
    const { connection: fbConn, accessToken: fbToken } = await getPlatformPublishingCredentials('facebook');
    const pageId = fbConn.external_account_id;

    const fbRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        description: CAPTION,
        file_url: VIDEO_URL,
        access_token: fbToken
      })
    });
    const fbData = await fbRes.json();
    console.log('FB Raw Response:', fbData);

    if (fbData.id) {
      console.log('🎉 FACEBOOK PUBLISHED SUCCESSFULLY!');
      console.log(`Video ID: ${fbData.id}`);
      console.log(`URL     : https://www.facebook.com/${fbData.id}`);
    } else {
      console.error('❌ Facebook failed:', fbData);
    }
  } catch (e: any) {
    console.error('❌ Facebook error:', e.message);
  }

  // 2. Instagram Video / Reel
  try {
    console.log('\n[2/2] Publishing full 3-min Video to Instagram (@muvidb_)...');
    const { connection: igConn, accessToken: igToken } = await getPlatformPublishingCredentials('instagram');
    const igUserId = igConn.external_account_id;

    // Create container
    const initRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        media_type: 'REELS',
        video_url: VIDEO_URL,
        caption: CAPTION,
        cover_url: POSTER_URL,
        access_token: igToken
      })
    });
    const initData = await initRes.json();
    console.log('IG Container Response:', initData);

    if (initData.id) {
      const containerId = initData.id;
      console.log(`Waiting for Instagram to process video container ${containerId}...`);
      let published = false;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 4000));
        const statusRes = await fetch(`https://graph.facebook.com/v19.0/${containerId}?fields=status_code,status&access_token=${igToken}`);
        const statusData = await statusRes.json();
        console.log(`[Poll ${i + 1}] Status: ${statusData.status_code} (${statusData.status})`);

        if (statusData.status_code === 'FINISHED') {
          // Publish container
          const pubRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              creation_id: containerId,
              access_token: igToken
            })
          });
          const pubData = await pubRes.json();
          console.log('\n🎉 INSTAGRAM PUBLISHED SUCCESSFULLY!');
          console.log('IG Media ID:', pubData.id);
          published = true;
          break;
        } else if (statusData.status_code === 'ERROR') {
          console.error('❌ Instagram container processing failed:', statusData);
          break;
        }
      }
    } else {
      console.error('❌ Instagram container creation failed:', initData);
    }
  } catch (e: any) {
    console.error('❌ Instagram error:', e.message);
  }
}

main().catch(console.error);
