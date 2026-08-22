import { Router } from 'express';
import { qualityInspectionController } from './quality-inspection.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import {
  requirePermission,
  requireAnyPermission
} from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
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

export const qualityInspectionRouter = Router();

qualityInspectionRouter.use(authenticateJwt);

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
