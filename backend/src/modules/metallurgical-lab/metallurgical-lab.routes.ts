import { Router } from 'express';
import { metallurgicalLabController } from './metallurgical-lab.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import {
  requirePermission,
  requireAnyPermission
} from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';
import {
  createLabTestRecordSchema,
  addHardnessMeasurementSchema,
  addHardnessTraverseSchema,
  addMicrostructureObservationSchema,
  lockLabTestRecordSchema,
  queryLabTestRecordsSchema
} from './metallurgical-lab.validator.js';

export const metallurgicalLabRouter = Router();

metallurgicalLabRouter.use(authenticateJwt);

// Create Lab Test Record
metallurgicalLabRouter.post(
  '/',
  requirePermission(PERMISSIONS.QUALITY_INSPECTION_RECORD),
  validateRequest({ body: createLabTestRecordSchema }),
  metallurgicalLabController.createLabRecord
);

// Query Lab Test Records
metallurgicalLabRouter.get(
  '/',
  requirePermission(PERMISSIONS.QUALITY_INSPECTION_VIEW),
  validateRequest({ query: queryLabTestRecordsSchema }),
  metallurgicalLabController.queryRecords
);

// Get Lab Record by ID
metallurgicalLabRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.QUALITY_INSPECTION_VIEW),
  metallurgicalLabController.getRecordById
);

// Get Lab Records by Inspection ID
metallurgicalLabRouter.get(
  '/by-inspection/:inspectionId',
  requirePermission(PERMISSIONS.QUALITY_INSPECTION_VIEW),
  metallurgicalLabController.getRecordsByInspectionId
);

// Get Lab Records by Job ID
metallurgicalLabRouter.get(
  '/by-job/:jobId',
  requirePermission(PERMISSIONS.QUALITY_INSPECTION_VIEW),
  metallurgicalLabController.getRecordsByJobId
);

// Add Hardness Measurement (HRC, HRB, HRA, HV, HBW)
metallurgicalLabRouter.post(
  '/:id/hardness',
  requirePermission(PERMISSIONS.QUALITY_INSPECTION_RECORD),
  validateRequest({ body: addHardnessMeasurementSchema }),
  metallurgicalLabController.addHardnessMeasurement
);

// Add Hardness Traverse & Calculate Effective Case Depth
metallurgicalLabRouter.post(
  '/:id/traverse',
  requirePermission(PERMISSIONS.QUALITY_INSPECTION_RECORD),
  validateRequest({ body: addHardnessTraverseSchema }),
  metallurgicalLabController.addHardnessTraverse
);

// Add Microstructure Observation
metallurgicalLabRouter.post(
  '/:id/microstructure',
  requirePermission(PERMISSIONS.QUALITY_INSPECTION_RECORD),
  validateRequest({ body: addMicrostructureObservationSchema }),
  metallurgicalLabController.addMicrostructureObservation
);

// Lock Lab Test Record
metallurgicalLabRouter.post(
  '/:id/lock',
  requireAnyPermission(
    PERMISSIONS.QUALITY_COC_APPROVE,
    PERMISSIONS.QUALITY_DISPOSITION_MANAGE,
    PERMISSIONS.QUALITY_INSPECTION_RECORD
  ),
  validateRequest({ body: lockLabTestRecordSchema }),
  metallurgicalLabController.lockLabRecord
);
