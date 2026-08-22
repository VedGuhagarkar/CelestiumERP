import { Router } from 'express';
import { warehouseController } from './warehouse.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import { requirePermission } from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { asyncHandler } from '../../core/middleware/async-handler.middleware.js';
import {
  createWarehouseSchema,
  updateWarehouseSchema,
  createStorageLocationSchema,
  updateStorageLocationSchema,
  queryWarehouseSchema,
  queryStorageLocationSchema
} from './warehouse.validator.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';

export const warehouseRouter = Router();

// Search Warehouses
warehouseRouter.get(
  '/',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_WAREHOUSE_VIEW),
  validateRequest(queryWarehouseSchema),
  asyncHandler(warehouseController.searchWarehouses)
);

// Create Warehouse
warehouseRouter.post(
  '/',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_WAREHOUSE_MANAGE),
  validateRequest(createWarehouseSchema),
  asyncHandler(warehouseController.createWarehouse)
);

// Search Storage Locations
warehouseRouter.get(
  '/locations',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_WAREHOUSE_VIEW),
  validateRequest(queryStorageLocationSchema),
  asyncHandler(warehouseController.searchLocations)
);

// Create Storage Location
warehouseRouter.post(
  '/locations',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_WAREHOUSE_MANAGE),
  validateRequest(createStorageLocationSchema),
  asyncHandler(warehouseController.createStorageLocation)
);

// Get Storage Location by Code
warehouseRouter.get(
  '/locations/code/:code',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_WAREHOUSE_VIEW),
  asyncHandler(warehouseController.getLocationByCode)
);

// Get Storage Location by ID
warehouseRouter.get(
  '/locations/:id',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_WAREHOUSE_VIEW),
  asyncHandler(warehouseController.getLocationById)
);

// Update Storage Location
warehouseRouter.patch(
  '/locations/:id',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_WAREHOUSE_MANAGE),
  validateRequest(updateStorageLocationSchema),
  asyncHandler(warehouseController.updateStorageLocation)
);

// Get Locations by Warehouse
warehouseRouter.get(
  '/:warehouseId/locations',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_WAREHOUSE_VIEW),
  asyncHandler(warehouseController.getLocationsByWarehouse)
);

// Get Warehouse by ID
warehouseRouter.get(
  '/:id',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_WAREHOUSE_VIEW),
  asyncHandler(warehouseController.getWarehouseById)
);

// Update Warehouse
warehouseRouter.patch(
  '/:id',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_WAREHOUSE_MANAGE),
  validateRequest(updateWarehouseSchema),
  asyncHandler(warehouseController.updateWarehouse)
);
