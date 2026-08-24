import type { CandidateEntity } from './candidate_service';
import { assessEditorialCandidate } from './editorial_selection_engine.js';

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
  recentFeaturedIds: Set<string> = new Set(),
  seriesSlug = 'film_conversation',
): ScoredCandidate {
  const assessment = assessEditorialCandidate(candidate, seriesSlug, {
    recentlyFeaturedIds: recentFeaturedIds,
  });
  const country = candidate.country || 'Nigeria';
  const recentCountryCount = recentHistoryCountries.filter(value => value === country).length;
  const geographicBalance = recentCountryCount > 5 ? 3 : 10;

  return {
    candidate,
    score: assessment.score,
    breakdown: {
      completeness: assessment.signals.completeness,
      freshness: assessment.signals.timeliness,
      relevance: assessment.signals.currentProject + assessment.signals.conversation,
      assetAvailability: assessment.signals.visual,
      geographicBalance,
      roleBalance: candidate.category && candidate.category !== 'Actor' ? 5 : 3,
      platformProminence: assessment.signals.priority,
      randomness: 0,
    },
    reasons: [...assessment.reasons, ...assessment.warnings],
  };
}

