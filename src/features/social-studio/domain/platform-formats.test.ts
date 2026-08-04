import { describe, expect, it } from 'vitest';
import { PLATFORM_PREFERRED_FORMAT, SOCIAL_PLATFORMS, preferredAssetFormat } from './platform-types';

const ALL = ['portrait_4_5', 'square_1_1', 'vertical_9_16'];

describe('preferredAssetFormat', () => {
  it('gives TikTok the vertical render', () => {
    expect(preferredAssetFormat('tiktok', ALL)).toBe('vertical_9_16');
  });

  it('gives the feed placements the 4:5 render', () => {
    for (const platform of ['instagram', 'facebook', 'threads'] as const) {
      expect(preferredAssetFormat(platform, ALL)).toBe('portrait_4_5');
    }
  });

  it('falls back when the preferred format was not rendered', () => {
    expect(preferredAssetFormat('tiktok', ['portrait_4_5', 'square_1_1'])).toBe('portrait_4_5');
    expect(preferredAssetFormat('instagram', ['square_1_1'])).toBe('square_1_1');
  });

  it('returns null when nothing was rendered', () => {
    expect(preferredAssetFormat('instagram', [])).toBeNull();
  });

  it('never leaves a platform without an asset when any format exists', () => {
    for (const platform of SOCIAL_PLATFORMS) {
      for (const available of [['portrait_4_5'], ['square_1_1'], ['vertical_9_16'], ALL]) {
        expect(preferredAssetFormat(platform, available)).not.toBeNull();
      }
    }
  });

  it('covers every platform in the preference map', () => {
    for (const platform of SOCIAL_PLATFORMS) {
      expect(PLATFORM_PREFERRED_FORMAT[platform]).toBeDefined();
    }
  });
});
