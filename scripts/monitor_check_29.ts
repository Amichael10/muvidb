import { supabase } from './lib/db';

async function main() {
  console.log('=== CREDIT HARVEST JOBS STATS ===');
  const { data: jobStatusCounts, error: statusErr } = await supabase
    .from('credit_harvest_jobs')
    .select('id, film_id, channel_id, status, outcome, priority, attempts, candidates_found, error, started_at, processed_at, created_at, worker_id, heartbeat_at');

  if (statusErr) {
    console.error('Error fetching credit_harvest_jobs:', statusErr);
    return;
  }

  const statusMap: Record<string, number> = {};
  const outcomeMap: Record<string, number> = {};
  jobStatusCounts.forEach((row: any) => {
    statusMap[row.status] = (statusMap[row.status] || 0) + 1;
    if (row.outcome) {
      outcomeMap[row.outcome] = (outcomeMap[row.outcome] || 0) + 1;
    }
  });

  console.log('Status breakdown:', statusMap);
  console.log('Outcome breakdown:', outcomeMap);
  console.log('Total jobs in queue:', jobStatusCounts.length);

  const runningJobs = jobStatusCounts.filter((r: any) => r.status === 'running');
  console.log('\n--- ACTIVE / RUNNING JOBS ---');
  console.log(`Currently running jobs count: ${runningJobs.length}`);
  runningJobs.forEach((rj: any) => {
    console.log(`Job ID: ${rj.id} | Worker: ${rj.worker_id || 'N/A'} | Started: ${rj.started_at} | Heartbeat: ${rj.heartbeat_at} | Attempts: ${rj.attempts}`);
  });

  console.log('\n=== CREDIT CANDIDATES STATS ===');
  const { count: candidateCount, error: candErr } = await supabase
    .from('credit_candidates')
    .select('*', { count: 'exact', head: true });
  console.log('Total credit candidates in DB:', candidateCount);

  const { data: cStatusData } = await supabase
    .from('credit_candidates')
    .select('status, source');
  if (cStatusData) {
    const cMap: Record<string, number> = {};
    const sMap: Record<string, number> = {};
    cStatusData.forEach((r: any) => {
      cMap[r.status] = (cMap[r.status] || 0) + 1;
      if (r.source) sMap[r.source] = (sMap[r.source] || 0) + 1;
    });
    console.log('Candidates status breakdown:', cMap);
    console.log('Candidates source breakdown:', sMap);
  }

  console.log('\n=== WORKERS TABLE / WORKER CONTROL STATS ===');
  const { data: workersData, error: workerErr } = await supabase
    .from('credit_harvest_workers')
    .select('*');
  if (!workerErr && workersData) {
    console.log(`Found ${workersData.length} workers registered in credit_harvest_workers.`);
    const workerStatusMap: Record<string, number> = {};
    workersData.forEach((w: any) => {
      workerStatusMap[w.status] = (workerStatusMap[w.status] || 0) + 1;
    });
    console.log('Worker status counts:', workerStatusMap);

    const activeWorkers = workersData.filter((w: any) => w.status === 'running' || w.status === 'idle');
    console.log(`\nActive / Idle workers details (${activeWorkers.length}):`);
    activeWorkers.forEach((w: any) => {
      console.log(`Worker ID: ${w.worker_id} | Status: ${w.status} | Processed: ${w.processed_count} | Failures: ${w.failure_count} | Last Seen: ${w.last_seen_at} | Message: ${w.last_message}`);
    });
  } else {
    console.log('credit_harvest_workers error/missing:', workerErr?.message);
  }

  console.log('\n=== RECENT WORKER LOGS (credit_harvest_logs) ===');
  const { data: recentLogs, error: logErr } = await supabase
    .from('credit_harvest_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(40);

  let cooldownCount = 0;
  let killTimeoutCount = 0;

  if (!logErr && recentLogs) {
    console.log(`Fetched latest ${recentLogs.length} logs from credit_harvest_logs:`);
    recentLogs.slice(0, 15).forEach((l: any) => {
      console.log(`[${l.created_at}] worker=${l.worker_id || 'N/A'} job=${l.job_id || 'N/A'}: ${l.message}`);
    });

    recentLogs.forEach((l: any) => {
      const msg = (l.message || '').toLowerCase();
      if (msg.includes('cooling down') || msg.includes('throttling detected')) {
        cooldownCount++;
      }
      if (msg.includes('process killed') || msg.includes('timeout 900s') || msg.includes('timed out')) {
        killTimeoutCount++;
      }
    });
  } else {
    console.log('credit_harvest_logs error/missing:', logErr?.message);
  }

  console.log('\n=== PERFORMANCE METRICS (DURATION, TIMEOUTS, SUCCESS RATE) ===');
  const finishedJobs = jobStatusCounts.filter((j: any) => ['done', 'failed', 'skipped'].includes(j.status));

  if (finishedJobs.length > 0) {
    let totalDurationMs = 0;
    let validDurationCount = 0;
    let timeoutCount = 0;
    let throttleCount = 0;
    let doneCount = 0;

    finishedJobs.forEach((j: any) => {
      if (j.status === 'done' || j.outcome === 'credits_found' || j.outcome === 'no_credits') {
        doneCount++;
      }
      if (j.started_at && j.processed_at) {
        const d = new Date(j.processed_at).getTime() - new Date(j.started_at).getTime();
        if (d > 0 && d < 7200000) {
          totalDurationMs += d;
          validDurationCount++;
        }
      }

      const errMsg = (j.error || '').toLowerCase();
      const outcome = (j.outcome || '').toLowerCase();
      if (errMsg.includes('timeout') || outcome.includes('timeout') || errMsg.includes('timed out') || outcome.includes('ytdlp_timeout')) {
        timeoutCount++;
      }
      if (errMsg.includes('429') || errMsg.includes('rate') || errMsg.includes('throttle') || outcome.includes('throttle') || errMsg.includes('cool-down') || errMsg.includes('cooldown')) {
        throttleCount++;
      }
    });

    const avgSec = validDurationCount > 0 ? (totalDurationMs / validDurationCount / 1000).toFixed(1) : 'N/A';
    const successRate = ((doneCount / finishedJobs.length) * 100).toFixed(1);
    const timeoutRate = ((timeoutCount / finishedJobs.length) * 100).toFixed(1);

    console.log(`Total finished jobs (done/failed/skipped): ${finishedJobs.length}`);
    console.log(`Successful/Done outcomes (credits_found or no_credits): ${doneCount}`);
    console.log(`Overall Success Rate: ${successRate}%`);
    console.log(`Average job duration: ${avgSec} seconds (${(Number(avgSec)/60).toFixed(2)} mins)`);
    console.log(`Timeout count in finished jobs: ${timeoutCount} (${timeoutRate}%)`);
    console.log(`Recent log throttle/cooldown events: ${cooldownCount}`);
    console.log(`Recent log process killed/timeouts: ${killTimeoutCount}`);
  }

  // Recent 20 finished jobs sample
  console.log('\n=== LATEST 20 PROCESSED JOBS ===');
  const recentProcessed = [...jobStatusCounts]
    .filter((j: any) => j.processed_at || j.started_at)
    .sort((a: any, b: any) => new Date(b.processed_at || b.started_at).getTime() - new Date(a.processed_at || a.started_at).getTime())
    .slice(0, 20);

  recentProcessed.forEach((rj: any) => {
    const durSec = rj.started_at && rj.processed_at ? ((new Date(rj.processed_at).getTime() - new Date(rj.started_at).getTime()) / 1000).toFixed(0) : 'N/A';
    console.log(`[${rj.processed_at || rj.started_at}] Job ${rj.id.slice(0, 8)} | Status: ${rj.status} | Outcome: ${rj.outcome || 'N/A'} | Candidates: ${rj.candidates_found} | Duration: ${durSec}s | Worker: ${rj.worker_id || 'N/A'}`);
    if (rj.error) {
      console.log(`  -> Error: ${rj.error.slice(0, 120)}`);
    }
  });
}

main().catch(console.error);
