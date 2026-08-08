import { Outlet } from 'react-router';
import ProtectedRoute from '../components/routing/ProtectedRoute';

/** Pathless layout route: professionals (and admins). */
export default function RequirePro() {
  return (
    <ProtectedRoute allowedRoles={['professional', 'admin']}>
      <Outlet />
    </ProtectedRoute>
  );
}
