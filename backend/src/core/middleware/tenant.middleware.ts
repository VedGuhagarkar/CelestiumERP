import { Request, Response, NextFunction } from 'express';
import { config } from '../../config/app.config.js';
import { BadRequestError } from '../errors/app-error.js';

/**
 * Tenant Context Middleware
 * Enforces tenant identification across all API routes.
 * Reference: CelestiumERP.md Section 1.1
 */

export function tenantMiddleware(req: Request, _res: Response, next: NextFunction): void {
  // 1. Check x-tenant-id header
  const headerTenantId = req.headers['x-tenant-id'] as string;

  // 2. Check user claims if already authenticated
  const userTenantId = req.user?.tenantId;

  // 3. Resolve tenantId or fallback to configured default tenant
  const resolvedTenantId = headerTenantId || userTenantId || config.tenant.defaultTenantId;

  if (!resolvedTenantId) {
    return next(new BadRequestError('Tenant context missing: Provide x-tenant-id header'));
  }

  // Cross-tenant mismatch guard: if authenticated user's tenant differs from requested header
  if (userTenantId && headerTenantId && userTenantId !== headerTenantId) {
    return next(new BadRequestError('Security alert: Cross-tenant header mismatch detected'));
  }

  req.tenantId = resolvedTenantId;
  next();
}
