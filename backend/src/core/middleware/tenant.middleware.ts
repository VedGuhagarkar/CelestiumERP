import { Request, Response, NextFunction } from 'express';
import { config } from '../../config/app.config.js';
import { BadRequestError, ForbiddenError } from '../errors/app-error.js';
import { TenantContextHolder } from '../context/tenant-context.js';

/**
 * Tenant Isolation & Context Enforcement Middleware
 *
 * ARCHITECTURAL CONTRACT:
 * 1. Resolves authoritative tenant context from cryptographic claims (req.user.tenantId) or client header (x-tenant-id).
 * 2. Cross-Tenant Spoof Guard: If authenticated, req.user.tenantId MUST strictly match requested x-tenant-id.
 * 3. Injects tenant context into AsyncLocalStorage for end-to-end request tracing.
 *
 * Reference: CelestiumERP.md Section 1.1, 1.5 & Section 2.2
 */
export function tenantMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const headerTenantId = req.headers['x-tenant-id'] as string | undefined;
  const userTenantId = req.user?.tenantId;

  // 1. Cross-tenant spoofing prevention
  if (userTenantId && headerTenantId && userTenantId !== headerTenantId) {
    return next(
      new ForbiddenError('Security Alert: Cross-tenant access denied. Header tenant does not match authenticated token claim.')
    );
  }

  // 2. Authoritative resolution: Authenticated token claim takes absolute precedence over header
  const resolvedTenantId = userTenantId || headerTenantId || config.tenant.defaultTenantId;

  if (!resolvedTenantId) {
    return next(new BadRequestError('Tenant context missing: Provide a valid x-tenant-id header'));
  }

  req.tenantId = resolvedTenantId;

  // 3. Bind to AsyncLocalStorage for asynchronous promise lifecycle tracking
  TenantContextHolder.run(
    {
      tenantId: resolvedTenantId,
      userId: req.user?.userId,
      userRoles: req.user?.roles,
      correlationId: (req.headers['x-correlation-id'] as string) || `req-${Date.now()}`
    },
    () => {
      next();
    }
  );
}
