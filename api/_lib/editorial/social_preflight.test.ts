import { describe, expect, it } from 'vitest';
import { classifyArtworkOrientation } from './social_preflight.js';

describe('classifyArtworkOrientation', () => {
  it('identifies YouTube landscape thumbnails for an allowed crop warning', () => {
    expect(classifyArtworkOrientation(480, 360)).toBe('landscape');
  });

  it('accepts portrait posters and distinguishes square artwork', () => {
    expect(classifyArtworkOrientation(500, 750)).toBe('portrait');
    expect(classifyArtworkOrientation(1000, 1000)).toBe('square');
  });
});
