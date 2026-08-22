import { z } from 'zod';
import { ValidationSchema } from '../../core/middleware/validate.middleware.js';

export const createRoleSchema: ValidationSchema = {
  body: z.object({
    code: z
      .string()
      .trim()
      .min(2, 'Role code must be at least 2 characters')
      .max(30, 'Role code must be at most 30 characters')
      .regex(/^[A-Z0-9_]+$/, 'Role code must contain only uppercase letters, numbers, and underscores')
      .toUpperCase(),
    name: z.string().trim().min(2, 'Role name is required').max(100),
    description: z.string().trim().max(500).optional(),
    permissions: z.array(z.string().trim()).min(1, 'At least one permission must be assigned')
  })
};

export const updateRoleSchema: ValidationSchema = {
  body: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(500).optional(),
    permissions: z.array(z.string().trim()).min(1).optional(),
    status: z.enum(['active', 'inactive']).optional()
  }),
  params: z.object({
    id: z.string().trim().min(1, 'Role ID is required')
  })
};

export const assignRolesSchema: ValidationSchema = {
  body: z.object({
    roles: z.array(z.string().trim().toUpperCase()).min(1, 'At least one role must be assigned')
  }),
  params: z.object({
    userId: z.string().trim().min(1, 'User ID is required')
  })
};
