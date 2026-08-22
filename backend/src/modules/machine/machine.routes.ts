import { Router } from 'express';
import { machineController } from './machine.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import {
  requirePermission,
  requireAnyPermission
} from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';
import {
  createMachineSchema,
  updateMachineSchema,
  changeMachineStatusSchema,
  addMachineNoteSchema,
  queryMachinesSchema
} from './machine.validator.js';

export const machineRouter = Router();

machineRouter.use(authenticateJwt);

// Fleet health summary
machineRouter.get(
  '/summary/fleet',
  requirePermission(PERMISSIONS.MACHINES_FURNACE_VIEW),
  machineController.getFleetSummary
);

// Capability matching query
machineRouter.get(
  '/capabilities/search',
  requirePermission(PERMISSIONS.MACHINES_FURNACE_VIEW),
  machineController.findCapableMachines
);

// Query machines with filters & pagination
machineRouter.get(
  '/',
  requirePermission(PERMISSIONS.MACHINES_FURNACE_VIEW),
  validateRequest({ query: queryMachinesSchema }),
  machineController.queryMachines
);

// Register machine
machineRouter.post(
  '/',
  requirePermission(PERMISSIONS.MACHINES_FURNACE_CONFIGURE),
  validateRequest({ body: createMachineSchema }),
  machineController.createMachine
);

// Get machine by code
machineRouter.get(
  '/code/:machineCode',
  requirePermission(PERMISSIONS.MACHINES_FURNACE_VIEW),
  machineController.getMachineByCode
);

// Get machine by ID
machineRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.MACHINES_FURNACE_VIEW),
  machineController.getMachineById
);

// Update machine configuration
machineRouter.put(
  '/:id',
  requirePermission(PERMISSIONS.MACHINES_FURNACE_CONFIGURE),
  validateRequest({ body: updateMachineSchema }),
  machineController.updateMachine
);

// Change machine operational status
machineRouter.post(
  '/:id/status',
  requireAnyPermission(
    PERMISSIONS.MACHINES_FURNACE_OPERATE,
    PERMISSIONS.MACHINES_FURNACE_CONFIGURE
  ),
  validateRequest({ body: changeMachineStatusSchema }),
  machineController.changeMachineStatus
);

// Add operational/maintenance note
machineRouter.post(
  '/:id/notes',
  requireAnyPermission(
    PERMISSIONS.MACHINES_FURNACE_OPERATE,
    PERMISSIONS.MACHINES_FURNACE_CONFIGURE
  ),
  validateRequest({ body: addMachineNoteSchema }),
  machineController.addNote
);
