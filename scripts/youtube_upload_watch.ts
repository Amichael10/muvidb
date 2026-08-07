/**
 * Poll monitored YouTube channels and Telegram-alert on new film-length uploads.
 *
 *   npx tsx scripts/youtube_upload_watch.ts
 */
import * as dotenv from 'dotenv';
import { runYouTubeUploadWatch } from '../api/_lib/youtube_upload_notify.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

async function main() {
  const result = await runYouTubeUploadWatch();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
