import crypto from 'node:crypto';
import { getSupabase } from './db.js';

export interface McpUserSession {
  userId: string;
  email: string;
  role: 'fan' | 'professional' | 'admin' | string;
  scope?: string;
  clientId?: string;
}

export function getMcpSecret(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.JWT_SECRET ||
    process.env.SUPABASE_KEY ||
    'muvidb-mcp-production-signing-secret-2026'
  );
}

/**
 * Encodes base64url string without padding
 */
function base64url(buffer: Buffer): string {
  return buffer.toString('base64url');
}

/**
 * Standard JWT signer with HMAC-SHA256 (RFC 7519)
 */
export function signJwt(payload: Record<string, any>, secret: string = getMcpSecret()): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verifies standard JWT HMAC-SHA256 token
 */
export function verifyJwt<T = Record<string, any>>(token: string, secret: string = getMcpSecret()): T | null {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    // Constant-time comparison
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload as T;
  } catch {
    return null;
  }
}

/**
 * Verifies PKCE RFC 7636 (code_challenge vs code_verifier)
 */
export function verifyPkce(codeVerifier: string, codeChallenge: string, method: string = 'S256'): boolean {
  if (!codeVerifier || !codeChallenge) return false;
  if (method === 'plain') {
    return codeVerifier === codeChallenge;
  }
  // S256: BASE64URL-ENCODE(SHA256(ASCII(code_verifier)))
  const hash = crypto.createHash('sha256').update(codeVerifier, 'ascii').digest('base64url');
  return hash === codeChallenge;
}

/**
 * Creates an authorization code for OAuth 2.1 code exchange
 */
export function generateAuthCode(
  data: {
    userId: string;
    email: string;
    role: string;
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    codeChallengeMethod?: string;
  },
  secret: string = getMcpSecret()
): string {
  const payload = {
    ...data,
    codeChallengeMethod: data.codeChallengeMethod || 'S256',
    type: 'oauth_code',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 600 // 10 minutes validity
  };
  return signJwt(payload, secret);
}

/**
 * Creates a Bearer access token for MCP clients (valid for 60 days)
 */
export function generateAccessToken(
  user: {
    userId: string;
    email: string;
    role: string;
    clientId?: string;
  },
  secret: string = getMcpSecret()
): { accessToken: string; refreshToken: string; expiresIn: number } {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 60 * 86400; // 60 days

  const accessPayload = {
    sub: user.userId,
    email: user.email,
    role: user.role,
    clientId: user.clientId || 'chatgpt',
    iss: 'https://muvidb.com',
    aud: 'https://muvidb.com/api/mcp',
    scope: 'mcp:tools',
    type: 'mcp_access_token',
    iat: now,
    exp: now + expiresIn
  };

  const refreshPayload = {
    sub: user.userId,
    email: user.email,
    role: user.role,
    type: 'mcp_refresh_token',
    iat: now,
    exp: now + (180 * 86400) // 180 days
  };

  return {
    accessToken: signJwt(accessPayload, secret),
    refreshToken: signJwt(refreshPayload, secret),
    expiresIn
  };
}

/**
 * Verifies any Bearer token presented to the MCP server.
 * Accepts:
 * 1. MuviDB signed MCP tokens
 * 2. Supabase Auth session tokens
 */
export async function verifyMcpToken(token: string): Promise<McpUserSession | null> {
  if (!token) return null;

  // 1. Try MuviDB signed JWT
  const jwtPayload = verifyJwt<any>(token);
  if (jwtPayload && jwtPayload.sub) {
    return {
      userId: jwtPayload.sub,
      email: jwtPayload.email || '',
      role: jwtPayload.role || 'fan',
      scope: jwtPayload.scope || 'mcp:tools',
      clientId: jwtPayload.clientId
    };
  }

  // 2. Try Supabase Auth user verification
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user) {
      const u = data.user;
      return {
        userId: u.id,
        email: u.email || '',
        role: u.user_metadata?.role || 'fan',
        scope: 'mcp:tools'
      };
    }
  } catch (err) {
    console.warn('[verifyMcpToken] Supabase auth check failed:', err);
  }

  return null;
}
