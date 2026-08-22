import { Router } from 'express';
import { productionJobController } from './production-job.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import { requirePermission } from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { asyncHandler } from '../../core/middleware/async-handler.middleware.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';
import {
  createDirectJobSchema,
  updateJobSchema,
  assignOperatorSchema,
  removeOperatorSchema,
  assignFurnaceSchema,
  removeFurnaceSchema,
  transitionJobSchema,
  cancelJobSchema,
  convertPlanToJobSchema,
  queryJobsSchema,
  getJobByIdSchema
} from './production-job.validator.js';

export const productionJobRouter = Router();

// 1. Create Direct Production Job
productionJobRouter.post(
  '/',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_CREATE),
  validateRequest(createDirectJobSchema),
  asyncHandler(productionJobController.createDirectJob)
);

// 2. Convert Approved Production Plan to Executable Production Job
productionJobRouter.post(
  '/convert-plan/:planId',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_CREATE),
  validateRequest(convertPlanToJobSchema),
  asyncHandler(productionJobController.convertPlan)
);

// 3. Get Prioritized Shop-Floor Production Queue
productionJobRouter.get(
  '/queue',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_VIEW),
  asyncHandler(productionJobController.getProductionQueue)
);

// 4. Query and Filter Production Jobs
productionJobRouter.get(
  '/',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_VIEW),
  validateRequest(queryJobsSchema),
  asyncHandler(productionJobController.getJobs)
);

// 5. Get All Production Jobs Generated from a Specific Plan
productionJobRouter.get(
  '/by-plan/:planId',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_VIEW),
  asyncHandler(productionJobController.getJobsByPlan)
);

// 6. Get Production Job Details & History by ID
productionJobRouter.get(
  '/:id',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_VIEW),
  validateRequest(getJobByIdSchema),
  asyncHandler(productionJobController.getJobById)
);

// 7. Update Production Job Details Before Execution
productionJobRouter.patch(
  '/:id',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_UPDATE),
  validateRequest(updateJobSchema),
  asyncHandler(productionJobController.updateJob)
);

// 8. Assign / Reallocate Operator to Job
productionJobRouter.post(
  '/:id/assign-operator',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_UPDATE),
  validateRequest(assignOperatorSchema),
  asyncHandler(productionJobController.assignOperator)
);

// 9. Remove Operator from Job
productionJobRouter.post(
  '/:id/remove-operator',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_UPDATE),
  validateRequest(removeOperatorSchema),
  asyncHandler(productionJobController.removeOperator)
);

// 10. Assign / Reallocate Furnace to Job
productionJobRouter.post(
  '/:id/assign-furnace',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_UPDATE),
  validateRequest(assignFurnaceSchema),
  asyncHandler(productionJobController.assignFurnace)
);

// 11. Remove Furnace from Job
productionJobRouter.post(
  '/:id/remove-furnace',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_UPDATE),
  validateRequest(removeFurnaceSchema),
  asyncHandler(productionJobController.removeFurnace)
);

// 12. Execute Lifecycle State Transition
productionJobRouter.post(
  '/:id/transition',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_TRANSITION),
  validateRequest(transitionJobSchema),
  asyncHandler(productionJobController.transitionJob)
);

// 13. Controlled Production Job Cancellation
productionJobRouter.post(
  '/:id/cancel',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_CANCEL),
  validateRequest(cancelJobSchema),
  asyncHandler(productionJobController.cancelJob)
);
