import { describe, expect, it } from 'vitest';
import { getChangedProfileFields, getProfileProgress } from './professionalProfile';

describe('professional profile helpers', () => {
  it('calculates completion from useful public profile details', () => {
    const result = getProfileProgress({
      photo_url: 'portrait.webp',
      bio: 'Screen and stage actor.',
      known_for_department: 'Actor',
      nationality: 'Nigerian',
      birthplace: 'Lagos, Nigeria',
      instagram_url: 'https://instagram.com/example',
    }, [{ id: 'credit-1' }]);

    expect(result.percent).toBe(100);
    expect(result.checks.every((check) => check.complete)).toBe(true);
  });

  it('only submits profile fields that actually changed', () => {
    const result = getChangedProfileFields(
      { name: 'Ada Example', bio: null, nationality: 'Nigerian' },
      { name: ' Ada Example ', bio: 'New biography', nationality: '' },
    );

    expect(result).toEqual({ bio: 'New biography', nationality: null });
  });
});
