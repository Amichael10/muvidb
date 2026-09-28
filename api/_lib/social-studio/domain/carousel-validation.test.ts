import { describe, expect, it } from 'vitest';
import { assertCarouselVariantsReady } from './carousel-validation.js';

describe('carousel scheduling validation', () => {
  it('rejects a carousel variant that only saved one image', () => {
    expect(() => assertCarouselVariantsReady([{ platform: 'instagram', platform_options: {
      post_format: 'carousel', carousel_asset_urls: ['https://cdn.example/one.jpg'],
    } }])).toThrow('instagram is set to Carousel but only has 1 saved image');
  });

  it('checks every selected platform independently', () => {
    expect(() => assertCarouselVariantsReady([
      { platform: 'instagram', platform_options: { post_format: 'carousel', carousel_asset_urls: ['https://cdn.example/1.jpg', 'https://cdn.example/2.jpg'] } },
      { platform: 'threads', platform_options: { post_format: 'carousel', carousel_asset_urls: ['https://cdn.example/1.jpg'] } },
    ])).toThrow('threads is set to Carousel');
  });

  it('allows valid carousels and single-image posts', () => {
    expect(() => assertCarouselVariantsReady([
      { platform: 'facebook', platform_options: { post_format: 'carousel', carousel_asset_urls: ['https://cdn.example/1.jpg', 'https://cdn.example/2.jpg'] } },
      { platform: 'instagram', platform_options: { post_format: 'single', carousel_asset_urls: ['https://cdn.example/1.jpg'] } },
    ])).not.toThrow();
  });
});
