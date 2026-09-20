import crypto from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './supabase.js';
import { handleCors } from './cors.js';

export async function handleApiKeysAdmin(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  // 1. GET: List all API keys
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('id, name, key_prefix, tier, scopes, rate_limit_per_min, usage_count, last_used_at, is_active, created_at, revoked_at')
        .order('created_at', { ascending: false });

      if (error) {
        // Table might not exist yet or lacks permissions
        if (
          error.code === 'PGRST205' ||
          error.code === '42501' ||
          error.message?.includes('does not exist') ||
          error.message?.includes('permission denied')
        ) {
          return res.status(200).json({
            keys: [],
            needs_migration: true,
            message: 'api_keys table requires database permissions. Run the migration SQL in Supabase SQL editor.'
          });
        }
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ keys: data || [] });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to fetch API keys' });
    }
  }

  // 2. POST: Generate new API key
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const { name, tier = 'free', scopes = ['films:read'], rate_limit_per_min = 60 } = body;

      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({ error: 'A valid organization or client name is required' });
      }

      if (!Array.isArray(scopes) || scopes.length === 0) {
        return res.status(400).json({ error: 'At least one permission scope must be selected' });
      }

      // Generate random secure token
      const randomPart = crypto.randomBytes(16).toString('hex');
      const rawKey = `muvi_live_${randomPart}`;
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
      const keyPrefix = `${rawKey.slice(0, 14)}...${rawKey.slice(-4)}`;

      const newKeyPayload = {
        name: name.trim(),
        key_hash: keyHash,
        key_prefix: keyPrefix,
        tier: ['free', 'pro', 'enterprise'].includes(tier) ? tier : 'free',
        scopes: scopes.filter(Boolean),
        rate_limit_per_min: Math.max(1, Math.min(Number(rate_limit_per_min) || 60, 10000)),
        usage_count: 0,
        is_active: true,
      };

      const { data, error } = await supabase
        .from('api_keys')
        .insert([newKeyPayload])
        .select('id, name, key_prefix, tier, scopes, rate_limit_per_min, usage_count, is_active, created_at')
        .single();

      if (error) {
        if (error.code === '42501' || error.message?.includes('permission denied')) {
          return res.status(403).json({
            error: 'Database permission denied for table public.api_keys. Run the migration SQL in Supabase SQL editor: GRANT ALL ON TABLE public.api_keys TO postgres, service_role, authenticated;',
            needs_migration: true
          });
        }
        return res.status(500).json({ error: error.message });
      }

      // Return the raw key ONCE so user can copy it
      return res.status(201).json({
        success: true,
        api_key: rawKey,
        key_record: data,
        message: 'API Key generated successfully. Copy it now, as it will never be displayed again.',
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to generate API key' });
    }
  }

  // 3. PATCH: Revoke or reactivate key, or update details (tier, scopes, rate limit, name)
  if (req.method === 'PATCH') {
    try {
      const { id, name, tier, is_active, scopes, rate_limit_per_min } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Missing key id' });

      const updates: Record<string, any> = {};
      if (typeof name === 'string' && name.trim().length >= 2) {
        updates.name = name.trim();
      }
      if (typeof tier === 'string' && ['free', 'pro', 'enterprise'].includes(tier.toLowerCase())) {
        updates.tier = tier.toLowerCase();
      }
      if (typeof is_active === 'boolean') {
        updates.is_active = is_active;
        if (!is_active) {
          updates.revoked_at = new Date().toISOString();
        } else {
          updates.revoked_at = null;
        }
      }
      if (Array.isArray(scopes)) updates.scopes = scopes.filter(Boolean);
      if (rate_limit_per_min !== undefined) {
        updates.rate_limit_per_min = Math.max(1, Math.min(Number(rate_limit_per_min) || 60, 10000));
      }

      const { data, error } = await supabase
        .from('api_keys')
        .update(updates)
        .eq('id', id)
        .select('id, name, key_prefix, tier, scopes, rate_limit_per_min, usage_count, is_active, created_at, revoked_at')
        .single();

      if (error) {
        if (error.code === '42501' || error.message?.includes('permission denied')) {
          return res.status(403).json({
            error: 'Database permission denied for table public.api_keys. Run the migration SQL in Supabase SQL editor: GRANT ALL ON TABLE public.api_keys TO postgres, service_role, authenticated;',
            needs_migration: true
          });
        }
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ success: true, key: data });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to update key' });
    }
  }

  // 4. DELETE: Permanently delete key
  if (req.method === 'DELETE') {
    try {
      const id = req.query.id || req.body?.id;
      if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing key id' });

      const { error } = await supabase.from('api_keys').delete().eq('id', id);
      if (error) {
        if (error.code === '42501' || error.message?.includes('permission denied')) {
          return res.status(403).json({
            error: 'Database permission denied for table public.api_keys. Run the migration SQL in Supabase SQL editor: GRANT ALL ON TABLE public.api_keys TO postgres, service_role, authenticated;',
            needs_migration: true
          });
        }
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ success: true, message: 'API key permanently removed' });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to delete key' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
