import { Router, Request, Response } from 'express';
import { ApiResponse } from '../core/responses/api-response.js';
import mongoose from 'mongoose';

/**
 * Root API v1 Router
 */

export const v1Router = Router();

// Health Check Endpoint
v1Router.get('/health', (_req: Request, res: Response) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  return ApiResponse.success(res, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      status: dbStatus,
      name: mongoose.connection.name || 'unconnected'
    },
    version: '1.0.0'
  }, 'Astralis ERP Backend API is operational');
});

// Domain route mount points will be registered here as domain modules are built
