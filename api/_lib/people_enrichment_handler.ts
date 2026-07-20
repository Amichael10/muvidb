import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isValidAuth } from './auth.js';
import { handleCors } from './cors.js';
import { supabase } from './supabase.js';
import { processPeopleEnrichmentBatch } from './people_enrichment.js';

export const maxDuration = 60;

const PERSON_EMBED = `
  id,name,slug,photo_url,bio,date_of_birth,birthplace,nationality,gender,
  known_for_department,instagram_url,facebook_url,twitter_url,tiktok_url,
  youtube_channel_id,youtube_handle,tmdb_id,film_count,popularity_score,
  profile_views,is_verified,is_spotlight,claimed_by,source
`;

const QUEUE_FIELDS = `
  id,person_id,status,missing_fields,current_completeness,priority_score,
  candidate_data,field_sources,source_name,source_record_id,source_url,
  match_confidence,match_reasons,matched_credits,reviewer_note,attempt_count,
  last_attempt_at,reviewed_at,created_at,updated_at
`;

const QUEUE_SELECT = `
  ${QUEUE_FIELDS},
  person:people!inner(${PERSON_EMBED}),
  research_runs:people_enrichment_research_runs(
    id,provider,model,status,identity_confidence,identity_reasons,
    search_queries,estimated_cost,started_at,completed_at,error_message
  ),
  evidence:people_enrichment_evidence(
    id,field_name,proposed_value,source_url,source_title,source_domain,
    source_tier,evidence_excerpt,identity_anchor,verification_status,retrieved_at
  )
`;

const QUEUE_SELECT_BASIC = `
  ${QUEUE_FIELDS},
  person:people!inner(${PERSON_EMBED})
`;

function uniqueStringIds(values: unknown, max: number): string[] | undefined {
  if (!Array.isArray(values)) return undefined;
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && Boolean(value)))]
    .slice(0, max);
}

async function getRequestUserId(req: VercelRequest): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data } = await supabase.auth.getUser(token);
  return data?.user?.id || null;
}

function applyFilters(query: any, body: any) {
  const status = String(body?.status || 'review');
  if (status === 'review') query = query.in('status', ['ready', 'needs_review']);
  else if (status === 'pending') query = query.in('status', ['pending', 'fetching', 'failed']);
  else if (status !== 'all') query = query.eq('status', status);
  if (body?.missingField && body.missingField !== 'all') {
    query = query.contains('missing_fields', [String(body.missingField)]);
  }
  if (String(body?.search || '').trim()) {
    query = query.ilike('person.name', `%${String(body.search).trim()}%`);
  }
  return query;
}

async function queueStats() {
  const statuses = ['pending', 'fetching', 'failed', 'ready', 'needs_review', 'no_match', 'applied', 'skipped'];
  const pairs = await Promise.all(statuses.map(async (status) => {
    const { count, error } = await supabase
      .from('people_enrichment_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', status);
    if (error) throw error;
    return [status, count || 0] as const;
  }));
  const counts = Object.fromEntries(pairs);
  return {
    total: Object.values(counts).reduce((sum: number, value: any) => sum + Number(value || 0), 0),
    pending: counts.pending + counts.fetching + counts.failed,
    review: counts.ready + counts.needs_review,
    ready: counts.ready,
    needsReview: counts.needs_review,
    noMatch: counts.no_match,
    applied: counts.applied,
    skipped: counts.skipped,
  };
}

async function list(body: any, res: VercelResponse) {
  const page = Math.max(1, Number(body?.page) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(body?.pageSize) || 40));
  const from = (page - 1) * pageSize;
  const runQuery = (select: string) => applyFilters(
    supabase.from('people_enrichment_queue').select(select, { count: 'exact' }),
    body,
  )
    // Least-complete first: tackle 0% profiles before the 50-90% ones.
    .order('current_completeness', { ascending: true })
    .order('priority_score', { ascending: false })
    .order('updated_at', { ascending: false })
    .range(from, from + pageSize - 1);

  let [{ data, error, count }, stats] = await Promise.all([runQuery(QUEUE_SELECT), queueStats()]);
  if (error) {
    [{ data, error, count }, stats] = await Promise.all([runQuery(QUEUE_SELECT_BASIC), queueStats()]);
  }
  if (error) throw error;
  return res.status(200).json({ rows: data || [], count: count || 0, page, pageSize, stats });
}

async function refresh(res: VercelResponse) {
  const { data, error } = await supabase.rpc('refresh_people_enrichment_queue');
  if (error) throw error;
  return res.status(200).json({ success: true, affected: data || 0, stats: await queueStats() });
}

async function suggest(body: any, res: VercelResponse) {
  const queueIds = uniqueStringIds(body?.queueIds, 10);
  const limit = Math.min(10, Math.max(1, Number(body?.limit) || 5));
  const results = await processPeopleEnrichmentBatch({ limit, queueIds });
  return res.status(200).json({ success: true, results, stats: await queueStats() });
}

async function apply(req: VercelRequest, body: any, res: VercelResponse) {
  const queueId = String(body?.queueId || '');
  const fields = Array.isArray(body?.fields) ? [...new Set(body.fields.filter(Boolean))] : [];
  if (!queueId || !fields.length) return res.status(400).json({ error: 'Select at least one proposed field' });
  const reviewerId = await getRequestUserId(req);
  const { data, error } = await supabase.rpc('apply_people_enrichment_candidate', {
    p_queue_id: queueId,
    p_fields: fields,
    p_reviewer_id: reviewerId,
  });
  if (error) throw error;
  return res.status(200).json({ success: true, person: data });
}

async function review(req: VercelRequest, body: any, res: VercelResponse) {
  const queueId = String(body?.queueId || '');
  const status = String(body?.status || 'skipped');
  if (!queueId || !['skipped', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid review decision' });
  }
  const reviewerId = await getRequestUserId(req);
  const { error } = await supabase.rpc('review_people_enrichment_candidate', {
    p_queue_id: queueId,
    p_status: status,
    p_note: String(body?.note || '').trim() || null,
    p_reviewer_id: reviewerId,
  });
  if (error) throw error;
  return res.status(200).json({ success: true });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await isValidAuth(req)).valid) return res.status(401).json({ error: 'Unauthorized' });

  const action = String(req.body?.action || 'list');
  try {
    if (action === 'list') return await list(req.body, res);
    if (action === 'refresh') return await refresh(res);
    if (action === 'suggest') return await suggest(req.body, res);
    if (action === 'apply') return await apply(req, req.body, res);
    if (action === 'review') return await review(req, req.body, res);
    return res.status(400).json({ error: 'Invalid action' });
  } catch (error: any) {
    console.error('People enrichment error:', error);
    return res.status(500).json({ error: error?.message || 'People enrichment operation failed' });
  }
}
