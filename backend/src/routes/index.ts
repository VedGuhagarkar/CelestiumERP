import { Router, Request, Response } from 'express';
import { ApiResponse } from '../core/responses/api-response.js';
import { getDatabaseHealth } from '../core/database/health.js';
import { config } from '../config/app.config.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import { rbacRouter } from '../modules/rbac/rbac.routes.js';
import { auditRouter } from '../modules/audit/audit.routes.js';
import { customerRouter } from '../modules/customer/customer.routes.js';
import { itemRouter } from '../modules/item/item.routes.js';
import { recipeRouter } from '../modules/recipe/recipe.routes.js';
import { specificationRouter } from '../modules/specification/specification.routes.js';
import { heatLotRouter } from '../modules/traceability/heat-lot.routes.js';
import { inventoryRouter } from '../modules/inventory/inventory.routes.js';
import { warehouseRouter } from '../modules/warehouse/warehouse.routes.js';
import { quarantineRouter } from '../modules/quarantine/quarantine.routes.js';
import { finishedGoodsRouter } from '../modules/finished-goods/finished-goods.routes.js';
import { productionPlanRouter } from '../modules/production-planning/production-plan.routes.js';
import { materialRequirementsRouter } from '../modules/material-requirements/material-requirements.routes.js';
import {
  furnaceRouter,
  furnaceCapacityRouter
} from '../modules/furnace-capacity/furnace-capacity.routes.js';
import {
  workforceRouter,
  workforceCapacityRouter
} from '../modules/workforce-capacity/workforce-capacity.routes.js';
import { constraintAnalysisRouter } from '../modules/constraint-analysis/constraint-analysis.routes.js';
import { productionJobRouter } from '../modules/production-job/production-job.routes.js';
import { productionScheduleRouter } from '../modules/production-schedule/production-schedule.routes.js';
import { qualityInspectionRouter } from '../modules/quality-inspection/quality-inspection.routes.js';
import { metallurgicalLabRouter } from '../modules/metallurgical-lab/metallurgical-lab.routes.js';
import { qualityPlanningRouter } from '../modules/quality-planning/quality-planning.routes.js';
import { ncrRouter, capaRouter } from '../modules/ncr-capa/ncr-capa.routes.js';
import { qualityDocumentationRouter } from '../modules/quality-documentation/quality-documentation.routes.js';
import { machineRouter } from '../modules/machine/machine.routes.js';
import { maintenanceRouter } from '../modules/maintenance/maintenance.routes.js';
import { pyrometryRouter } from '../modules/pyrometry/pyrometry.routes.js';
import { attendanceRouter } from '../modules/attendance/attendance.routes.js';
import { dispatchRouter } from '../modules/dispatch/dispatch.routes.js';
import { financeRouter } from '../modules/finance/finance.routes.js';
import { costingRouter } from '../modules/costing/costing.routes.js';
import { billingRouter } from '../modules/billing/billing.routes.js';
import { reportingRouter } from '../modules/reporting/reporting.routes.js';
import { notificationRouter } from '../modules/notification/notification.routes.js';
import { searchRouter } from '../modules/search/search.routes.js';
import { purchaseOrderRouter } from '../modules/purchase-order/purchase-order.routes.js';
import { grnRouter } from '../modules/grn/grn.routes.js';

/**
 * Root API v1 Router
 */

export const v1Router = Router();

// Health, Liveness & Readiness Probes (SRE Orchestration)
v1Router.get('/health', async (_req: Request, res: Response) => {
  const dbHealth = await getDatabaseHealth();
  const isHealthy = dbHealth.status === 'healthy' || dbHealth.status === 'degraded' || config.app.isTest;
  const mem = process.memoryUsage();

  return ApiResponse.success(
    res,
    {
      status: isHealthy ? 'healthy' : dbHealth.status,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024)
      },
      database: dbHealth,
      version: config.app.version,
      environment: config.app.env
    },
    isHealthy ? 'Astralis ERP Backend API is operational' : 'Astralis ERP Backend is degraded/unhealthy',
    isHealthy ? 200 : 503
  );
});

v1Router.get('/health/liveness', (_req: Request, res: Response) => {
  return ApiResponse.success(
    res,
    { status: 'alive', timestamp: new Date().toISOString(), uptimeSeconds: Math.floor(process.uptime()) },
    'Process is alive'
  );
});

v1Router.get('/health/readiness', async (_req: Request, res: Response) => {
  const dbHealth = await getDatabaseHealth();
  const isReady = dbHealth.status === 'healthy' || dbHealth.status === 'degraded' || config.app.isTest;

  return ApiResponse.success(
    res,
    {
      ready: isReady,
      databaseState: dbHealth.connectionState,
      pingLatencyMs: dbHealth.pingLatencyMs
    },
    isReady ? 'Ready for traffic' : 'Not ready for traffic',
    isReady ? 200 : 503
  );
});

// Domain Route Mount Points
v1Router.use('/auth', authRouter);
v1Router.use('/rbac', rbacRouter);
v1Router.use('/audit', auditRouter);
v1Router.use('/customers', customerRouter);
v1Router.use('/items', itemRouter);
v1Router.use('/recipes', recipeRouter);
v1Router.use('/specifications', specificationRouter);
v1Router.use('/heat-lots', heatLotRouter);
v1Router.use('/inventory', inventoryRouter);
v1Router.use('/warehouses', warehouseRouter);
v1Router.use('/quarantine', quarantineRouter);
v1Router.use('/finished-goods', finishedGoodsRouter);
v1Router.use('/production-plans', productionPlanRouter);
v1Router.use('/material-requirements', materialRequirementsRouter);
v1Router.use('/furnaces', furnaceRouter);
v1Router.use('/furnace-capacity', furnaceCapacityRouter);
v1Router.use('/workforce', workforceRouter);
v1Router.use('/workforce-capacity', workforceCapacityRouter);
v1Router.use('/constraint-analysis', constraintAnalysisRouter);
v1Router.use('/production-jobs', productionJobRouter);
v1Router.use('/production-schedules', productionScheduleRouter);
v1Router.use('/quality-inspections', qualityInspectionRouter);
v1Router.use('/metallurgical-lab', metallurgicalLabRouter);
v1Router.use('/quality-plans', qualityPlanningRouter);
v1Router.use('/ncrs', ncrRouter);
v1Router.use('/capas', capaRouter);
v1Router.use('/quality-documents', qualityDocumentationRouter);
v1Router.use('/machines', machineRouter);
v1Router.use('/maintenance', maintenanceRouter);
v1Router.use('/pyrometry', pyrometryRouter);
v1Router.use('/attendance', attendanceRouter);
v1Router.use('/dispatches', dispatchRouter);
v1Router.use('/finance', financeRouter);
v1Router.use('/costing', costingRouter);
v1Router.use('/billing', billingRouter);
v1Router.use('/reporting', reportingRouter);
v1Router.use('/notifications', notificationRouter);
v1Router.use('/search', searchRouter);
v1Router.use('/purchase-orders', purchaseOrderRouter);
v1Router.use('/grn', grnRouter);
v1Router.use('/material-receipts', grnRouter);
v1Router.use('/batch-orders', productionJobRouter);
v1Router.use('/planning', productionJobRouter);









