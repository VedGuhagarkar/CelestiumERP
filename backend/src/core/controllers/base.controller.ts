import { Request, Response } from 'express';
import { ApiResponse } from '../responses/api-response.js';
import { BadRequestError, UnauthorizedError } from '../errors/app-error.js';
import { AuthenticatedUserPayload } from '../types/express.js';
import { PaginationOptions } from '../types/pagination.js';

/**
 * Base Controller Convention
 * Provides standardized parameter extraction, tenant safety, and HTTP response envelopes.
 *
 * ARCHITECTURAL CONTRACT:
 * - Controllers MUST only call Services.
 * - Controllers MUST NOT import or call Repositories or Models directly.
 * - Controllers MUST NOT execute raw database queries.
 * Reference: CelestiumERP.md Section 1.9 & 7
 */

export abstract class BaseController {
  /**
   * Extract and guarantee active tenantId from request context
   */
  protected getTenantId(req: Request): string {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new BadRequestError('Tenant context is missing from request');
    }
    return tenantId;
  }

  /**
   * Extract and guarantee authenticated user payload
   */
  protected getUser(req: Request): AuthenticatedUserPayload {
    if (!req.user) {
      throw new UnauthorizedError('Authenticated user context required');
    }
    return req.user;
  }

  /**
   * Extract pagination and query sorting parameters safely
   */
  protected parsePagination(req: Request): PaginationOptions {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const sortField = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as string)?.toLowerCase() === 'asc' ? 1 : -1;

    return {
      page: Math.max(1, page),
      limit: Math.min(100, Math.max(1, limit)),
      sort: { [sortField]: sortOrder }
    };
  }

  /**
   * Standard Success (200 OK)
   */
  protected sendSuccess<T>(res: Response, data?: T, message?: string): Response {
    return ApiResponse.success(res, data, message);
  }

  /**
   * Standard Created (201 Created)
   */
  protected sendCreated<T>(res: Response, data: T, message?: string): Response {
    return ApiResponse.created(res, data, message);
  }

  /**
   * Standard Paginated List (200 OK)
   */
  protected sendPaginated<T>(
    res: Response,
    items: T[],
    page: number,
    limit: number,
    total: number,
    message?: string
  ): Response {
    return ApiResponse.paginated(res, items, page, limit, total, message);
  }

  /**
   * Standard No Content (204 No Content)
   */
  protected sendNoContent(res: Response): Response {
    return ApiResponse.noContent(res);
  }
}
