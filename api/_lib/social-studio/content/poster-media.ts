import sharp from 'sharp';

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export function isLikelyLandscapeOrThumbnailUrl(url?: string | null): boolean {
  if (!url) return false;
  return /ytimg\.com|img\.youtube\.com|hqdefault|maxresdefault|sddefault|mqdefault|\/vi\/|(?:^|[-_/])(?:backdrop|banner|landscape|wide|horizontal)(?:[-_./]|$)/i.test(url);
}

export async function downloadSocialImage(url: string): Promise<Buffer> {
  if (!url) throw new Error('Portrait poster needed. Add a portrait poster to the film first.');
  let normalizedUrl = url.trim().replace(/^http:\/\//i, 'https://');
  if (isLikelyLandscapeOrThumbnailUrl(normalizedUrl)) {
    throw new Error(`Landscape or video thumbnail URL detected (${normalizedUrl}). Under no condition can Social Studio post landscape artwork.`);
  }
  if (normalizedUrl.includes('bakkaz-files.nyc3.cdn.digitaloceanspaces.com')) {
    normalizedUrl = normalizedUrl.replace('bakkaz-files.nyc3.cdn.digitaloceanspaces.com', 'cloud.bakkaz.name.ng');
  }
  const target = new URL(normalizedUrl);
  if (target.protocol !== 'https:' || target.username || target.password
    || /^(localhost|127\.|10\.|0\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(target.hostname)) {
    throw new Error('A public HTTPS poster URL is required');
  }
  const response = await fetch(target, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok || !response.body) throw new Error(`Could not fetch poster (${response.status})`);
  const chunks: Uint8Array[] = [];
  let length = 0;
  for await (const chunk of response.body as any) {
    length += chunk.length;
    if (length > MAX_IMAGE_BYTES) throw new Error('Poster exceeds 20 MB');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** Fit the whole poster inside a portrait canvas; never crop credits or artwork. Strictly requires high-resolution portrait. */
export async function preparePoster(bytes: Buffer, _requirePortrait = true) {
  const image = sharp(bytes, { limitInputPixels: 40_000_000 }).rotate();
  const metadata = await image.metadata();
  const swapped = [5, 6, 7, 8].includes(metadata.orientation || 1);
  const width = swapped ? metadata.height : metadata.width;
  const height = swapped ? metadata.width : metadata.height;
  if (!width || !height) throw new Error('Poster dimensions could not be read');

  // Strict Rule: On no condition must Social Studio post landscape or square artwork.
  // Theatrical portrait posters must have aspect ratio >= 1.15:1.
  if (width >= height || (height / width) < 1.15) {
    throw new Error(`Portrait poster strictly required. Image is a landscape or square artwork (${width}x${height}, ratio ${(height / width).toFixed(2)}:1). Under no condition can Social Studio post landscape artwork.`);
  }

  // Strict Rule: Only crisp, high-resolution portrait posters.
  // Minimum resolution floor is 450x600 (recommended 800x1200+).
  if (width < 450 || height < 600) {
    throw new Error(`Poster resolution is too low (${width}x${height}). Social Studio strictly requires a crisp, high-resolution portrait poster (minimum 450x600).`);
  }

  const jpeg = await image.resize(864, 1080, { fit: 'contain', background: '#111111' })
    .flatten({ background: '#111111' }).jpeg({ quality: 95 }).toBuffer();
  return { jpeg, width: 864, height: 1080, originalWidth: width, originalHeight: height };
}

/** Pre-validation helper to verify image bytes meet strict high-res portrait requirements. */
export async function validateHighResPortraitPoster(bytes: Buffer): Promise<{ width: number; height: number; aspectRatio: number }> {
  const image = sharp(bytes, { limitInputPixels: 40_000_000 }).rotate();
  const metadata = await image.metadata();
  const swapped = [5, 6, 7, 8].includes(metadata.orientation || 1);
  const width = swapped ? metadata.height : metadata.width;
  const height = swapped ? metadata.width : metadata.height;
  if (!width || !height) throw new Error('Poster dimensions could not be read');

  if (width >= height || (height / width) < 1.15) {
    throw new Error(`Landscape or square artwork detected (${width}x${height}, ratio ${(height / width).toFixed(2)}:1). Under no condition can Social Studio post landscape artwork.`);
  }

  if (width < 450 || height < 600) {
    throw new Error(`Poster resolution is too low (${width}x${height}). Social Studio requires a high-resolution portrait poster (minimum 450x600).`);
  }

  return { width, height, aspectRatio: height / width };
}

/** Pre-validation helper for checking a public URL meets strict high-res portrait requirements. */
export async function validatePosterUrlIsHighResPortrait(url: string): Promise<{ width: number; height: number }> {
  const bytes = await downloadSocialImage(url);
  const result = await validateHighResPortraitPoster(bytes);
  return { width: result.width, height: result.height };
}

export function socialPhotoUrl(path: string) {
  const base = (process.env.SOCIAL_PUBLIC_MEDIA_ORIGIN || 'https://muvidb.com').replace(/\/$/, '');
  return `${base}/api/media?op=social-photo&path=${encodeURIComponent(path)}`;
}
