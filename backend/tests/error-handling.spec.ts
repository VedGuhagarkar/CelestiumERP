import {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  UnprocessableEntityError,
  TooManyRequestsError,
  DatabaseError,
  InvariantViolationError,
  DomainError,
  InternalServerError
} from '../src/core/errors/app-error.js';
import { errorMiddleware } from '../src/core/middleware/error.middleware.js';
import { sanitizeObject } from '../src/config/logger.config.js';

describe('Centralized AppError & Error Middleware Subsystem', () => {
  describe('AppError Class Hierarchy', () => {
    it('should create BadRequestError with 400 status and code', () => {
      const err = new BadRequestError('Invalid parameter', { field: 'batchSize' });
      expect(err.statusCode).toBe(400);
      expect(err.errorCode).toBe('BAD_REQUEST');
      expect(err.isOperational).toBe(true);
      expect(err.details).toEqual({ field: 'batchSize' });
    });

    it('should create UnauthorizedError with 401 status', () => {
      const err = new UnauthorizedError();
      expect(err.statusCode).toBe(401);
      expect(err.errorCode).toBe('UNAUTHORIZED');
    });

    it('should create ForbiddenError with 403 status', () => {
      const err = new ForbiddenError();
      expect(err.statusCode).toBe(403);
      expect(err.errorCode).toBe('FORBIDDEN');
    });

    it('should create NotFoundError with 404 status', () => {
      const err = new NotFoundError('Furnace not found');
      expect(err.statusCode).toBe(404);
      expect(err.errorCode).toBe('NOT_FOUND');
    });

    it('should create ConflictError with 409 status', () => {
      const err = new ConflictError('Batch number exists');
      expect(err.statusCode).toBe(409);
      expect(err.errorCode).toBe('CONFLICT');
    });

    it('should create ValidationError with 422 status', () => {
      const err = new ValidationError('Schema validation failed', [{ path: 'temp', message: 'Too low' }]);
      expect(err.statusCode).toBe(422);
      expect(err.errorCode).toBe('VALIDATION_ERROR');
      expect(err.details.length).toBe(1);
    });

    it('should create TooManyRequestsError with 429 status', () => {
      const err = new TooManyRequestsError();
      expect(err.statusCode).toBe(429);
      expect(err.errorCode).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should create DatabaseError with 500 status', () => {
      const err = new DatabaseError('Connection timeout');
      expect(err.statusCode).toBe(500);
      expect(err.errorCode).toBe('DATABASE_ERROR');
    });

    it('should create InvariantViolationError with 400 status', () => {
      const err = new InvariantViolationError('Cannot complete job without quenching step');
      expect(err.statusCode).toBe(400);
      expect(err.errorCode).toBe('INVARIANT_VIOLATION');
    });

    it('should create DomainError with 400 status', () => {
      const err = new DomainError('Recipe austenitizing temp exceeds furnace design limit');
      expect(err.statusCode).toBe(400);
      expect(err.errorCode).toBe('DOMAIN_RULE_VIOLATION');
    });

    it('should create InternalServerError with 500 status and non-operational flag', () => {
      const err = new InternalServerError('Unexpected crash');
      expect(err.statusCode).toBe(500);
      expect(err.errorCode).toBe('INTERNAL_ERROR');
      expect(err.isOperational).toBe(false);
    });
  });

  describe('Error Middleware Response Serialization', () => {
    let mockReq: any;
    let mockRes: any;
    let mockNext: any;

    beforeEach(() => {
      mockReq = { method: 'POST', originalUrl: '/api/v1/jobs' };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
      };
      mockNext = jest.fn();
    });

    it('should transform AppError into standardized ApiResponse.error format', () => {
      const error = new ConflictError('Job card number already exists');
      errorMiddleware(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 409,
          message: 'Job card number already exists',
          error: {
            code: 'CONFLICT',
            details: undefined
          }
        })
      );
    });

    it('should transform MongoDB duplicate key error (code 11000) to 409 Conflict', () => {
      const mongoError = {
        code: 11000,
        keyValue: { jobCardNumber: 'JC-2026-0091' }
      };

      errorMiddleware(mongoError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 409,
          error: {
            code: 'DUPLICATE_KEY_ERROR',
            details: { jobCardNumber: 'JC-2026-0091' }
          }
        })
      );
    });

    it('should transform Mongoose ValidationError into 422 with field details', () => {
      const mongooseValError = {
        name: 'ValidationError',
        errors: {
          setpointTemp: { path: 'setpointTemp', message: 'Setpoint temperature is required' }
        }
      };

      errorMiddleware(mongooseValError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(422);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 422,
          error: {
            code: 'MONGOOSE_VALIDATION_ERROR',
            details: [{ path: 'setpointTemp', message: 'Setpoint temperature is required' }]
          }
        })
      );
    });

    it('should transform JWT JsonWebTokenError into 401 Unauthorized', () => {
      const jwtError = { name: 'JsonWebTokenError', message: 'invalid signature' };
      errorMiddleware(jwtError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 401,
          error: {
            code: 'INVALID_TOKEN',
            details: null
          }
        })
      );
    });
  });

  describe('Sensitive Log Sanitizer (sanitizeObject)', () => {
    it('should deeply mask all sensitive fields', () => {
      const sensitivePayload = {
        user: 'metallurgist@factory.com',
        password: 'SuperSecretPassword123!',
        nested: {
          refreshToken: 'refresh_token_xyz_987',
          jwtSecret: 'top_secret_key',
          apiKey: 'key_12345'
        },
        items: [
          { token: 'secret_item_token', valid: true }
        ]
      };

      const sanitized = sanitizeObject(sensitivePayload);

      expect(sanitized.user).toBe('metallurgist@factory.com');
      expect(sanitized.password).toBe('***MASKED***');
      expect(sanitized.nested.refreshToken).toBe('***MASKED***');
      expect(sanitized.nested.jwtSecret).toBe('***MASKED***');
      expect(sanitized.nested.apiKey).toBe('***MASKED***');
      expect(sanitized.items[0].token).toBe('***MASKED***');
      expect(sanitized.items[0].valid).toBe(true);
    });
  });
});
