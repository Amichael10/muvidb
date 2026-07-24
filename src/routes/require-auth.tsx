import { Outlet } from 'react-router';
import ProtectedRoute from '../components/routing/ProtectedRoute';

/** Pathless layout route: any logged-in user. */
export default function RequireAuth() {
  return (
    <ProtectedRoute>
      <Outlet />
    </ProtectedRoute>
  );
}
