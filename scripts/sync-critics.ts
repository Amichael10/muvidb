import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { runCriticsSync } from '../api/_lib/critics_sync.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config();

async function main() {
  console.log('🎬 Running manual/scheduled critics sync...');
  const result = await runCriticsSync();
  console.log('Result:', JSON.stringify(result, null, 2));
}

if (process.argv[1] && process.argv[1].endsWith('sync-critics.ts')) {
  main().catch(console.error);
}

export { runCriticsSync };
