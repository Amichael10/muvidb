import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleHealth } from './_lib/health.js';
import { handleMirrorImages } from './_lib/mirror_images_admin.js';
import { downloadPublicImage } from './_lib/safe_image_download.js';

// Consolidated media/system router (Hobby free-tier function budget — see
// docs/SSR_MIGRATION.md). Public paths are preserved by vercel.json rewrites:
//   /api/health        -> /api/media?op=health
//   /api/mirror-images -> /api/media?op=mirror
//   /api/media?url=…    -> image proxy (default op)
export const config = { maxDuration: 60 }; // mirror-images batch needs the headroom

// Image proxy. Fetches a remote image server-side (with the *source site's own*
// Referer so hotlink protection lets it through) and streams it back from our
// own domain. The frontend points un-mirrored posters/backdrops at
// /api/media?url=<origin>, so users only ever see muvidb.com URLs and broken
// hotlinks disappear. Responses are cached hard at the Vercel edge, so each
// origin image is fetched at most once.

// Detect a real image from its leading bytes, regardless of the content-type header.
function sniffImageType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp';
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Route consolidated ops to their handlers; default (no op) is the image proxy.
  const op = req.query.op;
  if (op === 'social-photo') {
    const path = typeof req.query.path === 'string' ? req.query.path : '';
    if (!/^tiktok\/[a-f0-9-]{36}\/\d+\.jpg$/.test(path)) return res.status(400).send('Invalid photo path');
    const { supabase } = await import('./_lib/supabase.js');
    const { data, error } = await supabase.storage.from(process.env.SOCIAL_ASSET_BUCKET || 'social-published-assets').download(path);
    if (error || !data) return res.status(404).send('Photo not found');
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(Buffer.from(await data.arrayBuffer()));
  }
  if (op === 'health') return handleHealth(req, res);
  if (op === 'mirror') return handleMirrorImages(req, res);
  if (op === 'external' || req.query.provider) {
    const { handleExternalProvider } = await import('./_lib/external_provider_handler.js');
    return handleExternalProvider(req, res);
  }

  const raw = req.query.url;
  const url = Array.isArray(raw) ? raw[0] : raw;
  if (!url) return res.status(400).send('Missing url');

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return res.status(400).send('Invalid url');
  }
  if (!/^https?:$/.test(target.protocol)) return res.status(400).send('Unsupported protocol');

  try {
    const buffer = await downloadPublicImage(target, {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      Accept: 'image/webp,image/png,image/jpeg,image/gif,image/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    });

    // Trust the file signature over the (frequently wrong) content-type header —
    // origin servers often label valid images as application/octet-stream.
    const contentType = sniffImageType(buffer);
    if (!contentType) return res.status(415).send('Not an image');

    res.setHeader('Content-Type', contentType);
    // Immutable + shared cache so Vercel's edge serves it; origin hit once.
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(buffer);
  } catch (e: any) {
    const status = [400, 403, 413, 504].includes(e?.statusCode) ? e.statusCode : 502;
    return res.status(status).send(status === 403 ? 'Blocked host' : status === 413 ? 'Too large' : 'Image fetch failed');
  }
}
