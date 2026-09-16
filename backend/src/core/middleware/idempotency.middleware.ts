import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { IdempotencyConflictError } from '../errors/app-error.js';

export interface IdempotencyEntry {
  status: 'IN_FLIGHT' | 'COMPLETED';
  payloadHash: string;
  statusCode?: number;
  body?: any;
  timestamp: number;
}

// In-memory cache for idempotency keys (TTL: 1 hour)
const idempotencyStore = new Map<string, IdempotencyEntry>();
const TTL_MS = 60 * 60 * 1000;

export function hashPayload(body: any): string {
  if (body === undefined || body === null) return '';
  try {
    const str = typeof body === 'string' ? body : JSON.stringify(body);
    return crypto.createHash('sha256').update(str).digest('hex');
  } catch {
    return '';
  }
}

export function clearIdempotencyCache(): void {
  idempotencyStore.clear();
}

export function getIdempotencyEntry(key: string): IdempotencyEntry | undefined {
  return idempotencyStore.get(key);
}

export function setIdempotencyEntry(key: string, entry: IdempotencyEntry): void {
  idempotencyStore.set(key, entry);
}

/**
 * Enterprise Idempotency Middleware
 * Reference: CelestiumERP.md Section 1.7
 */

export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Prevent re-executing if already handled in the same pipeline (e.g. global + route-level)
  if ((req as any)._idempotencyProcessed) {
    return next();
  }

  const idempotencyKey = req.headers['idempotency-key'] as string;

  if (!idempotencyKey || !['POST', 'PUT', 'PATCH'].includes(req.method)) {
    return next();
  }

  (req as any)._idempotencyProcessed = true;

  const tenantId = (req as any).tenantId || (req.headers['x-tenant-id'] as string) || 'global';
  const cacheKey = `${tenantId}:${idempotencyKey}`;
  const now = Date.now();
  const currentPayloadHash = hashPayload(req.body);

  const existing = idempotencyStore.get(cacheKey);
  if (existing) {
    // Check if expired
    if (now - existing.timestamp >= TTL_MS) {
      idempotencyStore.delete(cacheKey);
    } else {
      // 1. In-flight collision detection (prevent concurrent double-clicks & parallel form submissions)
      if (existing.status === 'IN_FLIGHT') {
        return next(
          new IdempotencyConflictError(
            `A request with idempotency key '${idempotencyKey}' is currently in-flight. Duplicate simultaneous execution rejected.`
          )
        );
      }

      // 2. Completed request - verify payload hash matches
      if (existing.payloadHash && currentPayloadHash && existing.payloadHash !== currentPayloadHash) {
        return next(
          new IdempotencyConflictError(
            `Idempotency key '${idempotencyKey}' was previously used with a different request payload.`,
            undefined,
            'IDEMPOTENCY_PAYLOAD_MISMATCH'
          )
        );
      }

      // 3. Replay cached response directly
      res.status(existing.statusCode || 200).json({
        ...existing.body,
        _idempotencyReplay: true
      });
      return;
    }
  }

  // Atomically acquire in-flight lock
  idempotencyStore.set(cacheKey, {
    status: 'IN_FLIGHT',
    payloadHash: currentPayloadHash,
    timestamp: now
  });

  // Intercept json() calls to cache response payload on success, or release in-flight on failure
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      idempotencyStore.set(cacheKey, {
        status: 'COMPLETED',
        payloadHash: currentPayloadHash,
        statusCode: res.statusCode,
        body,
        timestamp: Date.now()
      });
    } else {
      // Request failed or returned error; remove in-flight lock so caller may retry
      const current = idempotencyStore.get(cacheKey);
      if (current && current.status === 'IN_FLIGHT') {
        idempotencyStore.delete(cacheKey);
      }
    }
    return originalJson(body);
  };

  // Listen for request abort or close to clean up abandoned in-flight locks
  res.on('close', () => {
    if (!res.writableEnded) {
      const current = idempotencyStore.get(cacheKey);
      if (current && current.status === 'IN_FLIGHT') {
        idempotencyStore.delete(cacheKey);
      }
    }
  });

  req.idempotencyKey = idempotencyKey;
  next();
}
