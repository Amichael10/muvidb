import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  generateAuthCode,
  generateAccessToken,
  verifyJwt,
  verifyPkce,
  verifyMcpToken
} from './_lib/mcp/auth.js';
import crypto from 'node:crypto';

export const maxDuration = 60;

/**
 * Handles OAuth 2.1 & RFC 9728 discovery and token exchange for MuviDB MCP Server.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Global CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const action = req.query.action || req.query._action;

  // 1. RFC 9728: OAuth 2.0 Protected Resource Metadata
  if (action === 'protected_resource' || req.url?.includes('oauth-protected-resource')) {
    return res.status(200).json({
      resource: 'https://muvidb.com/api/mcp',
      authorization_servers: ['https://muvidb.com'],
      scopes_supported: ['mcp:tools']
    });
  }

  // 2. RFC 8414: OAuth 2.0 Authorization Server Metadata
  if (action === 'authorization_server' || req.url?.includes('oauth-authorization-server')) {
    return res.status(200).json({
      issuer: 'https://muvidb.com',
      authorization_endpoint: 'https://muvidb.com/oauth/authorize',
      token_endpoint: 'https://muvidb.com/api/oauth/token',
      registration_endpoint: 'https://muvidb.com/api/oauth/register',
      scopes_supported: ['mcp:tools', 'offline_access'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
      code_challenge_methods_supported: ['S256']
    });
  }

  // 3. RFC 7591: Dynamic Client Registration (DCR) for ChatGPT / MCP hosts
  if (action === 'register' && req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const clientId = 'muvidb_mcp_' + crypto.randomBytes(8).toString('hex');

      return res.status(201).json({
        client_id: clientId,
        client_name: body.client_name || 'ChatGPT MCP Client',
        redirect_uris: body.redirect_uris || [
          'https://chatgpt.com/connector_platform_oauth_redirect'
        ],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none'
      });
    } catch (err: any) {
      return res.status(400).json({ error: 'invalid_client_metadata', error_description: err.message });
    }
  }

  // 4. Consent approval endpoint (called by frontend /oauth/authorize)
  if (action === 'consent' && req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const { userToken, clientId, redirectUri, codeChallenge, codeChallengeMethod, state } = body;

      if (!userToken) {
        return res.status(401).json({ error: 'unauthorized', message: 'User session required' });
      }

      const user = await verifyMcpToken(userToken);
      if (!user) {
        return res.status(401).json({ error: 'unauthorized', message: 'Invalid user session' });
      }

      if (!redirectUri) {
        return res.status(400).json({ error: 'invalid_request', message: 'redirectUri is required' });
      }

      // Generate signed authorization code with PKCE sealed inside
      const code = generateAuthCode({
        userId: user.userId,
        email: user.email,
        role: user.role,
        clientId: clientId || 'chatgpt',
        redirectUri,
        codeChallenge: codeChallenge || '',
        codeChallengeMethod: codeChallengeMethod || 'S256'
      });

      const redirectUrl = new URL(redirectUri);
      redirectUrl.searchParams.set('code', code);
      if (state) redirectUrl.searchParams.set('state', state);

      return res.status(200).json({
        success: true,
        code,
        redirectUrl: redirectUrl.toString()
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'server_error', message: err.message });
    }
  }

  // 5. Token Exchange (POST /api/oauth/token)
  if (action === 'token' || (req.method === 'POST' && !action)) {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const grantType = body.grant_type;

      // Case A: Authorization Code Exchange (with PKCE)
      if (grantType === 'authorization_code') {
        const { code, code_verifier, redirect_uri } = body;
        if (!code) {
          return res.status(400).json({ error: 'invalid_request', error_description: 'code is required' });
        }

        const codeData = verifyJwt<any>(code);
        if (!codeData || codeData.type !== 'oauth_code') {
          return res.status(400).json({ error: 'invalid_grant', error_description: 'Code is invalid or expired' });
        }

        // Verify redirect_uri matches
        if (redirect_uri && codeData.redirectUri && redirect_uri !== codeData.redirectUri) {
          return res.status(400).json({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' });
        }

        // Verify PKCE if challenge was provided
        if (codeData.codeChallenge) {
          if (!code_verifier) {
            return res.status(400).json({ error: 'invalid_request', error_description: 'code_verifier required' });
          }
          const validPkce = verifyPkce(code_verifier, codeData.codeChallenge, codeData.codeChallengeMethod);
          if (!validPkce) {
            return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
          }
        }

        const tokens = generateAccessToken({
          userId: codeData.userId,
          email: codeData.email,
          role: codeData.role,
          clientId: codeData.clientId
        });

        return res.status(200).json({
          access_token: tokens.accessToken,
          token_type: 'Bearer',
          expires_in: tokens.expiresIn,
          refresh_token: tokens.refreshToken,
          scope: 'mcp:tools'
        });
      }

      // Case B: Refresh Token Exchange
      if (grantType === 'refresh_token') {
        const { refresh_token } = body;
        const refreshData = verifyJwt<any>(refresh_token);
        if (!refreshData || refreshData.type !== 'mcp_refresh_token') {
          return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid or expired refresh token' });
        }

        const tokens = generateAccessToken({
          userId: refreshData.sub,
          email: refreshData.email,
          role: refreshData.role
        });

        return res.status(200).json({
          access_token: tokens.accessToken,
          token_type: 'Bearer',
          expires_in: tokens.expiresIn,
          refresh_token: tokens.refreshToken,
          scope: 'mcp:tools'
        });
      }

      return res.status(400).json({ error: 'unsupported_grant_type' });
    } catch (err: any) {
      return res.status(500).json({ error: 'server_error', error_description: err.message });
    }
  }

  // 6. Direct Personal Access Token creation for logged in users (Fan / Pro / Admin)
  if (action === 'create-token' && req.method === 'POST') {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'unauthorized', message: 'Authorization header required' });
      }

      const user = await verifyMcpToken(authHeader.slice(7).trim());
      if (!user) {
        return res.status(401).json({ error: 'unauthorized', message: 'Invalid session' });
      }

      const tokens = generateAccessToken({
        userId: user.userId,
        email: user.email,
        role: user.role,
        clientId: 'personal_dashboard'
      });

      return res.status(200).json({
        success: true,
        token: tokens.accessToken,
        expiresIn: tokens.expiresIn,
        user: {
          id: user.userId,
          email: user.email,
          role: user.role
        }
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'server_error', message: err.message });
    }
  }

  return res.status(404).json({ error: 'not_found' });
}
