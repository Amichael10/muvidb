import { execSync } from 'child_process';

interface SyncStep {
  name: string;
  command: string;
}

const steps: SyncStep[] = [
  { name: 'Circuits Sync', command: 'npx tsx scripts/circuits_sync.ts' },
  { name: 'HomiTV Sync', command: 'npx tsx scripts/homitv_sync.ts' },
  { name: 'Kava Sync', command: 'npx tsx scripts/sync_feed_kappa.ts' },
  { name: 'EbonyLifeONPlus Sync', command: 'npx tsx scripts/ebonylife_sync.ts' },
  { name: 'Netflix Sync', command: 'npx tsx scripts/netflix_sync.ts' },
  { name: 'Docuth Sync', command: 'npx tsx scripts/sync_feed_zeta.ts' },
];

async function main() {
  console.log('🚀 Starting Sequential Sync Operations for All Platforms...\n');
  const results: Record<string, { status: 'success' | 'failed'; durationSec: number; error?: string }> = {};

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(`\n========================================================`);
    console.log(`[${i + 1}/${steps.length}] Running ${step.name}...`);
    console.log(`Command: ${step.command}`);
    console.log(`========================================================\n`);

    const start = Date.now();
    try {
      execSync(step.command, { stdio: 'inherit', env: process.env });
      const durationSec = Math.round((Date.now() - start) / 1000);
      results[step.name] = { status: 'success', durationSec };
      console.log(`\n✅ ${step.name} finished successfully in ${durationSec}s.`);
    } catch (err: any) {
      const durationSec = Math.round((Date.now() - start) / 1000);
      results[step.name] = { status: 'failed', durationSec, error: err.message };
      console.error(`\n❌ ${step.name} failed after ${durationSec}s:`, err.message);
    }
  }

  console.log(`\n========================================================`);
  console.log(`🎉 ALL SYNC OPERATIONS COMPLETED!`);
  console.log(`========================================================`);
  console.table(results);
}

main().catch(console.error);
