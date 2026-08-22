import { Router } from 'express';
import { reportingController } from './reporting.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import {
  requirePermission,
  requireAnyPermission
} from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';
import { dateRangeFilterSchema } from './reporting.validator.js';

export const reportingRouter = Router();

reportingRouter.use(authenticateJwt);

// ==========================================
// 1. Executive Operational Dashboard
// ==========================================
reportingRouter.get(
  '/dashboard/executive',
  requireAnyPermission(
    PERMISSIONS.REPORTS_ANALYTICS_VIEW_OEE,
    PERMISSIONS.REPORTS_ANALYTICS_VIEW_QUALITY,
    PERMISSIONS.REPORTS_ANALYTICS_VIEW_FINANCE
  ),
  validateRequest({ query: dateRangeFilterSchema }),
  reportingController.getExecutiveDashboard
);

// ==========================================
// 2. Production & Throughput Reports
// ==========================================
reportingRouter.get(
  '/production/throughput',
  requireAnyPermission(
    PERMISSIONS.PRODUCTION_SCHEDULE_VIEW,
    PERMISSIONS.REPORTS_ANALYTICS_VIEW_OEE
  ),
  validateRequest({ query: dateRangeFilterSchema }),
  reportingController.getThroughputReport
);

reportingRouter.get(
  '/production/cycle-time',
  requireAnyPermission(
    PERMISSIONS.PRODUCTION_SCHEDULE_VIEW,
    PERMISSIONS.REPORTS_ANALYTICS_VIEW_OEE
  ),
  validateRequest({ query: dateRangeFilterSchema }),
  reportingController.getCycleTimeReport
);

// ==========================================
// 3. Equipment, OEE, Downtime, MTTR & MTBF
// ==========================================
reportingRouter.get(
  '/equipment/oee',
  requirePermission(PERMISSIONS.REPORTS_ANALYTICS_VIEW_OEE),
  validateRequest({ query: dateRangeFilterSchema }),
  reportingController.getOeeDowntimeReport
);

// ==========================================
// 4. Quality, FPY, Defect & NCR Reports
// ==========================================
reportingRouter.get(
  '/quality',
  requirePermission(PERMISSIONS.REPORTS_ANALYTICS_VIEW_QUALITY),
  validateRequest({ query: dateRangeFilterSchema }),
  reportingController.getQualityAnalyticsReport
);

// ==========================================
// 5. Workforce Attendance & Overtime Reports
// ==========================================
reportingRouter.get(
  '/workforce/attendance',
  requireAnyPermission(
    PERMISSIONS.WORKFORCE_ATTENDANCE_VIEW,
    PERMISSIONS.REPORTS_ANALYTICS_VIEW_OEE
  ),
  validateRequest({ query: dateRangeFilterSchema }),
  reportingController.getWorkforceAttendanceReport
);

// ==========================================
// 6. Inventory Valuation, Shortages & Warehouse Occupancy
// ==========================================
reportingRouter.get(
  '/inventory/valuation',
  requireAnyPermission(
    PERMISSIONS.INVENTORY_STOCK_VIEW,
    PERMISSIONS.REPORTS_ANALYTICS_VIEW_FINANCE
  ),
  reportingController.getInventoryWarehouseReport
);

// ==========================================
// 7. Dispatch & Delivery (OTIF) Report
// ==========================================
reportingRouter.get(
  '/dispatch',
  requireAnyPermission(
    PERMISSIONS.DISPATCH_DELIVERY_VIEW,
    PERMISSIONS.REPORTS_ANALYTICS_VIEW_OEE
  ),
  validateRequest({ query: dateRangeFilterSchema }),
  reportingController.getDispatchReport
);

// ==========================================
// 8. Job Costing & Profitability Report
// ==========================================
reportingRouter.get(
  '/costing/profitability',
  requireAnyPermission(
    PERMISSIONS.COSTING_REPORT_VIEW,
    PERMISSIONS.REPORTS_ANALYTICS_VIEW_FINANCE
  ),
  validateRequest({ query: dateRangeFilterSchema }),
  reportingController.getJobCostProfitabilityReport
);
