import { Router } from 'express';
import { itemController } from './item.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import { requirePermission } from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { asyncHandler } from '../../core/middleware/async-handler.middleware.js';
import {
  createItemSchema,
  updateItemSchema,
  updateItemStatusSchema,
  queryItemSchema
} from './item.validator.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';

export const itemRouter = Router();

// Search & List Items
itemRouter.get(
  '/',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_ITEM_VIEW),
  validateRequest(queryItemSchema),
  asyncHandler(itemController.searchItems)
);

// Register New Item
itemRouter.post(
  '/',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_ITEM_CREATE),
  validateRequest(createItemSchema),
  asyncHandler(itemController.createItem)
);

// Lookup Item by Code
itemRouter.get(
  '/code/:code',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_ITEM_VIEW),
  asyncHandler(itemController.getItemByCode)
);

// Retrieve Item by ID
itemRouter.get(
  '/:id',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_ITEM_VIEW),
  asyncHandler(itemController.getItemById)
);

// Update Item
itemRouter.put(
  '/:id',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_ITEM_UPDATE),
  validateRequest(updateItemSchema),
  asyncHandler(itemController.updateItem)
);

// Update Item Status
itemRouter.patch(
  '/:id/status',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_ITEM_DEACTIVATE),
  validateRequest(updateItemStatusSchema),
  asyncHandler(itemController.updateItemStatus)
);

// Archive Item
itemRouter.delete(
  '/:id',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_ITEM_DEACTIVATE),
  asyncHandler(itemController.archiveItem)
);
