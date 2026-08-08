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
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  // Force onboarding if not complete
  if (!user.onboarded && user.role !== 'admin' && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // Prevent accessing onboarding if already complete
  if (user.onboarded && location.pathname === '/onboarding') {
    return <Navigate to={user.role === 'professional' ? '/pro-dashboard' : '/dashboard'} replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
