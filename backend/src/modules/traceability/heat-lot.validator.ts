import { z } from 'zod';
import { ValidationSchema } from '../../core/middleware/validate.middleware.js';

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

const heatLotStatusEnum = z.enum([
  'INWARDED',
  'QUARANTINED',
  'RELEASED',
  'CONSUMED',
  'EXHAUSTED',
  'REJECTED'
]);

const lineageSourceEnum = z.enum([
  'RAW_MILL_HEAT',
  'INGOT_SPLIT',
  'RE_MELT',
  'INTERNAL_RECLASSIFICATION'
]);

export const inwardHeatLotSchema: ValidationSchema = {
  body: z.object({
    heatLotNumber: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .regex(/^[A-Z0-9_-]+$/, 'Heat-lot number must contain only uppercase letters, numbers, hyphens, and underscores')
      .toUpperCase()
      .optional(),
    itemId: z.string().trim().min(1, 'Item master reference is required'),
    materialGrade: z.string().trim().min(1, 'Material grade is required').max(100),
    supplierHeatNumber: z.string().trim().min(1, 'Supplier heat number is required').max(100),
    supplierLotNumber: z.string().trim().max(100).optional(),
    supplierName: z.string().trim().max(150).optional(),
    mtrNumber: z.string().trim().max(100).optional(),
    chemicalComposition: z.record(z.string(), z.number()).optional(),
    receivedDate: z.string().datetime().optional(),
    receivedQuantity: z.number().positive('Received quantity must be positive'),
    uom: uomEnum,
    storageLocation: z.string().trim().min(1, 'Storage location is required').max(100),
    status: heatLotStatusEnum.optional(),
    quarantineReason: z.string().trim().max(500).optional(),
    testCertReferences: z.array(z.string().trim()).optional(),
    lineage: z
      .object({
        parentHeatLotIds: z.array(z.string().trim()).optional(),
        sourceType: lineageSourceEnum.optional(),
        notes: z.string().trim().max(500).optional()
      })
      .optional()
  })
};

export const allocateHeatLotSchema: ValidationSchema = {
  body: z.object({
    jobCardId: z.string().trim().min(1, 'Job card ID is required'),
    jobCardNumber: z.string().trim().min(1, 'Job card number is required'),
    customerCode: z.string().trim().toUpperCase().optional(),
    quantity: z.number().positive('Allocation quantity must be positive')
  }),
  params: z.object({
    id: z.string().trim().min(1, 'Heat lot ID is required')
  })
};

export const consumeHeatLotSchema: ValidationSchema = {
  body: z.object({
    jobCardId: z.string().trim().min(1, 'Job card ID is required'),
    jobCardNumber: z.string().trim().min(1, 'Job card number is required'),
    customerCode: z.string().trim().toUpperCase().optional(),
    furnaceId: z.string().trim().optional(),
    batchNumber: z.string().trim().optional(),
    quantity: z.number().positive('Consumed quantity must be positive'),
    operatorId: z.string().trim().min(1, 'Operator ID is required')
  }),
  params: z.object({
    id: z.string().trim().min(1, 'Heat lot ID is required')
  })
};

export const quarantineHeatLotSchema: ValidationSchema = {
  body: z.object({
    quarantineReason: z.string().trim().min(3, 'Quarantine reason is required').max(500)
  }),
  params: z.object({
    id: z.string().trim().min(1, 'Heat lot ID is required')
  })
};

export const releaseHeatLotSchema: ValidationSchema = {
  body: z.object({
    releaseNotes: z.string().trim().max(500).optional()
  }),
  params: z.object({
    id: z.string().trim().min(1, 'Heat lot ID is required')
  })
};

export const queryHeatLotSchema: ValidationSchema = {
  query: z.object({
    search: z.string().trim().optional(),
    itemId: z.string().trim().optional(),
    itemCode: z.string().trim().optional(),
    materialGrade: z.string().trim().optional(),
    supplierHeatNumber: z.string().trim().optional(),
    mtrNumber: z.string().trim().optional(),
    status: heatLotStatusEnum.optional(),
    storageLocation: z.string().trim().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional()
  })
};
