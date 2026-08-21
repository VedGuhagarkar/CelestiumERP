import { Response } from 'express';

/**
 * Standardized API Response Envelope
 * Reference: CelestiumERP.md Section 1.6
 */

export interface ApiResponsePayload<T = any> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
    timestamp: string;
    correlationId?: string;
  };
  error?: {
    code: string;
    details?: any;
    stack?: string;
  };
}

export class ApiResponse {
  static success<T>(
    res: Response,
    data?: T,
    message: string = 'Operation completed successfully',
    statusCode: number = 200
  ): Response {
    const payload: ApiResponsePayload<T> = {
      success: true,
      statusCode,
      message,
      data,
      meta: {
        timestamp: new Date().toISOString()
      }
    };
    return res.status(statusCode).json(payload);
  }

  static created<T>(
    res: Response,
    data: T,
    message: string = 'Resource created successfully'
  ): Response {
    return this.success(res, data, message, 201);
  }

  static noContent(res: Response): Response {
    return res.status(204).send();
  }

  static paginated<T>(
    res: Response,
    items: T[],
    page: number,
    limit: number,
    total: number,
    message: string = 'Records retrieved successfully'
  ): Response {
    const totalPages = Math.ceil(total / limit) || 1;
    const payload: ApiResponsePayload<T[]> = {
      success: true,
      statusCode: 200,
      message,
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        timestamp: new Date().toISOString()
      }
    };
    return res.status(200).json(payload);
  }

  static error(
    res: Response,
    message: string = 'An error occurred',
    statusCode: number = 500,
    errorCode: string = 'INTERNAL_ERROR',
    details?: any
  ): Response {
    const payload: ApiResponsePayload = {
      success: false,
      statusCode,
      message,
      error: {
        code: errorCode,
        details
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    };
    return res.status(statusCode).json(payload);
  }
}
