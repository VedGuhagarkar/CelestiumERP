import { Router } from 'express';
import { costingController } from './costing.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import {
  requirePermission,
  requireAnyPermission
} from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';
import {
  createCostRateCardSchema,
  updateCostRateCardSchema,
  calculateJobCostSchema,
  recalculateJobCostSchema,
  freezeJobCostSchema,
  queryJobCostsSchema
} from './costing.validator.js';

export const costingRouter = Router();

costingRouter.use(authenticateJwt);

// ==========================================
// 1. Cost Rate Cards Endpoints
// ==========================================

costingRouter.get(
  '/rate-cards/active',
  requireAnyPermission(
    PERMISSIONS.COSTING_RATE_VIEW,
    PERMISSIONS.COSTING_JOB_VIEW,
    PERMISSIONS.REPORTS_ANALYTICS_VIEW_FINANCE
  ),
  costingController.getActiveRateCard
);

costingRouter.get(
  '/rate-cards',
  requireAnyPermission(
    PERMISSIONS.COSTING_RATE_VIEW,
    PERMISSIONS.COSTING_JOB_VIEW,
    PERMISSIONS.REPORTS_ANALYTICS_VIEW_FINANCE
  ),
  costingController.getAllRateCards
);

costingRouter.get(
  '/rate-cards/:code',
  requireAnyPermission(
    PERMISSIONS.COSTING_RATE_VIEW,
    PERMISSIONS.COSTING_JOB_VIEW,
    PERMISSIONS.REPORTS_ANALYTICS_VIEW_FINANCE
  ),
  costingController.getRateCardByCode
);

costingRouter.post(
  '/rate-cards',
  requirePermission(PERMISSIONS.COSTING_RATE_MANAGE),
  validateRequest({ body: createCostRateCardSchema }),
  costingController.createRateCard
);

costingRouter.patch(
  '/rate-cards/:code',
  requirePermission(PERMISSIONS.COSTING_RATE_MANAGE),
  validateRequest({ body: updateCostRateCardSchema }),
  costingController.updateRateCard
);

// ==========================================
// 2. Job Costing Endpoints
// ==========================================

costingRouter.post(
  '/jobs',
  requirePermission(PERMISSIONS.COSTING_JOB_CALCULATE),
  validateRequest({ body: calculateJobCostSchema }),
  costingController.calculateJobCost
);

costingRouter.post(
  '/jobs/:id/recalculate',
  requirePermission(PERMISSIONS.COSTING_JOB_CALCULATE),
  validateRequest({ body: recalculateJobCostSchema }),
  costingController.recalculateJobCost
);

costingRouter.post(
  '/jobs/:id/freeze',
  requirePermission(PERMISSIONS.COSTING_JOB_FREEZE),
  validateRequest({ body: freezeJobCostSchema }),
  costingController.freezeJobCost
);

costingRouter.get(
  '/jobs',
  requireAnyPermission(
    PERMISSIONS.COSTING_JOB_VIEW,
    PERMISSIONS.REPORTS_ANALYTICS_VIEW_FINANCE
  ),
  validateRequest({ query: queryJobCostsSchema }),
  costingController.queryJobCosts
);

costingRouter.get(
  '/jobs/summary',
  requireAnyPermission(
    PERMISSIONS.COSTING_REPORT_VIEW,
    PERMISSIONS.REPORTS_ANALYTICS_VIEW_FINANCE
  ),
  validateRequest({ query: queryJobCostsSchema }),
  costingController.getCostingSummaryReport
);

costingRouter.get(
  '/jobs/job/:jobId',
  requireAnyPermission(
    PERMISSIONS.COSTING_JOB_VIEW,
    PERMISSIONS.REPORTS_ANALYTICS_VIEW_FINANCE
  ),
  costingController.getJobCostByJobId
);

costingRouter.get(
  '/jobs/:id',
  requireAnyPermission(
    PERMISSIONS.COSTING_JOB_VIEW,
    PERMISSIONS.REPORTS_ANALYTICS_VIEW_FINANCE
  ),
  costingController.getJobCostById
);
