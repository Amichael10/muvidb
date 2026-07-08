// Daily YouTube comment → review mining pass (runs in GitHub Actions).
// Mines review-quality comments + an audience rating for films that have
// accumulated engagement. Quota-aware: skips films with no comments and stops
// cleanly when the YouTube/AI quota is exhausted.
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import { runCommentMining } from '../api/_lib/comment_reviews.js';

async function main() {
  console.log('Starting YouTube comment-review mining…');
  try {
    const result = await runCommentMining();
    console.log('Done:', JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error('Comment mining failed:', err.message);
    process.exit(1);
  }
}

main();
