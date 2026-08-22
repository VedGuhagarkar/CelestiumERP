import { Router } from 'express';
import { specificationController } from './specification.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import { requirePermission } from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { asyncHandler } from '../../core/middleware/async-handler.middleware.js';
import {
  createSpecificationSchema,
  updateSpecificationSchema,
  approveSpecificationSchema,
  rejectSpecificationSchema,
  querySpecificationSchema
} from './specification.validator.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';

export const specificationRouter = Router();

// Search & List Specifications
specificationRouter.get(
  '/',
  authenticateJwt,
  requirePermission(PERMISSIONS.QUALITY_SPEC_VIEW),
  validateRequest(querySpecificationSchema),
  asyncHandler(specificationController.searchSpecifications)
);

// Register New Specification (DRAFT)
specificationRouter.post(
  '/',
  authenticateJwt,
  requirePermission(PERMISSIONS.QUALITY_SPEC_CREATE),
  validateRequest(createSpecificationSchema),
  asyncHandler(specificationController.createSpecification)
);

// Retrieve Latest Active Specification Revision
specificationRouter.get(
  '/latest/:code',
  authenticateJwt,
  requirePermission(PERMISSIONS.QUALITY_SPEC_VIEW),
  asyncHandler(specificationController.getLatestActiveSpecification)
);

// Retrieve Specification by Code and Revision Number
specificationRouter.get(
  '/code/:code/revision/:revision',
  authenticateJwt,
  requirePermission(PERMISSIONS.QUALITY_SPEC_VIEW),
  asyncHandler(specificationController.getSpecificationByCodeAndRevision)
);

// Retrieve Specification by ID
specificationRouter.get(
  '/:id',
  authenticateJwt,
  requirePermission(PERMISSIONS.QUALITY_SPEC_VIEW),
  asyncHandler(specificationController.getSpecificationById)
);

// Update Specification in DRAFT Status
specificationRouter.put(
  '/:id',
  authenticateJwt,
  requirePermission(PERMISSIONS.QUALITY_SPEC_UPDATE),
  validateRequest(updateSpecificationSchema),
  asyncHandler(specificationController.updateSpecification)
);

// Submit Specification for Metallurgical Approval
specificationRouter.post(
  '/:id/submit-approval',
  authenticateJwt,
  requirePermission(PERMISSIONS.QUALITY_SPEC_UPDATE),
  asyncHandler(specificationController.submitForApproval)
);

// Approve and Release Specification Revision (Metallurgist / Admin)
specificationRouter.post(
  '/:id/approve',
  authenticateJwt,
  requirePermission(PERMISSIONS.QUALITY_SPEC_APPROVE),
  validateRequest(approveSpecificationSchema),
  asyncHandler(specificationController.approveSpecification)
);

// Reject Specification
specificationRouter.post(
  '/:id/reject',
  authenticateJwt,
  requirePermission(PERMISSIONS.QUALITY_SPEC_APPROVE),
  validateRequest(rejectSpecificationSchema),
  asyncHandler(specificationController.rejectSpecification)
);

// Create New Revision from Existing Specification
specificationRouter.post(
  '/:id/new-revision',
  authenticateJwt,
  requirePermission(PERMISSIONS.QUALITY_SPEC_CREATE),
  asyncHandler(specificationController.createNewRevision)
);

// Retire Specification Revision
specificationRouter.post(
  '/:id/retire',
  authenticateJwt,
  requirePermission(PERMISSIONS.QUALITY_SPEC_APPROVE),
  asyncHandler(specificationController.retireSpecification)
);
