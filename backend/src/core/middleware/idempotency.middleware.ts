import { Request, Response, NextFunction } from 'express';
import { ConflictError } from '../errors/app-error.js';

interface CachedResponse {
  statusCode: number;
  body: any;
  timestamp: number;
}

// In-memory cache for idempotency keys (TTL: 1 hour)
const idempotencyStore = new Map<string, CachedResponse>();
const TTL_MS = 60 * 60 * 1000;

/**
 * Enterprise Idempotency Middleware
 * Reference: CelestiumERP.md Section 1.8
 */

export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const idempotencyKey = req.headers['idempotency-key'] as string;

  if (!idempotencyKey || !['POST', 'PUT', 'PATCH'].includes(req.method)) {
    return next();
  }

  const cacheKey = `${req.tenantId || 'global'}:${idempotencyKey}`;
  const now = Date.now();

  const cached = idempotencyStore.get(cacheKey);
  if (cached) {
    if (now - cached.timestamp < TTL_MS) {
      // Return cached response directly
      res.status(cached.statusCode).json({
        ...cached.body,
        _idempotencyReplay: true
      });
      return;
    }
    idempotencyStore.delete(cacheKey);
  }

  // Intercept json() calls to cache response payload
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      idempotencyStore.set(cacheKey, {
        statusCode: res.statusCode,
        body,
        timestamp: Date.now()
      });
    }
    return originalJson(body);
  };

  req.idempotencyKey = idempotencyKey;
  next();
}
