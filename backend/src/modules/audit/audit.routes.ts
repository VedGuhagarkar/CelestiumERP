import { Router } from 'express';
import { auditController } from './audit.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import { requireAnyPermission } from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { asyncHandler } from '../../core/middleware/async-handler.middleware.js';
import { queryAuditSchema, entityHistorySchema } from './audit.validator.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';

export const auditRouter = Router();

// Query General Audit Logs
auditRouter.get(
  '/logs',
  authenticateJwt,
  requireAnyPermission(PERMISSIONS.ADMIN_TENANT_VIEW, PERMISSIONS.REPORTS_ANALYTICS_VIEW_QUALITY),
  validateRequest(queryAuditSchema),
  asyncHandler(auditController.queryAuditLogs)
);

// Query Entity-Specific Audit History
auditRouter.get(
  '/entities/:entityType/:entityId',
  authenticateJwt,
  requireAnyPermission(
    PERMISSIONS.ADMIN_TENANT_VIEW,
    PERMISSIONS.QUALITY_INSPECTION_VIEW,
    PERMISSIONS.PRODUCTION_JOB_VIEW
  ),
  validateRequest(entityHistorySchema),
  asyncHandler(auditController.getEntityHistory)
);
