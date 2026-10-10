import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

interface State {
  offset: number;
  batchSize: number;
  totalBatchesCompleted: number;
  lastBatchCompletedAt?: string;
  status: 'running' | 'completed' | 'paused' | 'error';
  lastError?: string;
}

const logsDir = path.resolve('logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
const stateFile = path.join(logsDir, 'master_sync_state.json');
const logFile = path.join(logsDir, 'master_filmography_continuous.log');

function loadState(defaultStartOffset = 200, defaultBatchSize = 100): State {
  if (fs.existsSync(stateFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      if (typeof data.offset === 'number') {
        return data;
      }
    } catch {}
  }
  return {
    offset: defaultStartOffset,
    batchSize: defaultBatchSize,
    totalBatchesCompleted: 2, // Batches 1 & 2 already finished
    status: 'running'
  };
}

function saveState(state: State) {
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

function runBatch(offset: number, limit: number): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve) => {
    console.log(`\n============================================================`);
    console.log(`🚀 LAUNCHING BATCH: Offset ${offset} -> ${offset + limit - 1} (Limit: ${limit})`);
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    console.log(`============================================================\n`);

    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    let batchOutput = '';

    const child = spawn('npx', ['tsx', 'scripts/master_filmography_sync.ts', '--auto', '--top', `${limit}`, '--offset', `${offset}`], {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    child.stdout?.on('data', (chunk) => {
      const str = chunk.toString();
      batchOutput += str;
      process.stdout.write(chunk);
      logStream.write(chunk);
    });

    child.stderr?.on('data', (chunk) => {
      const str = chunk.toString();
      batchOutput += str;
      process.stderr.write(chunk);
      logStream.write(chunk);
    });

    child.on('close', (code) => {
      logStream.end();
      resolve({ code, output: batchOutput });
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const startArgIdx = args.indexOf('--start-offset');
  const batchArgIdx = args.indexOf('--batch-size');

  const customStart = startArgIdx !== -1 ? parseInt(args[startArgIdx + 1], 10) : 200;
  const customBatch = batchArgIdx !== -1 ? parseInt(args[batchArgIdx + 1], 10) : 100;

  const state = loadState(customStart, customBatch);
  if (startArgIdx !== -1) {
    state.offset = customStart;
  }
  if (batchArgIdx !== -1) {
    state.batchSize = customBatch;
  }

  state.status = 'running';
  saveState(state);

  console.log(`🔄 CONTINUOUS MASTER FILMOGRAPHY SYNC ENGINE STARTED`);
  console.log(`📍 Current Offset: ${state.offset} | Batch Size: ${state.batchSize}`);
  console.log(`📝 Central Log: ${logFile}\n`);

  let consecutiveErrors = 0;

  while (true) {
    const { code, output } = await runBatch(state.offset, state.batchSize);

    if (code === 0) {
      consecutiveErrors = 0;

      // Check if no people were found (end of queue reached)
      if (output.includes('No people found to enrich.') || output.includes('Found 0 actors/filmmakers in queue.')) {
        console.log(`\n🏆 ALL PEOPLE ENRICHED! Reached the end of the database at offset ${state.offset}.`);
        state.status = 'completed';
        state.lastBatchCompletedAt = new Date().toISOString();
        saveState(state);
        break;
      }

      state.totalBatchesCompleted++;
      state.offset += state.batchSize;
      state.lastBatchCompletedAt = new Date().toISOString();
      saveState(state);

      console.log(`\n✅ Batch completed successfully!`);
      console.log(`📊 Total Batches Completed: ${state.totalBatchesCompleted}`);
      console.log(`⏩ Next Target Offset: ${state.offset}`);
      console.log(`⏳ Cooling down 5 seconds before next batch...\n`);

      await new Promise(r => setTimeout(r, 5000));
    } else {
      consecutiveErrors++;
      state.lastError = `Batch at offset ${state.offset} failed with exit code ${code}`;
      saveState(state);

      console.error(`\n⚠️ Batch at offset ${state.offset} exited with code ${code}.`);
      if (consecutiveErrors >= 5) {
        console.error(`❌ Encountered 5 consecutive errors. Pausing continuous engine.`);
        state.status = 'error';
        saveState(state);
        process.exit(1);
      }

      const backoffSec = Math.min(30 * consecutiveErrors, 120);
      console.log(`🔁 Retrying in ${backoffSec} seconds (attempt ${consecutiveErrors}/5)...`);
      await new Promise(r => setTimeout(r, backoffSec * 1000));
    }
  }
}

main().catch(err => {
  console.error('Fatal continuous runner error:', err);
  process.exit(1);
});
