export const SOCIAL_PLATFORMS = ['instagram', 'facebook', 'threads', 'tiktok'] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  threads: 'Threads',
  tiktok: 'TikTok',
};

export function isSocialPlatform(value: unknown): value is SocialPlatform {
  return typeof value === 'string' && SOCIAL_PLATFORMS.includes(value as SocialPlatform);
}

/**
 * Which rendered format each platform posts by default.
 *
 * TikTok is a full-screen vertical surface, so it takes 9:16. The rest are feed
 * placements where 4:5 occupies the most screen height Instagram allows. The
 * square render stays available for manual selection.
 */
export const PLATFORM_PREFERRED_FORMAT: Record<SocialPlatform, 'portrait_4_5' | 'vertical_9_16'> = {
  instagram: 'portrait_4_5',
  facebook: 'portrait_4_5',
  threads: 'portrait_4_5',
  tiktok: 'vertical_9_16',
};

/**
 * Picks the asset a variant should publish, falling back through the available
 * formats so a variant is never left without an asset when rendering produced
 * only some of them.
 */
export function preferredAssetFormat(platform: SocialPlatform, available: string[]): string | null {
  if (!available.length) return null;

  const order = [
    PLATFORM_PREFERRED_FORMAT[platform],
    'portrait_4_5',
    'square_1_1',
    'vertical_9_16',
  ];

  for (const format of order) {
    if (available.includes(format)) return format;
  }
  return available[0];
}

export function normalizePlatforms(value: unknown): SocialPlatform[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isSocialPlatform))];
}
