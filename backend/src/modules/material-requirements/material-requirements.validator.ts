import { z } from 'zod';
import { ValidationSchema } from '../../core/middleware/validate.middleware.js';

export const calculateRequirementsSchema: ValidationSchema = {
  body: z.object({
    planIds: z.array(z.string().trim()).optional(),
    itemCodes: z.array(z.string().trim().toUpperCase()).optional(),
    startDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
    endDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional()
  })
};

export const createReservationSchema: ValidationSchema = {
  body: z.object({
    planId: z.string().trim().min(1, 'Plan ID is required'),
    jobCardId: z.string().trim().optional(),
    targetType: z.enum(['HEAT_LOT', 'INVENTORY_ITEM']),
    targetId: z.string().trim().min(1, 'Target ID is required'),
    reservedQuantity: z.number().positive('Reserved quantity must be greater than 0'),
    notes: z.string().trim().max(500).optional()
  })
};

export const releaseReservationSchema: ValidationSchema = {
  body: z.object({
    reason: z.string().trim().min(3, 'Release reason is required').max(500)
  }),
  params: z.object({
    id: z.string().trim().min(1, 'Reservation ID is required')
  })
};

export const queryShortageSchema: ValidationSchema = {
  query: z.object({
    itemCode: z.string().trim().toUpperCase().optional(),
    materialGrade: z.string().trim().optional(),
    severity: z.enum(['NONE', 'PARTIAL', 'CRITICAL']).optional(),
    page: z.string().optional(),
    limit: z.string().optional()
  })
};
