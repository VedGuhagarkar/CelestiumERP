import { Router } from 'express';
import { workforceCapacityController } from './workforce-capacity.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import { requirePermission } from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { asyncHandler } from '../../core/middleware/async-handler.middleware.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';
import {
  createEmployeeSchema,
  addSkillSchema,
  evaluateCoverageSchema,
  assignOperatorSchema,
  queryShiftCapacitySchema,
  queryWorkforceSchema
} from './workforce-capacity.validator.js';

export const workforceRouter = Router();
export const workforceCapacityRouter = Router();

// --- Workforce Master & Certification Routes ---

workforceRouter.get(
  '/',
  authenticateJwt,
  requirePermission(PERMISSIONS.WORKFORCE_EMPLOYEE_VIEW),
  validateRequest(queryWorkforceSchema),
  asyncHandler(workforceCapacityController.getEmployees)
);

workforceRouter.post(
  '/',
  authenticateJwt,
  requirePermission(PERMISSIONS.WORKFORCE_EMPLOYEE_MANAGE),
  validateRequest(createEmployeeSchema),
  asyncHandler(workforceCapacityController.createEmployee)
);

workforceRouter.get(
  '/:id',
  authenticateJwt,
  requirePermission(PERMISSIONS.WORKFORCE_EMPLOYEE_VIEW),
  asyncHandler(workforceCapacityController.getEmployeeById)
);

workforceRouter.post(
  '/:id/skills',
  authenticateJwt,
  requirePermission(PERMISSIONS.WORKFORCE_EMPLOYEE_CERTIFY),
  validateRequest(addSkillSchema),
  asyncHandler(workforceCapacityController.addOrUpdateSkill)
);

// --- Workforce Shift Capacity & Planning Routes ---

workforceCapacityRouter.post(
  '/evaluate-coverage',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_SCHEDULE_VIEW),
  validateRequest(evaluateCoverageSchema),
  asyncHandler(workforceCapacityController.evaluateCoverage)
);

workforceCapacityRouter.get(
  '/shift-capacity',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_SCHEDULE_VIEW),
  validateRequest(queryShiftCapacitySchema),
  asyncHandler(workforceCapacityController.getShiftCapacity)
);

workforceCapacityRouter.post(
  '/assign',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_SCHEDULE_MANAGE),
  validateRequest(assignOperatorSchema),
  asyncHandler(workforceCapacityController.assignOperator)
);

workforceCapacityRouter.delete(
  '/allocations/:id',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_SCHEDULE_MANAGE),
  asyncHandler(workforceCapacityController.releaseAssignment)
);
