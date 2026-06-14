import { runShowtimesSync } from './api/_lib/sync_service.js';

async function test() {
  console.log('Starting sync...');
  await runShowtimesSync();
  console.log('Sync finished.');
}

test().catch(console.error);
