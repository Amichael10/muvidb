import { supabase as serviceSupabase } from './db';
import { resolveKnownAlias } from './nollywood_aliases';
export { serviceSupabase };

export type RawCandidate = {
  name: string;
  role?: string | null;
  creditType: 'actor' | 'crew';
  confidence: number;
  frameIndex?: number;
  frameSec?: number;
  videoSec?: number;
  frameSupport?: number;
  evidenceText?: string;
  sourceWorker: 'worker1' | 'worker2' | 'metadata';
};

export type VerifiedCredit = {
  personId: string;
  personName: string;
  role: 'actor' | 'producer' | 'director' | 'writer' | 'cinematographer' | 'editor' | 'sound' | 'costume' | 'makeup' | 'crew';
  characterName: string | null;
  billingOrder: number;
  consensusScore: number;
  verifiedSources: string[];
};

// Common Nollywood honorifics / titles to strip
const HONORIFICS = /^(?:Chief|Alhaja|Alhaji|Dr\.?|Doctor|Prof\.?|Professor|Pastor|Evang\.?|Evangelist|Otunba|Prince|Princess|King|Queen|Sir|Lady|Engr\.?|Amb\.?|Hon\.?)\s+/i;

// Roles / characters commonly OCR-glued as prefixes
const ROLE_PREFIXES = /^(?:Receptionist|Decedtionist|Stillphotographer|Still\s+Photographer|Bestboy|Best\s+Boy|Second\s+Unit(?:\s+Cameraman)?|Delivery\s+Man|Warder|Officer|Police(?:\s+Officer)?|Big\s+Lion|Armed\s+Robber|Dit|Subtitle|Costumier|Costume\s+Assts?|Costumer|Makeup(?:\s+Asst)?|Special\s+Effects|Cam\s+Tech|Props?\s+Sets?|Welfare|Security|Sound(?:\s+Recordist)?|Head\s+Of\s+Lights|Focus\s+Puller|Script(?:\s*supervisor)?)\s*[-:–]?\s+/i;

// Roles / characters commonly OCR-glued as suffixes
const ROLE_SUFFIXES = /\s+[-:–]?\s*(?:Scriptwriter|Script\s+Supervisor|Delivery\s+Man|Police\s+Officer|Stoneboy|Receptionist|Makeup|Set\s+Designer|Video\s+Bts|Spark|Costumier|Prop|Location|Continuity|Sound|Lights|Focus\s+Puller|Cam\s+Asst)$/i;

// Post-nominal titles like (MON), (OON), (MFR), (JP)
const POST_NOMINALS = /\s*\((?:MON|OON|MFR|CFR|GCFR|CON|JP|SAN|OFR|FNA)\)/gi;

// Noise filtering for non-person strings
export const NOISE_WORDS = [
  'COMING SOON', 'NEXT WEEK', 'NOW SHOWING', 'SUBSCRIBE', 'LIKE AND SHARE',
  'COPYRIGHT', 'PRODUCTIONS', 'ENTERTAINMENT', 'PICTURES', 'STUDIOS', 'LIMITED',
  'SPECIAL THANKS', 'LOCATION', 'LOGISTICS', 'CAMERA ASSISTANT', 'LIGHTS',
  'CATERING', 'SECURITY', 'TRANSPORT', 'GENERATOR', 'WELFARE', 'MEDIA', 'GRAPHICS',
  'CLICK HERE', 'ALL RIGHTS RESERVED', 'THE END', 'CAST', 'CREW', 'FULL MOVIE',
  'SOUND MAN', 'PROP SER', 'ASS RF GAFFER', 'CAMERA ASST', 'FOCUS PULLER', 'SET PROPS',
  'WE WOULD FOR YOU TO STAY CONNECTED', 'TILL DEATH', 'VOICE OVER ARTISTS',
  'BTS STILL PHOTOS', 'DATA WRANGLER', 'EXECUTIVE PRODUCERS', 'PRODUCER EXECUTIVE PRODUCER',
  'GRANDISH GLOBAL COMPANY', 'SEASON 3', 'NOLLYWOODMOVIES', 'NIGERIANMOVIES',
  'HOST OF OTHERS', 'AND MANY MORE', 'AND UNEXPECTED', 'AND INTENSE', 'AND STRONG',
  'HIDDEN BATTLES'
];

export function normalizePersonName(raw: string): string {
  if (!raw) return '';
  let name = raw
    .replace(POST_NOMINALS, '')
    .replace(/\s*\([^)]*\)/g, ''); // strip any brackets

  // Strip multiple leading honorifics (e.g. "Chief Dr. Pete Edochie")
  while (HONORIFICS.test(name)) {
    name = name.replace(HONORIFICS, '').trim();
  }

  // Strip glued role prefixes and suffixes
  while (ROLE_PREFIXES.test(name)) {
    name = name.replace(ROLE_PREFIXES, '').trim();
  }
  while (ROLE_SUFFIXES.test(name)) {
    name = name.replace(ROLE_SUFFIXES, '').trim();
  }

  name = name
    .replace(/[^\p{L}\p{N}\s.'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip trailing/leading punctuation
  name = name.replace(/^[.\s'-]+|[.\s'-]+$/g, '').trim();

  // Title case each word
  return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

export function canonicalNameKey(name: string): string {
  const norm = normalizePersonName(name).toLowerCase();
  return norm.replace(/[^a-z0-9]/g, '');
}

/** Levenshtein edit distance between two strings */
export function levenshtein(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix = Array.from({ length: bn + 1 }, () => new Array(an + 1).fill(0));
  for (let i = 0; i <= an; i++) matrix[0][i] = i;
  for (let j = 0; j <= bn; j++) matrix[j][0] = j;

  for (let j = 1; j <= bn; j++) {
    for (let i = 1; i <= an; i++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[j][i] = matrix[j - 1][i - 1];
      } else {
        matrix[j][i] = Math.min(
          matrix[j - 1][i - 1] + 1, // substitution
          matrix[j][i - 1] + 1,     // insertion
          matrix[j - 1][i] + 1      // deletion
        );
      }
    }
  }
  return matrix[bn][an];
}

/** Name similarity ratio between 0.0 and 1.0 (with token subset overlap check) */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizePersonName(a).toLowerCase();
  const nb = normalizePersonName(b).toLowerCase();
  if (na === nb) return 1.0;

  const ka = canonicalNameKey(a);
  const kb = canonicalNameKey(b);
  if (ka === kb) return 1.0;

  // Check word token overlap (e.g. "Femi Adebayo" vs "Femi Adebayo Salami")
  const wordsA = na.split(/\s+/).filter(w => w.length > 2);
  const wordsB = nb.split(/\s+/).filter(w => w.length > 2);
  if (wordsA.length >= 2 && wordsB.length >= 2) {
    const isASubsetOfB = wordsA.every(w => wordsB.includes(w));
    const isBSubsetOfA = wordsB.every(w => wordsA.includes(w));
    if (isASubsetOfB || isBSubsetOfA) {
      return 0.92; // High confidence alias/short-name match
    }
  }

  const maxLen = Math.max(ka.length, kb.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshtein(ka, kb);
  return 1 - dist / maxLen;
}

export function normalizeRole(rawRole: string | null | undefined, creditType: 'actor' | 'crew'): VerifiedCredit['role'] {
  if (creditType === 'actor') return 'actor';
  if (!rawRole) return 'crew';

  const r = rawRole.toLowerCase();
  if (/director|directed\s+by/i.test(r) && !/photography|art\s+director|costume/i.test(r)) return 'director';
  if (/producer|produced\s+by|executive\s+producer/i.test(r)) return 'producer';
  if (/writer|screenplay|script|story/i.test(r)) return 'writer';
  if (/cinematograph|d\.?o\.?p\.?|director\s+of\s+photography|camera/i.test(r)) return 'cinematographer';
  if (/editor|editing|edited\s+by/i.test(r)) return 'editor';
  if (/sound|audio|boom/i.test(r)) return 'sound';
  if (/costume|wardrobe/i.test(r)) return 'costume';
  if (/makeup|make-up/i.test(r)) return 'makeup';

  return 'crew';
}

import { validateCreditsWithAi } from './ai_credit_validator';

/**
 * Fuzzy search for an existing person in Lumi's people database.
 * 1. Exact case-insensitive match
 * 2. Multi-token overlap (First + Last)
 * 3. Surname search with Levenshtein similarity >= 85%
 */
/**
 * Fuzzy search for an existing person in Lumi's people database.
 * 1. Alias dictionary resolution
 * 2. Exact case-insensitive match (prioritizing stars by film_count)
 * 3. Multi-token overlap (First + Last)
 * 4. Surname search prioritized by film_count with Levenshtein similarity >= 85%
 */
export async function findPersonWithFuzzyMatch(name: string): Promise<{ id: string; name: string } | null> {
  if (!name || name.trim().length < 2) return null;

  // 1. Check known aliases first (e.g. Erekere -> Michael Olalekan Adeyemi, MC Lively -> Michael Sani Amanesi)
  const aliasResolved = resolveKnownAlias(name);
  const targetName = normalizePersonName(aliasResolved || name);
  if (!targetName || targetName.length < 2) return null;

  // 2. Direct ILIKE ordered by film_count (so if duplicate records exist, star is picked)
  const { data: directFind } = await serviceSupabase
    .from('people')
    .select('id, name, film_count')
    .ilike('name', targetName)
    .order('film_count', { ascending: false, nullsFirst: false })
    .limit(1);

  const directHit = directFind && directFind.length > 0 ? directFind[0] : null;
  // If exact match has > 2 films, return immediately
  if (directHit && (directHit.film_count || 0) > 2) {
    return directHit;
  }

  // 3. Token search & Surname fallback search (ordered by film_count)
  const parts = targetName.split(/\s+/).filter(w => w.length > 2);
  if (parts.length >= 2) {
    const surname = parts[parts.length - 1];
    const { data: surnameHits } = await serviceSupabase
      .from('people')
      .select('id, name, film_count')
      .ilike('name', `%${surname}%`)
      .order('film_count', { ascending: false, nullsFirst: false })
      .limit(30);

    if (surnameHits && surnameHits.length > 0) {
      for (const hit of surnameHits) {
        const sim = nameSimilarity(hit.name, targetName);
        if (sim >= 0.85) {
          return hit;
        }
      }
    }

    const firstName = parts[0];
    if (firstName.length >= 4) {
      const { data: firstHits } = await serviceSupabase
        .from('people')
        .select('id, name, film_count')
        .ilike('name', `%${firstName}%`)
        .order('film_count', { ascending: false, nullsFirst: false })
        .limit(20);

      if (firstHits && firstHits.length > 0) {
        for (const hit of firstHits) {
          const sim = nameSimilarity(hit.name, targetName);
          if (sim >= 0.85) {
            return hit;
          }
        }
      }
    }
  }

  // Fallback to direct hit if found (even with <= 2 films)
  if (directHit) return directHit;

  return null;
}

/**
 * Worker 3: The Consensus & Reconciliation Engine
 */
export async function reconcileAndVerifyCredits(
  filmId: string,
  worker1Candidates: RawCandidate[],
  worker2Candidates: RawCandidate[],
  metadataCandidates: RawCandidate[] = [],
  filmTitle: string = 'Film'
): Promise<VerifiedCredit[]> {
  const allRaw = [...worker1Candidates, ...worker2Candidates, ...metadataCandidates];

  if (!allRaw.length) return [];

  // Group raw observations by canonical name clusters
  type NameCluster = {
    canonicalName: string;
    variants: string[];
    observations: RawCandidate[];
    maxConfidence: number;
    frameSupport: number;
    roles: Set<string>;
    creditType: 'actor' | 'crew';
    characterNames: Set<string>;
    sources: Set<string>;
  };

  const clusters: NameCluster[] = [];

  for (const obs of allRaw) {
    const aliasMatch = resolveKnownAlias(obs.name);
    const resolvedRaw = aliasMatch || obs.name;
    const cleanName = normalizePersonName(resolvedRaw);
    if (!cleanName || cleanName.length < 3 || cleanName.split(' ').length < 2) continue;

    // Ignore character roles turned into people
    if (/^(?:brother|sister|uncle|aunty|mama|baba|papa|omo|elegbon|olori|pastor|officer|police)\s+/i.test(cleanName)) {
      continue;
    }
    // Ignore corporate / business entities
    if (/\b(?:agency|ventures|enterprises|properties|limited|ltd|holdings|services|company|studio|studios|productions?|props|costumes)\b/i.test(cleanName)) {
      continue;
    }

    const isNoise = NOISE_WORDS.some(nw => cleanName.toUpperCase().includes(nw));
    if (isNoise) continue;

    let matchedCluster = clusters.find(c => nameSimilarity(c.canonicalName, cleanName) >= 0.88);

    if (!matchedCluster) {
      matchedCluster = {
        canonicalName: cleanName,
        variants: [cleanName],
        observations: [],
        maxConfidence: 0,
        frameSupport: 0,
        roles: new Set(),
        creditType: obs.creditType,
        characterNames: new Set(),
        sources: new Set(),
      };
      clusters.push(matchedCluster);
    } else {
      if (!matchedCluster.variants.includes(cleanName)) {
        matchedCluster.variants.push(cleanName);
      }
      // Prefer clean 2-to-3 word names over longer contaminated strings with glued roles/characters
      const incomingWordCount = cleanName.split(' ').length;
      const canonicalWordCount = matchedCluster.canonicalName.split(' ').length;
      if (canonicalWordCount > 3 && incomingWordCount >= 2 && incomingWordCount <= 3) {
        matchedCluster.canonicalName = cleanName;
      } else if (canonicalWordCount < 2 && incomingWordCount >= 2) {
        matchedCluster.canonicalName = cleanName;
      }
    }

    matchedCluster.observations.push(obs);
    matchedCluster.maxConfidence = Math.max(matchedCluster.maxConfidence, obs.confidence);
    matchedCluster.frameSupport += (obs.frameSupport || 1);
    matchedCluster.sources.add(obs.sourceWorker);

    if (obs.role) {
      matchedCluster.roles.add(obs.role);
    }
  }

  if (!clusters.length) return [];

  const verifiedCredits: VerifiedCredit[] = [];
  const processedActorIds = new Set<string>(); // GUARANTEE 0 DUPLICATE ACTORS IN BATCH
  const processedPairs = new Set<string>();

  // 1. First Pass: Check which candidates are ALREADY verified in Lumi's people directory
  const unresolvedClusters: typeof clusters = [];
  const resolvedDbPeople = new Map<string, { id: string; name: string }>();

  for (const cluster of clusters) {
    const dbPerson = await findPersonWithFuzzyMatch(cluster.canonicalName);
    if (dbPerson) {
      resolvedDbPeople.set(cluster.canonicalName.toLowerCase(), dbPerson);
    } else {
      unresolvedClusters.push(cluster);
    }
  }

  if (resolvedDbPeople.size > 0) {
    console.log(`   📚 DB Directory: Auto-approved ${resolvedDbPeople.size} known persons from database`);
  }

  // 2. Second Pass: Consult AI Validation Gate ONLY for candidates NOT in the database
  const aiResultLookup = new Map<string, any>();
  if (unresolvedClusters.length > 0) {
    console.log(`   🤖 AI Validation Gate: Checking ${unresolvedClusters.length} unverified candidates...`);
    const candidatesForAi = unresolvedClusters.map(c => ({
      raw: c.canonicalName,
      role: Array.from(c.roles)[0] || (c.creditType === 'actor' ? 'actor' : 'crew'),
      creditType: c.creditType,
    }));

    const aiValidations = await validateCreditsWithAi(filmTitle, candidatesForAi);
    for (const res of aiValidations) {
      aiResultLookup.set(res.raw.toLowerCase(), res);
    }
  } else {
    console.log(`   ✨ All candidates already matched verified database people (AI gate call not needed).`);
  }

  let billingOrder = 1;

  for (const cluster of clusters) {
    let dbPerson = resolvedDbPeople.get(cluster.canonicalName.toLowerCase()) || null;
    let aiCheck = aiResultLookup.get(cluster.canonicalName.toLowerCase());

    // If not directly found in DB, check AI validation
    if (!dbPerson) {
      if (aiCheck && (!aiCheck.isValidHumanName || aiCheck.confidence < 85)) {
        console.log(`      🗑️  AI Rejected: "${cluster.canonicalName}" (${aiCheck.rejectionReason || 'Invalid name/role'})`);
        continue;
      }

      // If AI suggested a corrected name (e.g. fixed OCR typo), check DB again
      if (aiCheck?.cleanName && aiCheck.cleanName !== cluster.canonicalName) {
        dbPerson = await findPersonWithFuzzyMatch(aiCheck.cleanName);
      }
    }

    const isKnownStar = dbPerson !== null;
    let personId = dbPerson?.id;
    let finalPersonName = dbPerson?.name || aiCheck?.cleanName || cluster.canonicalName;

    // Only create a person if:
    // 1. Not found via fuzzy match in entire Lumi directory
    // 2. AND AI confirmed with >= 80% confidence or multi-source/frame support
    if (!personId) {
      const isHighConfidence = aiCheck && aiCheck.isValidHumanName && aiCheck.confidence >= 80;
      const isMultiSource = cluster.sources.size >= 2 || cluster.frameSupport >= 2;
      if (isHighConfidence || (aiCheck?.isValidHumanName && isMultiSource)) {
        const baseSlug = finalPersonName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const { data: created, error: pErr } = await serviceSupabase
          .from('people')
          .insert({
            name: finalPersonName,
            slug: `${baseSlug}-${Math.floor(100 + Math.random() * 900)}`,
            known_for_department: cluster.creditType === 'actor' ? 'Acting' : 'Directing',
          })
          .select('id, name')
          .single();

        if (pErr) {
          console.error(`Error auto-creating verified person ${finalPersonName}:`, pErr.message);
          continue;
        }
        personId = created.id;
        finalPersonName = created.name;
        console.log(`      ✨ Verified New Person Added to Directory: "${finalPersonName}"`);
      } else {
        console.log(`      ⏭️  Skipped (Uncertain / Not in DB): "${cluster.canonicalName}"`);
        continue;
      }
    }

    if (!personId) continue;

    // ZERO-DUPLICATE ACTOR RULE
    if (cluster.creditType === 'actor') {
      if (processedActorIds.has(personId)) {
        continue;
      }
      processedActorIds.add(personId);
    }

    const roleString = aiCheck?.normalizedRole || Array.from(cluster.roles)[0] || (cluster.creditType === 'actor' ? 'actor' : 'crew');
    const normalizedRole = normalizeRole(roleString, cluster.creditType);

    const pairKey = `${personId}:${normalizedRole}`;
    if (processedPairs.has(pairKey)) {
      continue;
    }
    processedPairs.add(pairKey);

    let consensusScore = isKnownStar ? 0.95 : (aiCheck?.confidence ? aiCheck.confidence / 100 : 0.85);

    verifiedCredits.push({
      personId,
      personName: finalPersonName,
      role: normalizedRole,
      characterName: null,
      billingOrder: billingOrder++,
      consensusScore: Number(consensusScore.toFixed(2)),
      verifiedSources: Array.from(cluster.sources),
    });
  }

  return verifiedCredits;
}

/**
 * Commits verified credits directly into Supabase `credits` table.
 * Strictly guarantees ZERO duplicate actor credits and zero duplicate (person, role) pairs.
 */
export async function commitVerifiedCredits(filmId: string, credits: VerifiedCredit[]): Promise<number> {
  if (!credits.length) return 0;

  // Fetch all existing credits for this film to prevent duplicates
  const { data: existingCredits } = await serviceSupabase
    .from('credits')
    .select('person_id, role')
    .eq('film_id', filmId);

  const existingPairSet = new Set<string>();
  const existingActors = new Set<string>();
  for (const ex of (existingCredits || []) as any[]) {
    existingPairSet.add(`${ex.person_id}:${ex.role}`);
    if (ex.role === 'actor') {
      existingActors.add(ex.person_id);
    }
  }

  let inserted = 0;
  const batchInsertedPairs = new Set<string>();
  const batchInsertedActors = new Set<string>();

  for (const c of credits) {
    const pairKey = `${c.personId}:${c.role}`;

    // 1. Never add the same person twice for the same role under the same movie
    if (existingPairSet.has(pairKey) || batchInsertedPairs.has(pairKey)) {
      continue;
    }

    // 2. Never add multiple actor credits for the same person under the same movie
    if (c.role === 'actor' && (existingActors.has(c.personId) || batchInsertedActors.has(c.personId))) {
      continue;
    }

    const { error } = await serviceSupabase.from('credits').insert({
      film_id: filmId,
      person_id: c.personId,
      role: c.role,
      character_name: c.characterName,
      billing_order: c.billingOrder,
      source: 'harvest_consensus',
    });

    if (!error) {
      inserted++;
      existingPairSet.add(pairKey);
      batchInsertedPairs.add(pairKey);
      if (c.role === 'actor') {
        existingActors.add(c.personId);
        batchInsertedActors.add(c.personId);
      }
    } else {
      console.error(`  -> Failed to insert credit for ${c.personName}:`, error.message);
    }
  }

  return inserted;
}
