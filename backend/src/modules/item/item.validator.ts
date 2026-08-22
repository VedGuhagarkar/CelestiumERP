import { z } from 'zod';
import { ValidationSchema } from '../../core/middleware/validate.middleware.js';

const categoryEnum = z.enum([
  'RAW_MATERIAL',
  'PROCESS_GAS',
  'QUENCH_MEDIA',
  'HEAT_TREAT_CONSUMABLE',
  'LABORATORY_CONSUMABLE',
  'FINISHED_TREATED_GOODS',
  'PACKAGING_MATERIAL'
]);

const uomEnum = z.enum([
  'KG',
  'MT',
  'LTR',
  'CU_M',
  'CYLINDER',
  'PCS',
  'ROLL',
  'BOX',
  'SET',
  'DRUM',
  'METER'
]);

export const createItemSchema: ValidationSchema = {
  body: z.object({
    itemCode: z
      .string()
      .trim()
      .min(2, 'Item code must be at least 2 characters')
      .max(30, 'Item code must not exceed 30 characters')
      .regex(/^[A-Z0-9_-]+$/, 'Item code must contain only uppercase letters, numbers, hyphens, and underscores')
      .toUpperCase(),
    name: z.string().trim().min(2, 'Item name is required').max(150),
    description: z.string().trim().max(500).optional(),
    category: categoryEnum,
    materialGrade: z.string().trim().max(100).optional(),
    uom: uomEnum,
    secondaryUom: uomEnum.optional(),
    conversionFactor: z.number().positive('Conversion factor must be positive').optional(),
    minStockLevel: z.number().min(0, 'Minimum stock level must be non-negative').default(0),
    reorderPoint: z.number().min(0, 'Reorder point must be non-negative').default(0),
    maxStockLevel: z.number().min(0).optional(),
    safetyStock: z.number().min(0).optional(),
    currentStock: z.number().min(0).default(0),
    storageLocation: z.string().trim().max(100).optional(),
    isHazardous: z.boolean().default(false),
    unNumber: z.string().trim().max(20).optional(),
    msdsReference: z.string().trim().max(100).optional(),
    shelfLifeDays: z.number().int().positive().optional(),
    isShelfLifeTracked: z.boolean().default(false)
  })
};

export const updateItemSchema: ValidationSchema = {
  body: z.object({
    itemCode: z.string().trim().optional(),
    name: z.string().trim().min(2).max(150).optional(),
    description: z.string().trim().max(500).optional(),
    category: categoryEnum.optional(),
    materialGrade: z.string().trim().max(100).optional(),
    uom: uomEnum.optional(),
    secondaryUom: uomEnum.optional(),
    conversionFactor: z.number().positive().optional(),
    minStockLevel: z.number().min(0).optional(),
    reorderPoint: z.number().min(0).optional(),
    maxStockLevel: z.number().min(0).optional(),
    safetyStock: z.number().min(0).optional(),
    storageLocation: z.string().trim().max(100).optional(),
    isHazardous: z.boolean().optional(),
    unNumber: z.string().trim().max(20).optional(),
    msdsReference: z.string().trim().max(100).optional(),
    shelfLifeDays: z.number().int().positive().optional(),
    isShelfLifeTracked: z.boolean().optional(),
    status: z.enum(['active', 'inactive', 'archived']).optional()
  }),
  params: z.object({
    id: z.string().trim().min(1, 'Item ID is required')
  })
};

export const updateItemStatusSchema: ValidationSchema = {
  body: z.object({
    status: z.enum(['active', 'inactive', 'archived'])
  }),
  params: z.object({
    id: z.string().trim().min(1, 'Item ID is required')
  })
};

export const queryItemSchema: ValidationSchema = {
  query: z.object({
    search: z.string().trim().optional(),
    category: categoryEnum.optional(),
    materialGrade: z.string().trim().optional(),
    isHazardous: z.string().optional(),
    isBelowReorderPoint: z.string().optional(),
    status: z.string().trim().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional()
  })
};
