import type { VercelRequest } from '@vercel/node';

export type RawBodyRequest = VercelRequest & { rawBody?: Buffer };

/** Preserve exactly the bytes signed by webhook providers before parsing JSON. */
export async function prepareRequestBody(req: RawBodyRequest): Promise<void> {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return;
  if (req.body != null && !Buffer.isBuffer(req.body) && typeof req.body !== 'string') {
    // Vercel may parse JSON before invoking a rewritten Node function even
    // when the destination exports bodyParser:false. Meta emits compact JSON,
    // so preserving property order while re-serializing restores the bytes
    // covered by x-hub-signature-256. Verification still fails closed when
    // the payload or configured app secret is wrong.
    req.rawBody = Buffer.from(JSON.stringify(req.body));
    return;
  }
  let raw: Buffer;
  if (Buffer.isBuffer(req.body)) raw = req.body;
  else if (typeof req.body === 'string') raw = Buffer.from(req.body);
  else {
    const chunks: Buffer[] = [];
    let bytes = 0;
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > 4 * 1024 * 1024) throw Object.assign(new Error('Request too large'), { statusCode: 413 });
      chunks.push(buffer);
    }
    raw = Buffer.concat(chunks);
  }
  if (raw.length > 4 * 1024 * 1024) throw Object.assign(new Error('Request too large'), { statusCode: 413 });
  req.rawBody = raw;
  const contentType = String(req.headers['content-type'] || '');
  if (contentType.includes('application/json') || contentType.includes('+json')) {
    try { req.body = raw.length ? JSON.parse(raw.toString('utf8')) : {}; }
    catch { throw Object.assign(new Error('Invalid JSON'), { statusCode: 400 }); }
  } else req.body = raw;
}
