import crypto from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './supabase.js';

export interface ApiKeyRecord {
  id: string;
  name: string;
  key_prefix: string;
  tier: string;
  scopes: string[];
  rate_limit_per_min: number;
  usage_count: number;
  last_used_at: string | null;
  is_active: boolean;
}

export interface AuthResult {
  authenticated: boolean;
  statusCode?: number;
  error?: string;
  message?: string;
  key?: ApiKeyRecord;
}

/**
 * Extract raw API key from request headers or query params.
 * Supports:
 *  - Header: `x-api-key: muvi_live_...`
 *  - Header: `Authorization: Bearer muvi_live_...`
 *  - Query: `?api_key=muvi_live_...`
 */
export function extractApiKey(req: VercelRequest): string | null {
  const headerKey = req.headers['x-api-key'] || req.headers['x-muvi-key'];
  if (headerKey && typeof headerKey === 'string') {
    return headerKey.trim();
  }

  const authHeader = req.headers['authorization'];
  if (authHeader && typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  const queryKey = req.query?.api_key;
  if (queryKey && typeof queryKey === 'string') {
    return queryKey.trim();
  }

  return null;
}

/**
 * Hash raw key using SHA-256 for secure database lookup.
 */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey.trim()).digest('hex');
}

/**
 * Authenticate incoming request and verify required permission scope.
 */
export async function requireApiKey(
  req: VercelRequest,
  res: VercelResponse,
  requiredScope?: string
): Promise<ApiKeyRecord | null> {
  const rawKey = extractApiKey(req);

  if (!rawKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing API key. Provide your key via the "x-api-key" header or "Authorization: Bearer <key>".',
      docs: 'https://muvidb.com/admin/api-keys'
    });
    return null;
  }

  const keyHash = hashApiKey(rawKey);

  try {
    const { data: keyRecord, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, tier, scopes, rate_limit_per_min, usage_count, last_used_at, is_active')
      .eq('key_hash', keyHash)
      .maybeSingle();

    if (error) {
      console.error('[api_key_guard] DB error:', error);
      res.status(500).json({ error: 'Authentication service temporarily unavailable' });
      return null;
    }

    if (!keyRecord) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key provided.',
      });
      return null;
    }

    if (!keyRecord.is_active) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'This API key has been revoked or deactivated.',
      });
      return null;
    }

    // Check scope permission
    if (requiredScope) {
      const allowedScopes: string[] = keyRecord.scopes || [];
      const hasWildcard = allowedScopes.includes('*') || allowedScopes.includes('admin');
      const hasScope = allowedScopes.includes(requiredScope);

      if (!hasWildcard && !hasScope) {
        res.status(403).json({
          error: 'Forbidden',
          message: `Your API key does not have the required permission scope: '${requiredScope}'.`,
          available_scopes: allowedScopes,
          required_scope: requiredScope,
        });
        return null;
      }
    }

    // Update usage statistics asynchronously without blocking the response
    Promise.resolve(
      supabase
        .from('api_keys')
        .update({
          usage_count: (keyRecord.usage_count || 0) + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq('id', keyRecord.id)
    ).catch((err: any) => console.warn('[api_key_guard] Failed to update key usage:', err));

    return keyRecord as ApiKeyRecord;
  } catch (err: any) {
    console.error('[api_key_guard] Unexpected error:', err);
    res.status(500).json({ error: 'Internal authentication error' });
    return null;
  }
}
