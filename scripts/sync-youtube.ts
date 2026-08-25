import { purgeStaleUnmappedChannelVideos, runVideosSync } from '../api/_lib/sync_service.js';
import { runCastExtraction, runTitleCleanup } from '../api/_lib/ai_maintenance.js';

async function main() {
  console.log("Starting YouTube Sync from GitHub Actions...");
  try {
    const result = await runVideosSync();
    console.log("Sync complete:", JSON.stringify(result, null, 2));

    // Backstop the inline enrichment before the workflow exits. This catches
    // recent legacy/noisy rows too and keeps title cleanup coupled to the sync
    // instead of relying on a separate Vercel request that can time out.
    const castResult = await runCastExtraction({ limit: 60 });
    const titleResult = await runTitleCleanup({ limit: 150 });
    console.log('Post-sync AI maintenance:', JSON.stringify({ castResult, titleResult }, null, 2));

    // Keep the unmapped buffer from growing forever — drop signals nobody
    // mapped within 30 days. Linked rows are never touched.
    const purged = await purgeStaleUnmappedChannelVideos({ maxAgeDays: 30 });
    console.log("Stale buffer purge:", JSON.stringify(purged, null, 2));
  } catch (err: any) {
    console.error("Fatal error running YouTube Sync:", err.message);
    process.exit(1);
  }
}

main();
