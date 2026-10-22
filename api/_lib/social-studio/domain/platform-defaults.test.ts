import { expect, it } from 'vitest';
import { defaultPlatformsFor, GRAPHIC_DEFAULT_PLATFORMS, VIDEO_DEFAULT_PLATFORMS } from './platform-types.js';

it('keeps graphics off TikTok by default', () => {
  expect(defaultPlatformsFor('graphic')).not.toContain('tiktok');
  expect(defaultPlatformsFor('graphic')).toEqual(['instagram', 'facebook', 'threads']);
});

it('sends clipper video to TikTok alongside every other social', () => {
  expect(defaultPlatformsFor('video')).toContain('tiktok');
  expect(defaultPlatformsFor('video')).toEqual(['instagram', 'facebook', 'threads', 'tiktok']);
});

it('is the graphic list plus TikTok, so the two never drift apart', () => {
  expect(defaultPlatformsFor('video')).toEqual([...GRAPHIC_DEFAULT_PLATFORMS, 'tiktok']);
});

it('returns a fresh array so a caller cannot mutate the shared default', () => {
  const first = defaultPlatformsFor('graphic');
  first.push('tiktok');
  expect(defaultPlatformsFor('graphic')).not.toContain('tiktok');
  expect(GRAPHIC_DEFAULT_PLATFORMS).not.toContain('tiktok');
  expect(VIDEO_DEFAULT_PLATFORMS).toContain('tiktok');
});
