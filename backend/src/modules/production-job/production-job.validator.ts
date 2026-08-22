import { z } from 'zod';
import { ValidationSchema } from '../../core/middleware/validate.middleware.js';

const jobStatusEnum = z.enum([
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'SCHEDULED',
  'IN_PROGRESS',
  'PAUSED',
  'QUALITY_CHECK',
  'STORAGE',
  'READY_FOR_DISPATCH',
  'DISPATCHED',
  'COMPLETED',
  'CANCELLED'
]);

const jobPriorityEnum = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT', 'AOG_CRITICAL']);

export const createDirectJobSchema: ValidationSchema = {
  body: z.object({
    customerId: z.string().trim().min(1, 'Customer ID is required'),
    itemId: z.string().trim().min(1, 'Item ID is required'),
    recipeId: z.string().trim().min(1, 'Recipe ID is required'),
    specificationId: z.string().trim().min(1, 'Specification ID is required'),
    targetQuantity: z.number().positive('Target quantity must be greater than zero'),
    priority: jobPriorityEnum.optional().default('NORMAL'),
    plannedStartDate: z.string().or(z.date()),
    targetCompletionDate: z.string().or(z.date()),
    assignedFurnaceId: z.string().trim().optional(),
    assignedOperatorId: z.string().trim().optional(),
    shift: z.string().trim().optional(),
    materialAllocations: z
      .array(
        z.object({
          heatLotId: z.string().trim().optional(),
          heatLotNumber: z.string().trim().toUpperCase().optional(),
          allocatedQuantity: z.number().positive(),
          uom: z.string().trim().min(1)
        })
      )
      .optional(),
    notes: z.string().trim().max(500).optional()
  })
};

export const updateJobSchema: ValidationSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Job ID is required')
  }),
  body: z.object({
    targetQuantity: z.number().positive().optional(),
    priority: jobPriorityEnum.optional(),
    plannedStartDate: z.string().or(z.date()).optional(),
    targetCompletionDate: z.string().or(z.date()).optional(),
    assignedFurnaceId: z.string().trim().optional(),
    assignedOperatorId: z.string().trim().optional(),
    shift: z.string().trim().optional(),
    notes: z.string().trim().max(500).optional()
  })
};

export const transitionJobSchema: ValidationSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Job ID is required')
  }),
  body: z.object({
    toStatus: jobStatusEnum,
    reason: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(500).optional()
  })
};

export const cancelJobSchema: ValidationSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Job ID is required')
  }),
  body: z.object({
    reason: z.string().trim().min(3, 'Cancellation reason is required (min 3 characters)'),
    notes: z.string().trim().max(500).optional()
  })
};

export const convertPlanToJobSchema: ValidationSchema = {
  params: z.object({
    planId: z.string().trim().min(1, 'Plan ID is required')
  }),
  body: z.object({
    assignedFurnaceId: z.string().trim().optional(),
    assignedOperatorId: z.string().trim().optional(),
    shift: z.enum(['SHIFT_1_MORNING', 'SHIFT_2_EVENING', 'SHIFT_3_NIGHT', 'GENERAL_DAY']).optional(),
    targetQuantity: z.number().positive().optional(),
    idempotencyKey: z.string().trim().max(100).optional(),
    notes: z.string().trim().max(500).optional()
  })
};

export const queryJobsSchema: ValidationSchema = {
  query: z.object({
    status: jobStatusEnum.optional(),
    furnaceId: z.string().trim().optional(),
    itemCode: z.string().trim().toUpperCase().optional(),
    planId: z.string().trim().optional(),
    priority: jobPriorityEnum.optional(),
    search: z.string().trim().optional(),
    page: z.string().optional(),
    limit: z.string().optional()
  })
};

export const getJobByIdSchema: ValidationSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Job ID is required')
  })
};
