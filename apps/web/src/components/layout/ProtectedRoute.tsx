import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '@kosmatch/shared';
import { useAuthStore } from '../../stores/authStore';

/** Redirects anonymous users to /login?redirect=<origin>; wrong roles go home. */
export function ProtectedRoute({ role }: { role?: Role }) {
  const { token, user } = useAuthStore();
  const location = useLocation();
  if (!token || !user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <Outlet />;
}
