import { authHeaders } from './apiAuth';
import { supabase } from './supabase';
import {
  buildTmdbEnrichmentProposal,
  chooseBestTmdbPerson,
} from './peopleEnrichment';

const QUEUE_SELECT = `
  id,person_id,status,missing_fields,current_completeness,priority_score,
  candidate_data,field_sources,source_name,source_record_id,source_url,
  match_confidence,match_reasons,matched_credits,reviewer_note,attempt_count,
  last_attempt_at,reviewed_at,created_at,updated_at,
  person:people!inner(
    id,name,slug,photo_url,bio,date_of_birth,birthplace,nationality,gender,
    known_for_department,instagram_url,facebook_url,twitter_url,
    youtube_channel_id,youtube_handle,tmdb_id,film_count,popularity_score,
    profile_views,is_verified,is_spotlight,claimed_by,source
  )
`;

const STATUS_GROUPS = {
  review: ['ready', 'needs_review'],
  pending: ['pending', 'fetching', 'failed'],
};

const apiRequest = async (body) => {
  if (import.meta.env.DEV) return null;
  const response = await fetch('/api/people-enrichment', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  const contentType = response.headers.get('content-type') || '';
  if (response.status === 404 || !contentType.includes('application/json')) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'People enrichment request failed');
  return payload;
};

const getLocalStats = async () => {
  const statuses = ['pending', 'fetching', 'failed', 'ready', 'needs_review', 'no_match', 'applied', 'skipped'];
  const pairs = await Promise.all(statuses.map(async (status) => {
    const { count, error } = await supabase
      .from('people_enrichment_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', status);
    if (error) throw error;
    return [status, count || 0];
  }));
  const counts = Object.fromEntries(pairs);
  return {
    total: Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0),
    pending: counts.pending + counts.fetching + counts.failed,
    review: counts.ready + counts.needs_review,
    ready: counts.ready,
    needsReview: counts.needs_review,
    noMatch: counts.no_match,
    applied: counts.applied,
    skipped: counts.skipped,
  };
};

const tmdbFetch = async (endpoint, params = {}) => {
  const query = new URLSearchParams({ endpoint });
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) query.set(key, String(value));
  });
  const response = await fetch(`/api/tmdb?${query.toString()}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.status_message || payload.error || 'TMDB lookup failed');
  return payload;
};

const tmdbPersonDetails = (id) => tmdbFetch(`/person/${id}`, {
  append_to_response: 'external_ids,combined_credits',
});

const getPersonContext = async (personId) => {
  const [{ data: person, error: personError }, { data: credits, error: creditsError }] = await Promise.all([
    supabase
      .from('people')
      .select('id,name,bio,photo_url,date_of_birth,birthplace,nationality,gender,known_for_department,instagram_url,facebook_url,twitter_url,youtube_channel_id,youtube_handle,tmdb_id,film_count,popularity_score,profile_views,is_verified,is_spotlight,claimed_by')
      .eq('id', personId)
      .single(),
    supabase.from('credits').select('films(title)').eq('person_id', personId),
  ]);
  if (personError) throw personError;
  if (creditsError) throw creditsError;
  const creditTitles = (credits || []).flatMap((credit) => {
    if (Array.isArray(credit.films)) return credit.films.map((film) => film?.title).filter(Boolean);
    return credit.films?.title ? [credit.films.title] : [];
  });
  return { person, creditTitles: [...new Set(creditTitles)] };
};

const findTmdbMatch = async ({ person, creditTitles }) => {
  if (person.tmdb_id) {
    const details = await tmdbPersonDetails(person.tmdb_id);
    return buildTmdbEnrichmentProposal({ person, creditTitles, details, exactTmdbId: true });
  }
  const search = await tmdbFetch('/search/person', {
    query: person.name,
    include_adult: false,
    page: 1,
  });
  const candidates = (await Promise.all((search.results || []).slice(0, 5)
    .map((result) => tmdbPersonDetails(result.id).catch(() => null))))
    .filter(Boolean);
  const best = chooseBestTmdbPerson({ person, creditTitles, candidates });
  if (!best) {
    return {
      status: 'no_match', candidateData: {}, fieldSources: {}, confidence: 0,
      reasons: ['No trusted TMDB result'], matchedCredits: [], sourceName: 'TMDB',
    };
  }
  return buildTmdbEnrichmentProposal({ person, creditTitles, details: best.details });
};

const buildLocalCandidate = async (target) => {
  const attemptCount = Number(target.attempt_count || 0) + 1;
  const { error: fetchingError } = await supabase
    .from('people_enrichment_queue')
    .update({ status: 'fetching', attempt_count: attemptCount, last_attempt_at: new Date().toISOString() })
    .eq('id', target.id);
  if (fetchingError) throw fetchingError;

  try {
    const context = await getPersonContext(target.person_id);
    const proposal = await findTmdbMatch(context);
    if (proposal.candidateData?.tmdb_id) {
      const { data: conflict } = await supabase
        .from('people')
        .select('id,name')
        .eq('tmdb_id', proposal.candidateData.tmdb_id)
        .neq('id', target.person_id)
        .limit(1)
        .maybeSingle();
      if (conflict) {
        proposal.status = 'needs_review';
        proposal.reasons = [...(proposal.reasons || []), `TMDB identity is already linked to ${conflict.name}`];
      }
    }

    const { error } = await supabase
      .from('people_enrichment_queue')
      .update({
        status: proposal.status,
        candidate_data: proposal.candidateData || {},
        field_sources: proposal.fieldSources || {},
        source_name: proposal.sourceName || 'TMDB',
        source_record_id: proposal.sourceRecordId || null,
        source_url: proposal.sourceUrl || null,
        match_confidence: proposal.confidence || 0,
        match_reasons: proposal.reasons || [],
        matched_credits: proposal.matchedCredits || [],
        reviewer_note: null,
      })
      .eq('id', target.id);
    if (error) throw error;
    return { queueId: target.id, status: proposal.status };
  } catch (error) {
    await supabase
      .from('people_enrichment_queue')
      .update({ status: 'failed', reviewer_note: error?.message || 'Candidate lookup failed' })
      .eq('id', target.id);
    return { queueId: target.id, status: 'failed', error: error?.message || 'Candidate lookup failed' };
  }
};

export const checkPeopleEnrichmentSetup = async () => {
  const { error } = await supabase.from('people_enrichment_queue').select('id').limit(1);
  return { ready: !error, error };
};

export const listPeopleEnrichment = async (options = {}) => {
  const remote = await apiRequest({ action: 'list', ...options });
  if (remote) return remote;

  const page = Math.max(1, Number(options.page) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(options.pageSize) || 40));
  const from = (page - 1) * pageSize;
  let query = supabase.from('people_enrichment_queue').select(QUEUE_SELECT, { count: 'exact' });
  const statuses = STATUS_GROUPS[options.status];
  if (statuses) query = query.in('status', statuses);
  else if (options.status && options.status !== 'all') query = query.eq('status', options.status);
  if (options.missingField && options.missingField !== 'all') {
    query = query.contains('missing_fields', [options.missingField]);
  }
  const search = String(options.search || '').trim();
  if (search) query = query.ilike('person.name', `%${search}%`);

  const [{ data, error, count }, stats] = await Promise.all([
    query
      .order('priority_score', { ascending: false })
      .order('updated_at', { ascending: false })
      .range(from, from + pageSize - 1),
    getLocalStats(),
  ]);
  if (error) throw error;
  return { rows: data || [], count: count || 0, page, pageSize, stats };
};

export const refreshPeopleEnrichment = async () => {
  const remote = await apiRequest({ action: 'refresh' });
  if (remote) return remote;
  const { data, error } = await supabase.rpc('refresh_people_enrichment_queue');
  if (error) throw error;
  return { success: true, affected: data || 0, stats: await getLocalStats() };
};

export const suggestPeopleEnrichment = async ({ queueIds, limit = 5 } = {}) => {
  const remote = await apiRequest({ action: 'suggest', queueIds, limit });
  if (remote) return remote;
  let query = supabase
    .from('people_enrichment_queue')
    .select('id,person_id,attempt_count')
    .order('priority_score', { ascending: false })
    .limit(Math.min(10, Math.max(1, limit)));
  if (queueIds?.length) query = query.in('id', queueIds.slice(0, 10));
  else query = query.in('status', ['pending', 'failed']);
  const { data, error } = await query;
  if (error) throw error;
  const results = [];
  for (const target of data || []) results.push(await buildLocalCandidate(target));
  return { success: true, results, stats: await getLocalStats() };
};

export const applyPeopleEnrichment = async (queueId, fields) => {
  const remote = await apiRequest({ action: 'apply', queueId, fields });
  if (remote) return remote;
  const { data, error } = await supabase.rpc('apply_people_enrichment_candidate', {
    p_queue_id: queueId,
    p_fields: fields,
    p_reviewer_id: null,
  });
  if (error) throw error;
  return { success: true, person: data };
};

export const reviewPeopleEnrichment = async (queueId, status, note = null) => {
  const remote = await apiRequest({ action: 'review', queueId, status, note });
  if (remote) return remote;
  const { error } = await supabase.rpc('review_people_enrichment_candidate', {
    p_queue_id: queueId,
    p_status: status,
    p_note: note,
    p_reviewer_id: null,
  });
  if (error) throw error;
  return { success: true };
};
