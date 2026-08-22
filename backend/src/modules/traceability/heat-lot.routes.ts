import { Router } from 'express';
import { heatLotController } from './heat-lot.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import { requirePermission } from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { asyncHandler } from '../../core/middleware/async-handler.middleware.js';
import {
  inwardHeatLotSchema,
  allocateHeatLotSchema,
  consumeHeatLotSchema,
  quarantineHeatLotSchema,
  releaseHeatLotSchema,
  queryHeatLotSchema
} from './heat-lot.validator.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';

export const heatLotRouter = Router();

// Search & List Heat Lots
heatLotRouter.get(
  '/',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_HEAT_LOT_VIEW),
  validateRequest(queryHeatLotSchema),
  asyncHandler(heatLotController.searchHeatLots)
);

// Inward New Heat Lot
heatLotRouter.post(
  '/inward',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_HEAT_LOT_INWARD),
  validateRequest(inwardHeatLotSchema),
  asyncHandler(heatLotController.inwardHeatLot)
);

// Backward Traceability (from Job Card to Heat Lot, MTR, Supplier)
heatLotRouter.get(
  '/backward-trace',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_HEAT_LOT_VIEW),
  asyncHandler(heatLotController.backwardTrace)
);

// Forward Traceability (from Heat Lot to downstream Job Cards, batches, and customers)
heatLotRouter.get(
  '/forward-trace/:number',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_HEAT_LOT_VIEW),
  asyncHandler(heatLotController.forwardTrace)
);

// Retrieve Heat Lot by Number
heatLotRouter.get(
  '/number/:number',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_HEAT_LOT_VIEW),
  asyncHandler(heatLotController.getHeatLotByNumber)
);

// Retrieve Heat Lot by ID
heatLotRouter.get(
  '/:id',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_HEAT_LOT_VIEW),
  asyncHandler(heatLotController.getHeatLotById)
);

// Quarantine Heat Lot
heatLotRouter.patch(
  '/:id/quarantine',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_HEAT_LOT_QUARANTINE),
  validateRequest(quarantineHeatLotSchema),
  asyncHandler(heatLotController.quarantineHeatLot)
);

// Release Heat Lot
heatLotRouter.patch(
  '/:id/release',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_HEAT_LOT_RELEASE),
  validateRequest(releaseHeatLotSchema),
  asyncHandler(heatLotController.releaseHeatLot)
);

// Allocate / Reserve Heat Lot Quantity for Job Card
heatLotRouter.post(
  '/:id/allocate',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_HEAT_LOT_INWARD),
  validateRequest(allocateHeatLotSchema),
  asyncHandler(heatLotController.allocateHeatLot)
);

// Consume Heat Lot Material in Production Batch
heatLotRouter.post(
  '/:id/consume',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_HEAT_LOT_INWARD),
  validateRequest(consumeHeatLotSchema),
  asyncHandler(heatLotController.consumeHeatLot)
);
