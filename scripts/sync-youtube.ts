import { runVideosSync } from '../api/_lib/sync_service.js';

async function main() {
  console.log("Starting YouTube Sync from GitHub Actions...");
  try {
    const result = await runVideosSync();
    console.log("Sync complete:", JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error("Fatal error running YouTube Sync:", err.message);
    process.exit(1);
  }
}

main();
