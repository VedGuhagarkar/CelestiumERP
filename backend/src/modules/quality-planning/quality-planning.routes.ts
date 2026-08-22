import { Router } from 'express';
import { qualityPlanningController } from './quality-planning.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import {
  requirePermission,
  requireAnyPermission
} from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';
import {
  createQualityPlanSchema,
  updateQualityPlanSchema,
  approveQualityPlanSchema,
  createQualityPlanRevisionSchema,
  queryQualityPlansSchema
} from './quality-planning.validator.js';

export const qualityPlanningRouter = Router();

qualityPlanningRouter.use(authenticateJwt);

// Create Quality Plan Draft
qualityPlanningRouter.post(
  '/',
  requireAnyPermission(
    PERMISSIONS.QUALITY_SPEC_CREATE,
    PERMISSIONS.QUALITY_SPEC_UPDATE,
    PERMISSIONS.QUALITY_INSPECTION_RECORD
  ),
  validateRequest({ body: createQualityPlanSchema }),
  qualityPlanningController.createPlan
);

// Query Quality Plans
qualityPlanningRouter.get(
  '/',
  requirePermission(PERMISSIONS.QUALITY_SPEC_VIEW),
  validateRequest({ query: queryQualityPlansSchema }),
  qualityPlanningController.queryPlans
);

// Find Applicable Quality Plan
qualityPlanningRouter.get(
  '/applicable',
  requirePermission(PERMISSIONS.QUALITY_SPEC_VIEW),
  qualityPlanningController.findApplicablePlan
);

// Get Active Approved Plan by planCode
qualityPlanningRouter.get(
  '/active/:planCode',
  requirePermission(PERMISSIONS.QUALITY_SPEC_VIEW),
  qualityPlanningController.getActiveApprovedPlan
);

// Get Quality Plan by ID
qualityPlanningRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.QUALITY_SPEC_VIEW),
  qualityPlanningController.getPlanById
);

// Update Draft Quality Plan
qualityPlanningRouter.put(
  '/:id',
  requirePermission(PERMISSIONS.QUALITY_SPEC_UPDATE),
  validateRequest({ body: updateQualityPlanSchema }),
  qualityPlanningController.updateDraftPlan
);

// Approve Quality Plan
qualityPlanningRouter.post(
  '/:id/approve',
  requirePermission(PERMISSIONS.QUALITY_SPEC_APPROVE),
  validateRequest({ body: approveQualityPlanSchema }),
  qualityPlanningController.approvePlan
);

// Create New Revision of Approved Plan
qualityPlanningRouter.post(
  '/:id/revise',
  requirePermission(PERMISSIONS.QUALITY_SPEC_UPDATE),
  validateRequest({ body: createQualityPlanRevisionSchema }),
  qualityPlanningController.createRevision
);
