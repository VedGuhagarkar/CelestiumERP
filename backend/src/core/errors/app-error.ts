/**
 * Standardized Domain Exception Hierarchy for Astralis ERP
 * Reference: CelestiumERP.md Section 1.6 & 1.10
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errorCode: string;
  public readonly details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    errorCode: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request', details?: any, errorCode: string = 'BAD_REQUEST') {
    super(message, 400, errorCode, true, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized: Authentication required', details?: any, errorCode: string = 'UNAUTHORIZED') {
    super(message, 401, errorCode, true, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden: Insufficient permissions for this resource', details?: any, errorCode: string = 'FORBIDDEN') {
    super(message, 403, errorCode, true, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', details?: any, errorCode: string = 'NOT_FOUND') {
    super(message, 404, errorCode, true, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict: Resource state conflict or unique constraint violation', details?: any, errorCode: string = 'CONFLICT') {
    super(message, 409, errorCode, true, details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', details?: any, errorCode: string = 'VALIDATION_ERROR') {
    super(message, 422, errorCode, true, details);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message: string = 'Unprocessable entity', details?: any, errorCode: string = 'UNPROCESSABLE_ENTITY') {
    super(message, 422, errorCode, true, details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too many requests: Rate limit exceeded', details?: any, errorCode: string = 'RATE_LIMIT_EXCEEDED') {
    super(message, 429, errorCode, true, details);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed', details?: any, errorCode: string = 'DATABASE_ERROR') {
    super(message, 500, errorCode, true, details);
  }
}

export class InvariantViolationError extends AppError {
  constructor(message: string = 'System invariant violated', details?: any, errorCode: string = 'INVARIANT_VIOLATION') {
    super(message, 400, errorCode, true, details);
  }
}

export class DomainError extends AppError {
  constructor(message: string = 'Business domain rule violation', details?: any, errorCode: string = 'DOMAIN_RULE_VIOLATION') {
    super(message, 400, errorCode, true, details);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', details?: any, errorCode: string = 'INTERNAL_ERROR') {
    super(message, 500, errorCode, false, details);
  }
}
