import type { VercelRequest, VercelResponse } from '@vercel/node';

// Image proxy. Fetches a remote image server-side (with the *source site's own*
// Referer so hotlink protection lets it through) and streams it back from our
// own domain. The frontend points un-mirrored posters/backdrops at
// /api/media?url=<origin>, so users only ever see muvidb.com URLs and broken
// hotlinks disappear. Responses are cached hard at the Vercel edge, so each
// origin image is fetched at most once.

// Block obvious SSRF targets (loopback, private ranges, cloud metadata, .local).
const BLOCKED_HOST =
  /^(localhost$|127\.|0\.0\.0\.0$|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|::1$|.*\.local$)/i;

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
  if (BLOCKED_HOST.test(target.hostname)) return res.status(403).send('Blocked host');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const upstream = await fetch(target.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': target.origin + '/',
      },
    });

    if (!upstream.ok) return res.status(502).send('Upstream error');

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.byteLength > 15 * 1024 * 1024) return res.status(413).send('Too large');

    // Trust the file signature over the (frequently wrong) content-type header —
    // origin servers often label valid images as application/octet-stream.
    const headerCt = upstream.headers.get('content-type') || '';
    const contentType = sniffImageType(buffer) || (headerCt.startsWith('image/') ? headerCt : null);
    if (!contentType) return res.status(415).send('Not an image');

    res.setHeader('Content-Type', contentType);
    // Immutable + shared cache so Vercel's edge serves it; origin hit once.
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(buffer);
  } catch (e: any) {
    return res.status(502).send(e?.name === 'AbortError' ? 'Timeout' : 'Fetch failed');
  } finally {
    clearTimeout(timeout);
  }
}
