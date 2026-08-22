import { Router } from 'express';
import { productionScheduleController } from './production-schedule.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import { requirePermission } from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { asyncHandler } from '../../core/middleware/async-handler.middleware.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';
import {
  scheduleJobSchema,
  rescheduleJobSchema,
  unscheduleJobSchema,
  queryScheduleSchema,
  getScheduleByIdSchema
} from './production-schedule.validator.js';

export const productionScheduleRouter = Router();

// 1. Schedule a Production Job
productionScheduleRouter.post(
  '/',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_SCHEDULE_MANAGE),
  validateRequest(scheduleJobSchema),
  asyncHandler(productionScheduleController.scheduleJob)
);

// 2. Reschedule a Production Job (Time window, furnace, operator)
productionScheduleRouter.post(
  '/:id/reschedule',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_SCHEDULE_MANAGE),
  validateRequest(rescheduleJobSchema),
  asyncHandler(productionScheduleController.rescheduleJob)
);

// 3. Controlled Schedule Cancellation / Unschedule (Returns to backlog)
productionScheduleRouter.post(
  '/:id/unschedule',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_SCHEDULE_MANAGE),
  validateRequest(unscheduleJobSchema),
  asyncHandler(productionScheduleController.unscheduleJob)
);

// 4. Get Prioritized Shop-Floor Production Schedule Queue
productionScheduleRouter.get(
  '/queue',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_SCHEDULE_VIEW),
  asyncHandler(productionScheduleController.getProductionQueue)
);

// 5. Query and Filter Production Schedules
productionScheduleRouter.get(
  '/',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_SCHEDULE_VIEW),
  validateRequest(queryScheduleSchema),
  asyncHandler(productionScheduleController.querySchedules)
);

// 6. Get Production Schedule Details & History by ID
productionScheduleRouter.get(
  '/:id',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_SCHEDULE_VIEW),
  validateRequest(getScheduleByIdSchema),
  asyncHandler(productionScheduleController.getScheduleById)
);
