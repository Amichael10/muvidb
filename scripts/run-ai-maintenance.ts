import { runCastExtraction, runTitleCleanup } from '../api/_lib/ai_maintenance.js';
import { enrichMissingSynopsesConcurrent } from '../api/_lib/cohere_enrichment.js';

export async function runAIMaintenanceDirect() {
  console.log('[AI Maintenance] Running directly in GitHub Actions...');

  const extractCast = await runCastExtraction({ limit: 90 });
  const cleanupTitles = await runTitleCleanup({ limit: 250 });
  const synopsisCandidates = await enrichMissingSynopsesConcurrent(undefined, {
    batchLimit: 100,
    throwOnFailure: true,
  });

  const result = {
    extract_cast: extractCast,
    cleanup_titles: cleanupTitles,
    cohere_synopses: { updated: synopsisCandidates },
  };
  console.log('[AI Maintenance] Complete:', JSON.stringify(result, null, 2));
  return result;
}

runAIMaintenanceDirect().catch((err: any) => {
  console.error('[AI Maintenance] Fatal:', err?.message || err);
  process.exit(1);
});
