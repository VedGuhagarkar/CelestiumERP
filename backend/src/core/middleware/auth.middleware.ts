import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/app.config.js';
import { UnauthorizedError } from '../errors/app-error.js';
import { AuthenticatedUserPayload } from '../types/express.js';

/**
 * JWT Authentication Middleware
 * Reference: CelestiumERP.md Section 2.2
 */

export function authenticateJwt(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Authentication required: Missing Bearer token'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret) as AuthenticatedUserPayload;
    req.user = decoded;
    if (decoded.tenantId) {
      req.tenantId = decoded.tenantId;
    }
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Session expired: Access token has expired'));
    }
    return next(new UnauthorizedError('Invalid access token'));
  }
}
