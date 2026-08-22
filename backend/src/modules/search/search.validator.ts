import { z } from 'zod';

export const querySearchSchema = z.object({
  q: z
    .string()
    .min(1, 'Search query must contain at least 1 character')
    .max(100, 'Search query too long')
    .trim(),
  category: z
    .enum([
      'ALL',
      'JOBS',
      'CUSTOMERS',
      'EMPLOYEES',
      'MATERIALS',
      'HEAT_LOTS',
      'MACHINES',
      'INSPECTIONS',
      'NCRS',
      'WAREHOUSES',
      'DISPATCHES',
      'INVOICES'
    ])
    .optional()
    .default('ALL'),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(parseInt(val, 10), 50) : 10))
});
