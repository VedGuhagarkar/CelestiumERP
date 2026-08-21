import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { config } from './config/app.config.js';
import { tenantMiddleware } from './core/middleware/tenant.middleware.js';
import { idempotencyMiddleware } from './core/middleware/idempotency.middleware.js';
import { apiRateLimiter } from './core/middleware/rate-limiter.middleware.js';
import { errorMiddleware } from './core/middleware/error.middleware.js';
import { NotFoundError } from './core/errors/app-error.js';
import { v1Router } from './routes/index.js';

/**
 * Express Application Factory
 * Reference: CelestiumERP.md Section 1.10
 */

export function createApp(): Express {
  const app = express();

  // 1. Security & Headers
  app.use(helmet());
  app.use(
    cors({
      origin: config.server.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'Idempotency-Key']
    })
  );

  // 2. Performance & Parsing
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 3. Rate Limiting
  app.use(apiRateLimiter);

  // 4. Multi-Tenant Context & Idempotency Filter
  app.use(tenantMiddleware);
  app.use(idempotencyMiddleware);

  // 5. API Routes Mount Point
  app.use(config.app.apiPrefix, v1Router);

  // 6. 404 Route Handler
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`API route '${req.method} ${req.originalUrl}' not found`));
  });

  // 7. Centralized Error Handler Middleware (MUST be last)
  app.use(errorMiddleware);

  return app;
}
