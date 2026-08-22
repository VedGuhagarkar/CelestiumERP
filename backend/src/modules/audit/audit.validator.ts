import { z } from 'zod';
import { ValidationSchema } from '../../core/middleware/validate.middleware.js';

export const queryAuditSchema: ValidationSchema = {
  query: z.object({
    entityType: z.string().trim().optional(),
    entityId: z.string().trim().optional(),
    actorId: z.string().trim().optional(),
    action: z.string().trim().optional(),
    status: z.enum(['SUCCESS', 'FAILURE']).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional()
  })
};

export const entityHistorySchema: ValidationSchema = {
  params: z.object({
    entityType: z.string().trim().min(1, 'Entity type is required'),
    entityId: z.string().trim().min(1, 'Entity ID is required')
  })
};
