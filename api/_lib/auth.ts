import type { VercelRequest } from '@vercel/node';
import { supabase } from './supabase.js';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Validates either:
 * 1. The native Vercel Cron/manual Authorization header with CRON_SECRET
 * 2. A x-cron-secret header with CRON_SECRET
 * 3. A Supabase Access Token from an Admin user
 */
export async function isValidAuth(req: VercelRequest): Promise<{ valid: boolean, reason?: string }> {
  if (!req?.headers) {
    console.error('Auth check: [CRITICAL] Request headers are missing.');
    return { valid: false, reason: 'Request headers are missing' };
  }
  const authHeader = req.headers['authorization'];
  const cronSecretHeader = req.headers['x-cron-secret'];
  
  if (CRON_SECRET) {
    if (cronSecretHeader === CRON_SECRET) return { valid: true };
    if (authHeader === `Bearer ${CRON_SECRET}`) return { valid: true };
  }

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    
    if (!token || token === 'undefined') {
      console.warn('Auth check: Token is empty or undefined');
      return { valid: false, reason: 'Token is empty or undefined' };
    }

    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error) {
        console.error('Auth check: Supabase verification failed:', error.message);
        return { valid: false, reason: `Supabase verification failed: ${error.message}` };
      }

      if (user) {
        let role = user.user_metadata?.role || 'fan';
        
        try {
          const { data: profile } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();
          
          if (profile?.role) {
            role = profile.role;
          }
        } catch (dbErr) {
          console.warn('Auth check: Failed to fetch role from public.users', dbErr);
        }
        
        if (role === 'admin' || role === 'admin_limited') {
          return { valid: true };
        } else {
          console.warn(`Auth check: [FORBIDDEN] ${user.email} lacks admin role. Evaluated role: ${role}`);
          return { valid: false, reason: `User lacks admin role. Evaluated role: ${role}` };
        }
      } else {
         return { valid: false, reason: 'User not found from token' };
      }
    } catch (e: any) {
      console.error('Auth check: [EXCEPTION]', e.message);
      return { valid: false, reason: `Exception: ${e.message}` };
    }
  } else {
    console.warn('Auth check: [MISSING] No Bearer token in Authorization header. Headers received:', Object.keys(req.headers));
    return { valid: false, reason: 'No Bearer token in Authorization header' };
  }

  return { valid: false, reason: 'Unknown error' };
}

