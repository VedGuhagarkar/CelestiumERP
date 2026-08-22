import { z } from 'zod';
import { ValidationSchema } from '../../core/middleware/validate.middleware.js';

const planPriorityEnum = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT', 'AOG_CRITICAL']);
const planStatusEnum = z.enum([
  'DRAFT',
  'PLANNED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'ON_HOLD'
]);

export const createProductionPlanSchema: ValidationSchema = {
  body: z.object({
    title: z.string().trim().min(3, 'Plan title must be at least 3 characters').max(150),
    priority: planPriorityEnum.default('NORMAL'),
    customerId: z.string().trim().min(1, 'Customer ID is required'),
    itemId: z.string().trim().min(1, 'Item ID is required'),
    recipeId: z.string().trim().min(1, 'Recipe ID is required'),
    specificationId: z.string().trim().min(1, 'Specification ID is required'),
    plannedQuantity: z.number().positive('Planned quantity must be greater than 0'),
    plannedStartDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
    targetCompletionDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
    requiredHeatLotNumber: z.string().trim().max(50).optional(),
    compatibleFurnaceTypes: z.array(z.string().trim()).optional(),
    estimatedFurnaceHours: z.number().min(0).optional(),
    operatorCertificationsRequired: z.array(z.string().trim()).optional(),
    maxBatchWeightKg: z.number().positive().optional(),
    notes: z.string().trim().max(1000).optional()
  })
};

export const updateProductionPlanSchema: ValidationSchema = {
  body: z.object({
    title: z.string().trim().min(3).max(150).optional(),
    priority: planPriorityEnum.optional(),
    plannedQuantity: z.number().positive().optional(),
    plannedStartDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
    targetCompletionDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
    requiredHeatLotNumber: z.string().trim().max(50).nullable().optional(),
    compatibleFurnaceTypes: z.array(z.string().trim()).optional(),
    estimatedFurnaceHours: z.number().min(0).optional(),
    operatorCertificationsRequired: z.array(z.string().trim()).optional(),
    maxBatchWeightKg: z.number().positive().nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional()
  }),
  params: z.object({
    id: z.string().trim().min(1, 'Plan ID is required')
  })
};

export const updatePlanStatusSchema: ValidationSchema = {
  body: z.object({
    status: planStatusEnum,
    reason: z.string().trim().max(500).optional()
  }),
  params: z.object({
    id: z.string().trim().min(1, 'Plan ID is required')
  })
};

export const queryProductionPlanSchema: ValidationSchema = {
  query: z.object({
    search: z.string().trim().optional(),
    status: planStatusEnum.optional(),
    priority: planPriorityEnum.optional(),
    customerCode: z.string().trim().optional(),
    itemCode: z.string().trim().optional(),
    materialGrade: z.string().trim().optional(),
    processFamily: z.string().trim().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional()
  })
};
