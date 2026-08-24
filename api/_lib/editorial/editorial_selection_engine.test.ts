import { describe, expect, it } from 'vitest';
import type { CandidateEntity } from './candidate_service.js';
import {
  assessEditorialCandidate,
  editorialIdentity,
  rankEditorialCandidates,
  shouldSuppressCalendarSlot,
} from './editorial_selection_engine.js';

function candidate(overrides: Partial<CandidateEntity> = {}): CandidateEntity {
  return {
    id: 'candidate-1',
    type: 'person',
    name: 'Example Professional',
    imageUrl: 'https://images.example.com/headshot.jpg',
    completenessScore: 0.9,
    data: {},
    ...overrides,
  };
}

describe('editorial selection engine', () => {
  const referenceDate = new Date('2026-08-24T12:00:00Z');

  it('rejects a newly updated unknown profile without editorial context', () => {
    const result = assessEditorialCandidate(candidate({
      data: {
        film_count: 3,
        popularity_score: 0,
        profile_views: 0,
        updated_at: '2026-08-24T10:00:00Z',
        knownFor: [{ title: 'Recent Film', year: 2026 }],
      },
    }), 'you_know_the_face', { referenceDate });

    expect(result.eligible).toBe(false);
    expect(result.warnings).toContain('Insufficient context to introduce this professional');
  });

  it('qualifies emerging talent with a recent project and enough profile context', () => {
    const result = assessEditorialCandidate(candidate({
      data: {
        film_count: 6,
        popularity_score: 20,
        profile_views: 120,
        bio: 'A Nigerian actor with verified screen credits.',
        instagram_url: 'https://instagram.com/example',
        knownFor: [{ title: 'Current Film', year: 2026 }, { title: 'Earlier Film', year: 2025 }],
      },
    }), 'you_know_the_face', { referenceDate });

    expect(result.eligible).toBe(true);
    expect(result.whyNow).toContain('Current Film');
  });

  it('caps raw credit and popularity counters instead of letting them dominate', () => {
    const result = assessEditorialCandidate(candidate({
      data: {
        film_count: 752,
        popularity_score: 80_000_000,
        profile_views: 10_000_000,
        bio: 'Established actor.',
        knownFor: [{ title: 'Known Film', year: 2020 }],
      },
    }), 'filmography', { referenceDate });

    expect(result.signals.audience).toBeLessThanOrEqual(20);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('rejects catalogue conversation films with no story or audience signal', () => {
    const result = assessEditorialCandidate(candidate({
      type: 'movie',
      name: 'Imported Row',
      data: { lifecycle: 'catalogue', view_count: 0 },
    }), 'film_conversation', { referenceDate });

    expect(result.eligible).toBe(false);
    expect(result.warnings).toContain('Not enough story context for a conversation post');
  });

  it('prioritizes a verified current streaming destination', () => {
    const result = assessEditorialCandidate(candidate({
      type: 'movie',
      name: 'Useful Film',
      data: {
        lifecycle: 'now_streaming',
        platformDisplayName: 'NolliStream',
        synopsis: 'A complete verified synopsis that gives audiences enough context for the story.',
      },
    }), 'where_to_watch', { referenceDate });

    expect(result.eligible).toBe(true);
    expect(result.whyNow).toBe('Now available on NolliStream');
    expect(result.signals.priority).toBe(5);
  });

  it('deduplicates near-identical imported titles', () => {
    const sharedData = {
      lifecycle: 'now_streaming',
      platformDisplayName: 'Docuth',
      synopsis: 'A complete verified synopsis that gives audiences enough context for the story.',
    };
    const ranked = rankEditorialCandidates([
      candidate({ id: 'a', type: 'movie', name: 'Kate Ayomide | Praise in the Storms', data: sharedData }),
      candidate({ id: 'b', type: 'movie', name: "Kate Ayomide's | Praise in the Storms (Mercy)", data: sharedData }),
    ], 'where_to_watch', { referenceDate });

    expect(editorialIdentity(ranked[0].candidate)).toBe('kate ayomide');
    expect(ranked).toHaveLength(1);
  });

  it('enforces daily and weekly professional-profile limits', () => {
    expect(shouldSuppressCalendarSlot({
      status: 'planned',
      seriesSlug: 'filmography',
      dailyPeopleCount: 1,
      weeklyPeopleCount: 1,
      seriesAlreadyUsedToday: false,
    })).toContain('one professional');

    expect(shouldSuppressCalendarSlot({
      status: 'planned',
      seriesSlug: 'filmography',
      dailyPeopleCount: 0,
      weeklyPeopleCount: 2,
      seriesAlreadyUsedToday: false,
    })).toContain('Weekly');
  });
});
