import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './supabase.js';
import { isValidAuth } from './auth.js';
import { runVideosSync } from './sync_service.js';

/**
 * Manual/targeted YouTube refresh.
 *
 * This delegates to the same service used by GitHub Actions so admin-triggered
 * and scheduled syncs cannot drift apart again. The route remains consolidated
 * under /api/cron/sync; no serverless function is added.
 */
export const config = { maxDuration: 300 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end();
  if (!(await isValidAuth(req)).valid) return res.status(401).json({ error: 'Unauthorized' });

  const channelId = typeof req.query.channelId === 'string' ? req.query.channelId : undefined;
  const startedAt = Date.now();
  const { data: logEntry } = await supabase
    .from('sync_logs')
    .insert({
      source: 'youtube_manual',
      status: 'running',
      message: `Started enriched sync for ${channelId ? `channel ${channelId}` : 'all channels'}...`,
      details: { channelId: channelId || null, started_at: new Date().toISOString() },
    })
    .select('id')
    .single();

  try {
    const result: any = await runVideosSync({
      channelId,
      force: true,
      // A targeted manual sync is also an explicit repair request.
      maxPages: channelId ? 4 : 1,
    });

    if (logEntry?.id) {
      await supabase
        .from('sync_logs')
        .update({
          status: 'success',
          message: `Enriched YouTube sync complete. Created ${result.films_created || 0}, repaired ${result.legacy_films_repaired || 0}.`,
          details: { ...result, completed_at: new Date().toISOString() },
          duration_ms: Date.now() - startedAt,
          items_processed: result.processed || 0,
          items_created: result.films_created || 0,
          items_updated: (result.upserted || 0) + (result.legacy_films_repaired || 0),
          items_failed: 0,
        })
        .eq('id', logEntry.id);
    }

    return res.status(200).json({
      success: true,
      videos_upserted: result.upserted || 0,
      channels_processed: result.processed || 0,
      films_created: result.films_created || 0,
      films_repaired: result.legacy_films_repaired || 0,
      credits_added: result.repair_credits_added || 0,
      synopses_generated: result.repair_synopses_generated || 0,
      ...result,
    });
  } catch (err: any) {
    if (logEntry?.id) {
      await supabase
        .from('sync_logs')
        .update({
          status: 'error',
          message: err.message,
          duration_ms: Date.now() - startedAt,
          items_failed: 1,
          details: { error: err.stack },
        })
        .eq('id', logEntry.id);
    }
    return res.status(500).json({ error: err.message });
  }
}
