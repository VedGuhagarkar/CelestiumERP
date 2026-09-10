import { Router } from 'express';
import { qualityInspectionController } from './quality-inspection.controller.js';
import { productionJobController } from '../production-job/production-job.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import {
  requirePermission,
  requireAnyPermission
} from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { asyncHandler } from '../../core/middleware/async-handler.middleware.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';
import {
  createQualityInspectionSchema,
  assignInspectorSchema,
  recordTestResultsSchema,
  approveInspectionSchema,
  rejectInspectionSchema,
  requestReinspectionSchema,
  queryQualityInspectionsSchema
} from './quality-inspection.validator.js';
import {
  takeForInspectionSchema,
  recordHeatTreatmentInspectionSchema,
  approveInspectionForDispatchSchema,
  failInspectionSchema
} from '../production-job/production-job.validator.js';

export const qualityInspectionRouter = Router();

qualityInspectionRouter.use(authenticateJwt);

// --- Authoritative Revised Quality Inspection Phase Endpoints (Prompt 1) ---

// 1. Get Batch Orders Waiting for Inspection (eligible handoff queue)
qualityInspectionRouter.get(
  ['/waiting-for-inspection', '/queue/waiting-for-inspection'],
  requireAnyPermission(
    PERMISSIONS.QUALITY_INSPECTION_VIEW,
    PERMISSIONS.QUALITY_INSPECTION_RECORD,
    PERMISSIONS.QUALITY_INSPECTION_VERIFY
  ),
  asyncHandler(productionJobController.getWaitingForInspectionQueue)
);

// 2. Get Batch Orders In Inspection (active inspection queue)
qualityInspectionRouter.get(
  ['/in-inspection', '/queue/in-inspection'],
  requireAnyPermission(
    PERMISSIONS.QUALITY_INSPECTION_VIEW,
    PERMISSIONS.QUALITY_INSPECTION_RECORD,
    PERMISSIONS.QUALITY_INSPECTION_VERIFY
  ),
  asyncHandler(productionJobController.getInInspectionQueue)
);

// 3. Get Batch Orders Waiting for Dispatch (conforming inspection completed queue)
qualityInspectionRouter.get(
  ['/waiting-for-dispatch', '/queue/waiting-for-dispatch'],
  requireAnyPermission(
    PERMISSIONS.QUALITY_INSPECTION_VIEW,
    PERMISSIONS.DISPATCH_DELIVERY_VIEW,
    PERMISSIONS.PRODUCTION_JOB_VIEW,
    PERMISSIONS.BATCH_ORDER_VIEW
  ),
  asyncHandler(productionJobController.getWaitingForDispatchQueue)
);

// 4. Get Batch Orders Inspection Failed (quarantined / rejected queue)
qualityInspectionRouter.get(
  ['/inspection-failed', '/queue/inspection-failed'],
  requireAnyPermission(
    PERMISSIONS.QUALITY_INSPECTION_VIEW,
    PERMISSIONS.QUALITY_DISPOSITION_MANAGE
  ),
  asyncHandler(productionJobController.getInspectionFailedQueue)
);

// 5. Take Batch Order for Quality Inspection (waiting for inspection -> in inspection atomic transition)
qualityInspectionRouter.post(
  ['/:id/take-for-inspection', '/:id/take-inspection'],
  requireAnyPermission(
    PERMISSIONS.QUALITY_INSPECTION_RECORD,
    PERMISSIONS.QUALITY_INSPECTION_VERIFY
  ),
  validateRequest(takeForInspectionSchema),
  asyncHandler(productionJobController.takeForInspection)
);

// 6. Record Heat-Treatment Inspection Data for In-Inspection Batch Order
qualityInspectionRouter.post(
  ['/:id/record-inspection', '/:id/inspection-data'],
  requireAnyPermission(
    PERMISSIONS.QUALITY_INSPECTION_RECORD,
    PERMISSIONS.QUALITY_INSPECTION_VERIFY
  ),
  validateRequest(recordHeatTreatmentInspectionSchema),
  asyncHandler(productionJobController.recordHeatTreatmentInspectionData)
);
qualityInspectionRouter.put(
  ['/:id/record-inspection', '/:id/inspection-data'],
  requireAnyPermission(
    PERMISSIONS.QUALITY_INSPECTION_RECORD,
    PERMISSIONS.QUALITY_INSPECTION_VERIFY
  ),
  validateRequest(recordHeatTreatmentInspectionSchema),
  asyncHandler(productionJobController.recordHeatTreatmentInspectionData)
);

// 7. Approve Inspection for Dispatch (in inspection -> waiting for dispatch atomic transition)
qualityInspectionRouter.post(
  [
    '/:id/approve-dispatch',
    '/:id/approve-for-dispatch',
    '/:id/approve-inspection',
    '/:id/approve-for-inspection'
  ],
  requireAnyPermission(
    PERMISSIONS.QUALITY_INSPECTION_RECORD,
    PERMISSIONS.QUALITY_INSPECTION_VERIFY,
    PERMISSIONS.QUALITY_DISPOSITION_MANAGE
  ),
  validateRequest(approveInspectionForDispatchSchema),
  asyncHandler(productionJobController.approveInspectionForDispatch)
);

// 8. Fail Inspection (in inspection -> inspection authoritative failure / quarantine state)
qualityInspectionRouter.post(
  ['/:id/fail-inspection'],
  requireAnyPermission(
    PERMISSIONS.QUALITY_INSPECTION_RECORD,
    PERMISSIONS.QUALITY_INSPECTION_VERIFY,
    PERMISSIONS.QUALITY_DISPOSITION_MANAGE
  ),
  validateRequest(failInspectionSchema),
  asyncHandler(productionJobController.failInspection)
);

// 9. Get Inspection Workbench Data (lineage, recipe requirements, execution summary, inspection data)
qualityInspectionRouter.get(
  ['/:id/workbench', '/:id/inspection-workbench'],
  requireAnyPermission(
    PERMISSIONS.QUALITY_INSPECTION_VIEW,
    PERMISSIONS.PRODUCTION_JOB_VIEW,
    PERMISSIONS.BATCH_ORDER_VIEW
  ),
  asyncHandler(productionJobController.getInspectionWorkbenchData)
);

// Create Quality Inspection
qualityInspectionRouter.post(
  '/',
  requirePermission(PERMISSIONS.QUALITY_INSPECTION_RECORD),
  validateRequest({ body: createQualityInspectionSchema }),
  qualityInspectionController.createInspection
);

// Query Quality Inspections
qualityInspectionRouter.get(
  '/',
  requirePermission(PERMISSIONS.QUALITY_INSPECTION_VIEW),
  validateRequest({ query: queryQualityInspectionsSchema }),
  qualityInspectionController.getInspections
);

// Get Inspections for a specific job
qualityInspectionRouter.get(
  '/by-job/:jobId',
  requirePermission(PERMISSIONS.QUALITY_INSPECTION_VIEW),
  qualityInspectionController.getInspectionByJobId
);

// Get Inspection by ID
qualityInspectionRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.QUALITY_INSPECTION_VIEW),
  qualityInspectionController.getInspectionById
);

// Assign / Reallocate Inspector
qualityInspectionRouter.post(
  '/:id/assign',
  requirePermission(PERMISSIONS.QUALITY_INSPECTION_RECORD),
  validateRequest({ body: assignInspectorSchema }),
  qualityInspectionController.assignInspector
);

// Record Test Results
qualityInspectionRouter.post(
  '/:id/test-results',
  requirePermission(PERMISSIONS.QUALITY_INSPECTION_RECORD),
  validateRequest({ body: recordTestResultsSchema }),
  qualityInspectionController.recordTestResults
);

// Approve Quality Inspection
qualityInspectionRouter.post(
  '/:id/approve',
  requirePermission(PERMISSIONS.QUALITY_COC_APPROVE),
  validateRequest({ body: approveInspectionSchema }),
  qualityInspectionController.approveInspection
);

// Reject Quality Inspection & Raise NCR
qualityInspectionRouter.post(
  '/:id/reject',
  requireAnyPermission(
    PERMISSIONS.QUALITY_DISPOSITION_MANAGE,
    PERMISSIONS.QUALITY_INSPECTION_RECORD
  ),
  validateRequest({ body: rejectInspectionSchema }),
  qualityInspectionController.rejectInspection
);

// Request Reinspection
qualityInspectionRouter.post(
  '/:id/reinspection',
  requireAnyPermission(
    PERMISSIONS.QUALITY_DISPOSITION_MANAGE,
    PERMISSIONS.QUALITY_INSPECTION_RECORD
  ),
  validateRequest({ body: requestReinspectionSchema }),
  qualityInspectionController.requestReinspection
);
