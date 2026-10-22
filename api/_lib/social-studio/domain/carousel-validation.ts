export function assertCarouselVariantsReady(variants: Array<{ platform: string; platform_options?: any }>) {
  for (const variant of variants) {
    const options = variant.platform_options || {};
    const urls = Array.isArray(options.carousel_asset_urls)
      ? options.carousel_asset_urls.filter((url: unknown) => typeof url === 'string' && /^https:\/\//i.test(url))
      : [];
    if (options.post_format === 'carousel' && urls.length < 2) {
      throw Object.assign(
        new Error(`${variant.platform} is set to Carousel but only has ${urls.length} saved image${urls.length === 1 ? '' : 's'}. Add at least 2 items to that channel before scheduling.`),
        { status: 409 },
      );
    }
  }
}
