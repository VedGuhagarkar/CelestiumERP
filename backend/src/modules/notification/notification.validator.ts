import { z } from 'zod';

export const queryNotificationsSchema = z.object({
  isRead: z
    .string()
    .optional()
    .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),
  category: z
    .enum([
      'QUALITY',
      'EQUIPMENT',
      'MAINTENANCE',
      'PYROMETRY',
      'INVENTORY',
      'PRODUCTION',
      'DISPATCH',
      'FINANCE',
      'WORKFORCE',
      'SECURITY'
    ])
    .optional(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().optional(),
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 20))
});

export const updatePreferencesSchema = z.object({
  enabledChannels: z.array(z.enum(['IN_APP', 'EMAIL'])).optional(),
  categorySubscriptions: z
    .record(
      z.enum([
        'QUALITY',
        'EQUIPMENT',
        'MAINTENANCE',
        'PYROMETRY',
        'INVENTORY',
        'PRODUCTION',
        'DISPATCH',
        'FINANCE',
        'WORKFORCE',
        'SECURITY'
      ]),
      z.boolean()
    )
    .optional(),
  minimumPriority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']).optional(),
  isMuted: z.boolean().optional(),
  mutedUntil: z.string().datetime().nullable().optional()
});

export const broadcastAlertSchema = z.object({
  category: z.enum([
    'QUALITY',
    'EQUIPMENT',
    'MAINTENANCE',
    'PYROMETRY',
    'INVENTORY',
    'PRODUCTION',
    'DISPATCH',
    'FINANCE',
    'WORKFORCE',
    'SECURITY'
  ]),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']),
  title: z.string().min(3, 'Alert title is required (min 3 chars)'),
  message: z.string().min(5, 'Alert message is required (min 5 chars)'),
  targetRole: z.string().optional(),
  actionUrl: z.string().optional(),
  metadata: z.record(z.any()).optional()
});
