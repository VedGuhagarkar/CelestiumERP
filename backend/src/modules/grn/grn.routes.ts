import { Router } from 'express';
import { grnController } from './grn.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import { requirePermission, requireAnyPermission } from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { asyncHandler } from '../../core/middleware/async-handler.middleware.js';
import {
  recordMaterialReceiptSchema,
  storeMaterialSchema,
  createGrnSchema,
  queryGrnSchema,
  queryGrnUnitSchema,
  allocateUnitSchema,
  queryAvailablePlanningUnitsSchema
} from './grn.validator.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';

export const grnRouter = Router();

// 1. Material Receipt: Record arrival against PO (supports both /receipts and /material-receipts)
grnRouter.post(
  ['/receipts', '/material-receipts'],
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_STORAGE_RECORD),
  validateRequest(recordMaterialReceiptSchema),
  asyncHandler(grnController.recordMaterialReceipt)
);

// Query Material Receipts
grnRouter.get(
  ['/receipts', '/material-receipts'],
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_STORAGE_RECORD),
  asyncHandler(grnController.queryReceipts)
);

// 2. Warehouse Storage: Put away and store received material
grnRouter.post(
  ['/receipts/:id/store', '/receipts/:id/storage', '/material-receipts/:id/store', '/material-receipts/:id/storage'],
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_STORAGE_RECORD),
  validateRequest(storeMaterialSchema),
  asyncHandler(grnController.storeMaterial)
);

// 3. GRN Creation: Generate Goods Receipt Note from stored material
grnRouter.post(
  '/',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_GRN_CREATE),
  validateRequest(createGrnSchema),
  asyncHandler(grnController.createGRN)
);

// 4. Query GRNs
grnRouter.get(
  '/',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_GRN_VIEW),
  validateRequest(queryGrnSchema),
  asyncHandler(grnController.queryGRNs)
);

// 5. Query Individual Material/Part Units
grnRouter.get(
  ['/units', '/units/traceable'],
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_GRN_VIEW),
  validateRequest(queryGrnUnitSchema),
  asyncHandler(grnController.queryUnits)
);

// 6. Available for Planning Query Gate
grnRouter.get(
  ['/units/available-for-planning', '/planning-units/available'],
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_GRN_VIEW),
  validateRequest(queryAvailablePlanningUnitsSchema),
  asyncHandler(grnController.getAvailableUnitsForPlanning)
);

// 7. Individual Unit Traceability (Full 5-tier lineage: PO -> GRN -> Unit -> Item -> Recipe)
grnRouter.get(
  '/units/:unitIdentifier/traceability',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_GRN_VIEW),
  asyncHandler(grnController.getUnitTraceability)
);

// 8. Allocate Individual Unit to Downstream Planning Batch
grnRouter.post(
  ['/units/:unitIdentifier/allocate', '/planning-units/:unitIdentifier/allocate'],
  authenticateJwt,
  requireAnyPermission(
    PERMISSIONS.PRODUCTION_JOB_CREATE,
    PERMISSIONS.INVENTORY_GRN_CREATE,
    PERMISSIONS.INVENTORY_STORAGE_RECORD
  ),
  validateRequest(allocateUnitSchema),
  asyncHandler(grnController.allocateUnitForPlanning)
);

// 9. Authoritative Creation Phase State Machine Lifecycle
grnRouter.get(
  '/state-control/lifecycle',
  authenticateJwt,
  asyncHandler(grnController.getStateMachineLifecycle)
);

// 10. Print GRN (HTML or structured JSON report - supports both GET and POST)
grnRouter.get(
  '/:id/print',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_GRN_PRINT),
  asyncHandler(grnController.printGRN)
);
grnRouter.post(
  '/:id/print',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_GRN_PRINT),
  asyncHandler(grnController.printGRN)
);

// 11. Get Authoritative GRN Record by ID
grnRouter.get(
  '/:id',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_GRN_VIEW),
  asyncHandler(grnController.getGrnById)
);
