import crypto from 'crypto';

interface ServiceAccountToken {
  token: string;
  expiresAt: number;
}

let cachedToken: ServiceAccountToken | null = null;

/**
 * Obtains a Google Drive Bearer Access Token.
 * Prioritizes GOOGLE_REFRESH_TOKEN (User OAuth with paid Google One storage).
 * Falls back to Service Account JWT if refresh token is not configured.
 * Uses 100% native Node.js crypto and fetch — ZERO external dependencies.
 */
async function getGoogleDriveAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.token;
  }

  // 1. Prioritize User OAuth Refresh Token (uses personal/paid Google One storage)
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (refreshToken && clientId && clientSecret) {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Failed to refresh Google Drive access token: ${tokenResponse.status} ${errorText}`);
    }

    const tokenData = (await tokenResponse.json()) as { access_token: string; expires_in: number };
    cachedToken = {
      token: tokenData.access_token,
      expiresAt: now + (tokenData.expires_in || 3600),
    };

    return cachedToken.token;
  }

  // 2. Fallback to Service Account JWT
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';
  privateKey = privateKey.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error('Google Drive credentials not configured in environment variables (missing GOOGLE_REFRESH_TOKEN or GOOGLE_SERVICE_ACCOUNT_EMAIL)');
  }

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const claimSet = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const base64UrlEncode = (str: string) =>
    Buffer.from(str)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaimSet = base64UrlEncode(JSON.stringify(claimSet));
  const signatureInput = `${encodedHeader}.${encodedClaimSet}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signatureInput);
  const signature = signer
    .sign(privateKey, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${signatureInput}.${signature}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Failed to obtain Google Drive service account token: ${tokenResponse.status} ${errorText}`);
  }

  const tokenData = (await tokenResponse.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: tokenData.access_token,
    expiresAt: now + (tokenData.expires_in || 3600),
  };

  return cachedToken.token;
}

/**
 * Creates a resumable direct upload URL to allow client-side streaming directly to Google Drive.
 * Completely bypasses Vercel 4.5MB request body limits.
 */
export async function createDriveUploadSession(
  fileName: string,
  mimeType: string,
  fileSize: number
): Promise<string> {
  const token = await getGoogleDriveAccessToken();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': fileSize.toString(),
      },
      body: JSON.stringify({
        name: `temp_${Date.now()}_${fileName}`,
        parents: folderId ? [folderId] : undefined,
      }),
    }
  );

  const uploadUrl = res.headers.get('location');
  if (!uploadUrl) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Failed to generate Google Drive resumable upload URL: ${errText || res.statusText}`);
  }
  return uploadUrl;
}

/**
 * Fetches stream of the video to send to Instagram/TikTok/YouTube
 */
export async function getVideoStreamFromDrive(fileId: string): Promise<Response> {
  const token = await getGoogleDriveAccessToken();
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to stream file ${fileId} from Drive: ${res.statusText}`);
  }

  return res;
}

/**
 * Immediately deletes the video from Google Drive after posting to maintain 0 MB usage
 */
export async function deleteVideoFromDrive(fileId: string): Promise<void> {
  try {
    const token = await getGoogleDriveAccessToken();
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (res.ok) {
      console.log(`[GoogleDrive] Successfully deleted temporary file: ${fileId}`);
    } else {
      console.error(`[GoogleDrive] Failed to delete file ${fileId}: ${res.statusText}`);
    }
  } catch (error) {
    console.error(`[GoogleDrive] Failed to delete file ${fileId}:`, error);
  }
}
