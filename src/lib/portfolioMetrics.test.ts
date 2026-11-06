import { describe, it, expect } from 'vitest';
import {
  computePortfolioMetrics,
  formatCurrencyShort,
  formatViewsShort,
  type PortfolioFilm,
} from './portfolioClient';

describe('Creator Link Portfolio Metrics', () => {
  it('formats short currency in Naira, Dollars, Pounds, and Euros', () => {
    expect(formatCurrencyShort(420_000_000)).toBe('₦420M');
    expect(formatCurrencyShort(1_400_000_000)).toBe('₦1.4B');
    expect(formatCurrencyShort(50_000)).toBe('₦50K');
    expect(formatCurrencyShort(10_000_000, 'USD')).toBe('$10M');
    expect(formatCurrencyShort(0)).toBe('');
  });

  it('formats view counts into clean K, M, and B abbreviations', () => {
    expect(formatViewsShort(86_000_000)).toBe('86M');
    expect(formatViewsShort(12_400_000)).toBe('12.4M');
    expect(formatViewsShort(750_000)).toBe('750K');
    expect(formatViewsShort(1_500_000_000)).toBe('1.5B');
    expect(formatViewsShort(0)).toBe('');
  });

  it('calculates Across Screens breakdown and Commercial Footprint correctly', () => {
    const mockFilms: PortfolioFilm[] = [
      // 12 cinema releases
      ...Array.from({ length: 12 }, (_, i) => ({
        id: `cinema-${i}`,
        title: `Cinema Film ${i}`,
        slug: `cinema-film-${i}`,
        year: 2024,
        poster_url: null,
        backdrop_url: null,
        synopsis: 'Test',
        roles: ['Director'],
        release_type: 'cinema',
        box_office_domestic: i === 0 ? 420_000_000 : 0, // ₦420M total
      })),
      // 19 YouTube films
      ...Array.from({ length: 19 }, (_, i) => ({
        id: `yt-${i}`,
        title: `YouTube Film ${i}`,
        slug: `yt-film-${i}`,
        year: 2023,
        poster_url: null,
        backdrop_url: null,
        synopsis: 'Test',
        roles: ['Actor'],
        release_type: 'youtube',
        view_count: i === 0 ? 86_000_000 : 0, // 86M total
      })),
    ];

    // 3 stage productions with one having stage theatre box office
    const mockStageCredits = [
      { id: 'stage-1', role: 'Lead Actor', box_office_domestic: 18_500_000, plays: { title: 'Wole Soyinka Death and the Kings Horseman' } },
      { id: 'stage-2', role: 'Director', plays: { title: 'The Lion and the Jewel' } },
      { id: 'stage-3', role: 'Producer', plays: { title: 'Kurunmi' } },
    ];

    const metrics = computePortfolioMetrics(mockFilms, mockStageCredits);

    expect(metrics.cinemaCount).toBe(12);
    expect(metrics.youtubeCount).toBe(19);
    expect(metrics.stageCount).toBe(3);
    expect(metrics.acrossScreensText).toBe('12 cinema releases · 19 YouTube films · 3 stage productions');

    expect(metrics.totalBoxOffice).toBe(420_000_000);
    expect(metrics.formattedBoxOffice).toBe('₦420M');

    expect(metrics.totalStageBoxOffice).toBe(18_500_000);
    expect(metrics.formattedStageBoxOffice).toBe('₦18.5M');

    expect(metrics.totalViews).toBe(86_000_000);
    expect(metrics.formattedViews).toBe('86M');
    expect(metrics.hasCommercialFootprint).toBe(true);
  });

  it('handles creators with no theatrical box office or zero views gracefully', () => {
    const mockFilms: PortfolioFilm[] = [
      {
        id: 'film-1',
        title: 'Indie Film',
        slug: 'indie-film',
        year: 2024,
        poster_url: null,
        backdrop_url: null,
        synopsis: 'Test',
        roles: ['Writer'],
        release_type: 'unreleased',
      },
    ];

    const metrics = computePortfolioMetrics(mockFilms, []);
    expect(metrics.cinemaCount).toBe(0);
    expect(metrics.youtubeCount).toBe(0);
    expect(metrics.stageCount).toBe(0);
    expect(metrics.acrossScreensText).toBe('1 credited production');
    expect(metrics.hasCommercialFootprint).toBe(false);
  });
});
