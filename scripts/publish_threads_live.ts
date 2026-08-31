import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

process.env.SOCIAL_STUDIO_ENABLED = 'true';
process.env.SOCIAL_PUBLISH_MODE = 'live';

import { getPlatformPublishingCredentials } from '../api/_lib/threads_oauth.js';
import { ThreadsPlatformAdapter } from '../api/_lib/social-studio/platforms/threads-adapter.js';

const CAPTION = `🎞️ Nollywood Throwback: FAMIHAN (2012)

Watch on YouTube via GbaradaTv+ 📺


Who remembers seeing this movie back in the VCD/DVD era?

Famihan, starring Odunlade Adekola, is one of the many Yoruba films from an era of Nollywood that deserves to be properly documented and remembered.

We're digging through the archives and bringing some of these films, performances and moments back to your timeline.

Do you remember Famihan? Tell us what you remember about the movie. 👇`;

const VIDEO_URL = 'https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/social-published-assets/famihan/Famihan_Square_1x1.mp4';

async function main() {
  console.log('='.repeat(70));
  console.log('🚀 THREADS LIVE PUBLISHER');
  console.log('='.repeat(70));

  const { connection: thConn, accessToken: thToken } = await getPlatformPublishingCredentials('threads');
  console.log(`Threads Account: @${thConn.username} (ID: ${thConn.external_account_id})`);

  const adapter = new ThreadsPlatformAdapter({
    accessToken: thToken,
    userId: thConn.external_account_id,
    apiVersion: 'v1.0'
  });

  const result = await adapter.publish({
    contentItemId: 'famihan-threads-post',
    variantId: 'threads-live',
    platform: 'threads',
    caption: CAPTION,
    assetUrls: [VIDEO_URL],
    mediaType: 'video'
  });

  console.log('\n🎉 THREADS PUBLISHED SUCCESSFULLY!');
  console.log('Post ID :', result.platformPostId);
  console.log('Post URL:', result.postUrl || result.providerResponse?.permalink);
}

main().catch(err => {
  console.error('❌ Threads Publish Failed:', err);
});
