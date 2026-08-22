import { z } from 'zod';
import { ValidationSchema } from '../../core/middleware/validate.middleware.js';

const scheduleStatusEnum = z.enum([
  'SCHEDULED',
  'RESCHEDULED',
  'UNSCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
]);

const jobPriorityEnum = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT', 'AOG_CRITICAL']);

const shiftEnum = z.enum([
  'SHIFT_1_MORNING',
  'SHIFT_2_EVENING',
  'SHIFT_3_NIGHT',
  'GENERAL_DAY'
]);

export const scheduleJobSchema: ValidationSchema = {
  body: z
    .object({
      jobId: z.string().trim().min(1, 'Job ID is required'),
      furnaceId: z.string().trim().min(1, 'Furnace ID is required'),
      operatorId: z.string().trim().optional(),
      shift: shiftEnum.optional(),
      plannedStartTime: z.string().or(z.date()),
      plannedEndTime: z.string().or(z.date()),
      overrideConstraints: z.boolean().optional().default(false),
      overrideReason: z.string().trim().optional(),
      notes: z.string().trim().max(500).optional()
    })
    .refine(
      (data) => {
        const start = new Date(data.plannedStartTime).getTime();
        const end = new Date(data.plannedEndTime).getTime();
        return end > start;
      },
      {
        message: 'Planned end time must be strictly after planned start time',
        path: ['plannedEndTime']
      }
    )
};

export const rescheduleJobSchema: ValidationSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Schedule ID is required')
  }),
  body: z
    .object({
      newFurnaceId: z.string().trim().optional(),
      newOperatorId: z.string().trim().optional(),
      newShift: shiftEnum.optional(),
      newPlannedStartTime: z.string().or(z.date()),
      newPlannedEndTime: z.string().or(z.date()),
      overrideConstraints: z.boolean().optional().default(false),
      overrideReason: z.string().trim().optional(),
      reason: z.string().trim().min(3, 'Reschedule reason is required (min 3 characters)'),
      notes: z.string().trim().max(500).optional()
    })
    .refine(
      (data) => {
        const start = new Date(data.newPlannedStartTime).getTime();
        const end = new Date(data.newPlannedEndTime).getTime();
        return end > start;
      },
      {
        message: 'New planned end time must be strictly after new planned start time',
        path: ['newPlannedEndTime']
      }
    )
};

export const unscheduleJobSchema: ValidationSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Schedule ID is required')
  }),
  body: z.object({
    reason: z.string().trim().min(3, 'Unschedule reason is required (min 3 characters)'),
    notes: z.string().trim().max(500).optional()
  })
};

export const queryScheduleSchema: ValidationSchema = {
  query: z.object({
    furnaceId: z.string().trim().optional(),
    operatorId: z.string().trim().optional(),
    status: scheduleStatusEnum.optional(),
    priority: jobPriorityEnum.optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    search: z.string().trim().optional(),
    page: z.string().optional(),
    limit: z.string().optional()
  })
};

export const getScheduleByIdSchema: ValidationSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Schedule ID is required')
  })
};
