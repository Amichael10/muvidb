import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isValidAuth } from './auth.js';
import { handleCors } from './cors.js';
import { supabase } from './supabase.js';
import { scanDuplicateRecords } from '../../src/lib/deduplicator.js';

export const maxDuration = 60;

const PEOPLE_SCAN_FIELDS = [
  'id', 'name', 'slug', 'photo_url', 'bio', 'date_of_birth', 'nationality',
  'gender', 'tmdb_id', 'mubi_id', 'instagram_url', 'facebook_url',
  'twitter_url', 'youtube_channel_id', 'youtube_handle', 'is_verified',
  'claimed_by', 'known_for_department', 'popularity_score', 'profile_views',
  'film_count', 'source', 'created_at', 'updated_at',
].join(',');

const FILM_SCAN_FIELDS = [
  'id', 'title', 'original_title', 'slug', 'poster_url', 'synopsis', 'year',
  'release_date', 'runtime_minutes', 'tmdb_id', 'mubi_id', 'source',
  'source_video_id', 'trailer_youtube_id', 'content_type', 'series_id',
  'season_number', 'episode_number', 'release_type', 'status', 'is_published',
  'view_count', 'needs_review', 'youtube_watch_url', 'streaming_links',
  'trailer_external_url', 'film_watch_links(distributor,url)', 'created_at', 'updated_at',
].join(',');

const VALID_ENTITIES = new Set(['people', 'films']);

const fetchAll = async (table: 'people' | 'films', select: string) => {
  const rows: any[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return rows;
};

const compactReport = (report: any) => ({
  ...report,
  groups: report.groups.map((group: any) => ({
    ...group,
    records: group.records.map((record: any) => ({
      ...record,
      bio: record.bio ? String(record.bio).slice(0, 420) : null,
      synopsis: record.synopsis ? String(record.synopsis).slice(0, 420) : null,
    })),
  })),
});

const pairKey = (left: string, right: string) => [left, right].sort().join(':');

const removeDismissedGroups = async (report: any, entity: string) => {
  const { data } = await supabase
    .from('dedupe_ignored_pairs')
    .select('left_record_id,right_record_id')
    .eq('entity_type', entity);
  if (!data?.length) return report;

  const ignored = new Set(data.map((row: any) => pairKey(row.left_record_id, row.right_record_id)));
  const groups = report.groups.filter((group: any) => {
    const ids = group.records.map((record: any) => record.id);
    const pairs: string[] = [];
    for (let left = 0; left < ids.length; left += 1) {
      for (let right = left + 1; right < ids.length; right += 1) {
        pairs.push(pairKey(ids[left], ids[right]));
      }
    }
    return !pairs.length || pairs.some((pair) => !ignored.has(pair));
  });

  return {
    ...report,
    groups,
    summary: {
      ...report.summary,
      groups: groups.length,
      recordsInGroups: new Set(groups.flatMap((group: any) => group.records.map((record: any) => record.id))).size,
      high: groups.filter((group: any) => group.confidence === 'high').length,
      medium: groups.filter((group: any) => group.confidence === 'medium').length,
      review: groups.filter((group: any) => group.confidence === 'review').length,
      blocked: groups.filter((group: any) => group.confidence === 'blocked').length,
    },
  };
};

const scan = async (entity: 'people' | 'films', res: VercelResponse) => {
  const fields = entity === 'people' ? PEOPLE_SCAN_FIELDS : FILM_SCAN_FIELDS;
  const records = await fetchAll(entity, fields);
  const rawReport = scanDuplicateRecords(records, entity);
  const report = await removeDismissedGroups(rawReport, entity);

  await supabase.from('dedupe_scan_runs').insert({
    entity_type: entity,
    records_scanned: report.recordsScanned,
    candidate_groups: report.summary.groups,
    summary: report.summary,
    completed_at: report.scannedAt,
  });

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(compactReport(report));
};

const details = async (entity: 'people' | 'films', ids: string[], res: VercelResponse) => {
  if (!Array.isArray(ids) || ids.length < 2 || ids.length > 50) {
    return res.status(400).json({ error: 'Choose between 2 and 50 records' });
  }
  const fields = entity === 'people' ? PEOPLE_SCAN_FIELDS : FILM_SCAN_FIELDS;
  const { data, error } = await supabase.from(entity).select(fields).in('id', ids);
  if (error) throw error;
  return res.status(200).json({ records: data || [] });
};

const merge = async (
  entity: 'people' | 'films',
  primaryId: string,
  duplicateIds: string[],
  metadata: Record<string, unknown>,
  res: VercelResponse,
) => {
  const duplicates = [...new Set((duplicateIds || []).filter((id) => id && id !== primaryId))];
  if (!primaryId || !duplicates.length || duplicates.length > 49) {
    return res.status(400).json({ error: 'Choose one primary record and at least one duplicate' });
  }

  const rpcName = entity === 'people' ? 'merge_people_group' : 'merge_films_group';
  const { error } = await supabase.rpc(rpcName, {
    p_master_id: primaryId,
    p_duplicate_ids: duplicates,
    p_metadata: metadata || {},
  });
  if (error) throw error;

  return res.status(200).json({ success: true, primaryId, mergedIds: duplicates });
};

const dismiss = async (
  entity: 'people' | 'films',
  ids: string[],
  reason: string,
  res: VercelResponse,
) => {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))];
  if (uniqueIds.length < 2 || uniqueIds.length > 50) {
    return res.status(400).json({ error: 'Choose between 2 and 50 records' });
  }

  const rows = [];
  for (let left = 0; left < uniqueIds.length; left += 1) {
    for (let right = left + 1; right < uniqueIds.length; right += 1) {
      const [leftRecordId, rightRecordId] = [uniqueIds[left], uniqueIds[right]].sort();
      rows.push({
        entity_type: entity,
        left_record_id: leftRecordId,
        right_record_id: rightRecordId,
        reason: String(reason || '').trim() || null,
      });
    }
  }

  const { error } = await supabase
    .from('dedupe_ignored_pairs')
    .upsert(rows, { onConflict: 'entity_type,left_record_id,right_record_id' });
  if (error) throw error;
  return res.status(200).json({ success: true, ignoredPairs: rows.length });
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await isValidAuth(req);
  if (!auth.valid) return res.status(401).json({ error: 'Unauthorized' });

  const action = String(req.body?.action || 'scan');
  const entity = String(req.body?.entity || 'people') as 'people' | 'films';
  if (!VALID_ENTITIES.has(entity)) return res.status(400).json({ error: 'Invalid entity type' });

  try {
    if (action === 'scan') return await scan(entity, res);
    if (action === 'details') return await details(entity, req.body?.ids, res);
    if (action === 'merge') {
      return await merge(entity, req.body?.primaryId, req.body?.duplicateIds, req.body?.metadata, res);
    }
    if (action === 'dismiss') return await dismiss(entity, req.body?.ids, req.body?.reason, res);
    return res.status(400).json({ error: 'Invalid action' });
  } catch (error: any) {
    console.error('Deduplicator error:', error);
    return res.status(500).json({ error: error?.message || 'Deduplicator operation failed' });
  }
}
