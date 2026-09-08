import { useAuth } from './useAuth.js';

export function usePermission() {
  const { user } = useAuth();

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    const hasAdminRole = (user.roles || []).some(
      (r) => r.toUpperCase() === 'ADMIN' || r.toUpperCase() === 'SUPERADMIN'
    );
    if (hasAdminRole) return true;
    if (
      user.permissions?.includes('SYSTEM_ADMIN') ||
      user.permissions?.includes('ALL') ||
      user.permissions?.includes('*')
    ) {
      return true;
    }
    return (
      user.permissions?.includes(permission) ||
      (permission === 'purchase_order:order:create' && user.permissions?.includes('PURCHASE_ORDER_CREATE')) ||
      (permission === 'PURCHASE_ORDER_CREATE' && user.permissions?.includes('purchase_order:order:create')) ||
      false
    );
  };

  const hasAnyPermission = (permissions: string[]): boolean => {
    if (!user) return false;
    const hasAdminRole = (user.roles || []).some(
      (r) => r.toUpperCase() === 'ADMIN' || r.toUpperCase() === 'SUPERADMIN'
    );
    if (hasAdminRole) return true;
    if (
      user.permissions?.includes('SYSTEM_ADMIN') ||
      user.permissions?.includes('ALL') ||
      user.permissions?.includes('*')
    ) {
      return true;
    }
    return permissions.some((p) => hasPermission(p));
  };

  const hasAllPermissions = (permissions: string[]): boolean => {
    if (!user) return false;
    const hasAdminRole = (user.roles || []).some(
      (r) => r.toUpperCase() === 'ADMIN' || r.toUpperCase() === 'SUPERADMIN'
    );
    if (hasAdminRole) return true;
    if (
      user.permissions?.includes('SYSTEM_ADMIN') ||
      user.permissions?.includes('ALL') ||
      user.permissions?.includes('*')
    ) {
      return true;
    }
    return permissions.every((p) => hasPermission(p));
  };

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    permissions: user?.permissions || []
  };
}
