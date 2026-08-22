import { Router } from 'express';
import { productionJobController } from './production-job.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import { requirePermission } from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { asyncHandler } from '../../core/middleware/async-handler.middleware.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';
import {
  convertPlanToJobSchema,
  queryJobsSchema,
  getJobByIdSchema
} from './production-job.validator.js';

export const productionJobRouter = Router();

// 1. Convert Approved Production Plan to Executable Production Job
productionJobRouter.post(
  '/convert-plan/:planId',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_CREATE),
  validateRequest(convertPlanToJobSchema),
  asyncHandler(productionJobController.convertPlan)
);

// 2. Query and Filter Production Jobs
productionJobRouter.get(
  '/',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_VIEW),
  validateRequest(queryJobsSchema),
  asyncHandler(productionJobController.getJobs)
);

// 3. Get Production Job Details by ID
productionJobRouter.get(
  '/:id',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_VIEW),
  validateRequest(getJobByIdSchema),
  asyncHandler(productionJobController.getJobById)
);

// 4. Get All Production Jobs Generated from a Specific Plan
productionJobRouter.get(
  '/by-plan/:planId',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_VIEW),
  asyncHandler(productionJobController.getJobsByPlan)
);
