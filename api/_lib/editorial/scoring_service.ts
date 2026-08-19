import type { CandidateEntity } from './candidate_service';

export interface ScoredCandidate {
  candidate: CandidateEntity;
  score: number;
  breakdown: {
    completeness: number;
    freshness: number;
    relevance: number;
    assetAvailability: number;
    geographicBalance: number;
    roleBalance: number;
    platformProminence: number;
    randomness: number;
  };
  reasons: string[];
}

/**
 * Computes a normalized 0-100 deterministic score for a candidate subject.
 */
export function scoreCandidate(
  candidate: CandidateEntity,
  recentHistoryCountries: string[] = [],
  recentFeaturedIds: Set<string> = new Set()
): ScoredCandidate {
  const reasons: string[] = [];

  // 1. Database Completeness (0-20)
  const completeness = Math.min(20, Math.round((candidate.completenessScore || 0.7) * 20));
  reasons.push(`DB completeness: ${completeness}/20`);

  // 2. Asset Availability (0-10)
  const assetAvailability = candidate.imageUrl ? 10 : 2;
  if (candidate.imageUrl) reasons.push('Photo/poster available');

  // 3. Freshness / Cooldown (0-15)
  let freshness = 15;
  if (recentFeaturedIds.has(candidate.id)) {
    freshness = 0;
    reasons.push('⚠️ Featured recently (cooldown penalty)');
  } else {
    reasons.push('Clean cooldown record');
  }

  // 4. Geographic Balance (0-10)
  let geographicBalance = 10;
  const country = candidate.country || 'Nigeria';
  const recentCountryCount = recentHistoryCountries.filter((c) => c === country).length;
  if (recentCountryCount > 5) {
    geographicBalance = 3;
    reasons.push(`Geographic balance penalty (${country} featured ${recentCountryCount}x recently)`);
  }

  // 5. Editorial Relevance & Talent Growth Boost (0-20)
  let relevance = 12;
  if (candidate.data?.isRisingStar) {
    relevance = 18;
    reasons.push(`✨ Rising star spotlight (${candidate.data.film_count || 0} verified credits)`);
  } else if (candidate.data?.isCrew) {
    relevance = 18;
    reasons.push(`🎬 Key craft department (${candidate.category || 'Crew'})`);
  } else if (candidate.data?.film_count && candidate.data.film_count >= 5) {
    relevance = 16;
    reasons.push(`Strong credit volume (${candidate.data.film_count} credits)`);
  }

  // 6. Platform Prominence & Hidden Gem Multiplier (0-15)
  let platformProminence = 0;
  if (candidate.data?.isEmergingPlatform) {
    platformProminence = 15;
    reasons.push(`🚀 Emerging platform boost (${candidate.data.platformDisplayName || 'Platform'})`);
  } else if (candidate.data?.isYoutubeGem) {
    platformProminence = 15;
    reasons.push(`💎 YouTube hidden gem (${candidate.data.outperformanceRatio || 1}x reach multiplier)`);
  } else if (candidate.data?.isMainstream) {
    platformProminence = 8;
    reasons.push(`Streamer / Cinema feature (${candidate.data.platformDisplayName || 'Streamer'})`);
  }

  // 7. Role Balance (0-5)
  const roleBalance = candidate.category && candidate.category !== 'Actor' ? 5 : 3;

  // 8. Controlled Randomness (0-5)
  const randomness = Math.floor(Math.random() * 5);

  const rawScore = completeness + freshness + relevance + assetAvailability + geographicBalance + platformProminence + roleBalance + randomness;
  const score = Math.min(100, Math.max(0, rawScore));

  return {
    candidate,
    score,
    breakdown: {
      completeness,
      freshness,
      relevance,
      assetAvailability,
      geographicBalance,
      roleBalance,
      platformProminence,
      randomness,
    },
    reasons,
  };
}

