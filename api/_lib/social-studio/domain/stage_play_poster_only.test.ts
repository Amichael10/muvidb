import { describe, expect, it } from 'vitest';
import { parseGenerateDraftRequest } from './validation.js';
import { defaultTemplateSlugForSeries } from '../../social_studio.js';
import { defaultTemplateSlugForSnapshot } from '../../social_render.js';

describe('stage play poster-alone policy', () => {
  it('strictly routes whats_on_stage drafts to poster-only in parseGenerateDraftRequest', () => {
    const parsed = parseGenerateDraftRequest({
      contentType: 'whats_on_stage',
      sourceEntityId: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
      templateSlug: 'on-stage-theatre-v1', // even if client requests a template
      platforms: ['instagram', 'threads'],
    });

    expect(parsed.templateSlug).toBe('poster-only');
  });

  it('routes default template slug for series whats_on_stage and play candidate to poster-only', () => {
    expect(defaultTemplateSlugForSeries('whats_on_stage', 'play')).toBe('poster-only');
    expect(defaultTemplateSlugForSeries('whats_on_stage', 'movie')).toBe('poster-only');
    expect(defaultTemplateSlugForSeries('custom_series', 'play')).toBe('poster-only');
  });

  it('routes default template slug for whats_on_stage snapshot to poster-only', () => {
    expect(defaultTemplateSlugForSnapshot({
      kind: 'whats_on_stage',
      capturedAt: '2026-10-27T00:00:00Z',
      playId: 'test-play-1',
      title: 'Death and the King\'s Horseman',
      slug: 'death-and-the-kings-horseman',
      posterUrl: 'https://muvidb.com/poster.jpg',
      backdropUrl: null,
      synopsis: 'A classic drama on stage.',
      venue: 'Terra Kulture',
      city: 'Lagos',
      country: 'Nigeria',
      runStartDate: '2026-11-01',
      runEndDate: '2026-11-15',
      performanceTime: '6:00 PM',
      playwright: 'Wole Soyinka',
      director: 'Bolanle Austen-Peters',
      producer: null,
      ticketUrl: null,
      status: 'upcoming',
      year: 2026,
    })).toBe('poster-only');
  });
});
