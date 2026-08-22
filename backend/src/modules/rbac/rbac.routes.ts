import { Router } from 'express';
import { rbacController } from './rbac.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import { requirePermission } from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { asyncHandler } from '../../core/middleware/async-handler.middleware.js';
import { createRoleSchema, updateRoleSchema, assignRolesSchema } from './rbac.validator.js';
import { PERMISSIONS } from './rbac.constants.js';

export const rbacRouter = Router();

// Permissions Catalog & Authenticated User Permissions
rbacRouter.get('/permissions', authenticateJwt, asyncHandler(rbacController.getPermissionsCatalog));
rbacRouter.get('/me/permissions', authenticateJwt, asyncHandler(rbacController.getMyPermissions));

// Role Management Endpoints
rbacRouter.get(
  '/roles',
  authenticateJwt,
  requirePermission(PERMISSIONS.ADMIN_ROLE_VIEW),
  asyncHandler(rbacController.getRoles)
);

rbacRouter.post(
  '/roles',
  authenticateJwt,
  requirePermission(PERMISSIONS.ADMIN_ROLE_CREATE),
  validateRequest(createRoleSchema),
  asyncHandler(rbacController.createRole)
);

rbacRouter.put(
  '/roles/:id',
  authenticateJwt,
  requirePermission(PERMISSIONS.ADMIN_ROLE_UPDATE),
  validateRequest(updateRoleSchema),
  asyncHandler(rbacController.updateRole)
);

// Role Assignment to Users
rbacRouter.post(
  '/users/:userId/roles',
  authenticateJwt,
  requirePermission(PERMISSIONS.ADMIN_ROLE_ASSIGN),
  validateRequest(assignRolesSchema),
  asyncHandler(rbacController.assignRolesToUser)
);
