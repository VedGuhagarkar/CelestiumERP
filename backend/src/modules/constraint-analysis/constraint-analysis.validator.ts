import { z } from 'zod';
import { ValidationSchema } from '../../core/middleware/validate.middleware.js';

export const evaluatePlanParamsSchema: ValidationSchema = {
  params: z.object({
    planId: z.string().trim().min(1, 'Plan ID is required')
  })
};

export const evaluateBatchSchema: ValidationSchema = {
  body: z.object({
    itemId: z.string().trim().min(1, 'Item ID is required'),
    itemCode: z.string().trim().toUpperCase(),
    materialGrade: z.string().trim().min(1, 'Material grade is required'),
    plannedQuantity: z.number().positive('Planned quantity must be positive'),
    recipeId: z.string().trim().optional(),
    specificationId: z.string().trim().optional(),
    assignedFurnaceId: z.string().trim().optional(),
    assignedEmployeeIds: z.array(z.string().trim()).optional(),
    targetDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
    shift: z.enum(['SHIFT_1_MORNING', 'SHIFT_2_EVENING', 'SHIFT_3_NIGHT', 'GENERAL_DAY']).optional(),
    targetTemperatureC: z.number().min(0).max(2000).optional(),
    processFamily: z.string().trim().optional(),
    totalBatchWeightKg: z.number().positive().optional()
  })
};

export const factoryAuditQuerySchema: ValidationSchema = {
  query: z.object({
    limit: z.string().optional(),
    customerCode: z.string().trim().toUpperCase().optional(),
    materialGrade: z.string().trim().optional(),
    status: z.enum(['PLANNED', 'CONFIRMED', 'IN_PROGRESS']).optional()
  })
};
