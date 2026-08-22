import { z } from 'zod';
import { ValidationSchema } from '../../core/middleware/validate.middleware.js';

const targetTypeEnum = z.enum(['ITEM', 'HEAT_LOT', 'JOB_CARD', 'FINISHED_GOODS']);

const reasonCodeEnum = z.enum([
  'SPECTROMETRY_CHEMISTRY_FAIL',
  'SURFACE_HARDNESS_FAIL',
  'CORE_HARDNESS_FAIL',
  'EFFECTIVE_CASE_DEPTH_FAIL',
  'MICROSTRUCTURE_NON_CONFORMANCE',
  'CRACK_OR_DISTORTION',
  'CUSTOMER_RETURN_NCR',
  'DOCUMENTATION_DISCREPANCY',
  'GENERAL_SUSPECT_HOLD'
]);

const triggerSourceEnum = z.enum([
  'INSPECTION_FAILURE',
  'NCR',
  'RECEIVING_INSPECTION',
  'FURNACE_ABORT',
  'CUSTOMER_COMPLAINT',
  'MANUAL_HOLD'
]);

const statusEnum = z.enum([
  'ACTIVE_QUARANTINE',
  'RELEASED_TO_STOCK',
  'SCRAP_DISPOSITION',
  'RETURN_TO_SUPPLIER',
  'REWORK_APPROVED'
]);

const dispositionStatusEnum = z.enum([
  'SCRAP_DISPOSITION',
  'RETURN_TO_SUPPLIER',
  'REWORK_APPROVED'
]);

export const placeInQuarantineSchema: ValidationSchema = {
  body: z.object({
    targetType: targetTypeEnum,
    targetId: z.string().trim().min(1, 'Target ID is required'),
    targetIdentifier: z.string().trim().min(1, 'Target identifier (e.g. Heat lot #, Job Card #) is required'),
    itemId: z.string().trim().min(1, 'Item master ID is required'),
    location: z.string().trim().min(1, 'Quarantine storage location is required'),
    originalLocation: z.string().trim().optional(),
    quantity: z.number().positive('Quarantine quantity must be positive'),
    reasonCode: reasonCodeEnum,
    reasonDescription: z.string().trim().min(3, 'Quarantine reason description is required').max(500),
    triggerSource: triggerSourceEnum,
    triggerReferenceNumber: z.string().trim().max(100).optional()
  })
};

export const releaseQuarantineSchema: ValidationSchema = {
  body: z.object({
    releaseNotes: z.string().trim().min(3, 'Release justification notes are required').max(500),
    targetLocation: z.string().trim().optional()
  })
};

export const dispositionQuarantineSchema: ValidationSchema = {
  body: z.object({
    dispositionStatus: dispositionStatusEnum,
    dispositionNotes: z.string().trim().min(3, 'Disposition justification notes are required').max(500)
  })
};

export const queryQuarantineSchema: ValidationSchema = {
  query: z.object({
    search: z.string().trim().optional(),
    targetType: targetTypeEnum.optional(),
    targetIdentifier: z.string().trim().optional(),
    itemId: z.string().trim().optional(),
    itemCode: z.string().trim().optional(),
    status: statusEnum.optional(),
    reasonCode: reasonCodeEnum.optional(),
    triggerSource: triggerSourceEnum.optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional()
  })
};
