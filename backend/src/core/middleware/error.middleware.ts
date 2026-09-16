import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { config } from '../../config/app.config.js';
import { logger } from '../../config/logger.config.js';
import { AppError } from '../errors/app-error.js';
import { ApiResponse } from '../responses/api-response.js';

/**
 * Centralized Error Handling Middleware
 * Standardizes all application, database, validation, and unhandled errors into uniform API responses.
 * Reference: CelestiumERP.md Section 1.6
 */

export function errorMiddleware(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): Response {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal server error';
  let errorCode = err.errorCode || err.name || 'INTERNAL_ERROR';
  let details = err.details || null;

  // 1. Handle AppError Hierarchy
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errorCode = err.errorCode;
    details = err.details;
  }
  // 2. Handle MongoDB Duplicate Key Error (Code 11000)
  else if (err.code === 11000) {
    statusCode = 409;
    errorCode = 'DUPLICATE_KEY_ERROR';
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate value violation: Record with this ${field} already exists`;
    details = err.keyValue;
  }
  // 3. Handle Mongoose Validation Error
  else if (err.name === 'ValidationError' && err.errors) {
    statusCode = 422;
    errorCode = 'MONGOOSE_VALIDATION_ERROR';
    message = 'Database validation failed';
    details = Object.values(err.errors).map((e: any) => ({
      path: e.path,
      message: e.message
    }));
  }
  // 4. Handle Raw Zod Validation Error (if not captured in middleware)
  else if (err instanceof ZodError || err.name === 'ZodError') {
    statusCode = 422;
    errorCode = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    details = (err as any).errors?.map((e: any) => ({
      path: Array.isArray(e.path) ? e.path.join('.') : String(e.path || ''),
      message: e.message
    }));
  }
  // 5. Handle Mongoose CastError (Invalid ObjectId or Type)
  else if (err.name === 'CastError') {
    statusCode = 400;
    errorCode = 'INVALID_IDENTIFIER';
    const rawVal = typeof err.value === 'object' ? JSON.stringify(err.value) : String(err.value ?? '');
    const safeVal = rawVal.length > 80 ? rawVal.substring(0, 80) + '...' : rawVal;
    message = `Invalid format for identifier '${safeVal}'`;
  }
  // 6. Handle BSON ObjectId Parsing Error
  else if (err.name === 'BSONError') {
    statusCode = 400;
    errorCode = 'INVALID_IDENTIFIER';
    message = 'Invalid identifier or ObjectId binary representation';
  }
  // 7. Handle URI Malformed Error (bad percent encoding in params)
  else if (err instanceof URIError) {
    statusCode = 400;
    errorCode = 'MALFORMED_URI';
    message = 'Malformed URI encoding in request path or query parameters';
  }
  // 8. Handle Payload Too Large
  else if (err.type === 'entity.too.large' || err.name === 'PayloadTooLargeError' || err.status === 413) {
    statusCode = 413;
    errorCode = 'PAYLOAD_TOO_LARGE';
    message = 'Request payload size exceeds the maximum allowable limit';
  }
  // 9. Handle JWT Authentication Errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = 'INVALID_TOKEN';
    message = 'Invalid authentication token signature';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired';
  }
  // 10. Handle JSON Syntax Errors in Request Body
  else if (err instanceof SyntaxError && ('body' in err || err.status === 400)) {
    statusCode = 400;
    errorCode = 'MALFORMED_JSON';
    message = 'Malformed JSON in request payload';
  }

  // Log error (warning for 4xx, error with stack for 500s)
  if (statusCode >= 500) {
    logger.error(`[500 Server Error] ${req.method} ${req.originalUrl}:`, err);
  } else {
    logger.warn(`[${statusCode} Client Error] ${req.method} ${req.originalUrl} (${errorCode}): ${message}`);
  }

  // Security Hardening: In production, mask internal 500 errors and suppress internal stack/details
  if (config.app.isProduction && statusCode >= 500) {
    message = 'Internal server error';
    details = undefined;
  }

  return ApiResponse.error(res, message, statusCode, errorCode, details);
}
