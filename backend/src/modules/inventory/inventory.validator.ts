import { z } from 'zod';
import { ValidationSchema } from '../../core/middleware/validate.middleware.js';

const transactionTypeEnum = z.enum([
  'GOODS_RECEIPT',
  'GOODS_ISSUE',
  'STOCK_ADJUSTMENT_ADD',
  'STOCK_ADJUSTMENT_DEDUCT',
  'INTERNAL_TRANSFER_OUT',
  'INTERNAL_TRANSFER_IN',
  'RESERVATION_ALLOCATE',
  'RESERVATION_RELEASE'
]);

const reasonCodeEnum = z.enum([
  'PHYSICAL_COUNT_DISCREPANCY',
  'DAMAGED_IN_STORAGE',
  'SAMPLE_DESTRUCTIVE_TESTING',
  'EXPIRED_SHELF_LIFE',
  'SCRAP_DISPOSAL',
  'SYSTEM_INITIALIZATION',
  'OTHER'
]);

const referenceTypeEnum = z.enum([
  'JOB_CARD',
  'HEAT_LOT',
  'PURCHASE_ORDER',
  'PHYSICAL_COUNT',
  'MAINTENANCE_WORKORDER',
  'SCRAP',
  'DISPATCH'
]);

export const goodsReceiptSchema: ValidationSchema = {
  body: z.object({
    itemId: z.string().trim().min(1, 'Item master ID is required'),
    location: z.string().trim().min(1, 'Storage location is required').max(100),
    quantity: z.number().positive('Receipt quantity must be positive'),
    referenceType: referenceTypeEnum,
    referenceId: z.string().trim().optional(),
    referenceNumber: z.string().trim().optional(),
    comments: z.string().trim().max(500).optional()
  })
};

export const goodsIssueSchema: ValidationSchema = {
  body: z.object({
    itemId: z.string().trim().min(1, 'Item master ID is required'),
    location: z.string().trim().min(1, 'Storage location is required').max(100),
    quantity: z.number().positive('Issue quantity must be positive'),
    referenceType: referenceTypeEnum,
    referenceId: z.string().trim().optional(),
    referenceNumber: z.string().trim().optional(),
    comments: z.string().trim().max(500).optional()
  })
};

export const stockAdjustmentSchema: ValidationSchema = {
  body: z.object({
    itemId: z.string().trim().min(1, 'Item master ID is required'),
    location: z.string().trim().min(1, 'Storage location is required').max(100),
    adjustedQuantity: z.number().refine((val) => val !== 0, 'Adjusted quantity cannot be zero'),
    reasonCode: reasonCodeEnum,
    comments: z.string().trim().min(3, 'Adjustment justification comments are required').max(500),
    referenceNumber: z.string().trim().optional()
  })
};

export const internalTransferSchema: ValidationSchema = {
  body: z
    .object({
      itemId: z.string().trim().min(1, 'Item master ID is required'),
      sourceLocation: z.string().trim().min(1, 'Source location is required').max(100),
      destinationLocation: z.string().trim().min(1, 'Destination location is required').max(100),
      quantity: z.number().positive('Transfer quantity must be positive'),
      referenceNumber: z.string().trim().optional(),
      comments: z.string().trim().max(500).optional()
    })
    .refine((data) => data.sourceLocation !== data.destinationLocation, {
      message: 'Source and destination locations must be different',
      path: ['destinationLocation']
    })
};

export const reserveStockSchema: ValidationSchema = {
  body: z.object({
    itemId: z.string().trim().min(1, 'Item master ID is required'),
    location: z.string().trim().min(1, 'Storage location is required').max(100),
    quantity: z.number().positive('Reservation quantity must be positive'),
    referenceType: referenceTypeEnum,
    referenceId: z.string().trim().optional(),
    referenceNumber: z.string().trim().optional(),
    comments: z.string().trim().max(500).optional()
  })
};

export const releaseReservationSchema: ValidationSchema = {
  body: z.object({
    itemId: z.string().trim().min(1, 'Item master ID is required'),
    location: z.string().trim().min(1, 'Storage location is required').max(100),
    quantity: z.number().positive('Release quantity must be positive'),
    referenceType: referenceTypeEnum,
    referenceId: z.string().trim().optional(),
    referenceNumber: z.string().trim().optional(),
    comments: z.string().trim().max(500).optional()
  })
};

export const queryBalanceSchema: ValidationSchema = {
  query: z.object({
    search: z.string().trim().optional(),
    itemId: z.string().trim().optional(),
    itemCode: z.string().trim().optional(),
    location: z.string().trim().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional()
  })
};

export const queryTransactionSchema: ValidationSchema = {
  query: z.object({
    search: z.string().trim().optional(),
    itemId: z.string().trim().optional(),
    itemCode: z.string().trim().optional(),
    type: transactionTypeEnum.optional(),
    location: z.string().trim().optional(),
    referenceType: referenceTypeEnum.optional(),
    referenceNumber: z.string().trim().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional()
  })
};
