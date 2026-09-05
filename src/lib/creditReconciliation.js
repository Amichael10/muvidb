import { namesNearMatch, namesLookSame, personNameTokens } from './personNameMatch.js';

export function creditTextKey(value) {
  return String(value || '').normalize('NFKD').replace(/\p{M}/gu, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function creditNameKey(value) {
  return creditTextKey(value).split(' ').filter(Boolean).sort().join(' ');
}

export function creditType(value) {
  return value === 'cast' ? 'actor' : value;
}

export function candidateKey(row) {
  return [row.film_id || '', creditType(row.credit_type), creditNameKey(row.raw_name), creditTextKey(row.role_or_character)].join('|');
}

export function scoreCandidateMatch(candidate, reading) {
  if (creditType(candidate.credit_type) !== reading.credit_type) return 0;
  
  const cName = creditNameKey(candidate.raw_name);
  const rName = creditNameKey(reading.raw_name);
  if (cName && cName === rName) {
    const roleMatch = creditTextKey(candidate.role_or_character) === creditTextKey(reading.role_or_character);
    return roleMatch ? 1.0 : 0.92;
  }
  
  if (namesNearMatch(candidate.raw_name, reading.raw_name) || namesLookSame(candidate.raw_name, reading.raw_name)) {
    const roleMatch = creditTextKey(candidate.role_or_character) === creditTextKey(reading.role_or_character);
    return roleMatch ? 0.88 : 0.80;
  }
  
  const cTokens = personNameTokens(candidate.raw_name);
  const rTokens = personNameTokens(reading.raw_name);
  
  if (cTokens.length && rTokens.length) {
    const commonTokens = cTokens.filter(t => rTokens.includes(t));
    if (commonTokens.length > 0) {
      const overlapRatio = commonTokens.length / Math.max(cTokens.length, rTokens.length);
      const roleBonus = (candidate.role_or_character && reading.role_or_character && creditTextKey(candidate.role_or_character) === creditTextKey(reading.role_or_character)) ? 0.15 : 0;
      return 0.55 + (overlapRatio * 0.25) + roleBonus;
    }
  }

  if (candidate.role_or_character && reading.role_or_character && creditTextKey(candidate.role_or_character).length > 3) {
    if (creditTextKey(candidate.role_or_character) === creditTextKey(reading.role_or_character)) {
      return 0.52;
    }
  }

  return 0;
}

// Different roles, numbered characters, and conflicting profile links stay separate.
export function duplicateCreditGroups(rows) {
  const groups = [];
  for (const row of rows) {
    if (!creditNameKey(row.raw_name) || (row.status && row.status !== 'pending')) continue;
    const group = groups.find(items => items[0].film_id === row.film_id
      && creditType(items[0].credit_type) === creditType(row.credit_type)
      && creditTextKey(items[0].role_or_character) === creditTextKey(row.role_or_character)
      && (creditNameKey(items[0].raw_name) === creditNameKey(row.raw_name)
        || (row.matched_person_id && items.some(item => item.matched_person_id === row.matched_person_id)))
      && !items.some(item => item.matched_person_id && row.matched_person_id && item.matched_person_id !== row.matched_person_id));
    if (group) group.push(row);
    else groups.push([row]);
  }
  return groups.filter(group => group.length > 1).map(group => [...group].sort((a, b) =>
    Number(Boolean(b.matched_person_id)) - Number(Boolean(a.matched_person_id))
    || Number(b.ocr_confidence || b.confidence || 0) - Number(a.ocr_confidence || a.confidence || 0)));
}

export function dedupeCreditCandidates(rows) {
  const repeats = new Set(duplicateCreditGroups(rows).flatMap(group => group.slice(1)));
  return rows.filter(row => !repeats.has(row));
}

// Group the review display without discarding alternative readings or real roles.
export function groupCreditReadings(rows) {
  const groups = [];
  for (const row of rows) {
    const group = groups.find(items => items[0].film_id === row.film_id
      && creditType(items[0].credit_type) === creditType(row.credit_type)
      && creditNameKey(row.raw_name)
      && !items.some(item => item.matched_person_id && row.matched_person_id && item.matched_person_id !== row.matched_person_id)
      && (creditNameKey(items[0].raw_name) === creditNameKey(row.raw_name)
        || (row.matched_person_id && items.some(item => item.matched_person_id === row.matched_person_id))));
    if (group) group.push(row);
    else groups.push([row]);
  }
  return groups;
}

export function compareScreenshotCredits(existing, extracted, type, localReadings = []) {
  const readings = dedupeCreditCandidates(extracted.map(item => ({
    raw_name: String(item.name || '').trim(),
    role_or_character: String(item.role_or_character || '').trim(),
    credit_type: creditType(type),
  })).filter(item => creditNameKey(item.raw_name)));

  const assignedTargetIds = new Set();

  return readings.map(reading => {
    const scoredMatches = existing
      .filter(row => creditType(row.credit_type) === reading.credit_type)
      .map(row => ({ row, score: scoreCandidateMatch(row, reading) }))
      .filter(item => item.score >= 0.5)
      .sort((a, b) => b.score - a.score);

    const matches = scoredMatches.map(item => item.row);

    const exact = matches.filter(row => 
      creditNameKey(row.raw_name) === creditNameKey(reading.raw_name) &&
      creditTextKey(row.role_or_character) === creditTextKey(reading.role_or_character)
    );

    const isTie = scoredMatches.length > 1 && 
      Math.abs(scoredMatches[0].score - scoredMatches[1].score) < 0.001 && 
      exact.length === 0;

    // Find highest scoring available candidate not already claimed by a higher score
    const bestUnassigned = isTie ? null : scoredMatches.find(item => !assignedTargetIds.has(item.row.id));
    const target = isTie ? null : (bestUnassigned ? bestUnassigned.row : (matches[0] || null));

    if (target && target.id) {
      assignedTargetIds.add(target.id);
    }

    const local = localReadings.filter(item => 
      creditNameKey(item.name) === creditNameKey(reading.raw_name) ||
      namesNearMatch(item.name, reading.raw_name)
    );

    const isExact = exact.length > 0;
    const isCorrection = Boolean(target && !isExact);

    return {
      reading,
      matches,
      local,
      candidates: existing.filter(row => creditType(row.credit_type) === reading.credit_type),
      localAgreement: local.some(item => 
        creditNameKey(item.name) === creditNameKey(reading.raw_name) &&
        creditTextKey(item.role_or_character) === creditTextKey(reading.role_or_character)
      ),
      targetId: target?.id || (matches.length ? '' : '__new__'),
      targetCandidate: target || null,
      isCorrection,
      duplicateIds: target ? exact.filter(row => row.id !== target.id && row.status === 'pending'
        && (!target.matched_person_id || !row.matched_person_id || target.matched_person_id === row.matched_person_id)).map(row => row.id) : [],
      agreement: isExact 
        ? 'Matches queued credit' 
        : isCorrection 
          ? `Corrects candidate: ${target.raw_name}` 
          : 'New credit (not in current roster)',
    };
  });
}

