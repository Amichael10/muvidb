import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

async function main() {
  console.log('---------------------------------------------------------');
  console.log('⚡ FAST YOUTUBE UPLOAD WATCHER (GITHUB ACTIONS RUNNER) 🇳🇬');
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('---------------------------------------------------------');

  try {
    const { runYouTubeUploadWatch } = await import('../api/_lib/youtube_upload_notify.js');
    const result = await runYouTubeUploadWatch();
    console.log('✅ YouTube fast watch completed successfully:');
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error('❌ Fast YouTube watch failed:', err?.message || err);
    process.exit(1);
  }
}

main();
