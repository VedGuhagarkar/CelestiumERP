import { useAuth } from './useAuth.js';

export function usePermission() {
  const { user } = useAuth();

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.permissions?.includes('SYSTEM_ADMIN')) return true;
    return user.permissions?.includes(permission) || false;
  };

  const hasAnyPermission = (permissions: string[]): boolean => {
    if (!user) return false;
    if (user.permissions?.includes('SYSTEM_ADMIN')) return true;
    return permissions.some((p) => user.permissions?.includes(p));
  };

  const hasAllPermissions = (permissions: string[]): boolean => {
    if (!user) return false;
    if (user.permissions?.includes('SYSTEM_ADMIN')) return true;
    return permissions.every((p) => user.permissions?.includes(p));
  };

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    permissions: user?.permissions || []
  };
}
