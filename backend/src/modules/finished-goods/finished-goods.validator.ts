import { z } from 'zod';
import { ValidationSchema } from '../../core/middleware/validate.middleware.js';

const fgStatusEnum = z.enum([
  'AWAITING_QC_RELEASE',
  'RELEASED_FOR_DISPATCH',
  'QUARANTINED',
  'RESERVED_FOR_DISPATCH',
  'FULLY_DISPATCHED'
]);

export const inwardFinishedGoodsSchema: ValidationSchema = {
  body: z.object({
    jobCardId: z.string().trim().min(1, 'Job Card ID is required'),
    jobCardNumber: z.string().trim().min(1, 'Job Card Number is required'),
    heatLotNumber: z.string().trim().optional(),
    customerCode: z.string().trim().min(1, 'Customer Code is required'),
    itemId: z.string().trim().min(1, 'Item master ID is required'),
    description: z.string().trim().max(500).optional(),
    totalQuantity: z.number().positive('Finished goods output quantity must be positive'),
    location: z.string().trim().min(1, 'Storage location is required')
  })
};

export const releaseFinishedGoodsSchema: ValidationSchema = {
  body: z.object({
    cocNumber: z.string().trim().max(100).optional(),
    inspectionReportId: z.string().trim().max(100).optional(),
    releaseNotes: z.string().trim().min(3, 'Release justification notes are required').max(500)
  })
};

export const reserveFinishedGoodsSchema: ValidationSchema = {
  body: z.object({
    quantity: z.number().positive('Reservation quantity must be positive'),
    deliveryChallanNumber: z.string().trim().max(100).optional(),
    comments: z.string().trim().max(500).optional()
  })
};

export const releaseReservationSchema: ValidationSchema = {
  body: z.object({
    quantity: z.number().positive('Release quantity must be positive'),
    comments: z.string().trim().max(500).optional()
  })
};

export const moveFinishedGoodsLocationSchema: ValidationSchema = {
  body: z.object({
    destinationLocation: z.string().trim().min(1, 'Destination location is required'),
    reason: z.string().trim().max(500).optional()
  })
};

export const queryFinishedGoodsSchema: ValidationSchema = {
  query: z.object({
    search: z.string().trim().optional(),
    jobCardNumber: z.string().trim().optional(),
    heatLotNumber: z.string().trim().optional(),
    customerCode: z.string().trim().optional(),
    itemId: z.string().trim().optional(),
    itemCode: z.string().trim().optional(),
    status: fgStatusEnum.optional(),
    location: z.string().trim().optional(),
    isReleased: z.enum(['true', 'false']).optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional()
  })
};
