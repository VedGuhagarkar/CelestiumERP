import { Router } from 'express';
import { productionJobController } from './production-job.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import { requirePermission, requireAnyPermission } from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { asyncHandler } from '../../core/middleware/async-handler.middleware.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';
import {
  createDirectJobSchema,
  createBatchOrderSchema,
  updateProcessDetailsSchema,
  getProcessDetailsSchema,
  getBatchOrderGenealogySchema,
  getBatchOrderProductionReadinessSchema,
  updateJobSchema,
  assignOperatorSchema,
  removeOperatorSchema,
  assignFurnaceSchema,
  removeFurnaceSchema,
  transitionJobSchema,
  cancelJobSchema,
  convertPlanToJobSchema,
  startJobExecutionSchema,
  recordStageProgressSchema,
  pauseJobExecutionSchema,
  resumeJobExecutionSchema,
  addProductionLogSchema,
  completeJobExecutionSchema,
  transitionToStorageSchema,
  queryJobsSchema,
  getJobByIdSchema
} from './production-job.validator.js';

export const productionJobRouter = Router();

// --- Authoritative Planning Phase & Batch Order Endpoints ---

// 0a. Get Eligible Purchase Orders (POs with completed GRNs)
productionJobRouter.get(
  ['/eligible-pos', '/planning/eligible-pos'],
  authenticateJwt,
  requireAnyPermission(PERMISSIONS.BATCH_ORDER_VIEW, PERMISSIONS.PRODUCTION_JOB_VIEW),
  asyncHandler(productionJobController.getEligiblePOs)
);

// 0b. Get Eligible GRNs Belonging Strictly to a Specific PO
productionJobRouter.get(
  ['/pos/:poId/grns', '/planning/pos/:poId/grns'],
  authenticateJwt,
  requireAnyPermission(PERMISSIONS.BATCH_ORDER_VIEW, PERMISSIONS.PRODUCTION_JOB_VIEW),
  asyncHandler(productionJobController.getEligibleGRNsForPO)
);

// 0c. Get Parts Available for Planning on a Specific GRN
productionJobRouter.get(
  ['/grns/:grnId/parts', '/planning/grns/:grnId/parts'],
  authenticateJwt,
  requireAnyPermission(PERMISSIONS.BATCH_ORDER_VIEW, PERMISSIONS.PRODUCTION_JOB_VIEW),
  asyncHandler(productionJobController.getEligiblePartsForGRN)
);

// 0d. Create Authoritative Batch Order (PO -> GRN -> BO Hierarchy)
productionJobRouter.post(
  ['/', '/batch-orders', '/create-batch-order'],
  authenticateJwt,
  requirePermission(PERMISSIONS.BATCH_ORDER_CREATE),
  validateRequest(createBatchOrderSchema),
  asyncHandler(productionJobController.createBatchOrder)
);

// 0e. Get Process Details for Batch Order (15 sequential positions)
productionJobRouter.get(
  ['/batch-orders/:id/process-details', '/:id/process-details'],
  authenticateJwt,
  requireAnyPermission(PERMISSIONS.BATCH_ORDER_VIEW, PERMISSIONS.PRODUCTION_JOB_VIEW),
  validateRequest(getProcessDetailsSchema),
  asyncHandler(productionJobController.getProcessDetails)
);

// 0f. Update Process Details for Batch Order (15 sequential positions)
productionJobRouter.put(
  ['/batch-orders/:id/process-details', '/:id/process-details'],
  authenticateJwt,
  requireAnyPermission(
    PERMISSIONS.BATCH_ORDER_UPDATE,
    PERMISSIONS.BATCH_ORDER_CREATE,
    PERMISSIONS.PRODUCTION_JOB_UPDATE
  ),
  validateRequest(updateProcessDetailsSchema),
  asyncHandler(productionJobController.updateProcessDetails)
);

// 0g. Get Authoritative Source Genealogy for Batch Order
productionJobRouter.get(
  ['/batch-orders/:id/genealogy', '/:id/genealogy'],
  authenticateJwt,
  requireAnyPermission(PERMISSIONS.BATCH_ORDER_VIEW, PERMISSIONS.PRODUCTION_JOB_VIEW),
  validateRequest(getBatchOrderGenealogySchema),
  asyncHandler(productionJobController.getBatchOrderGenealogy)
);

// 0h. Get Batch Order Production Readiness Evaluation
productionJobRouter.get(
  ['/batch-orders/:id/production-readiness', '/:id/production-readiness'],
  authenticateJwt,
  requireAnyPermission(PERMISSIONS.BATCH_ORDER_VIEW, PERMISSIONS.PRODUCTION_JOB_VIEW),
  validateRequest(getBatchOrderProductionReadinessSchema),
  asyncHandler(productionJobController.getBatchOrderProductionReadiness)
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
  ['/queue', '/production-queue', '/batch-orders/queue'],
  authenticateJwt,
  requireAnyPermission(
    PERMISSIONS.PRODUCTION_JOB_VIEW,
    PERMISSIONS.BATCH_ORDER_VIEW,
    PERMISSIONS.MACHINES_FURNACE_OPERATE
  ),
  asyncHandler(productionJobController.getProductionQueue)
);

// 4. Get Machine Utilization and Downtime Analytics for OEE
productionJobRouter.get(
  '/analytics/utilization',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_VIEW),
  asyncHandler(productionJobController.getMachineUtilizationAndDowntime)
);

// 5. Query and Filter Production Jobs / Batch Orders
productionJobRouter.get(
  ['/', '/batch-orders'],
  authenticateJwt,
  requireAnyPermission(PERMISSIONS.PRODUCTION_JOB_VIEW, PERMISSIONS.BATCH_ORDER_VIEW),
  validateRequest(queryJobsSchema),
  asyncHandler(productionJobController.getJobs)
);

// 6. Get All Production Jobs Generated from a Specific Plan
productionJobRouter.get(
  '/by-plan/:planId',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_VIEW),
  asyncHandler(productionJobController.getJobsByPlan)
);

// 7. Get Production Job / Batch Order Details & History by ID
productionJobRouter.get(
  ['/:id', '/batch-orders/:id'],
  authenticateJwt,
  requireAnyPermission(PERMISSIONS.BATCH_ORDER_VIEW, PERMISSIONS.PRODUCTION_JOB_VIEW),
  validateRequest(getJobByIdSchema),
  asyncHandler(productionJobController.getJobById)
);

// 8. Update Production Job Details Before Execution
productionJobRouter.patch(
  ['/:id', '/batch-orders/:id'],
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_UPDATE),
  validateRequest(updateJobSchema),
  asyncHandler(productionJobController.updateJob)
);

// 9. Assign / Reallocate Operator to Job
productionJobRouter.post(
  '/:id/assign-operator',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_UPDATE),
  validateRequest(assignOperatorSchema),
  asyncHandler(productionJobController.assignOperator)
);

// 10. Remove Operator from Job
productionJobRouter.post(
  '/:id/remove-operator',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_UPDATE),
  validateRequest(removeOperatorSchema),
  asyncHandler(productionJobController.removeOperator)
);

// 11. Assign / Reallocate Furnace to Job
productionJobRouter.post(
  '/:id/assign-furnace',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_UPDATE),
  validateRequest(assignFurnaceSchema),
  asyncHandler(productionJobController.assignFurnace)
);

// 12. Remove Furnace from Job
productionJobRouter.post(
  '/:id/remove-furnace',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_UPDATE),
  validateRequest(removeFurnaceSchema),
  asyncHandler(productionJobController.removeFurnace)
);

// --- Shop-Floor Cycle Execution Endpoints ---

// 13. Start Furnace Cycle Execution
productionJobRouter.post(
  '/:id/start',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_TRANSITION),
  validateRequest(startJobExecutionSchema),
  asyncHandler(productionJobController.startJobExecution)
);

// 14. Record Stage Progress (Preheat, Soak, Quench, Temper)
productionJobRouter.post(
  '/:id/stage-progress',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_UPDATE),
  validateRequest(recordStageProgressSchema),
  asyncHandler(productionJobController.recordStageProgress)
);

// 15. Controlled Pause & Downtime Logging
productionJobRouter.post(
  '/:id/pause',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_TRANSITION),
  validateRequest(pauseJobExecutionSchema),
  asyncHandler(productionJobController.pauseJobExecution)
);

// 16. Controlled Resume
productionJobRouter.post(
  '/:id/resume',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_TRANSITION),
  validateRequest(resumeJobExecutionSchema),
  asyncHandler(productionJobController.resumeJobExecution)
);

// 17. Record Production / Shift Handover Notes
productionJobRouter.post(
  '/:id/notes',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_UPDATE),
  validateRequest(addProductionLogSchema),
  asyncHandler(productionJobController.addProductionLog)
);

// 18. Complete Production Execution & Quality Handoff
productionJobRouter.post(
  '/:id/complete',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_TRANSITION),
  validateRequest(completeJobExecutionSchema),
  asyncHandler(productionJobController.completeJobExecution)
);

// 19. Transfer Completed Production to Warehouse Storage
productionJobRouter.post(
  '/:id/transition-storage',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_TRANSITION),
  validateRequest(transitionToStorageSchema),
  asyncHandler(productionJobController.transitionToStorage)
);

// 20. Execute Generic Lifecycle State Transition
productionJobRouter.post(
  '/:id/transition',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_TRANSITION),
  validateRequest(transitionJobSchema),
  asyncHandler(productionJobController.transitionJob)
);

// 21. Controlled Production Job Cancellation
productionJobRouter.post(
  '/:id/cancel',
  authenticateJwt,
  requirePermission(PERMISSIONS.PRODUCTION_JOB_CANCEL),
  validateRequest(cancelJobSchema),
  asyncHandler(productionJobController.cancelJob)
);
