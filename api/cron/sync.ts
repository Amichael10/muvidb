import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase.js';
import { isValidAuth } from '../_lib/auth.js';
import { runCastExtraction, runTitleCleanup } from '../_lib/ai_maintenance.js';
import { runShowtimesSync, runVideosSync, runTMDBSync } from '../_lib/sync_service.js';

/**
 * Main Cron Entry Point
 * Orchestrates various sync tasks: showtimes, videos, TMDB discovery, and AI maintenance.
 */

export const config = { maxDuration: 300 }; // 5-minute timeout

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end();
  
  // Auth Check
  if (!(await isValidAuth(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { task } = req.query;
  const startTime = Date.now();

  try {
    // ── CASE 1: Run ALL Tasks ────────────────────────────────────────────────
    if (!task) {
      console.log('[cron/sync] No task specified, running ALL tasks in sequence...');
      
      const { data: masterLog } = await supabase.from('sync_logs').insert({
        source: 'master',
        status: 'running',
        message: 'Running all sync tasks...'
      }).select().single();

      const results: any = {};
      const tasks = [
        { name: 'showtimes', fn: runShowtimesSync },
        { name: 'videos', fn: runVideosSync },
        { name: 'tmdb', fn: runTMDBSync },
        { name: 'ai_maintenance', fn: runAIMaintenance }
      ];

      for (const t of tasks) {
        const tStart = Date.now();
        try {
          const res = await t.fn();
          results[t.name] = res;
          
          await supabase.from('sync_logs').insert({
            source: t.name,
            status: 'success',
            message: `Completed ${t.name} task`,
            details: res,
            duration_ms: Date.now() - tStart,
            items_processed: res.processed || res.upserted || res.imported || 0,
            items_updated: res.upserted || res.imported || 0
          });
        } catch (e: any) {
          console.error(`[cron/sync] Task ${t.name} failed:`, e.message);
          results[t.name] = { error: e.message };
          
          await supabase.from('sync_logs').insert({
            source: t.name,
            status: 'error',
            message: e.message,
            duration_ms: Date.now() - tStart,
            items_failed: 1
          });
        }
      }
      
      if (masterLog) {
        await supabase.from('sync_logs').update({
          status: 'success',
          message: 'All sync tasks completed',
          details: { results, completed_at: new Date().toISOString() },
          duration_ms: Date.now() - startTime
        }).eq('id', masterLog.id);
      }
      
      return res.status(200).json({
        success: true,
        message: 'All sync tasks completed',
        results
      });
    }

    // ── CASE 2: Run Specific Task ───────────────────────────────────────────
    console.log(`[cron/sync] Starting task: ${task}`);
    
    const { data: taskLog } = await supabase.from('sync_logs').insert({
      source: task as string,
      status: 'running',
      message: `Running ${task} task...`
    }).select().single();

    const tStart = Date.now();
    let result: any;

    switch (task) {
      case 'showtimes':      result = await runShowtimesSync(); break;
      case 'videos':         result = await runVideosSync(); break;
      case 'tmdb':           result = await runTMDBSync(); break;
      case 'ai_maintenance': result = await runAIMaintenance(); break;
      case 'kava':      
        return res.status(200).json({ 
          task: 'kava', 
          status: 'moved_to_github_actions',
          message: 'Kava sync now runs directly in GitHub Actions to bypass Vercel timeout limits.' 
        });
      default:
        return res.status(400).json({ error: 'Invalid task' });
    }

    if (taskLog) {
      await supabase.from('sync_logs').update({
        status: 'success',
        message: `Completed ${task} task`,
        details: { result, completed_at: new Date().toISOString() },
        duration_ms: Date.now() - tStart,
        items_processed: result.processed || result.upserted || result.imported || 0,
        items_updated: result.upserted || result.imported || 0
      }).eq('id', taskLog.id);
    }

    return res.status(200).json(result);

  } catch (err: any) {
    console.error(`[cron/sync] Fatal error in ${task || 'master'}:`, err.message);
    
    await supabase.from('sync_logs').insert({
      source: (task as string) || 'master',
      status: 'error',
      message: err.message,
      duration_ms: Date.now() - startTime,
      items_failed: 1
    });
    
    return res.status(500).json({ error: err.message });
  }
}

// ── TASK: AI MAINTENANCE ─────────────────────────────────────────────────────
// Orchestrates extract_cast → cleanup_titles in sequence.
// Isolated here to keep the switch statement clean and manage sequential dependencies.
async function runAIMaintenance() {
  console.log('[AI Maintenance] Starting automated AI pipeline...');
  const results: any = { extract_cast: null, cleanup_titles: null };

  // 1. Extract Cast (must run first to capture actor names from messy titles)
  try {
    results.extract_cast = await runCastExtraction();
  } catch (err: any) {
    results.extract_cast = { error: err.message };
  }

  // 2. Cleanup Titles (strips marketing noise)
  try {
    results.cleanup_titles = await runTitleCleanup();
  } catch (err: any) {
    results.cleanup_titles = { error: err.message };
  }

  return { task: 'ai_maintenance', ...results };
}
