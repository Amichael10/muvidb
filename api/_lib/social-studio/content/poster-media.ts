import sharp from 'sharp';

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export async function downloadSocialImage(url: string): Promise<Buffer> {
  if (!url) throw new Error('Portrait poster needed. Add a portrait poster to the film first.');
  const target = new URL(url);
  if (target.protocol !== 'https:' || target.username || target.password
    || /^(localhost|127\.|10\.|0\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(target.hostname)) {
    throw new Error('A public HTTPS poster URL is required');
  }
  const response = await fetch(target, { redirect: 'error', signal: AbortSignal.timeout(15000) });
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

/** Fit the whole poster inside a portrait canvas; never crop credits or artwork. */
export async function preparePoster(bytes: Buffer, requirePortrait = true) {
  const image = sharp(bytes, { limitInputPixels: 40_000_000 }).rotate();
  const metadata = await image.metadata();
  const swapped = [5, 6, 7, 8].includes(metadata.orientation || 1);
  const width = swapped ? metadata.height : metadata.width;
  const height = swapped ? metadata.width : metadata.height;
  if (!width || !height) throw new Error('Poster dimensions could not be read');
  if (requirePortrait && width >= height) {
    throw new Error('Portrait poster needed. Replace the film poster with a portrait image, then try again.');
  }
  const jpeg = await image.resize(864, 1080, { fit: 'contain', background: '#111111' })
    .flatten({ background: '#111111' }).jpeg({ quality: 92 }).toBuffer();
  return { jpeg, width: 864, height: 1080, originalWidth: width, originalHeight: height };
}

export function socialPhotoUrl(path: string) {
  const base = (process.env.SOCIAL_PUBLIC_MEDIA_ORIGIN || 'https://muvidb.com').replace(/\/$/, '');
  return `${base}/api/media?op=social-photo&path=${encodeURIComponent(path)}`;
}
