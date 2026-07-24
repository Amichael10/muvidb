import { Outlet } from 'react-router';
import ProtectedRoute from '../components/routing/ProtectedRoute';

/** Pathless layout route: the admin dashboard (full or limited admins). */
export default function RequireAdmin() {
  return (
    <ProtectedRoute allowedRoles={['admin', 'admin_limited']}>
      <Outlet />
    </ProtectedRoute>
  );
}
