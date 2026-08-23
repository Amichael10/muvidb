import { describe, expect, it } from 'vitest';
import {
  CAPTION_BANK,
  buildVerifiedCaptionValues,
  captionBankCategoryForSeries,
  resolveCaptionStarter,
  selectCaptionBankStarters,
} from './caption_bank.js';

describe('MuviDB caption bank', () => {
  it('contains all eight 100-starter Notion categories', () => {
    expect(Object.keys(CAPTION_BANK)).toHaveLength(8);
    for (const starters of Object.values(CAPTION_BANK)) expect(starters).toHaveLength(100);
    expect(Object.values(CAPTION_BANK).flat()).toHaveLength(800);
  });

  it('maps editorial series to the correct bank', () => {
    expect(captionBankCategoryForSeries('where_to_watch')).toBe('where_to_watch');
    expect(captionBankCategoryForSeries('new_and_upcoming')).toBe('new_and_upcoming');
    expect(captionBankCategoryForSeries('you_know_the_face', { type: 'person' })).toBe('filmography');
    expect(captionBankCategoryForSeries('whats_on_stage', { type: 'play' })).toBe('whats_on_stage');
    expect(captionBankCategoryForSeries('theatre-weekend', { type: 'play' })).toBe('whats_on_stage');
  });

  it('resolves only placeholders backed by verified candidate data', () => {
    const values = buildVerifiedCaptionValues({
      type: 'movie',
      name: 'Example Film',
      data: { platformDisplayName: 'NolliStream', release_date: '2026-09-01' },
    });
    expect(resolveCaptionStarter('[FILM] arrives on [PLATFORM] on [DATE].', values))
      .toBe('Example Film arrives on NolliStream on 2026-09-01.');
    expect(resolveCaptionStarter('[COUNT] people watched [FILM].', values)).toBeNull();
  });

  it('never returns unresolved placeholders to the copy generator', () => {
    const result = selectCaptionBankStarters({
      seriesSlug: 'where_to_watch',
      candidate: {
        id: 'film-1',
        type: 'movie',
        name: 'Example Film',
        data: { platformDisplayName: 'Docuth', lifecycle: 'now_streaming' },
      },
      limit: 12,
    });
    expect(result.category).toBe('where_to_watch');
    expect(result.starters).toHaveLength(12);
    expect(result.starters.every(starter => !/\[[^\]]+\]/.test(starter))).toBe(true);
    expect(result.starters.every(starter => starter.includes('Example Film') && starter.includes('Docuth'))).toBe(true);
    expect(result.starters.every(starter => !/new on|newly available|has arrived|just added/i.test(starter))).toBe(true);
  });

  it('selects a stable set for the same candidate', () => {
    const input = {
      seriesSlug: 'new_and_upcoming',
      candidate: { id: 'future-1', type: 'movie', name: 'Future Film', data: { release_date: '2026-10-01' } },
      limit: 5,
    };
    expect(selectCaptionBankStarters(input)).toEqual(selectCaptionBankStarters(input));
  });

  it('does not claim an unverified poster, trailer, or cast announcement', () => {
    const result = selectCaptionBankStarters({
      seriesSlug: 'new_and_upcoming',
      candidate: { id: 'future-2', type: 'movie', name: 'Future Film', data: { lifecycle: 'upcoming', release_date: '2026-10-01' } },
      limit: 20,
    });
    expect(result.starters.every(starter => !/new poster|poster reveal|first look|trailer|cast update|cast reveal|announced|confirmed|joins|audience|attention|interest|buzz|anticipated|trending/i.test(starter))).toBe(true);
  });
});
