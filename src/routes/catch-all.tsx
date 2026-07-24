import { Navigate } from 'react-router';

/** Preserves the old `<Route path="*" element={<Navigate to="/" replace />} />`. */
export default function CatchAll() {
  return <Navigate to="/" replace />;
}
