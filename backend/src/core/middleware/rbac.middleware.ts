import { Request, Response, NextFunction } from 'express';
import { PermissionKey, Permissions } from '../constants/permissions.js';
import { ForbiddenError, UnauthorizedError } from '../errors/app-error.js';

/**
 * RBAC Permission Middleware
 * Reference: CelestiumERP.md Section 3.1
 */

export function requirePermission(...requiredPermissions: PermissionKey[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const userPermissions = req.user.permissions || [];

    // System Administrator role has universal bypass
    if (userPermissions.includes(Permissions.SYSTEM_ADMIN)) {
      return next();
    }

    // Check if user has at least one of the required permissions
    const hasPermission = requiredPermissions.some((perm) => userPermissions.includes(perm));

    if (!hasPermission) {
      return next(
        new ForbiddenError(`Forbidden: Missing required permission [${requiredPermissions.join(', ')}]`)
      );
    }

    next();
  };
}
