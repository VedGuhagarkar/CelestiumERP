import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';

export interface ProtectedRouteProps {
  requiredPermission?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requiredPermission }) => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredPermission && user) {
    const hasPerm =
      user.permissions?.includes('SYSTEM_ADMIN') ||
      user.permissions?.includes(requiredPermission);

    if (!hasPerm) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <Outlet />;
};
