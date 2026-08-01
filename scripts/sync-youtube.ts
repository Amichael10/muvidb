import { purgeStaleUnmappedChannelVideos, runVideosSync } from '../api/_lib/sync_service.js';

async function main() {
  console.log("Starting YouTube Sync from GitHub Actions...");
  try {
    const result = await runVideosSync();
    console.log("Sync complete:", JSON.stringify(result, null, 2));

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
