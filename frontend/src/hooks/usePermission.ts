import { useAuth } from './useAuth.js';

export function usePermission() {
  const { user } = useAuth();

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    const isPrivilegedRole = (user.roles || []).some((r) =>
      ['ADMIN', 'SUPERADMIN', 'PLANT_MANAGER', 'OPERATIONS_DIRECTOR'].includes(r.toUpperCase())
    );
    if (isPrivilegedRole) return true;
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
      (permission === 'production:batch_order:create' && user.permissions?.includes('BATCH_ORDER_CREATE')) ||
      (permission === 'BATCH_ORDER_CREATE' && user.permissions?.includes('production:batch_order:create')) ||
      (permission === 'production:batch_order:view' && user.permissions?.includes('BATCH_ORDER_VIEW')) ||
      (permission === 'BATCH_ORDER_VIEW' && user.permissions?.includes('production:batch_order:view')) ||
      (permission === 'production:job:create' && user.permissions?.includes('PRODUCTION_JOB_CREATE')) ||
      (permission === 'PRODUCTION_JOB_CREATE' && user.permissions?.includes('production:job:create')) ||
      (permission === 'production:job:view' && user.permissions?.includes('PRODUCTION_JOB_VIEW')) ||
      (permission === 'PRODUCTION_JOB_VIEW' && user.permissions?.includes('production:job:view')) ||
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
