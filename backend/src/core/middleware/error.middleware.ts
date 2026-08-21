import { Request, Response, NextFunction } from 'express';
import { config } from '../../config/app.config.js';
import { logger } from '../../config/logger.config.js';
import { AppError } from '../errors/app-error.js';
import { ApiResponse } from '../responses/api-response.js';

/**
 * Centralized Error Handling Middleware
 * Reference: CelestiumERP.md Section 1.6
 */

export function errorMiddleware(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): Response {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errorCode = err.name || 'INTERNAL_ERROR';
  let details = err.details || null;

  // Handle Mongoose / MongoDB Duplicate Key Error (Code 11000)
  if (err.code === 11000) {
    statusCode = 409;
    errorCode = 'DUPLICATE_KEY_ERROR';
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate value violation: Record with this ${field} already exists`;
    details = err.keyValue;
  }

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError' && err.errors) {
    statusCode = 422;
    errorCode = 'MONGOOSE_VALIDATION_ERROR';
    message = 'Database validation failed';
    details = Object.values(err.errors).map((e: any) => ({
      path: e.path,
      message: e.message
    }));
  }

  // Handle Mongoose CastError (Invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    errorCode = 'INVALID_IDENTIFIER';
    message = `Invalid format for identifier '${err.value}'`;
  }

  // Log error (warnings for 4xx operational, errors with stack traces for 500s)
  if (statusCode >= 500) {
    logger.error(`[Unhandled Error] ${req.method} ${req.originalUrl}:`, err);
  } else {
    logger.warn(`[Client Error] ${req.method} ${req.originalUrl} (${statusCode}): ${message}`);
  }

  // Do not expose internal stacks in production
  const errorDetails = config.app.isProduction && statusCode === 500 ? undefined : details;

  return ApiResponse.error(res, message, statusCode, errorCode, errorDetails);
}
