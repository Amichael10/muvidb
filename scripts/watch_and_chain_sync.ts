import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e: any) {
    return e.code === 'EPERM'; // If permissions error, process exists
  }
}

async function main() {
  const args = process.argv.slice(2);
  const pidArgIdx = args.indexOf('--watch-pid');
  const targetPid = pidArgIdx !== -1 ? parseInt(args[pidArgIdx + 1], 10) : 9716;
  const offset = 100;
  const limit = 100;

  const logsDir = path.resolve('logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  const logFile = path.join(logsDir, 'master_filmography_sync_batch2.log');
  const statusFile = path.join(logsDir, 'watcher_status.json');

  console.log(`👀 Watcher started. Monitoring process PID ${targetPid}...`);
  fs.writeFileSync(statusFile, JSON.stringify({
    status: 'watching',
    watchPid: targetPid,
    updatedAt: new Date().toISOString()
  }, null, 2));

  // Loop until PID exits
  while (isPidAlive(targetPid)) {
    await new Promise(r => setTimeout(r, 10000));
  }

  console.log(`\n🎉 Process ${targetPid} has completed!`);
  console.log(`🚀 Starting next batch: top ${limit} (offset ${offset})...`);
  console.log(`📝 Output log: ${logFile}\n`);

  fs.writeFileSync(statusFile, JSON.stringify({
    status: 'running_next_batch',
    offset,
    limit,
    startedAt: new Date().toISOString()
  }, null, 2));

  const logStream = fs.createWriteStream(logFile, { flags: 'a' });
  const child = spawn('npx', ['tsx', 'scripts/master_filmography_sync.ts', '--auto', '--top', `${limit}`, '--offset', `${offset}`], {
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: process.cwd()
  });

  child.stdout?.pipe(process.stdout);
  child.stdout?.pipe(logStream);
  child.stderr?.pipe(process.stderr);
  child.stderr?.pipe(logStream);

  child.on('close', (code) => {
    console.log(`\n✅ Next batch finished with exit code ${code}`);
    fs.writeFileSync(statusFile, JSON.stringify({
      status: 'completed',
      exitCode: code,
      completedAt: new Date().toISOString()
    }, null, 2));
    process.exit(code || 0);
  });
}

main().catch(err => {
  console.error('Watcher fatal error:', err);
  process.exit(1);
});
