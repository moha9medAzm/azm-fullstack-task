import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { Role } from '../api/types';
import { Spinner } from '../components/Spinner';

export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Loading session…" />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
