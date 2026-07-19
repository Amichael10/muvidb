import { supabase } from './supabase.js';
import {
  buildTmdbEnrichmentProposal,
  chooseBestTmdbPerson,
} from '../../src/lib/peopleEnrichment.js';

const TMDB_API_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';

type QueueTarget = {
  id: string;
  person_id: string;
  attempt_count: number;
};

type PersonContext = {
  person: Record<string, any>;
  creditTitles: string[];
};

const tmdbFetch = async (path: string, params: Record<string, string | number | boolean> = {}) => {
  if (!TMDB_API_KEY) throw new Error('TMDB_API_KEY is not configured');
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set('api_key', TMDB_API_KEY);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`TMDB request failed (${response.status})${detail ? `: ${detail.slice(0, 160)}` : ''}`);
  }
  return response.json();
};

const tmdbPersonDetails = (id: string | number) => tmdbFetch(`/person/${id}`, {
  append_to_response: 'external_ids,combined_credits',
});

const getPersonContext = async (personId: string): Promise<PersonContext> => {
  const [{ data: person, error: personError }, { data: credits, error: creditsError }] = await Promise.all([
    supabase
      .from('people')
      .select('id,name,bio,photo_url,date_of_birth,birthplace,nationality,gender,known_for_department,instagram_url,facebook_url,twitter_url,youtube_channel_id,youtube_handle,tmdb_id,film_count,popularity_score,profile_views,is_verified,is_spotlight,claimed_by')
      .eq('id', personId)
      .single(),
    supabase
      .from('credits')
      .select('films(title)')
      .eq('person_id', personId),
  ]);
  if (personError) throw personError;
  if (creditsError) throw creditsError;

  const creditTitles = (credits || []).flatMap((credit: any) => {
    if (Array.isArray(credit.films)) return credit.films.map((film: any) => film?.title).filter(Boolean);
    return credit.films?.title ? [credit.films.title] : [];
  });
  return { person, creditTitles: [...new Set(creditTitles)] as string[] };
};

const findTmdbMatch = async ({ person, creditTitles }: PersonContext) => {
  if (person.tmdb_id) {
    const details = await tmdbPersonDetails(person.tmdb_id);
    return buildTmdbEnrichmentProposal({ person, creditTitles, details, exactTmdbId: true });
  }

  const search = await tmdbFetch('/search/person', {
    query: person.name,
    include_adult: false,
    page: 1,
  });
  const results = (search?.results || []).slice(0, 5);
  if (!results.length) {
    return {
      status: 'no_match', candidateData: {}, fieldSources: {}, confidence: 0,
      reasons: ['No TMDB result'], matchedCredits: [], sourceName: 'TMDB',
    };
  }

  const detailed = (await Promise.all(results.map((result: any) => tmdbPersonDetails(result.id).catch(() => null))))
    .filter(Boolean);
  const best = chooseBestTmdbPerson({ person, creditTitles, candidates: detailed });
  if (!best) {
    return {
      status: 'no_match', candidateData: {}, fieldSources: {}, confidence: 0,
      reasons: ['No usable TMDB result'], matchedCredits: [], sourceName: 'TMDB',
    };
  }
  return buildTmdbEnrichmentProposal({ person, creditTitles, details: best.details });
};

export const buildPeopleEnrichmentCandidate = async (target: QueueTarget) => {
  await supabase
    .from('people_enrichment_queue')
    .update({
      status: 'fetching',
      attempt_count: Number(target.attempt_count || 0) + 1,
      last_attempt_at: new Date().toISOString(),
    })
    .eq('id', target.id);

  try {
    const context = await getPersonContext(target.person_id);
    const proposal: any = await findTmdbMatch(context);

    if (proposal.candidateData?.tmdb_id) {
      const { data: conflictingPerson } = await supabase
        .from('people')
        .select('id,name')
        .eq('tmdb_id', proposal.candidateData.tmdb_id)
        .neq('id', target.person_id)
        .maybeSingle();
      if (conflictingPerson) {
        proposal.status = 'needs_review';
        proposal.reasons = [
          ...(proposal.reasons || []),
          `TMDB identity is already linked to ${conflictingPerson.name}`,
        ];
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

    return {
      queueId: target.id,
      personId: target.person_id,
      status: proposal.status,
      confidence: proposal.confidence || 0,
      proposedFields: Object.keys(proposal.candidateData || {}),
    };
  } catch (error: any) {
    await supabase
      .from('people_enrichment_queue')
      .update({ status: 'failed', reviewer_note: error?.message || 'Candidate lookup failed' })
      .eq('id', target.id);
    return {
      queueId: target.id,
      personId: target.person_id,
      status: 'failed',
      error: error?.message || 'Candidate lookup failed',
    };
  }
};

export const processPeopleEnrichmentBatch = async ({
  limit = 5,
  queueIds,
}: {
  limit?: number;
  queueIds?: string[];
} = {}) => {
  let query = supabase
    .from('people_enrichment_queue')
    .select('id,person_id,attempt_count')
    .order('priority_score', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 10));

  if (queueIds?.length) query = query.in('id', queueIds.slice(0, 10));
  else query = query.in('status', ['pending', 'failed']);

  const { data, error } = await query;
  if (error) throw error;
  const results = [];
  for (const target of (data || []) as QueueTarget[]) {
    results.push(await buildPeopleEnrichmentCandidate(target));
  }
  return results;
};
