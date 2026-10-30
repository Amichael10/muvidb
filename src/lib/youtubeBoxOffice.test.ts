import { describe, it, expect } from 'vitest';
import {
  calculateYoutubeBoxOffice,
  calculateStreamingVelocity,
  formatCompactCurrency,
  parseRuntimeMinutes,
} from './youtubeBoxOffice';

describe('youtubeBoxOffice engine', () => {
  it('formats compact currencies correctly', () => {
    expect(formatCompactCurrency(12500000, 'NGN')).toBe('₦12.5M');
    expect(formatCompactCurrency(4500000000, 'NGN')).toBe('₦4.5B');
    expect(formatCompactCurrency(8500, 'USD')).toBe('$8.5K');
    expect(formatCompactCurrency(1200000, 'USD')).toBe('$1.2M');
  });

  it('parses runtime formats correctly', () => {
    expect(parseRuntimeMinutes('PT1H45M')).toBe(105);
    expect(parseRuntimeMinutes('2h 10m')).toBe(130);
    expect(parseRuntimeMinutes(95)).toBe(95);
    expect(parseRuntimeMinutes(null)).toBe(90);
  });

  it('calculates realistic Nollywood revenue range for a 2-hour 10M view blockbuster', () => {
    const estimate = calculateYoutubeBoxOffice({
      viewCount: 10_000_000,
      runtimeMinutes: 120, // Extended epic
      language: 'English',
      title: 'Queen of the Street',
    });

    expect(estimate.lowUsd).toBeGreaterThan(25000);
    expect(estimate.highUsd).toBeGreaterThan(estimate.lowUsd);
    expect(estimate.lowNgn).toBeGreaterThan(35_000_000);
    expect(estimate.tier).toBe('blockbuster');
    expect(estimate.formattedNgn).toContain('₦');
    expect(estimate.formattedUsd).toContain('$');
  });

  it('adjusts base RPM for indigenous language titles', () => {
    const englishEst = calculateYoutubeBoxOffice({
      viewCount: 1_000_000,
      runtimeMinutes: 90,
      language: 'English',
    });

    const yorubaEst = calculateYoutubeBoxOffice({
      viewCount: 1_000_000,
      runtimeMinutes: 90,
      language: 'Yoruba',
    });

    expect(yorubaEst.lowUsd).toBeLessThan(englishEst.lowUsd);
    expect(yorubaEst.highUsd).toBeLessThan(englishEst.highUsd);
  });

  it('calculates streaming velocity properly', () => {
    const velocity = calculateStreamingVelocity({
      viewCount: 3_000_000,
      year: 2025,
    });

    expect(velocity.daysActive).toBeGreaterThan(0);
    expect(velocity.viewsPerDay).toBeGreaterThan(0);
    expect(velocity.formattedViewsPerDay).toContain('/day');
    expect(velocity.badge.label).toBeDefined();
  });
});

