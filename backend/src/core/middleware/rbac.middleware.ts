import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../errors/app-error.js';
import { rbacService } from '../../modules/rbac/rbac.service.js';

/**
 * RBAC Permission Authorization Middleware
 * Enforces that the authenticated user possesses the required granular permissions.
 *
 * ARCHITECTURAL CONTRACT:
 * - Must be placed AFTER `authenticateJwt` and `tenantMiddleware`.
 * - Admin role (`ADMIN`) bypasses granular checks automatically.
 * - Computes effective permissions dynamically across all active assigned roles.
 *
 * Reference: CelestiumERP.md Section 2.2
 */
export function requirePermission(...requiredPermissions: string[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required prior to authorization check'));
    }

    const tenantId = req.tenantId;
    if (!tenantId) {
      return next(new UnauthorizedError('Tenant context required for authorization check'));
    }

    const userRoles = req.user.roles || [];

    // 1. Super-Admin Fast Path
    if (userRoles.map((r) => r.toUpperCase()).includes('ADMIN')) {
      return next();
    }

    try {
      // 2. Resolve effective user permissions dynamically
      const userPerms = await rbacService.getUserEffectivePermissions(tenantId, req.user.userId, userRoles);
      const userPermSet = new Set(userPerms.permissions);

      // 3. Verify all required permissions are present
      const missingPermissions = requiredPermissions.filter((perm) => !userPermSet.has(perm));

      if (missingPermissions.length > 0) {
        return next(
          new ForbiddenError(
            `Access Denied: You lack required permission(s): ${missingPermissions.join(', ')}`
          )
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * RBAC Require Any Permission Middleware
 * Allows access if the user possesses at least ONE of the specified permissions.
 */
export function requireAnyPermission(...permissions: string[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required prior to authorization check'));
    }

    const tenantId = req.tenantId;
    if (!tenantId) {
      return next(new UnauthorizedError('Tenant context required for authorization check'));
    }

    const userRoles = req.user.roles || [];

    if (userRoles.map((r) => r.toUpperCase()).includes('ADMIN')) {
      return next();
    }

    try {
      const userPerms = await rbacService.getUserEffectivePermissions(tenantId, req.user.userId, userRoles);
      const userPermSet = new Set(userPerms.permissions);

      const hasAtLeastOne = permissions.some((perm) => userPermSet.has(perm));

      if (!hasAtLeastOne) {
        return next(
          new ForbiddenError(
            `Access Denied: Requires at least one of the following permissions: ${permissions.join(', ')}`
          )
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
