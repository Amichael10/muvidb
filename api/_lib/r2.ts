import crypto from 'crypto';

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl?: string;
}

function getR2Config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID || '';
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
  const bucketName = process.env.R2_BUCKET_NAME || '';
  const publicUrl = process.env.R2_PUBLIC_URL || '';

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error(
      'Cloudflare R2 environment variables missing. Please configure R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME.'
    );
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl };
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Uploads a file buffer directly to Cloudflare R2 using AWS Signature Version 4.
 * Uses 100% native Node.js crypto and fetch — ZERO external dependencies.
 */
export async function uploadToR2(
  fileName: string,
  fileBytes: Buffer,
  mimeType: string
): Promise<{ url: string; key: string; sizeMb: number }> {
  const config = getR2Config();
  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
  const region = 'auto';
  const service = 's3';

  const cleanKey = fileName.replace(/^\/+/, '');
  const path = `/${config.bucketName}/${cleanKey}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);

  const payloadHash = sha256Hex(fileBytes);

  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const canonicalHeaders =
    `content-type:${mimeType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest =
    `PUT\n` +
    `${path}\n` +
    `\n` +
    `${canonicalHeaders}\n` +
    `${signedHeaders}\n` +
    `${payloadHash}`;

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign =
    `${algorithm}\n` +
    `${amzDate}\n` +
    `${credentialScope}\n` +
    `${sha256Hex(canonicalRequest)}`;

  const kDate = hmacSha256(`AWS4${config.secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = hmacSha256(kSigning, stringToSign).toString('hex');

  const authorizationHeader =
    `${algorithm} ` +
    `Credential=${config.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, ` +
    `Signature=${signature}`;

  const uploadUrl = `${endpoint}${path}`;
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': mimeType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization: authorizationHeader,
    },
    body: fileBytes,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Cloudflare R2 upload failed (${response.status}): ${errText}`);
  }

  const publicBase = config.publicUrl
    ? config.publicUrl.replace(/\/+$/, '')
    : `https://${config.bucketName}.${config.accountId}.r2.cloudflarestorage.com`;

  const publicUrl = `${publicBase}/${cleanKey}`;

  return {
    url: publicUrl,
    key: cleanKey,
    sizeMb: Number((fileBytes.length / (1024 * 1024)).toFixed(2)),
  };
}

/**
 * Deletes an object from Cloudflare R2
 */
export async function deleteFromR2(fileName: string): Promise<boolean> {
  try {
    const config = getR2Config();
    const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
    const region = 'auto';
    const service = 's3';

    const cleanKey = fileName.replace(/^\/+/, '');
    const path = `/${config.bucketName}/${cleanKey}`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);

    const payloadHash = sha256Hex('');
    const host = `${config.accountId}.r2.cloudflarestorage.com`;
    const canonicalHeaders =
      `host:${host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

    const canonicalRequest =
      `DELETE\n` +
      `${path}\n` +
      `\n` +
      `${canonicalHeaders}\n` +
      `${signedHeaders}\n` +
      `${payloadHash}`;

    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign =
      `${algorithm}\n` +
      `${amzDate}\n` +
      `${credentialScope}\n` +
      `${sha256Hex(canonicalRequest)}`;

    const kDate = hmacSha256(`AWS4${config.secretAccessKey}`, dateStamp);
    const kRegion = hmacSha256(kDate, region);
    const kService = hmacSha256(kRegion, service);
    const kSigning = hmacSha256(kService, 'aws4_request');
    const signature = hmacSha256(kSigning, stringToSign).toString('hex');

    const authorizationHeader =
      `${algorithm} ` +
      `Credential=${config.accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, ` +
      `Signature=${signature}`;

    const res = await fetch(`${endpoint}${path}`, {
      method: 'DELETE',
      headers: {
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        Authorization: authorizationHeader,
      },
    });

    return res.ok || res.status === 204;
  } catch (err) {
    console.error('Failed to delete from R2:', err);
    return false;
  }
}
