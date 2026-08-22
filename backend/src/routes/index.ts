import { Router, Request, Response } from 'express';
import { ApiResponse } from '../core/responses/api-response.js';
import { getDatabaseHealth } from '../core/database/health.js';
import { config } from '../config/app.config.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import { rbacRouter } from '../modules/rbac/rbac.routes.js';
import { auditRouter } from '../modules/audit/audit.routes.js';
import { customerRouter } from '../modules/customer/customer.routes.js';
import { itemRouter } from '../modules/item/item.routes.js';

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
