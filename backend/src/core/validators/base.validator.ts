import { z } from 'zod';

/**
 * Common Request Validation Schemas
 * Standardizes DTO parsing across all domain modules.
 */

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc', 'ASC', 'DESC']).optional().default('desc'),
  search: z.string().trim().optional()
});

export const IdParamSchema = z.object({
  id: z.string().min(1, 'Identifier parameter is required')
});

export const CodeParamSchema = z.object({
  code: z.string().min(1, 'Code parameter is required')
});

export const DateRangeQuerySchema = z.object({
  startDate: z.string().datetime({ message: 'startDate must be valid ISO datetime' }).optional(),
  endDate: z.string().datetime({ message: 'endDate must be valid ISO datetime' }).optional()
});

export type PaginationQueryDto = z.infer<typeof PaginationQuerySchema>;
export type IdParamDto = z.infer<typeof IdParamSchema>;
export type CodeParamDto = z.infer<typeof CodeParamSchema>;
export type DateRangeQueryDto = z.infer<typeof DateRangeQuerySchema>;
