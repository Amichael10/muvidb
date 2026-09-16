import { supabase } from './lib/db';
import * as fs from 'fs';

async function main() {
  const result: any = {};
  result.timestamp = new Date().toISOString();

  // 1. Credit harvest jobs
  const { data: jobStatusCounts, error: statusErr } = await supabase
    .from('credit_harvest_jobs')
    .select('id, film_id, channel_id, status, outcome, priority, attempts, candidates_found, error, started_at, processed_at, created_at, worker_id, heartbeat_at');

  if (statusErr) {
    result.statusErr = statusErr;
    fs.writeFileSync('scripts/monitor_37_output.json', JSON.stringify(result, null, 2));
    return;
  }

  const statusMap: Record<string, number> = {};
  const outcomeMap: Record<string, number> = {};
  jobStatusCounts.forEach((row: any) => {
    statusMap[row.status] = (statusMap[row.status] || 0) + 1;
    if (row.outcome) {
      outcomeMap[row.outcome] = (outcomeMap[row.outcome] || 0) + 1;
    } else {
      outcomeMap['null/none'] = (outcomeMap['null/none'] || 0) + 1;
    }
  });

  result.jobStatusCounts = statusMap;
  result.jobOutcomeCounts = outcomeMap;
  result.totalJobs = jobStatusCounts.length;

  const runningJobs = jobStatusCounts.filter((r: any) => r.status === 'running');
  result.runningJobsCount = runningJobs.length;
  result.runningJobs = runningJobs.map((rj: any) => ({
    id: rj.id,
    worker_id: rj.worker_id,
    started_at: rj.started_at,
    heartbeat_at: rj.heartbeat_at,
    attempts: rj.attempts,
    film_id: rj.film_id
  }));

  // 2. Credit candidates
  const { count: candidateCount } = await supabase
    .from('credit_candidates')
    .select('*', { count: 'exact', head: true });
  result.totalCandidates = candidateCount;

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
    result.candidateStatusCounts = cMap;
    result.candidateSourceCounts = sMap;
  }

  // 3. Workers Table
  const { data: workersData, error: workerErr } = await supabase
    .from('credit_harvest_workers')
    .select('*');
  if (!workerErr && workersData) {
    result.totalWorkers = workersData.length;
    const workerStatusMap: Record<string, number> = {};
    workersData.forEach((w: any) => {
      workerStatusMap[w.status] = (workerStatusMap[w.status] || 0) + 1;
    });
    result.workerStatusCounts = workerStatusMap;
    result.workers = workersData;
  }

  // 4. Recent Worker Logs
  const { data: recentLogs, error: logErr } = await supabase
    .from('credit_harvest_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  let cooldownCount = 0;
  let killTimeoutCount = 0;
  let throttleCountLogs = 0;

  if (!logErr && recentLogs) {
    result.recentLogsSample = recentLogs.slice(0, 15);
    recentLogs.forEach((l: any) => {
      const msg = (l.message || '').toLowerCase();
      if (msg.includes('cooling down') || msg.includes('cooldown') || msg.includes('cool-down')) {
        cooldownCount++;
      }
      if (msg.includes('throttling') || msg.includes('429') || msg.includes('rate limit')) {
        throttleCountLogs++;
      }
      if (msg.includes('process killed') || msg.includes('timeout') || msg.includes('timed out')) {
        killTimeoutCount++;
      }
    });
  }
  result.logCooldownEvents = cooldownCount;
  result.logThrottleEvents = throttleCountLogs;
  result.logKillTimeoutEvents = killTimeoutCount;

  // 5. Performance Metrics
  const finishedJobs = jobStatusCounts.filter((j: any) => ['done', 'failed', 'skipped'].includes(j.status));
  result.totalFinishedJobs = finishedJobs.length;

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

    const avgSec = validDurationCount > 0 ? (totalDurationMs / validDurationCount / 1000).toFixed(1) : '0';
    const successRate = ((doneCount / finishedJobs.length) * 100).toFixed(1);
    const timeoutRate = ((timeoutCount / finishedJobs.length) * 100).toFixed(1);

    result.performance = {
      doneCount,
      successRate: `${successRate}%`,
      avgDurationSeconds: avgSec,
      avgDurationMinutes: (Number(avgSec)/60).toFixed(2),
      timeoutCount,
      timeoutRate: `${timeoutRate}%`,
      jobThrottleCount: throttleCount
    };
  }

  // 6. Latest 15 processed jobs
  result.recentProcessedJobs = [...jobStatusCounts]
    .filter((j: any) => j.processed_at || j.started_at)
    .sort((a: any, b: any) => new Date(b.processed_at || b.started_at).getTime() - new Date(a.processed_at || a.started_at).getTime())
    .slice(0, 15);

  fs.writeFileSync('scripts/monitor_37_output.json', JSON.stringify(result, null, 2));
  console.log('Saved result to scripts/monitor_37_output.json');
}

main().catch(console.error);
