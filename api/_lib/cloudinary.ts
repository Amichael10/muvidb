import { createHash } from 'node:crypto';

/**
 * Cloudinary credentials with key rotation, following the same shape as
 * `yt_service.ts`: numbered env vars form a pool, and a dead credential rotates
 * to the next one so the effective quota is the sum across accounts.
 *
 * Cloudinary needs three values, not one — `cloud_name`, `api_key` and
 * `api_secret` — and a key/secret pair only works against its own cloud. Two
 * layouts are supported:
 *
 *   - Separate accounts: set CLOUDINARY_CLOUD_NAME_1..n alongside each key pair.
 *     This is the layout that actually multiplies the add-on quota.
 *   - One account, several key pairs: set a single CLOUDINARY_CLOUD_NAME and it
 *     applies to every pair. Note that background-removal quota is metered per
 *     account, so rotating within one cloud does NOT raise the ceiling.
 */
export type CloudinaryCredential = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  /** Human-readable slot for log lines; never contains the secret. */
  label: string;
};

const MAX_CREDENTIAL_SLOTS = 10;

export function collectCloudinaryCredentials(
  env: NodeJS.ProcessEnv = process.env,
): CloudinaryCredential[] {
  const sharedCloud = (env.CLOUDINARY_CLOUD_NAME || '').trim();
  const credentials: CloudinaryCredential[] = [];
  const seen = new Set<string>();

  const push = (slot: string, cloudName: string, apiKey: string, apiSecret: string) => {
    const cloud = (cloudName || sharedCloud).trim();
    const key = (apiKey || '').trim();
    const secret = (apiSecret || '').trim();
    if (!cloud || !key || !secret) return;

    const dedupe = `${cloud}:${key}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);

    credentials.push({ cloudName: cloud, apiKey: key, apiSecret: secret, label: `${cloud}#${slot}` });
  };

  push('0', env.CLOUDINARY_CLOUD_NAME || '', env.CLOUDINARY_API_KEY || '', env.CLOUDINARY_API_SECRET || '');

  for (let i = 1; i <= MAX_CREDENTIAL_SLOTS; i++) {
    push(
      String(i),
      env[`CLOUDINARY_CLOUD_NAME_${i}`] || '',
      env[`CLOUDINARY_API_KEY_${i}`] || '',
      env[`CLOUDINARY_API_SECRET_${i}`] || '',
    );
  }

  return credentials;
}

/**
 * Cloudinary's signed-upload algorithm: every parameter except `file`,
 * `cloud_name`, `resource_type` and `api_key`, sorted by key, joined as
 * `k=v&k=v`, with the API secret appended, then SHA-1 hex.
 */
export function signCloudinaryParams(
  params: Record<string, string | number | boolean | undefined>,
  apiSecret: string,
): string {
  const EXCLUDED = new Set(['file', 'cloud_name', 'resource_type', 'api_key', 'signature']);

  const payload = Object.keys(params)
    .filter(key => !EXCLUDED.has(key))
    .filter(key => params[key] !== undefined && params[key] !== '')
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');

  return createHash('sha1').update(`${payload}${apiSecret}`).digest('hex');
}

/**
 * Whether a Cloudinary failure means "this credential is spent, try the next".
 * 420/429 are Cloudinary's rate-limit codes; the add-on returns a 400 whose body
 * names the exhausted quota. Anything else is a genuine request error where
 * rotating would just burn the remaining credentials.
 */
export function isExhaustedCredentialError(status: number, body: string): boolean {
  if (status === 420 || status === 429) return true;
  if (status === 401 || status === 403) return true;
  if (status === 400 && /quota|limit|exceeded|usage/i.test(body)) return true;
  return false;
}

export function cloudinaryUploadUrl(cloudName: string): string {
  return `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`;
}

/**
 * Delivery transformation for a portrait cut-out. All three steps are load
 * bearing — see docs/social-templates/README.md:
 *
 *   e_background_removal  the cut-out itself. The plain asset URL still
 *                         contains the original background even once the
 *                         add-on reports `complete`; only this returns alpha.
 *   e_trim                drops transparent padding, otherwise the subject
 *                         renders offset by empty pixels.
 *   c_fill,ar_1:2,g_face  re-crops to a tall portrait. Card layouts cap the
 *                         subject by WIDTH, so a square source can only ever
 *                         reach ~47% of card height; 1:2 reaches ~95%.
 */
export const CUTOUT_TRANSFORMATION = 'e_background_removal/e_trim/c_fill,ar_1:2,g_face';

function basicAuth(credential: CloudinaryCredential): string {
  return Buffer.from(`${credential.apiKey}:${credential.apiSecret}`).toString('base64');
}

async function destroyAsset(credential: CloudinaryCredential, publicId: string): Promise<void> {
  const timestamp = Math.floor(Date.now() / 1000);
  const form = new FormData();
  form.set('public_id', publicId);
  form.set('timestamp', String(timestamp));
  form.set('api_key', credential.apiKey);
  form.set('signature', signCloudinaryParams({ public_id: publicId, timestamp }, credential.apiSecret));

  try {
    await fetch(`https://api.cloudinary.com/v1_1/${credential.cloudName}/image/destroy`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    // The source upload is disposable; a failed cleanup only costs free-tier
    // storage and must not fail the cut-out that already succeeded.
  }
}

export type CutoutResult = {
  png: Buffer;
  credentialLabel: string;
  publicId: string;
};

/**
 * Produces a background-removed portrait for one image URL, rotating across
 * configured Cloudinary accounts when a credential is rate-limited or spent.
 *
 * The uploaded source is destroyed afterwards: the free plan meters storage and
 * objects, and the cut-out is mirrored into Supabase storage by the caller.
 */
export async function generateCutout(
  imageUrl: string,
  options: { credentials?: CloudinaryCredential[]; pollMs?: number; maxPolls?: number } = {},
): Promise<CutoutResult> {
  const credentials = options.credentials ?? collectCloudinaryCredentials();
  if (!credentials.length) {
    throw new Error('No Cloudinary credentials configured (need CLOUDINARY_CLOUD_NAME_n + API key/secret)');
  }

  const pollMs = options.pollMs ?? 3000;
  const maxPolls = options.maxPolls ?? 15;
  let lastError = '';

  for (const credential of credentials) {
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = `social-cutout/${timestamp}-${Math.random().toString(36).slice(2, 10)}`;
    const params = { background_removal: 'cloudinary_ai', public_id: publicId, timestamp };

    const form = new FormData();
    form.set('file', imageUrl);
    form.set('api_key', credential.apiKey);
    form.set('timestamp', String(timestamp));
    form.set('public_id', publicId);
    form.set('background_removal', 'cloudinary_ai');
    form.set('signature', signCloudinaryParams(params, credential.apiSecret));

    const upload = await fetch(cloudinaryUploadUrl(credential.cloudName), {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(60_000),
    });

    if (!upload.ok) {
      const body = await upload.text();
      lastError = `${upload.status} ${body.slice(0, 200)}`;
      if (isExhaustedCredentialError(upload.status, body) && credentials.length > 1) {
        console.warn(`[cutout] credential ${credential.label} unusable (${upload.status}), rotating…`);
        continue;
      }
      throw new Error(`Cloudinary upload failed: ${lastError}`);
    }

    // Background removal runs asynchronously after the upload returns.
    let status = 'pending';
    for (let attempt = 0; attempt < maxPolls && status !== 'complete'; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollMs));
      const probe = await fetch(
        `https://api.cloudinary.com/v1_1/${credential.cloudName}/resources/image/upload/${encodeURIComponent(publicId)}`,
        { headers: { Authorization: `Basic ${basicAuth(credential)}` }, signal: AbortSignal.timeout(20_000) },
      );
      if (!probe.ok) continue;
      const detail: any = await probe.json();
      status = detail?.info?.background_removal?.cloudinary_ai?.status ?? 'pending';
      if (status === 'failed') break;
    }

    if (status !== 'complete') {
      await destroyAsset(credential, publicId);
      throw new Error(`Background removal did not complete (status: ${status})`);
    }

    const delivery = `https://res.cloudinary.com/${credential.cloudName}/image/upload/${CUTOUT_TRANSFORMATION}/${publicId}.png`;
    const rendered = await fetch(delivery, { signal: AbortSignal.timeout(60_000) });
    if (!rendered.ok) {
      await destroyAsset(credential, publicId);
      throw new Error(`Cut-out delivery failed: HTTP ${rendered.status}`);
    }

    const png = Buffer.from(await rendered.arrayBuffer());
    await destroyAsset(credential, publicId);

    if (png.length < 1024 || png.readUInt32BE(0) !== 0x89504e47) {
      throw new Error('Cut-out delivery did not return a PNG');
    }

    return { png, credentialLabel: credential.label, publicId };
  }

  throw new Error(`All ${credentials.length} Cloudinary credentials unusable (${lastError})`);
}
