import { Router } from 'express';
import { materialRequirementsController } from './material-requirements.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import { requirePermission } from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { asyncHandler } from '../../core/middleware/async-handler.middleware.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';
import {
  calculateRequirementsSchema,
  createReservationSchema,
  releaseReservationSchema,
  queryShortageSchema
} from './material-requirements.validator.js';

export const materialRequirementsRouter = Router();

// 1. Calculate Requirements across planned work
materialRequirementsRouter.post(
  '/calculate',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_SCHEDULE_VIEW),
  validateRequest(calculateRequirementsSchema),
  asyncHandler(materialRequirementsController.calculate)
);

// 2. Query Material Shortages
materialRequirementsRouter.get(
  '/shortages',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_SCHEDULE_VIEW),
  validateRequest(queryShortageSchema),
  asyncHandler(materialRequirementsController.getShortages)
);

// 3. Atomically Reserve Material (Heat Lot or Stock Item)
materialRequirementsRouter.post(
  '/reserve',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_SCHEDULE_MANAGE),
  validateRequest(createReservationSchema),
  asyncHandler(materialRequirementsController.reserve)
);

// 4. Release Material Reservation
materialRequirementsRouter.post(
  '/reservations/:id/release',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_SCHEDULE_MANAGE),
  validateRequest(releaseReservationSchema),
  asyncHandler(materialRequirementsController.release)
);

// 5. Get Active Reservations by Plan ID
materialRequirementsRouter.get(
  '/reservations/plan/:planId',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_SCHEDULE_VIEW),
  asyncHandler(materialRequirementsController.getByPlan)
);
