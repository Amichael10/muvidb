import { Outlet } from 'react-router';
import ProtectedRoute from '../components/routing/ProtectedRoute';

/**
 * Pathless layout route for the admin pages that were individually wrapped in
 * a second `allowedRoles={['admin']}` guard in App.tsx — i.e. full admins only,
 * not `admin_limited`. Nested inside the admin layout so the stricter check
 * still applies on top of RequireAdmin.
 */
export default function RequireAdminStrict() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <Outlet />
    </ProtectedRoute>
  );
}
