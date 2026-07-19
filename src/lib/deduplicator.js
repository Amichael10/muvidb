const PERSON_NOISE = new Set([
  'actor', 'actress', 'alhaji', 'alhaja', 'chief', 'comedian', 'director',
  'dr', 'engr', 'evangelist', 'hon', 'mr', 'mrs', 'ms', 'pastor', 'prince',
  'princess', 'producer', 'sir', 'official',
]);

const FILM_NOISE = new Set([
  'african', 'film', 'films', 'full', 'latest', 'movie', 'movies', 'new',
  'nigerian', 'nollywood', 'official', 'trailer',
]);

const SOCIAL_FIELDS = ['instagram_url', 'facebook_url', 'twitter_url'];

const unique = (values) => [...new Set(values.filter(Boolean))];

export const foldText = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[’‘`]/g, "'")
  .toLowerCase();

const words = (value) => foldText(value)
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .split(/\s+/)
  .filter(Boolean);

const compact = (tokens) => tokens.join('');
const sortedCompact = (tokens) => [...tokens].sort().join('');

const personTokens = (value) => words(value).filter((token) => !PERSON_NOISE.has(token));

const filmTokens = (value) => words(value).filter((token) => {
  if (FILM_NOISE.has(token)) return false;
  if (/^(19|20)\d{2}$/.test(token)) return false;
  return true;
});

const soundex = (value) => {
  const input = foldText(value).replace(/[^a-z]/g, '');
  if (!input) return '';
  const first = input[0].toUpperCase();
  const codes = {
    b: '1', f: '1', p: '1', v: '1',
    c: '2', g: '2', j: '2', k: '2', q: '2', s: '2', x: '2', z: '2',
    d: '3', t: '3', l: '4', m: '5', n: '5', r: '6',
  };
  let result = '';
  let previous = codes[input[0]] || '';
  for (let index = 1; index < input.length && result.length < 3; index += 1) {
    const code = codes[input[index]] || '';
    if (code && code !== previous) result += code;
    previous = code;
  }
  return `${first}${result.padEnd(3, '0')}`;
};

const jaroWinkler = (leftValue, rightValue) => {
  const left = String(leftValue || '');
  const right = String(rightValue || '');
  if (left === right) return left ? 1 : 0;
  if (!left || !right) return 0;

  const distance = Math.max(Math.floor(Math.max(left.length, right.length) / 2) - 1, 0);
  const leftMatches = new Array(left.length).fill(false);
  const rightMatches = new Array(right.length).fill(false);
  let matches = 0;

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const start = Math.max(0, leftIndex - distance);
    const end = Math.min(leftIndex + distance + 1, right.length);
    for (let rightIndex = start; rightIndex < end; rightIndex += 1) {
      if (rightMatches[rightIndex] || left[leftIndex] !== right[rightIndex]) continue;
      leftMatches[leftIndex] = true;
      rightMatches[rightIndex] = true;
      matches += 1;
      break;
    }
  }

  if (!matches) return 0;

  let transpositions = 0;
  let rightIndex = 0;
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    if (!leftMatches[leftIndex]) continue;
    while (!rightMatches[rightIndex]) rightIndex += 1;
    if (left[leftIndex] !== right[rightIndex]) transpositions += 1;
    rightIndex += 1;
  }

  const jaro = (
    matches / left.length
    + matches / right.length
    + (matches - transpositions / 2) / matches
  ) / 3;
  let prefix = 0;
  while (prefix < 4 && left[prefix] && left[prefix] === right[prefix]) prefix += 1;
  return jaro + prefix * 0.1 * (1 - jaro);
};

const tokenSimilarity = (leftTokens, rightTokens) => {
  if (!leftTokens.length || !rightTokens.length) return 0;
  const remaining = [...rightTokens];
  let total = 0;

  for (const token of leftTokens) {
    let bestIndex = -1;
    let bestScore = 0;
    for (let index = 0; index < remaining.length; index += 1) {
      const score = jaroWinkler(token, remaining[index]);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    if (bestIndex >= 0 && bestScore >= 0.72) {
      total += bestScore;
      remaining.splice(bestIndex, 1);
    }
  }

  return total / Math.max(leftTokens.length, rightTokens.length);
};

const socialHandle = (value) => {
  if (!value) return '';
  const folded = foldText(value).replace(/[?#].*$/, '').replace(/\/$/, '');
  const parts = folded.split('/').filter(Boolean);
  return (parts.at(-1) || folded).replace(/^@/, '').replace(/[^a-z0-9._-]/g, '');
};

const createPersonForms = (name) => {
  const raw = String(name || '').trim();
  const parenthetical = [...raw.matchAll(/\(([^)]+)\)/g)]
    .map((match) => match[1].trim())
    .filter((candidate) => {
      const tokens = personTokens(candidate);
      const letters = foldText(candidate).replace(/[^a-z]/g, '');
      if (!letters || /\d/.test(candidate)) return false;
      return letters.length >= 7 && tokens.length > 0;
    });
  const outside = raw.replace(/\([^)]+\)/g, ' ');
  const candidates = unique([raw, outside, ...parenthetical]);
  return candidates.map((candidate) => {
    const tokens = personTokens(candidate);
    return { tokens, compact: compact(tokens), sorted: sortedCompact(tokens) };
  }).filter((form) => form.compact.length >= 3);
};

const createFilmForms = (title) => {
  const rawTokens = words(title);
  const cleanedTokens = filmTokens(title);
  return unique([compact(rawTokens), compact(cleanedTokens)]).map((value) => ({
    compact: value,
    tokens: value === compact(rawTokens) ? rawTokens : cleanedTokens,
    sorted: value === compact(rawTokens) ? sortedCompact(rawTokens) : sortedCompact(cleanedTokens),
  })).filter((form) => form.compact.length >= 2);
};

const buildPersonKeys = (person) => {
  const keys = [];
  for (const form of person._forms) {
    const first = form.tokens[0] || '';
    const last = form.tokens.at(-1) || '';
    keys.push(`person:exact:${form.compact}`);
    if (form.tokens.length > 1) keys.push(`person:sorted:${form.sorted}`);
    keys.push(`person:edge:${first.slice(0, 3)}:${last.slice(0, 3)}`);
    keys.push(`person:phonetic:${soundex(first)}:${soundex(last)}`);
    if (form.tokens.length === 1) {
      keys.push(`person:single:${soundex(first)}:${Math.round(first.length / 2)}`);
    }
  }
  if (person.tmdb_id) keys.push(`person:tmdb:${person.tmdb_id}`);
  if (person.mubi_id) keys.push(`person:mubi:${person.mubi_id}`);
  if (person.youtube_channel_id) keys.push(`person:youtube:${person.youtube_channel_id}`);
  if (person.youtube_handle) keys.push(`person:yhandle:${socialHandle(person.youtube_handle)}`);
  for (const field of SOCIAL_FIELDS) {
    const handle = socialHandle(person[field]);
    if (handle) keys.push(`person:social:${field}:${handle}`);
  }
  return unique(keys);
};

const buildFilmKeys = (film) => {
  const keys = [];
  for (const form of film._forms) {
    const first = form.tokens[0] || '';
    const last = form.tokens.at(-1) || '';
    keys.push(`film:exact:${form.compact}`);
    keys.push(`film:year:${film.year || 'unknown'}:${form.compact}`);
    keys.push(`film:edge:${film.year || 'unknown'}:${first.slice(0, 4)}:${last.slice(0, 4)}`);
  }
  if (film.tmdb_id) keys.push(`film:tmdb:${film.tmdb_id}`);
  if (film.mubi_id) keys.push(`film:mubi:${film.mubi_id}`);
  if (film.source_video_id) keys.push(`film:video:${film.source_video_id}`);
  if (film.trailer_youtube_id) keys.push(`film:trailer:${film.trailer_youtube_id}`);
  return unique(keys);
};

const pairCandidates = (records, keyBuilder) => {
  const index = new Map();
  records.forEach((record, recordIndex) => {
    for (const key of keyBuilder(record)) {
      const bucket = index.get(key) || [];
      bucket.push(recordIndex);
      index.set(key, bucket);
    }
  });

  const pairs = new Set();
  for (const [key, bucket] of index.entries()) {
    const strongKey = /:(exact|sorted|tmdb|mubi|youtube|yhandle|social|video|trailer):/.test(key);
    if (bucket.length > (strongKey ? 180 : 55)) continue;
    for (let left = 0; left < bucket.length; left += 1) {
      for (let right = left + 1; right < bucket.length; right += 1) {
        const first = bucket[left];
        const second = bucket[right];
        pairs.add(first < second ? `${first}:${second}` : `${second}:${first}`);
      }
    }
  }
  return [...pairs].map((pair) => pair.split(':').map(Number));
};

const bestFormScore = (leftForms, rightForms) => {
  let result = { score: 0, exact: false, reordered: false, alias: false };
  for (let leftIndex = 0; leftIndex < leftForms.length; leftIndex += 1) {
    for (let rightIndex = 0; rightIndex < rightForms.length; rightIndex += 1) {
      const left = leftForms[leftIndex];
      const right = rightForms[rightIndex];
      const exact = left.compact === right.compact;
      const reordered = left.sorted && left.sorted === right.sorted;
      const score = Math.max(
        jaroWinkler(left.compact, right.compact),
        jaroWinkler(left.sorted, right.sorted),
        tokenSimilarity(left.tokens, right.tokens),
      );
      if (exact || reordered || score > result.score) {
        result = {
          score: exact ? 1 : reordered ? Math.max(score, 0.985) : score,
          exact,
          reordered,
          alias: leftIndex > 0 || rightIndex > 0,
        };
      }
    }
  }
  return result;
};

const bothDifferent = (left, right, field) => Boolean(left[field] && right[field] && String(left[field]) !== String(right[field]));
const bothSame = (left, right, field) => Boolean(left[field] && right[field] && String(left[field]) === String(right[field]));

const scorePeoplePair = (left, right) => {
  const form = bestFormScore(left._forms, right._forms);
  const reasons = [];
  const conflicts = [];
  let score = form.score;

  if (bothSame(left, right, 'tmdb_id')) { score = 1; reasons.push('Same TMDB person ID'); }
  if (bothSame(left, right, 'mubi_id')) { score = Math.max(score, 0.995); reasons.push('Same MUBI person ID'); }
  if (bothSame(left, right, 'youtube_channel_id')) { score = Math.max(score, 0.995); reasons.push('Same YouTube channel'); }

  for (const field of SOCIAL_FIELDS) {
    const leftHandle = socialHandle(left[field]);
    const rightHandle = socialHandle(right[field]);
    if (leftHandle && rightHandle && leftHandle === rightHandle) {
      score = Math.max(score, 0.99);
      reasons.push(`Same ${field.replace('_url', '')} handle`);
    }
  }

  if (form.exact) reasons.push(form.alias ? 'Name matches an alias' : 'Same normalized name');
  else if (form.reordered) reasons.push('Same name tokens in a different order');
  else if (form.score >= 0.9) reasons.push('Very similar spelling');
  else if (form.score >= 0.84) reasons.push('Possible spelling variation');

  if (bothSame(left, right, 'date_of_birth')) reasons.push('Same date of birth');
  if (bothDifferent(left, right, 'tmdb_id')) conflicts.push('Different TMDB IDs');
  if (bothDifferent(left, right, 'mubi_id')) conflicts.push('Different MUBI IDs');
  if (bothDifferent(left, right, 'youtube_channel_id')) conflicts.push('Different YouTube channels');
  if (bothDifferent(left, right, 'date_of_birth')) conflicts.push('Different dates of birth');
  if (left.claimed_by && right.claimed_by && left.claimed_by !== right.claimed_by) conflicts.push('Claimed by different users');

  const supported = reasons.some((reason) => reason.startsWith('Same ') && !reason.includes('normalized'));
  const singleTokenComparison = left._forms.every((item) => item.tokens.length === 1)
    && right._forms.every((item) => item.tokens.length === 1);
  const fuzzyThreshold = singleTokenComparison ? 0.965 : 0.9;
  const candidate = score >= fuzzyThreshold || form.exact || form.reordered || supported;
  if (!candidate) return null;
  if (conflicts.length) score = Math.min(score, 0.79);

  return { score, reasons: unique(reasons), conflicts };
};

const filmKind = (film) => film.content_type || (film.season_number || film.episode_number ? 'series' : 'film');

const scoreFilmPair = (left, right) => {
  const form = bestFormScore(left._forms, right._forms);
  const reasons = [];
  const conflicts = [];
  const leftYear = Number(left.year) || null;
  const rightYear = Number(right.year) || null;
  const sameYear = leftYear && rightYear && leftYear === rightYear;
  const yearGap = leftYear && rightYear ? Math.abs(leftYear - rightYear) : null;
  let score = form.score;

  if (bothSame(left, right, 'tmdb_id')) { score = 1; reasons.push('Same TMDB film ID'); }
  if (bothSame(left, right, 'mubi_id')) { score = Math.max(score, 0.995); reasons.push('Same MUBI film ID'); }
  if (bothSame(left, right, 'source_video_id')) { score = Math.max(score, 0.995); reasons.push('Same source video'); }
  if (bothSame(left, right, 'trailer_youtube_id')) { score = Math.max(score, 0.97); reasons.push('Same trailer video'); }

  if (form.exact) reasons.push('Same normalized title');
  else if (form.reordered) reasons.push('Same title tokens in a different order');
  else if (form.score >= 0.9) reasons.push('Very similar title');

  if (sameYear) {
    score = Math.max(score, form.exact ? 0.97 : form.reordered ? 0.95 : score);
    reasons.push('Same production year');
  } else if (yearGap !== null && yearGap > 1) {
    conflicts.push(`Production years differ by ${yearGap}`);
  }

  if (bothDifferent(left, right, 'tmdb_id')) conflicts.push('Different TMDB IDs');
  if (filmKind(left) !== filmKind(right)) conflicts.push('Different content types');
  if (left.series_id && right.series_id && left.series_id !== right.series_id) conflicts.push('Different parent series');

  const strongIdentifier = reasons.some((reason) => /ID|source video|trailer video/.test(reason));
  const candidate = strongIdentifier || (form.exact && (sameYear || !leftYear || !rightYear)) || (form.score >= 0.9 && sameYear);
  if (!candidate && !(form.exact && yearGap !== null)) return null;
  if (!sameYear && !strongIdentifier) score = Math.min(score, 0.84);
  if (conflicts.length) score = Math.min(score, 0.79);

  return { score, reasons: unique(reasons), conflicts };
};

const personCompleteness = (person) => [
  person.photo_url, person.bio, person.date_of_birth, person.nationality,
  person.instagram_url || person.facebook_url || person.twitter_url,
  person.tmdb_id || person.mubi_id, person.youtube_channel_id || person.youtube_handle,
].filter(Boolean).length;

const filmCompleteness = (film) => [
  film.poster_url, film.synopsis, film.year, film.runtime_minutes,
  film.tmdb_id || film.mubi_id, film.source_video_id, film.release_type,
].filter(Boolean).length;

const connectedGroups = (records, scoredPairs, entity) => {
  const parent = records.map((_, index) => index);
  const find = (index) => {
    let current = index;
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]];
      current = parent[current];
    }
    return current;
  };
  const union = (left, right) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
  };

  const isStrongPair = (pair) => {
    const strongReason = pair.reasons.some((reason) => /Same normalized|different order|TMDB|MUBI|YouTube|handle|source video/.test(reason));
    return strongReason || pair.score >= 0.94;
  };

  const strongPairs = scoredPairs.filter(isStrongPair);
  strongPairs.forEach((pair) => union(pair.left, pair.right));
  const components = new Map();
  strongPairs.forEach((pair) => {
    const root = find(pair.left);
    const component = components.get(root) || { indexes: new Set(), pairs: [] };
    component.indexes.add(pair.left);
    component.indexes.add(pair.right);
    component.pairs.push(pair);
    components.set(root, component);
  });

  const pairComponents = scoredPairs
    .filter((pair) => !isStrongPair(pair) && find(pair.left) !== find(pair.right))
    .map((pair) => ({ indexes: new Set([pair.left, pair.right]), pairs: [pair] }));

  const allComponents = [...components.values(), ...pairComponents];

  const groups = allComponents.map((component) => {
    const groupRecords = [...component.indexes].map((index) => {
      const { _forms, ...record } = records[index];
      return {
        ...record,
        completeness: entity === 'people' ? personCompleteness(record) : filmCompleteness(record),
      };
    });
    const conflicts = unique(component.pairs.flatMap((pair) => pair.conflicts));
    const reasons = unique(component.pairs.flatMap((pair) => pair.reasons));
    const maxScore = Math.max(...component.pairs.map((pair) => pair.score));
    const minScore = Math.min(...component.pairs.map((pair) => pair.score));
    const confidence = conflicts.length
      ? 'blocked'
      : minScore >= 0.95
        ? 'high'
        : maxScore >= 0.9
          ? 'medium'
          : 'review';
    const recommended = [...groupRecords].sort((left, right) => {
      const verifiedDelta = Number(right.is_verified || right.is_published) - Number(left.is_verified || left.is_published);
      if (verifiedDelta) return verifiedDelta;
      const claimedDelta = Number(Boolean(right.claimed_by)) - Number(Boolean(left.claimed_by));
      if (claimedDelta) return claimedDelta;
      const completenessDelta = right.completeness - left.completeness;
      if (completenessDelta) return completenessDelta;
      const usageLeft = Number(left.film_count || left.view_count || 0);
      const usageRight = Number(right.film_count || right.view_count || 0);
      return usageRight - usageLeft;
    })[0];

    return {
      id: `${entity}-${groupRecords.map((record) => record.id).sort().join('-')}`,
      entity,
      confidence,
      score: Number(maxScore.toFixed(4)),
      reasons,
      conflicts,
      recommendedPrimaryId: recommended?.id || groupRecords[0]?.id,
      records: groupRecords,
    };
  });

  const uniqueGroups = [];
  const signatures = new Set();
  for (const group of groups) {
    const signature = group.records.map((record) => record.id).sort().join(':');
    if (signatures.has(signature)) continue;
    signatures.add(signature);
    uniqueGroups.push(group);
  }

  return uniqueGroups.sort((left, right) => {
    const confidenceOrder = { high: 0, medium: 1, review: 2, blocked: 3 };
    return confidenceOrder[left.confidence] - confidenceOrder[right.confidence]
      || right.score - left.score
      || right.records.length - left.records.length;
  });
};

const scan = (input, entity) => {
  const records = (Array.isArray(input) ? input : [])
    .filter((record) => record?.id && (entity === 'people' ? record.name : record.title))
    .map((record) => ({
      ...record,
      _forms: entity === 'people' ? createPersonForms(record.name) : createFilmForms(record.title),
    }))
    .filter((record) => record._forms.length > 0);

  const candidates = pairCandidates(records, entity === 'people' ? buildPersonKeys : buildFilmKeys);
  const scoredPairs = [];
  for (const [left, right] of candidates) {
    const result = entity === 'people'
      ? scorePeoplePair(records[left], records[right])
      : scoreFilmPair(records[left], records[right]);
    if (result) scoredPairs.push({ left, right, ...result });
  }

  const groups = connectedGroups(records, scoredPairs, entity);
  return {
    entity,
    scannedAt: new Date().toISOString(),
    recordsScanned: records.length,
    candidatePairs: scoredPairs.length,
    groups,
    summary: {
      groups: groups.length,
      recordsInGroups: unique(groups.flatMap((group) => group.records.map((record) => record.id))).length,
      high: groups.filter((group) => group.confidence === 'high').length,
      medium: groups.filter((group) => group.confidence === 'medium').length,
      review: groups.filter((group) => group.confidence === 'review').length,
      blocked: groups.filter((group) => group.confidence === 'blocked').length,
    },
  };
};

export const scanPeopleDuplicates = (people) => scan(people, 'people');
export const scanFilmDuplicates = (films) => scan(films, 'films');
export const scanDuplicateRecords = (records, entity) => entity === 'films'
  ? scanFilmDuplicates(records)
  : scanPeopleDuplicates(records);
