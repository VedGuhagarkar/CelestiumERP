import { z } from 'zod';
import { ValidationSchema } from '../../core/middleware/validate.middleware.js';

const shiftTypeEnum = z.enum([
  'SHIFT_1_MORNING',
  'SHIFT_2_EVENING',
  'SHIFT_3_NIGHT',
  'GENERAL_DAY'
]);

const proficiencyEnum = z.enum(['BASIC', 'COMPETENT', 'EXPERT']);

export const createEmployeeSchema: ValidationSchema = {
  body: z.object({
    employeeCode: z
      .string()
      .trim()
      .min(2, 'Employee code must be at least 2 characters')
      .max(30, 'Employee code must not exceed 30 characters')
      .regex(/^[A-Z0-9_-]+$/, 'Employee code must be uppercase alphanumeric')
      .toUpperCase(),
    fullName: z.string().trim().min(2, 'Full name is required').max(100),
    department: z.string().trim().min(2, 'Department is required').max(50),
    designation: z.string().trim().min(2, 'Designation is required').max(50),
    defaultShift: shiftTypeEnum.default('SHIFT_1_MORNING'),
    maxDailyHours: z.number().min(4).max(16).default(8.0),
    maxWeeklyOvertimeHours: z.number().min(0).max(30).default(12.0),
    skills: z
      .array(
        z.object({
          skillCode: z.string().trim().toUpperCase(),
          skillName: z.string().trim().min(2),
          proficiency: proficiencyEnum.default('COMPETENT'),
          certifiedDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
          expiryDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional()
        })
      )
      .optional(),
    notes: z.string().trim().max(500).optional()
  })
};

export const addSkillSchema: ValidationSchema = {
  body: z.object({
    skillCode: z.string().trim().toUpperCase(),
    skillName: z.string().trim().min(2),
    proficiency: proficiencyEnum.default('COMPETENT'),
    certifiedDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
    expiryDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional()
  }),
  params: z.object({
    id: z.string().trim().min(1, 'Employee ID is required')
  })
};

export const evaluateCoverageSchema: ValidationSchema = {
  body: z.object({
    date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
    shift: shiftTypeEnum,
    requiredSkills: z.array(z.string().trim().toUpperCase()).min(1, 'At least one required skill must be specified'),
    requiredOperatorCount: z.number().int().positive().default(1),
    furnaceId: z.string().trim().optional(),
    planId: z.string().trim().optional()
  })
};

export const assignOperatorSchema: ValidationSchema = {
  body: z.object({
    employeeId: z.string().trim().min(1, 'Employee ID is required'),
    date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
    shift: shiftTypeEnum,
    allocatedHours: z.number().min(0.5).max(16),
    furnaceId: z.string().trim().optional(),
    planId: z.string().trim().optional(),
    jobCardId: z.string().trim().optional(),
    requiredSkills: z.array(z.string().trim().toUpperCase()).default([]),
    notes: z.string().trim().max(500).optional()
  })
};

export const queryShiftCapacitySchema: ValidationSchema = {
  query: z.object({
    date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
    shift: shiftTypeEnum.optional(),
    skillCode: z.string().trim().toUpperCase().optional()
  })
};

export const queryWorkforceSchema: ValidationSchema = {
  query: z.object({
    department: z.string().trim().optional(),
    shift: shiftTypeEnum.optional(),
    skillCode: z.string().trim().toUpperCase().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE']).optional(),
    search: z.string().trim().optional()
  })
};
