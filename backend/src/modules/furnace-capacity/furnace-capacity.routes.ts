import { Router } from 'express';
import { furnaceCapacityController } from './furnace-capacity.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import { requirePermission } from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { asyncHandler } from '../../core/middleware/async-handler.middleware.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';
import {
  createFurnaceSchema,
  compatibilityCheckSchema,
  bookFurnaceCapacitySchema,
  queryFurnaceSchema,
  queryUtilizationSchema
} from './furnace-capacity.validator.js';

export const furnaceRouter = Router();
export const furnaceCapacityRouter = Router();

// --- Furnace Equipment Master Routes ---

furnaceRouter.get(
  '/',
  authenticateJwt,
  requirePermission(PERMISSIONS.MACHINES_FURNACE_VIEW),
  validateRequest(queryFurnaceSchema),
  asyncHandler(furnaceCapacityController.getFurnaces)
);

furnaceRouter.post(
  '/',
  authenticateJwt,
  requirePermission(PERMISSIONS.MACHINES_FURNACE_CONFIGURE),
  validateRequest(createFurnaceSchema),
  asyncHandler(furnaceCapacityController.createFurnace)
);

furnaceRouter.get(
  '/:id',
  authenticateJwt,
  requirePermission(PERMISSIONS.MACHINES_FURNACE_VIEW),
  asyncHandler(furnaceCapacityController.getFurnaceById)
);

// --- Furnace Capacity & Allocation Routes ---

furnaceCapacityRouter.post(
  '/check-compatibility',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_SCHEDULE_VIEW),
  validateRequest(compatibilityCheckSchema),
  asyncHandler(furnaceCapacityController.checkCompatibility)
);

furnaceCapacityRouter.get(
  '/utilization',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_SCHEDULE_VIEW),
  validateRequest(queryUtilizationSchema),
  asyncHandler(furnaceCapacityController.getUtilization)
);

furnaceCapacityRouter.post(
  '/book',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_SCHEDULE_MANAGE),
  validateRequest(bookFurnaceCapacitySchema),
  asyncHandler(furnaceCapacityController.bookCapacity)
);

furnaceCapacityRouter.delete(
  '/allocations/:id',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_SCHEDULE_MANAGE),
  asyncHandler(furnaceCapacityController.releaseAllocation)
);
