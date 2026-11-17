import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  signJwt,
  verifyJwt,
  generateAuthCode,
  generateAccessToken,
  verifyPkce,
  verifyMcpToken
} from '../../../api/_lib/mcp/auth.js';

describe('OAuth & PKCE Security for MCP', () => {
  const secret = 'test-secret-key-12345';

  it('signs and verifies JWT tokens with HS256', () => {
    const payload = { sub: 'usr_123', email: 'fan@muvidb.com', role: 'fan' };
    const token = signJwt(payload, secret);

    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);

    const verified = verifyJwt<typeof payload>(token, secret);
    expect(verified).not.toBeNull();
    expect(verified?.sub).toBe('usr_123');
    expect(verified?.email).toBe('fan@muvidb.com');
  });

  it('verifies PKCE challenge and verifier according to RFC 7636', () => {
    // Generate code_verifier
    const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    // S256 challenge = BASE64URL(SHA256(verifier))
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier, 'ascii')
      .digest('base64url');

    const isValid = verifyPkce(codeVerifier, codeChallenge, 'S256');
    expect(isValid).toBe(true);

    const isInvalid = verifyPkce('wrong_verifier', codeChallenge, 'S256');
    expect(isInvalid).toBe(false);
  });

  it('generates and validates OAuth authorization code with embedded PKCE challenge', () => {
    const codeChallenge = 'test-challenge-xyz';
    const code = generateAuthCode(
      {
        userId: 'usr_fan_456',
        email: 'fan2@muvidb.com',
        role: 'fan',
        clientId: 'chatgpt',
        redirectUri: 'https://chatgpt.com/connector_platform_oauth_redirect',
        codeChallenge
      },
      secret
    );

    const verified = verifyJwt<any>(code, secret);
    expect(verified).not.toBeNull();
    expect(verified?.type).toBe('oauth_code');
    expect(verified?.userId).toBe('usr_fan_456');
    expect(verified?.codeChallenge).toBe(codeChallenge);
    expect(verified?.redirectUri).toBe('https://chatgpt.com/connector_platform_oauth_redirect');
  });

  it('generates access and refresh tokens for MCP clients', () => {
    const tokens = generateAccessToken(
      {
        userId: 'usr_fan_789',
        email: 'fan3@muvidb.com',
        role: 'fan',
        clientId: 'chatgpt'
      },
      secret
    );

    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
    expect(tokens.expiresIn).toBe(60 * 86400);

    const verifiedAccess = verifyJwt<any>(tokens.accessToken, secret);
    expect(verifiedAccess?.sub).toBe('usr_fan_789');
    expect(verifiedAccess?.scope).toBe('mcp:tools');
    expect(verifiedAccess?.type).toBe('mcp_access_token');
  });
});
