import { Router } from 'express';
import { purchaseOrderController } from './purchase-order.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import { requirePermission } from '../../core/middleware/rbac.middleware.js';
import { idempotencyMiddleware } from '../../core/middleware/idempotency.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { asyncHandler } from '../../core/middleware/async-handler.middleware.js';
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  queryPurchaseOrderSchema
} from './purchase-order.validator.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';

export const purchaseOrderRouter = Router();

// Create new Purchase Order (Binds Item + Recipe)
purchaseOrderRouter.post(
  '/',
  authenticateJwt,
  requirePermission(PERMISSIONS.PURCHASE_ORDER_CREATE),
  idempotencyMiddleware,
  validateRequest(createPurchaseOrderSchema),
  asyncHandler(purchaseOrderController.createOrder)
);

// Query Purchase Orders with pagination and filters
purchaseOrderRouter.get(
  '/',
  authenticateJwt,
  requirePermission(PERMISSIONS.PURCHASE_ORDER_VIEW),
  validateRequest(queryPurchaseOrderSchema),
  asyncHandler(purchaseOrderController.queryOrders)
);

// Get PO by automatic PO Number (e.g. PO-202609-0001)
purchaseOrderRouter.get(
  '/number/:poNumber',
  authenticateJwt,
  requirePermission(PERMISSIONS.PURCHASE_ORDER_VIEW),
  asyncHandler(purchaseOrderController.getOrderByPoNumber)
);

// Get PO by ID
purchaseOrderRouter.get(
  '/:id',
  authenticateJwt,
  requirePermission(PERMISSIONS.PURCHASE_ORDER_VIEW),
  asyncHandler(purchaseOrderController.getOrderById)
);

// Update Purchase Order
purchaseOrderRouter.put(
  '/:id',
  authenticateJwt,
  requirePermission(PERMISSIONS.PURCHASE_ORDER_UPDATE),
  validateRequest(updatePurchaseOrderSchema),
  asyncHandler(purchaseOrderController.updateOrder)
);

// Cancel Purchase Order
purchaseOrderRouter.post(
  '/:id/cancel',
  authenticateJwt,
  requirePermission(PERMISSIONS.PURCHASE_ORDER_UPDATE),
  asyncHandler(purchaseOrderController.cancelOrder)
);
