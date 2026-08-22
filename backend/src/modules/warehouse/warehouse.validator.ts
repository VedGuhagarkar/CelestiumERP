import { z } from 'zod';
import { ValidationSchema } from '../../core/middleware/validate.middleware.js';

const warehouseTypeEnum = z.enum([
  'MAIN_PLANT',
  'RAW_MATERIAL_YARD',
  'GAS_YARD',
  'FINISHED_STORE',
  'OFFSITE_STORE'
]);

const storageZoneTypeEnum = z.enum([
  'RAW_MATERIAL_YARD',
  'QUARANTINE_AREA',
  'WIP_STAGE',
  'FINISHED_GOODS',
  'CONSUMABLES_STORE',
  'GAS_STORAGE',
  'LAB_ARCHIVE'
]);

const warehouseStatusEnum = z.enum(['ACTIVE', 'INACTIVE']);
const storageLocationStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE']);
const uomEnum = z.enum(['KG', 'MT', 'LTR', 'CU_M', 'CYLINDER', 'PCS', 'ROLL', 'BOX', 'SET', 'DRUM', 'METER']);

export const createWarehouseSchema: ValidationSchema = {
  body: z.object({
    code: z
      .string()
      .trim()
      .min(2, 'Warehouse code must be at least 2 characters')
      .max(30)
      .regex(/^[A-Z0-9_-]+$/, 'Warehouse code must be uppercase alphanumeric with dashes/underscores'),
    name: z.string().trim().min(2, 'Warehouse name is required').max(100),
    type: warehouseTypeEnum,
    description: z.string().trim().max(500).optional(),
    plantArea: z.string().trim().max(100).optional()
  })
};

export const updateWarehouseSchema: ValidationSchema = {
  body: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    type: warehouseTypeEnum.optional(),
    description: z.string().trim().max(500).optional(),
    plantArea: z.string().trim().max(100).optional(),
    status: warehouseStatusEnum.optional()
  })
};

export const createStorageLocationSchema: ValidationSchema = {
  body: z.object({
    warehouseId: z.string().trim().min(1, 'Warehouse ID is required'),
    locationCode: z
      .string()
      .trim()
      .min(2, 'Location code must be at least 2 characters')
      .max(50)
      .regex(/^[A-Z0-9_.-]+$/, 'Location code must be uppercase alphanumeric with dashes/underscores/dots'),
    zone: z.string().trim().min(1, 'Storage zone is required').max(100),
    bay: z.string().trim().max(50).optional(),
    rack: z.string().trim().max(50).optional(),
    bin: z.string().trim().max(50).optional(),
    zoneType: storageZoneTypeEnum,
    capacityQuantity: z.number().positive().optional(),
    capacityUom: uomEnum.optional(),
    isQuarantineLocation: z.boolean().optional(),
    temperatureControlled: z.boolean().optional()
  })
};

export const updateStorageLocationSchema: ValidationSchema = {
  body: z.object({
    zone: z.string().trim().min(1).max(100).optional(),
    bay: z.string().trim().max(50).optional(),
    rack: z.string().trim().max(50).optional(),
    bin: z.string().trim().max(50).optional(),
    zoneType: storageZoneTypeEnum.optional(),
    capacityQuantity: z.number().positive().optional(),
    capacityUom: uomEnum.optional(),
    status: storageLocationStatusEnum.optional(),
    isQuarantineLocation: z.boolean().optional(),
    temperatureControlled: z.boolean().optional()
  })
};

export const queryWarehouseSchema: ValidationSchema = {
  query: z.object({
    search: z.string().trim().optional(),
    type: warehouseTypeEnum.optional(),
    status: warehouseStatusEnum.optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional()
  })
};

export const queryStorageLocationSchema: ValidationSchema = {
  query: z.object({
    search: z.string().trim().optional(),
    warehouseId: z.string().trim().optional(),
    warehouseCode: z.string().trim().optional(),
    zoneType: storageZoneTypeEnum.optional(),
    status: storageLocationStatusEnum.optional(),
    isQuarantineLocation: z.enum(['true', 'false']).optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional()
  })
};
