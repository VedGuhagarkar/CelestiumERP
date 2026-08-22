import { z } from 'zod';
import { ValidationSchema } from '../../core/middleware/validate.middleware.js';

const jobStatusEnum = z.enum([
  'PENDING_RELEASE',
  'RELEASED',
  'STAGED',
  'LOADED',
  'HEATING',
  'SOAKING',
  'QUENCHING',
  'TEMPERING',
  'COOLING',
  'UNLOADED',
  'AWAITING_QC',
  'COMPLETED',
  'ON_HOLD',
  'CANCELLED'
]);

const jobPriorityEnum = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT', 'AOG_CRITICAL']);

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
