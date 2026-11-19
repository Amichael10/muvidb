import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Client-side route guard, extracted from App.tsx so the SSR route config can
 * reuse it from layout routes (see src/routes.ts).
 *
 * Note this stays a *client* guard: under SSR `loading` is true on the server,
 * so guarded routes server-render nothing and resolve after hydration. Moving
 * the check server-side needs cookie-based Supabase auth (@supabase/ssr), which
 * is deliberately deferred — see docs/SSR_MIGRATION.md, Phase 1.
 */
export default function ProtectedRoute({
  children,
  allowedRoles = [],
}: {
  children: ReactNode;
  allowedRoles?: string[];
}) {
  const { user, loading, role } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const effectiveRole = role || user.role;

  // Crucial: If a route requires specific roles (e.g. ['admin', 'admin_limited']),
  // but the user's role has not resolved yet, do NOT prematurely kick them to /dashboard!
  // Wait on the current URL until the verified role arrives so refresh maintains state.
  if (allowedRoles.length > 0 && !effectiveRole) {
    return null;
  }

  // Force onboarding if not complete
  if (!user.onboarded && effectiveRole !== 'admin' && effectiveRole !== 'fan' && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // Prevent accessing onboarding if already complete
  if ((user.onboarded || effectiveRole === 'fan') && location.pathname === '/onboarding') {
    return <Navigate to={effectiveRole === 'professional' ? '/pro-dashboard' : '/dashboard'} replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(effectiveRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
