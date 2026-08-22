import { z } from 'zod';

export const dateRangeFilterSchema = z.object({
  startDate: z
    .string()
    .datetime({ message: 'startDate must be a valid ISO datetime' })
    .optional(),
  endDate: z
    .string()
    .datetime({ message: 'endDate must be a valid ISO datetime' })
    .optional(),
  periodCode: z.string().optional(),
  furnaceId: z.string().optional(),
  customerId: z.string().optional(),
  itemId: z.string().optional(),
  department: z.string().optional(),
  format: z.enum(['json', 'csv', 'xlsx', 'pdf']).optional().default('json')
});

export type DateRangeFilterInput = z.infer<typeof dateRangeFilterSchema>;
