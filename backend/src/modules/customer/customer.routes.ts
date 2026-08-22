import { Router } from 'express';
import { customerController } from './customer.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import { requirePermission } from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { asyncHandler } from '../../core/middleware/async-handler.middleware.js';
import {
  createCustomerSchema,
  updateCustomerSchema,
  updateCustomerStatusSchema,
  queryCustomerSchema
} from './customer.validator.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';

export const customerRouter = Router();

// Search & List Customers
customerRouter.get(
  '/',
  authenticateJwt,
  requirePermission(PERMISSIONS.CUSTOMER_VIEW),
  validateRequest(queryCustomerSchema),
  asyncHandler(customerController.searchCustomers)
);

// Register New Customer
customerRouter.post(
  '/',
  authenticateJwt,
  requirePermission(PERMISSIONS.CUSTOMER_CREATE),
  validateRequest(createCustomerSchema),
  asyncHandler(customerController.createCustomer)
);

// Lookup Customer by Unique Code
customerRouter.get(
  '/code/:code',
  authenticateJwt,
  requirePermission(PERMISSIONS.CUSTOMER_VIEW),
  asyncHandler(customerController.getCustomerByCode)
);

// Retrieve Customer by ID
customerRouter.get(
  '/:id',
  authenticateJwt,
  requirePermission(PERMISSIONS.CUSTOMER_VIEW),
  asyncHandler(customerController.getCustomerById)
);

// Update Customer Master Data
customerRouter.put(
  '/:id',
  authenticateJwt,
  requirePermission(PERMISSIONS.CUSTOMER_UPDATE),
  validateRequest(updateCustomerSchema),
  asyncHandler(customerController.updateCustomer)
);

// Update Customer Quality / Active Status
customerRouter.patch(
  '/:id/status',
  authenticateJwt,
  requirePermission(PERMISSIONS.CUSTOMER_DEACTIVATE),
  validateRequest(updateCustomerStatusSchema),
  asyncHandler(customerController.updateCustomerStatus)
);

// Archive Customer (Protected Soft Delete)
customerRouter.delete(
  '/:id',
  authenticateJwt,
  requirePermission(PERMISSIONS.CUSTOMER_DEACTIVATE),
  asyncHandler(customerController.archiveCustomer)
);
