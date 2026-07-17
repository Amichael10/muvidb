// sync_logs lifecycle for scraper/sync adapters. Usage:
//
//   const log = await startSyncLog('mysource', 'Syncing mysource...');
//   try {
//     ... work, incrementing log.counters ...
//     await log.finish(`Done. ${log.counters.updated} updated.`);
//   } catch (err) {
//     await log.fail(err);
//     process.exit(1);
//   }
import { supabase } from './db';

export type SyncCounters = { processed: number; created: number; updated: number; failed: number };

export async function startSyncLog(source: string, message: string) {
  const startTime = Date.now();
  const counters: SyncCounters = { processed: 0, created: 0, updated: 0, failed: 0 };

  const { data: entry, error } = await supabase
    .from('sync_logs')
    .insert({
      source,
      status: 'running',
      message,
      details: { started_at: new Date().toISOString() },
    })
    .select()
    .single();
  if (error) console.warn(`sync_logs insert failed (continuing): ${error.message}`);
  const logId = entry?.id;

  async function update(fields: Record<string, unknown>) {
    if (!logId) return;
    await supabase
      .from('sync_logs')
      .update({
        duration_ms: Date.now() - startTime,
        items_processed: counters.processed,
        items_created: counters.created,
        items_updated: counters.updated,
        items_failed: counters.failed,
        ...fields,
      })
      .eq('id', logId);
  }

  return {
    id: logId,
    counters,
    startTime,
    finish: (message: string, details?: Record<string, unknown>) =>
      update({
        status: counters.failed === 0 ? 'success' : 'partial',
        message,
        details: { ...counters, ...details },
      }),
    fail: (err: Error) =>
      update({ status: 'error', message: err.message, details: { error: err.stack } }),
  };
}
