import { Router } from 'express';
import { inventoryController } from './inventory.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import { requirePermission } from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { asyncHandler } from '../../core/middleware/async-handler.middleware.js';
import {
  goodsReceiptSchema,
  goodsIssueSchema,
  stockAdjustmentSchema,
  internalTransferSchema,
  reserveStockSchema,
  releaseReservationSchema,
  queryBalanceSchema,
  queryTransactionSchema
} from './inventory.validator.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';

export const inventoryRouter = Router();

// Search Location Balances
inventoryRouter.get(
  '/balances',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_STOCK_VIEW),
  validateRequest(queryBalanceSchema),
  asyncHandler(inventoryController.searchBalances)
);

// Search Immutable Transaction Ledger
inventoryRouter.get(
  '/transactions',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_STOCK_VIEW),
  validateRequest(queryTransactionSchema),
  asyncHandler(inventoryController.searchTransactions)
);

// Goods Receipt
inventoryRouter.post(
  '/goods-receipt',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_STOCK_ADJUST),
  validateRequest(goodsReceiptSchema),
  asyncHandler(inventoryController.recordGoodsReceipt)
);

// Goods Issue
inventoryRouter.post(
  '/goods-issue',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_STOCK_ADJUST),
  validateRequest(goodsIssueSchema),
  asyncHandler(inventoryController.recordGoodsIssue)
);

// Stock Adjustment (Mandatory Reason Code)
inventoryRouter.post(
  '/adjustments',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_STOCK_ADJUST),
  validateRequest(stockAdjustmentSchema),
  asyncHandler(inventoryController.recordStockAdjustment)
);

// Internal Location Transfer
inventoryRouter.post(
  '/transfers',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_STOCK_TRANSFER),
  validateRequest(internalTransferSchema),
  asyncHandler(inventoryController.recordInternalTransfer)
);

// Reserve Stock
inventoryRouter.post(
  '/reservations',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_STOCK_ADJUST),
  validateRequest(reserveStockSchema),
  asyncHandler(inventoryController.reserveStock)
);

// Release Stock Reservation
inventoryRouter.post(
  '/reservations/release',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_STOCK_ADJUST),
  validateRequest(releaseReservationSchema),
  asyncHandler(inventoryController.releaseReservation)
);
