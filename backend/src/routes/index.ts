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

/**
 * Root API v1 Router
 */

export const v1Router = Router();

// Health Check Endpoint
v1Router.get('/health', async (_req: Request, res: Response) => {
  const dbHealth = await getDatabaseHealth();

  return ApiResponse.success(
    res,
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: dbHealth,
      version: config.app.version,
      environment: config.app.env
    },
    'Astralis ERP Backend API is operational'
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








