import { Router } from 'express';
import { quarantineController } from './quarantine.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import { requirePermission } from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { asyncHandler } from '../../core/middleware/async-handler.middleware.js';
import {
  placeInQuarantineSchema,
  releaseQuarantineSchema,
  dispositionQuarantineSchema,
  queryQuarantineSchema
} from './quarantine.validator.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';

export const quarantineRouter = Router();

// Search Quarantine Records
quarantineRouter.get(
  '/',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_HEAT_LOT_VIEW),
  validateRequest(queryQuarantineSchema),
  asyncHandler(quarantineController.searchQuarantines)
);

// Place Material / Heat Lot / Job in Quarantine
quarantineRouter.post(
  '/',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_HEAT_LOT_QUARANTINE),
  validateRequest(placeInQuarantineSchema),
  asyncHandler(quarantineController.placeInQuarantine)
);

// Get Quarantine Record by Number
quarantineRouter.get(
  '/number/:number',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_HEAT_LOT_VIEW),
  asyncHandler(quarantineController.getQuarantineByNumber)
);

// Get Quarantine Record by ID
quarantineRouter.get(
  '/:id',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_HEAT_LOT_VIEW),
  asyncHandler(quarantineController.getQuarantineById)
);

// Release Quarantine Record back to Stock
quarantineRouter.post(
  '/:id/release',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_HEAT_LOT_RELEASE),
  validateRequest(releaseQuarantineSchema),
  asyncHandler(quarantineController.releaseFromQuarantine)
);

// Disposition Quarantine Record (Scrap / Return / Rework)
quarantineRouter.post(
  '/:id/disposition',
  authenticateJwt,
  requirePermission(PERMISSIONS.QUALITY_DISPOSITION_MANAGE),
  validateRequest(dispositionQuarantineSchema),
  asyncHandler(quarantineController.dispositionQuarantine)
);
