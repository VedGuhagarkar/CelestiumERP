import { Router } from 'express';
import { maintenanceController } from './maintenance.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import {
  requirePermission,
  requireAnyPermission
} from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';
import {
  createPreventivePlanSchema,
  updatePreventivePlanSchema,
  reportBreakdownSchema,
  createWorkOrderSchema,
  resolveBreakdownSchema,
  completeWorkOrderSchema,
  queryMaintenanceWorkOrdersSchema,
  queryPreventivePlansSchema
} from './maintenance.validator.js';

export const maintenanceRouter = Router();

maintenanceRouter.use(authenticateJwt);

// Reliability Metrics & MTTR/MTBF
maintenanceRouter.get(
  '/metrics',
  requirePermission(PERMISSIONS.MACHINES_FURNACE_VIEW),
  maintenanceController.getMetrics
);

// Overdue Maintenance Plans
maintenanceRouter.get(
  '/plans/overdue',
  requirePermission(PERMISSIONS.MACHINES_FURNACE_VIEW),
  maintenanceController.getOverduePlans
);

// Query Preventive Plans
maintenanceRouter.get(
  '/plans',
  requirePermission(PERMISSIONS.MACHINES_FURNACE_VIEW),
  validateRequest({ query: queryPreventivePlansSchema }),
  maintenanceController.queryPlans
);

// Create Preventive Plan
maintenanceRouter.post(
  '/plans',
  requirePermission(PERMISSIONS.MACHINES_FURNACE_CONFIGURE),
  validateRequest({ body: createPreventivePlanSchema }),
  maintenanceController.createPreventivePlan
);

// Update Preventive Plan
maintenanceRouter.put(
  '/plans/:id',
  requirePermission(PERMISSIONS.MACHINES_FURNACE_CONFIGURE),
  validateRequest({ body: updatePreventivePlanSchema }),
  maintenanceController.updatePreventivePlan
);

// Report Breakdown (moves machine to BREAKDOWN)
maintenanceRouter.post(
  '/breakdown',
  requireAnyPermission(
    PERMISSIONS.MACHINES_FURNACE_OPERATE,
    PERMISSIONS.MACHINES_FURNACE_CONFIGURE
  ),
  validateRequest({ body: reportBreakdownSchema }),
  maintenanceController.reportBreakdown
);

// Resolve Breakdown (repairs machine and transitions back to operational)
maintenanceRouter.post(
  '/breakdown/:id/resolve',
  requireAnyPermission(
    PERMISSIONS.MACHINES_FURNACE_OPERATE,
    PERMISSIONS.MACHINES_FURNACE_CONFIGURE
  ),
  validateRequest({ body: resolveBreakdownSchema }),
  maintenanceController.resolveBreakdown
);

// Query Work Orders
maintenanceRouter.get(
  '/work-orders',
  requirePermission(PERMISSIONS.MACHINES_FURNACE_VIEW),
  validateRequest({ query: queryMaintenanceWorkOrdersSchema }),
  maintenanceController.queryWorkOrders
);

// Create Work Order
maintenanceRouter.post(
  '/work-orders',
  requireAnyPermission(
    PERMISSIONS.MACHINES_FURNACE_OPERATE,
    PERMISSIONS.MACHINES_FURNACE_CONFIGURE
  ),
  validateRequest({ body: createWorkOrderSchema }),
  maintenanceController.createWorkOrder
);

// Get Work Order by ID
maintenanceRouter.get(
  '/work-orders/:id',
  requirePermission(PERMISSIONS.MACHINES_FURNACE_VIEW),
  maintenanceController.getWorkOrderById
);

// Complete Work Order
maintenanceRouter.post(
  '/work-orders/:id/complete',
  requireAnyPermission(
    PERMISSIONS.MACHINES_FURNACE_OPERATE,
    PERMISSIONS.MACHINES_FURNACE_CONFIGURE
  ),
  validateRequest({ body: completeWorkOrderSchema }),
  maintenanceController.completeWorkOrder
);
