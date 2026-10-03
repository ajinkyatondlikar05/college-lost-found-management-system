import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function PrivateRoute({ children }) {
  const { user, loading, isLoggingOut } = useAuth();
  if (isLoggingOut) return <Navigate to="/" replace />;
  if (loading) return <div className="loading-page"><div className="spinner"></div></div>;
  if (!user) return <Navigate to="/user/login" replace />;
  if (user.role !== 'admin' && user.status !== 'approved') {
    return <Navigate to="/user/login" replace />;
  }
  return children;
}

export function AdminRoute({ children }) {
  const { user, loading, isLoggingOut } = useAuth();
  if (isLoggingOut) return <Navigate to="/" replace />;
  if (loading) return <div className="loading-page"><div className="spinner"></div></div>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
