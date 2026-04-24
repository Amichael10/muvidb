import type { VercelRequest } from '@vercel/node';
import { supabase } from './supabase';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Validates either:
 * 1. The native Vercel Cron/manual Authorization header with CRON_SECRET
 * 2. A x-cron-secret header with CRON_SECRET
 * 3. A Supabase Access Token from an Admin user
 */
export async function isValidAuth(req: VercelRequest): Promise<boolean> {
  if (!req?.headers) {
    console.error('Auth check: [CRITICAL] Request headers are missing.');
    return false;
  }
  const authHeader = req.headers['authorization'];
  const cronSecretHeader = req.headers['x-cron-secret'];
  
  // 1 & 2: Check CRON_SECRET bypass
  if (CRON_SECRET) {
    if (cronSecretHeader === CRON_SECRET) return true;
    if (authHeader === `Bearer ${CRON_SECRET}`) return true;
  }

  // 3: Verify Supabase Session
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    
    if (!token || token === 'undefined') {
      console.warn('Auth check: Token is empty or undefined');
      return false;
    }

    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error) {
        console.error('Auth check: Supabase verification failed:', error.message);
        return false;
      }

      if (user) {
        const defaultAdminEmail = 'amichaelwale@gmail.com';
        const role = user.user_metadata?.role || 'fan';
        
        console.log(`Auth check: [SUCCESS] User: ${user.email} | Role: ${role}`);

        if (user.email === defaultAdminEmail || role === 'admin' || role === 'pro') {
          return true;
        } else {
          console.warn(`Auth check: [FORBIDDEN] ${user.email} lacks admin/pro role.`);
        }
      }
    } catch (e: any) {
      console.error('Auth check: [EXCEPTION]', e.message);
    }
  } else {
    console.warn('Auth check: [MISSING] No Bearer token in Authorization header. Headers received:', Object.keys(req.headers));
  }

  return false;
}
