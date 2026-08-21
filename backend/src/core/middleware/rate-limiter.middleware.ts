import rateLimit from 'express-rate-limit';
import { config } from '../../config/app.config.js';
import { ApiResponse } from '../responses/api-response.js';

/**
 * Standard API Rate Limiter
 */

export const apiRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    ApiResponse.error(
      res,
      'Too many requests from this IP, please try again later',
      429,
      'RATE_LIMIT_EXCEEDED'
    );
  }
});
