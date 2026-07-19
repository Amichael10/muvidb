export const ENRICHMENT_FIELDS = [
  { key: 'bio', label: 'Biography', weight: 20, kind: 'longtext' },
  { key: 'photo_url', label: 'Profile photo', weight: 20, kind: 'image' },
  { key: 'date_of_birth', label: 'Date of birth', weight: 12 },
  { key: 'birthplace', label: 'Birthplace', weight: 8 },
  { key: 'known_for_department', label: 'Known for', weight: 8 },
  { key: 'instagram_url', label: 'Instagram', weight: 10, kind: 'link' },
  { key: 'facebook_url', label: 'Facebook', weight: 4, kind: 'link' },
  { key: 'twitter_url', label: 'X / Twitter', weight: 4, kind: 'link' },
  { key: 'tiktok_url', label: 'TikTok', weight: 2, kind: 'link' },
  { key: 'tmdb_id', label: 'TMDB identity', weight: 12 },
];

const fold = (value = '') => String(value)
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\b(actor|actress|producer|director|filmmaker|mr|mrs|miss|dr|chief|hon)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const normalizedTitle = (value = '') => fold(value)
  .replace(/\b(the movie|full movie|nollywood|nigerian movie|season \d+|episode \d+|ep \d+)\b/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const levenshtein = (left, right) => {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array(right.length + 1);
  for (let row = 1; row <= left.length; row += 1) {
    current[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    for (let column = 0; column <= right.length; column += 1) previous[column] = current[column];
  }
  return previous[right.length];
};

const textSimilarity = (left, right) => {
  const normalizedLeft = fold(left);
  const normalizedRight = fold(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;
  return Math.max(0, 1 - levenshtein(normalizedLeft, normalizedRight) / Math.max(normalizedLeft.length, normalizedRight.length));
};

const compact = (object) => Object.fromEntries(
  Object.entries(object).filter(([, value]) => value !== null && value !== undefined && value !== ''),
);

const tmdbCreditTitles = (details) => [
  ...(details?.combined_credits?.cast || []),
  ...(details?.combined_credits?.crew || []),
].map((credit) => credit.title || credit.name).filter(Boolean);

export const getPeopleCompleteness = (person) => ENRICHMENT_FIELDS.reduce(
  (score, field) => score + (person?.[field.key] ? field.weight : 0),
  0,
);

export const getMissingPeopleFields = (person) => ENRICHMENT_FIELDS
  .filter((field) => !person?.[field.key])
  .map((field) => field.key);

export const scoreTmdbPersonMatch = ({ person, creditTitles = [], details, exactTmdbId = false }) => {
  const aliases = [details?.name, ...(details?.also_known_as || [])].filter(Boolean);
  const nameScore = Math.max(0, ...aliases.map((alias) => textSimilarity(person?.name, alias)));
  const dbTitles = new Map(creditTitles.filter(Boolean).map((title) => [normalizedTitle(title), title]));
  const matchedCredits = [...new Set(tmdbCreditTitles(details)
    .map(normalizedTitle)
    .filter((title) => title && dbTitles.has(title)))]
    .map((title) => dbTitles.get(title));

  if (exactTmdbId) {
    return {
      confidence: 1,
      status: 'ready',
      reasons: ['Existing TMDB identity'],
      matchedCredits,
      nameScore,
    };
  }

  let confidence = nameScore * 0.65;
  const reasons = [];
  if (nameScore === 1) reasons.push('Exact normalized name');
  else if (nameScore >= 0.84) reasons.push('Very similar name');

  if (matchedCredits.length) {
    confidence += Math.min(0.3, matchedCredits.length * 0.15);
    reasons.push(`${matchedCredits.length} matching ${matchedCredits.length === 1 ? 'credit' : 'credits'}`);
  }

  const department = fold(person?.known_for_department);
  const tmdbDepartment = fold(details?.known_for_department);
  if (department && tmdbDepartment && department === tmdbDepartment) {
    confidence += 0.05;
    reasons.push('Matching department');
  }

  if (person?.date_of_birth && details?.birthday) {
    if (person.date_of_birth === details.birthday) {
      confidence += 0.18;
      reasons.push('Matching date of birth');
    } else {
      confidence -= 0.35;
      reasons.push('Conflicting date of birth');
    }
  }

  if (details?.profile_path) confidence += 0.02;
  confidence = Math.max(0, Math.min(0.99, confidence));

  return {
    confidence,
    status: confidence >= 0.78 ? 'ready' : confidence >= 0.58 ? 'needs_review' : 'no_match',
    reasons: reasons.length ? reasons : ['Insufficient identity evidence'],
    matchedCredits,
    nameScore,
  };
};

const socialUrl = (network, handle) => {
  if (!handle) return null;
  const clean = String(handle).trim().replace(/^@/, '');
  if (!clean) return null;
  if (network === 'instagram') return `https://www.instagram.com/${clean}/`;
  if (network === 'facebook') return `https://www.facebook.com/${clean}`;
  if (network === 'twitter') return `https://x.com/${clean}`;
  return null;
};

export const buildTmdbEnrichmentProposal = ({ person, creditTitles = [], details, exactTmdbId = false }) => {
  const match = scoreTmdbPersonMatch({ person, creditTitles, details, exactTmdbId });
  if (match.status === 'no_match') {
    return {
      status: 'no_match',
      candidateData: {},
      fieldSources: {},
      ...match,
    };
  }

  const external = details?.external_ids || {};
  const candidateData = compact({
    bio: details?.biography?.trim()?.length >= 40 ? details.biography.trim() : null,
    photo_url: details?.profile_path ? `https://image.tmdb.org/t/p/original${details.profile_path}` : null,
    date_of_birth: /^\d{4}-\d{2}-\d{2}$/.test(details?.birthday || '') ? details.birthday : null,
    birthplace: details?.place_of_birth?.trim() || null,
    gender: ({ 1: 'Female', 2: 'Male', 3: 'Non-binary' })[details?.gender] || null,
    known_for_department: details?.known_for_department || null,
    instagram_url: socialUrl('instagram', external.instagram_id),
    facebook_url: socialUrl('facebook', external.facebook_id),
    twitter_url: socialUrl('twitter', external.twitter_id),
    tmdb_id: details?.id || null,
  });
  const sourceUrl = `https://www.themoviedb.org/person/${details.id}`;
  const fieldSources = Object.fromEntries(Object.keys(candidateData).map((field) => [field, {
    source: 'TMDB',
    url: sourceUrl,
    confidence: Number(match.confidence.toFixed(3)),
  }]));

  return {
    status: match.status,
    candidateData,
    fieldSources,
    sourceName: 'TMDB',
    sourceRecordId: String(details.id),
    sourceUrl,
    ...match,
  };
};

export const chooseBestTmdbPerson = ({ person, creditTitles = [], candidates = [] }) => candidates
  .map((details) => ({
    details,
    match: scoreTmdbPersonMatch({ person, creditTitles, details }),
  }))
  .sort((left, right) => right.match.confidence - left.match.confidence)[0] || null;
