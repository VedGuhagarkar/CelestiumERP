import { Router, RequestHandler } from 'express';
import { authenticateJwt } from '../middleware/auth.middleware.js';
import { tenantMiddleware } from '../middleware/tenant.middleware.js';
import { requirePermission } from '../middleware/rbac.middleware.js';
import { validateRequest, ValidationSchema } from '../middleware/validate.middleware.js';
import { asyncHandler } from '../middleware/async-handler.middleware.js';
import { PermissionKey } from '../constants/permissions.js';

/**
 * Route Configuration Options & Helper Conventions
 *
 * ARCHITECTURAL CONTRACT:
 * - Routes MUST only compose HTTP endpoints and middleware chains.
 * - Routes MUST NOT contain business decisions or data transformations.
 * - Routes MUST NOT import Services, Repositories, or Models directly.
 * Reference: CelestiumERP.md Section 1.9 & 7
 */

export interface RouteEndpointConfig {
  path: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  handler: (req: any, res: any, next?: any) => Promise<any> | any;
  permissions?: PermissionKey[];
  requireAuth?: boolean;
  validation?: ValidationSchema;
  additionalMiddleware?: RequestHandler[];
}

export function registerRoute(router: Router, config: RouteEndpointConfig): void {
  const middlewares: RequestHandler[] = [tenantMiddleware];

  // 1. Authentication (Default true unless explicitly disabled)
  if (config.requireAuth !== false) {
    middlewares.push(authenticateJwt);
  }

  // 2. RBAC Permission Checks
  if (config.permissions && config.permissions.length > 0) {
    middlewares.push(requirePermission(...config.permissions));
  }

  // 3. Request Payload/Query Validation
  if (config.validation) {
    middlewares.push(validateRequest(config.validation));
  }

  // 4. Custom Middlewares
  if (config.additionalMiddleware) {
    middlewares.push(...config.additionalMiddleware);
  }

  // 5. Async Controller Action
  middlewares.push(asyncHandler(config.handler));

  // Mount route onto router
  router[config.method](config.path, ...middlewares);
}
