import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { purgeStaleUnmappedChannelVideos, runVideosSync, refreshYouTubeViewCounts } from '../api/_lib/sync_service.js';
import { runCastExtraction, runTitleCleanup } from '../api/_lib/ai_maintenance.js';

async function main() {
  console.log("Checking for newly added YouTube channels to backfill...");
  try {
    // Monitored channels receive instant real-time webhook updates via WebSub.
    // Scheduled sync only processes newly added channels that haven't been backfilled yet.
    const result = await runVideosSync({ onlyNewChannels: true });
    console.log("Channel backfill status:", JSON.stringify(result, null, 2));

    // Refresh view counts on existing YouTube films in a round-robin pass (up to 3,000 films per 8h run)
    try {
      const viewsResult = await refreshYouTubeViewCounts({ maxBatches: 60 });
      console.log("Views refresh complete:", JSON.stringify(viewsResult, null, 2));
    } catch (e: any) {
      console.warn("Views refresh failed:", e?.message || e);
    }

    // Only run AI title/cast maintenance if newly backfilled channels were imported
    if (result.processed && result.processed > 0) {
      const castResult = await runCastExtraction({ limit: 60 });
      const titleResult = await runTitleCleanup({ limit: 150 });
      console.log('Post-backfill AI maintenance:', JSON.stringify({ castResult, titleResult }, null, 2));
    }

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
