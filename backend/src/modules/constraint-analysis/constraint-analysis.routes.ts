import { Router } from 'express';
import { constraintAnalysisController } from './constraint-analysis.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import { requirePermission } from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { asyncHandler } from '../../core/middleware/async-handler.middleware.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';
import {
  evaluatePlanParamsSchema,
  factoryAuditQuerySchema
} from './constraint-analysis.validator.js';

export const constraintAnalysisRouter = Router();

// 1. Evaluate All 9 Constraint Categories for a Specific Production Plan
constraintAnalysisRouter.post(
  '/evaluate-plan/:planId',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_SCHEDULE_VIEW),
  validateRequest(evaluatePlanParamsSchema),
  asyncHandler(constraintAnalysisController.evaluatePlan)
);

// 2. Perform Factory-Wide Constraint Audit across All Active Production Plans
constraintAnalysisRouter.get(
  '/factory-audit',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_SCHEDULE_VIEW),
  validateRequest(factoryAuditQuerySchema),
  asyncHandler(constraintAnalysisController.factoryAudit)
);

// 3. Get Top Factory Bottlenecks & Category Breakdown
constraintAnalysisRouter.get(
  '/bottlenecks',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_SCHEDULE_VIEW),
  asyncHandler(constraintAnalysisController.getBottlenecks)
);
