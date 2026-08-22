import { Router } from 'express';
import { finishedGoodsController } from './finished-goods.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import { requirePermission } from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { asyncHandler } from '../../core/middleware/async-handler.middleware.js';
import {
  inwardFinishedGoodsSchema,
  releaseFinishedGoodsSchema,
  reserveFinishedGoodsSchema,
  releaseReservationSchema,
  moveFinishedGoodsLocationSchema,
  queryFinishedGoodsSchema
} from './finished-goods.validator.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';

export const finishedGoodsRouter = Router();

// Search Finished Goods
finishedGoodsRouter.get(
  '/',
  authenticateJwt,
  requirePermission(PERMISSIONS.DISPATCH_DELIVERY_VIEW),
  validateRequest(queryFinishedGoodsSchema),
  asyncHandler(finishedGoodsController.search)
);

// Inward Finished Goods Output from Production
finishedGoodsRouter.post(
  '/inward',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_COMPLETE),
  validateRequest(inwardFinishedGoodsSchema),
  asyncHandler(finishedGoodsController.inwardFinishedGoods)
);

// Get Finished Goods by Lot Number
finishedGoodsRouter.get(
  '/lot/:lotNumber',
  authenticateJwt,
  requirePermission(PERMISSIONS.DISPATCH_DELIVERY_VIEW),
  asyncHandler(finishedGoodsController.getByLotNumber)
);

// Get Finished Goods by ID
finishedGoodsRouter.get(
  '/:id',
  authenticateJwt,
  requirePermission(PERMISSIONS.DISPATCH_DELIVERY_VIEW),
  asyncHandler(finishedGoodsController.getById)
);

// Quality Release Finished Goods for Dispatch
finishedGoodsRouter.post(
  '/:id/release',
  authenticateJwt,
  requirePermission(PERMISSIONS.QUALITY_COC_APPROVE),
  validateRequest(releaseFinishedGoodsSchema),
  asyncHandler(finishedGoodsController.releaseFinishedGoods)
);

// Reserve Finished Goods for Delivery Challan / Dispatch Pass
finishedGoodsRouter.post(
  '/:id/reserve',
  authenticateJwt,
  requirePermission(PERMISSIONS.DISPATCH_DELIVERY_CREATE),
  validateRequest(reserveFinishedGoodsSchema),
  asyncHandler(finishedGoodsController.reserveForDispatch)
);

// Release Finished Goods Reservation
finishedGoodsRouter.post(
  '/:id/reserve/release',
  authenticateJwt,
  requirePermission(PERMISSIONS.DISPATCH_DELIVERY_CREATE),
  validateRequest(releaseReservationSchema),
  asyncHandler(finishedGoodsController.releaseDispatchReservation)
);

// Relocate Finished Goods
finishedGoodsRouter.patch(
  '/:id/location',
  authenticateJwt,
  requirePermission(PERMISSIONS.INVENTORY_STOCK_TRANSFER),
  validateRequest(moveFinishedGoodsLocationSchema),
  asyncHandler(finishedGoodsController.moveLocation)
);
