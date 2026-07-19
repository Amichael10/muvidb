/**
 * Pure helpers for grounded Gemini people enrichment.
 * Used by the server research pipeline and unit tests.
 */

export const GEMINI_PEOPLE_PROMPT_VERSION = 'gemini-people-v1';

export const GEMINI_RESEARCH_FIELDS = [
  'bio',
  'photo_url',
  'photo_source_page',
  'date_of_birth',
  'birthplace',
  'nationality',
  'gender',
  'known_for_department',
  'instagram_url',
  'facebook_url',
  'twitter_url',
  'youtube_url',
  'youtube_handle',
  'tiktok_url',
  'notable_credits',
];

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'mc_cid', 'mc_eid', 'ref', 'ref_src',
]);

/** Prefer official / interview / festival sources over aggregators. */
export const SOURCE_TIER_RULES = [
  { tier: 1, pattern: /(^|\.)(instagram|facebook|x|twitter|tiktok|youtube|youtu)\.com$/i, label: 'official_or_social' },
  { tier: 1, pattern: /(production|studios?|films?|pictures|entertainment)\./i, label: 'production_company' },
  { tier: 2, pattern: /(interview|presskit|about)/i, label: 'interview_or_profile' },
  { tier: 3, pattern: /(festival|broadcaster|cinema|distributor|netflix|primevideo|showmax|irokotv)/i, label: 'festival_or_distributor' },
  { tier: 4, pattern: /(guardian|variety|tribune|deadline|tribune|pulse|premiumtimes|thisdaylive|vanguard|punchng|legit\.ng|bella\.ng)/i, label: 'press' },
  { tier: 5, pattern: /(themoviedb|tmdb|imdb|wikipedia|wikidata)/i, label: 'aggregator' },
];

export function normalizeUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let value = raw.trim();
  if (!value) return null;
  if (value.startsWith('//')) value = `https:${value}`;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  try {
    const url = new URL(value);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) {
        url.searchParams.delete(key);
      }
    }
    let pathname = url.pathname.replace(/\/+$/, '') || '';
    if (pathname === '/') pathname = '';
    const query = url.searchParams.toString();
    return `${url.protocol}//${url.hostname}${pathname}${query ? `?${query}` : ''}`;
  } catch {
    return null;
  }
}

export function sourceDomain(rawUrl) {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) return null;
  try {
    return new URL(normalized).hostname;
  } catch {
    return null;
  }
}

export function classifySourceTier(rawUrl, title = '') {
  const domain = sourceDomain(rawUrl) || '';
  const haystack = `${domain} ${title || ''} ${rawUrl || ''}`.toLowerCase();
  for (const rule of SOURCE_TIER_RULES) {
    if (rule.pattern.test(domain) || rule.pattern.test(haystack)) return rule.tier;
  }
  return 4;
}

/**
 * Extract citation URLs from Gemini groundingMetadata / urlContextMetadata.
 * Only these URLs count as evidence — never trust URLs that appear only in model JSON.
 */
export function extractGroundingCitationUrls(groundingMetadata = {}, urlContextMetadata = {}) {
  const urls = new Set();

  function push(value) {
    const normalized = normalizeUrl(value);
    if (normalized) urls.add(normalized);
  }

  for (const chunk of groundingMetadata?.groundingChunks || []) {
    push(chunk?.web?.uri || chunk?.web?.url || chunk?.retrievedContext?.uri);
  }
  for (const support of groundingMetadata?.groundingSupports || []) {
    for (const idx of support?.groundingChunkIndices || []) {
      const chunk = groundingMetadata?.groundingChunks?.[idx];
      push(chunk?.web?.uri || chunk?.web?.url);
    }
  }
  for (const item of urlContextMetadata?.urlMetadata || []) {
    push(item?.retrievedUrl || item?.url);
  }

  return [...urls];
}

export function citationUrlSet(groundingMetadata, urlContextMetadata) {
  return new Set(extractGroundingCitationUrls(groundingMetadata, urlContextMetadata));
}

function fold(value = '') {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Require at least two identity anchors. Exact name alone is insufficient.
 */
/**
 * @param {{
 *   identityStatus?: 'matched'|'needs_review'|'no_match',
 *   identityConfidence?: number,
 *   identityReasons?: string[],
 *   identityAnchors?: string[],
 *   conflicts?: any[],
 *   matchedCredits?: string[],
 *   personName?: string,
 *   proposedName?: string|null,
 * }} [args]
 */
export function scoreGeminiIdentity({
  identityStatus,
  identityConfidence,
  identityReasons = [],
  identityAnchors = [],
  conflicts = [],
  matchedCredits = [],
  personName,
  proposedName,
} = {}) {
  const reasons = [...identityReasons];
  const anchors = [...identityAnchors];
  let confidence = Number(identityConfidence);
  if (!Number.isFinite(confidence)) confidence = 0;
  confidence = Math.max(0, Math.min(1, confidence));

  const nameMatch = personName && proposedName
    ? fold(personName) === fold(proposedName)
    : false;
  if (nameMatch && !anchors.some((a) => /name/i.test(a))) {
    anchors.push('matching_name');
  }
  if (matchedCredits?.length && !anchors.some((a) => /credit|film/i.test(a))) {
    anchors.push(`matching_film_credit:${matchedCredits[0]}`);
  }

  const uniqueAnchors = [...new Set(anchors.filter(Boolean))];

  if (uniqueAnchors.length < 2) {
    return {
      status: 'no_match',
      confidence: Math.min(confidence, 0.4),
      reasons: reasons.length
        ? [...reasons, 'Fewer than two identity anchors']
        : ['Fewer than two identity anchors'],
      anchors: uniqueAnchors,
      conflicts,
    };
  }

  if (conflicts?.some((c) => /birth|identity|different person/i.test(String(c?.field || c || '')))) {
    return {
      status: 'needs_review',
      confidence: Math.min(confidence, 0.72),
      reasons: [...reasons, 'Conflicting identity evidence'],
      anchors: uniqueAnchors,
      conflicts,
    };
  }

  if (identityStatus === 'no_match') {
    return {
      status: 'no_match',
      confidence: Math.min(confidence, 0.45),
      reasons: reasons.length ? reasons : ['Model reported no confident match'],
      anchors: uniqueAnchors,
      conflicts,
    };
  }

  if (identityStatus === 'needs_review' || confidence < 0.72) {
    return {
      status: 'needs_review',
      confidence,
      reasons: reasons.length ? reasons : ['Identity needs human review'],
      anchors: uniqueAnchors,
      conflicts,
    };
  }

  return {
    status: confidence >= 0.78 ? 'ready' : 'needs_review',
    confidence,
    reasons: reasons.length ? reasons : ['Grounded identity anchors found'],
    anchors: uniqueAnchors,
    conflicts,
  };
}

function fieldHasCitedUrl(fieldProposal, allowedUrls) {
  return [
    ...(fieldProposal?.evidence_urls || []),
    ...(fieldProposal?.source_urls || []),
    fieldProposal?.source_url,
  ].map(normalizeUrl).filter((url) => url && allowedUrls.has(url));
}

function buildEvidenceRows(fieldName, proposedValue, citedUrls, proposal) {
  return citedUrls.map((url) => ({
    field_name: fieldName,
    proposed_value: proposedValue,
    source_url: url,
    source_title: proposal?.source_title || null,
    source_domain: sourceDomain(url),
    source_tier: classifySourceTier(url, proposal?.source_title),
    evidence_excerpt: proposal?.evidence_excerpt || null,
    identity_anchor: proposal?.identity_anchor || null,
  }));
}

/**
 * Drop any proposed fact whose URL is absent from Gemini grounding citations.
 * A URL written only inside model JSON is not evidence.
 */
export function reconcileCitations(parsed, groundingMetadata = {}, urlContextMetadata = {}) {
  const allowed = citationUrlSet(groundingMetadata, urlContextMetadata);
  const rejected = [];
  const candidateFields = {};
  const evidence = [];

  for (const [fieldName, proposal] of Object.entries(parsed?.candidate_fields || {})) {
    if (!GEMINI_RESEARCH_FIELDS.includes(fieldName)) {
      rejected.push({ field: fieldName, reason: 'Unsupported field' });
      continue;
    }
    if (proposal == null || proposal === '') continue;

    const value = typeof proposal === 'object' && proposal !== null && 'value' in proposal
      ? proposal.value
      : proposal;
    if (value === null || value === undefined || value === '') continue;

    if (fieldName === 'bio') {
      const text = String(value).trim();
      if (!text) continue;
      const sentenceUrls = (Array.isArray(proposal?.sentence_evidence) ? proposal.sentence_evidence : [])
        .flatMap((row) => (row?.evidence_urls || []).map(normalizeUrl).filter((url) => url && allowed.has(url)));
      const cited = [...new Set([...sentenceUrls, ...fieldHasCitedUrl(proposal, allowed)])];
      if (!cited.length) {
        rejected.push({ field: fieldName, reason: 'Bio lacks grounding citations' });
        continue;
      }
      const labeled = text.startsWith('AI-synthesized from cited sources')
        ? text
        : `AI-synthesized from cited sources. ${text}`;
      candidateFields[fieldName] = labeled;
      evidence.push(...buildEvidenceRows(fieldName, labeled, cited, proposal));
      continue;
    }

    if (fieldName === 'gender') {
      const gender = String(value).trim();
      if (!/^(male|female|non-binary|nonbinary)$/i.test(gender)) {
        rejected.push({ field: fieldName, reason: 'Gender not explicitly reliable' });
        continue;
      }
    }

    const cited = fieldHasCitedUrl(proposal, allowed);
    if (!cited.length) {
      rejected.push({
        field: fieldName,
        reason: fieldName === 'notable_credits'
          ? 'Uncited notable credits'
          : 'URL not present in grounding citations',
      });
      continue;
    }

    let nextValue = value;
    if (fieldName === 'notable_credits') {
      nextValue = (Array.isArray(value) ? value : [value]).filter(Boolean);
      candidateFields[fieldName] = nextValue;
      evidence.push(...buildEvidenceRows(fieldName, JSON.stringify(nextValue), cited, proposal));
      continue;
    }

    if (typeof nextValue === 'string' && /_url$/.test(fieldName)) {
      nextValue = normalizeUrl(nextValue) || nextValue;
    }
    candidateFields[fieldName] = nextValue;
    evidence.push(...buildEvidenceRows(fieldName, String(nextValue), cited, proposal));
  }

  return {
    candidateFields,
    evidence,
    rejected,
    allowedCitationUrls: [...allowed],
  };
}

/**
 * @param {{
 *   name?: string,
 *   creditTitles?: string[],
 *   currentFields?: Record<string, any>,
 * }} [args]
 */
export function buildInputFingerprint({
  name,
  creditTitles = [],
  currentFields = {},
} = {}) {
  const payload = {
    name: fold(name || ''),
    credits: [...creditTitles].map(fold).filter(Boolean).sort(),
    fields: {
      bio: Boolean(currentFields.bio),
      photo_url: Boolean(currentFields.photo_url),
      date_of_birth: currentFields.date_of_birth || null,
      birthplace: fold(currentFields.birthplace || ''),
      nationality: fold(currentFields.nationality || ''),
      gender: fold(currentFields.gender || ''),
      known_for_department: fold(currentFields.known_for_department || ''),
      instagram_url: normalizeUrl(currentFields.instagram_url) || '',
      facebook_url: normalizeUrl(currentFields.facebook_url) || '',
      twitter_url: normalizeUrl(currentFields.twitter_url) || '',
      tiktok_url: normalizeUrl(currentFields.tiktok_url) || '',
      youtube_handle: fold(currentFields.youtube_handle || ''),
    },
  };
  const json = JSON.stringify(payload);
  // Browser-safe fingerprint (server also uses this helper).
  let hash = 0;
  for (let i = 0; i < json.length; i += 1) {
    hash = ((hash << 5) - hash) + json.charCodeAt(i);
    hash |= 0;
  }
  return `v1:${(hash >>> 0).toString(16)}:${json.length}`;
}

/** Important profile gaps that justify a Gemini pass after a weak TMDB result. */
export function hasImportantMissingFields(person = {}, missingFields = []) {
  const missing = new Set(missingFields?.length
    ? missingFields
    : [
      !person.bio && 'bio',
      !person.photo_url && 'photo_url',
      !person.instagram_url && !person.twitter_url && !person.facebook_url && 'socials',
    ].filter(Boolean));
  return ['bio', 'photo_url', 'instagram_url', 'twitter_url', 'facebook_url', 'socials']
    .some((field) => missing.has(field));
}

/**
 * @param {{
 *   tmdbProposal?: any,
 *   person?: Record<string, any>,
 *   missingFields?: string[],
 *   force?: boolean,
 * }} [args]
 */
export function shouldRunGeminiAfterTmdb({
  tmdbProposal,
  person,
  missingFields,
  force = false,
} = {}) {
  if (force) return true;
  if (!tmdbProposal) return true;
  if (tmdbProposal.status === 'no_match') return true;
  if (tmdbProposal.status === 'needs_review' && hasImportantMissingFields(person, missingFields)) {
    return true;
  }
  const proposed = tmdbProposal.candidateData || {};
  const stillMissingImportant = ['bio', 'photo_url'].some((field) => (
    !person?.[field] && !proposed[field]
  ));
  const stillMissingSocial = !person?.instagram_url && !person?.twitter_url && !person?.facebook_url
    && !proposed.instagram_url && !proposed.twitter_url && !proposed.facebook_url;
  return stillMissingImportant || stillMissingSocial;
}

export function buildFieldSourcesFromEvidence(evidence = [], provider = 'Gemini') {
  const grouped = {};
  for (const row of evidence) {
    if (!grouped[row.field_name]) grouped[row.field_name] = [];
    grouped[row.field_name].push({
      source: provider,
      provider,
      url: row.source_url,
      title: row.source_title || null,
      domain: row.source_domain || sourceDomain(row.source_url),
      tier: row.source_tier,
      excerpt: row.evidence_excerpt || null,
      identity_anchor: row.identity_anchor || null,
    });
  }
  return grouped;
}

export function estimateGeminiCost({
  promptTokens = 0,
  candidatesTokens = 0,
  searchQueries = 0,
} = {}) {
  // Approximate Flash pricing + search grounding usage for budgeting only.
  const inputCost = (Number(promptTokens) / 1_000_000) * 0.3;
  const outputCost = (Number(candidatesTokens) / 1_000_000) * 2.5;
  const searchCost = Number(searchQueries) * 0.035;
  return Number((inputCost + outputCost + searchCost).toFixed(6));
}

/**
 * Lightweight runtime validation when Zod is unavailable (browser/tests).
 * Server path validates with Zod as well.
 */
export function validateGeminiPeoplePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'Payload must be an object' };
  }
  if (!['matched', 'needs_review', 'no_match'].includes(payload.identity_status)) {
    return { ok: false, error: 'Invalid identity_status' };
  }
  if (typeof payload.identity_confidence !== 'number'
    || payload.identity_confidence < 0
    || payload.identity_confidence > 1) {
    return { ok: false, error: 'identity_confidence must be 0..1' };
  }
  if (!Array.isArray(payload.identity_reasons)) {
    return { ok: false, error: 'identity_reasons must be an array' };
  }
  if (payload.candidate_fields != null && typeof payload.candidate_fields !== 'object') {
    return { ok: false, error: 'candidate_fields must be an object' };
  }
  if (payload.conflicts != null && !Array.isArray(payload.conflicts)) {
    return { ok: false, error: 'conflicts must be an array' };
  }
  return { ok: true, value: payload };
}
