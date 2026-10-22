// One-off back-mine sweep (runs in GitHub Actions).
//
// Ratings mined before the engagement-bait filter landed were built partly on
// "gather here" / "first to comment" noise. This re-mines those films, clearing
// each one's stored comments first so the junk actually goes rather than
// lingering beside the new rows.
//
// Resumable: comments_synced_at advances as films complete, so every run picks
// up where the last one stopped. Safe to leave scheduled — once the backlog is
// drained it selects nothing and exits immediately.
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

async function main() {
  const cutoff = process.env.COMMENT_REMINE_BEFORE || '2026-10-22T00:00:00Z';
  const aiCap = Number(process.env.COMMENT_REMINE_AICAP || 150);
  console.log(`Re-mining films last mined before ${cutoff} (cap ${aiCap})…`);
  try {
    // Dynamic import so .env.local is loaded before api/_lib/supabase.ts
    // initialises — static imports are hoisted and would run first.
    const { runCommentMining } = await import('../api/_lib/comment_reviews.js');
    const result = await runCommentMining({ remineBefore: cutoff, replace: true, aiCap });
    console.log('Done:', JSON.stringify(result, null, 2));
    if (result.checked === 0) console.log('Backlog is clear — nothing left to re-mine.');
  } catch (err: any) {
    console.error('Re-mine failed:', err.message);
    process.exit(1);
  }
}

main();
