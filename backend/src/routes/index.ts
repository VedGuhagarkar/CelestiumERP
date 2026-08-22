import { Router, Request, Response } from 'express';
import { ApiResponse } from '../core/responses/api-response.js';
import { getDatabaseHealth } from '../core/database/health.js';
import { config } from '../config/app.config.js';

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

// Domain route mount points will be registered here as domain modules are built
