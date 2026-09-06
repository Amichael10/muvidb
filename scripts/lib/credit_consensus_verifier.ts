import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://pkenrmorywmuvnzfoylp.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

export const serviceSupabase: SupabaseClient = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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

// Post-nominal titles like (MON), (OON), (MFR), (JP)
const POST_NOMINALS = /\s*\((?:MON|OON|MFR|CFR|GCFR|CON|JP|SAN|OFR|FNA)\)/gi;

// Noise filtering for non-person strings
const NOISE_WORDS = [
  'COMING SOON', 'NEXT WEEK', 'NOW SHOWING', 'SUBSCRIBE', 'LIKE AND SHARE',
  'COPYRIGHT', 'PRODUCTIONS', 'ENTERTAINMENT', 'PICTURES', 'STUDIOS', 'LIMITED',
  'SPECIAL THANKS', 'LOCATION', 'LOGISTICS', 'CAMERA ASSISTANT', 'LIGHTS',
  'CATERING', 'SECURITY', 'TRANSPORT', 'GENERATOR', 'WELFARE', 'MEDIA', 'GRAPHICS',
  'CLICK HERE', 'ALL RIGHTS RESERVED', 'THE END', 'CAST', 'CREW'
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

/**
 * Worker 3: The Consensus & Reconciliation Engine
 */
export async function reconcileAndVerifyCredits(
  filmId: string,
  worker1Candidates: RawCandidate[],
  worker2Candidates: RawCandidate[],
  metadataCandidates: RawCandidate[] = []
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
    const cleanName = normalizePersonName(obs.name);
    if (!cleanName || cleanName.length < 3 || cleanName.split(' ').length < 2) continue;

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
      if (cleanName.length > matchedCluster.canonicalName.length && !cleanName.includes('.')) {
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

  // Fetch known people from Supabase directory
  const { data: knownPeople } = await serviceSupabase
    .from('people')
    .select('id, name')
    .limit(1000);

  const verifiedCredits: VerifiedCredit[] = [];
  const processedActorIds = new Set<string>(); // GUARANTEE 0 DUPLICATE ACTORS

  let billingOrder = 1;

  for (const cluster of clusters) {
    let dbPerson: { id: string; name: string } | null = null;
    if (knownPeople && knownPeople.length > 0) {
      const match = knownPeople.find(p => nameSimilarity(p.name, cluster.canonicalName) >= 0.90);
      if (match) dbPerson = match;
    }

    const hasDualWorkerConsensus = cluster.sources.has('worker1') && cluster.sources.has('worker2');
    const hasMetadataSupport = cluster.sources.has('metadata');
    const hasMultiFrameSupport = cluster.frameSupport >= 2;
    const isKnownStar = dbPerson !== null;

    let consensusScore = 0.50;
    if (hasDualWorkerConsensus) consensusScore += 0.30;
    if (hasMetadataSupport) consensusScore += 0.20;
    if (hasMultiFrameSupport) consensusScore += 0.15;
    if (isKnownStar) consensusScore += 0.20;
    consensusScore = Math.min(1.0, consensusScore);

    const isAccepted = consensusScore >= 0.70 || hasDualWorkerConsensus || isKnownStar;
    if (!isAccepted) continue;

    let personId = dbPerson?.id;
    let finalPersonName = dbPerson?.name || cluster.canonicalName;

    if (!personId) {
      const { data: directFind } = await serviceSupabase
        .from('people')
        .select('id, name')
        .ilike('name', cluster.canonicalName)
        .limit(1);

      if (directFind && directFind.length > 0) {
        personId = directFind[0].id;
        finalPersonName = directFind[0].name;
      } else {
        const slug = cluster.canonicalName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const { data: created, error: pErr } = await serviceSupabase
          .from('people')
          .insert({
            name: cluster.canonicalName,
            slug: `${slug}-${Math.floor(1000 + Math.random() * 9000)}`,
            known_for_department: cluster.creditType === 'actor' ? 'Acting' : 'Directing',
          })
          .select('id, name')
          .single();

        if (pErr) {
          console.error(`Error auto-creating person ${cluster.canonicalName}:`, pErr.message);
          continue;
        }
        personId = created.id;
        finalPersonName = created.name;
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

    const roleString = Array.from(cluster.roles)[0] || (cluster.creditType === 'actor' ? 'actor' : 'crew');
    const normalizedRole = normalizeRole(roleString, cluster.creditType);

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
 */
export async function commitVerifiedCredits(filmId: string, credits: VerifiedCredit[]): Promise<number> {
  if (!credits.length) return 0;

  let inserted = 0;

  for (const c of credits) {
    const { data: existing } = await serviceSupabase
      .from('credits')
      .select('id')
      .eq('film_id', filmId)
      .eq('person_id', c.personId)
      .eq('role', c.role)
      .limit(1);

    if (!existing || existing.length === 0) {
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
      } else {
        console.error(`  -> Failed to insert credit for ${c.personName}:`, error.message);
      }
    }
  }

  return inserted;
}
