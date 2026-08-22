import { Router } from 'express';
import { productionPlanController } from './production-plan.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import { requirePermission } from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { asyncHandler } from '../../core/middleware/async-handler.middleware.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';
import {
  createProductionPlanSchema,
  updateProductionPlanSchema,
  updatePlanStatusSchema,
  queryProductionPlanSchema
} from './production-plan.validator.js';

export const productionPlanRouter = Router();

// 1. Search / Query Production Plans
productionPlanRouter.get(
  '/',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_SCHEDULE_VIEW),
  validateRequest(queryProductionPlanSchema),
  asyncHandler(productionPlanController.query)
);

// 2. Create Production Plan
productionPlanRouter.post(
  '/',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_SCHEDULE_MANAGE),
  validateRequest(createProductionPlanSchema),
  asyncHandler(productionPlanController.create)
);

// 3. Get Production Plan by Plan Number
productionPlanRouter.get(
  '/number/:planNumber',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_SCHEDULE_VIEW),
  asyncHandler(productionPlanController.getByNumber)
);

// 4. Get Production Plan by ID
productionPlanRouter.get(
  '/:id',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_SCHEDULE_VIEW),
  asyncHandler(productionPlanController.getById)
);

// 5. Update Production Plan Details
productionPlanRouter.put(
  '/:id',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_SCHEDULE_MANAGE),
  validateRequest(updateProductionPlanSchema),
  asyncHandler(productionPlanController.update)
);

// 6. Update Production Plan Status
productionPlanRouter.patch(
  '/:id/status',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_SCHEDULE_MANAGE),
  validateRequest(updatePlanStatusSchema),
  asyncHandler(productionPlanController.updateStatus)
);

// 7. Recalculate Material Readiness & Progress
productionPlanRouter.post(
  '/:id/recalculate',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_SCHEDULE_MANAGE),
  asyncHandler(productionPlanController.recalculate)
);
