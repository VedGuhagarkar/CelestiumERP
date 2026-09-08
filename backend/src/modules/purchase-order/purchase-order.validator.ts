import { z } from 'zod';
import { ValidationSchema } from '../../core/middleware/validate.middleware.js';

export const createPurchaseOrderItemSchema = z.object({
  itemId: z.string().trim().min(1, 'Item ID is required'),
  recipeId: z.string().trim().min(1, 'Recipe ID is required'),
  orderedQuantity: z.number().positive('Ordered quantity must be greater than zero'),
  unitPrice: z.number().nonnegative('Unit price must be non-negative').optional(),
  processingRequirement: z.string().trim().max(500).optional(),
  lineNotes: z.string().trim().max(500).optional()
});

export const createPurchaseOrderSchema: ValidationSchema = {
  body: z.object({
    supplierName: z.string().trim().min(2, 'Supplier name must be at least 2 characters').max(200),
    supplierCode: z.string().trim().max(50).optional(),
    vendorAddress: z.string().trim().max(500).optional(),
    contactEmail: z.string().trim().email('Invalid contact email format').optional().or(z.literal('')),
    contactPhone: z.string().trim().max(50).optional(),
    orderDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
    expectedDeliveryDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
    items: z.array(createPurchaseOrderItemSchema).min(1, 'At least one item must be included in the PO'),
    currency: z.string().trim().min(3).max(3).optional(),
    paymentTerms: z.string().trim().max(100).optional(),
    deliveryTerms: z.string().trim().max(100).optional(),
    taxAmount: z.number().nonnegative().optional(),
    notes: z.string().trim().max(1000).optional(),
    idempotencyKey: z.string().trim().max(128).optional()
  })
};

export const updatePurchaseOrderSchema: ValidationSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Purchase Order ID is required')
  }),
  body: z.object({
    supplierName: z.string().trim().min(2).max(200).optional(),
    supplierCode: z.string().trim().max(50).optional(),
    vendorAddress: z.string().trim().max(500).optional(),
    contactEmail: z.string().trim().email().optional().or(z.literal('')),
    contactPhone: z.string().trim().max(50).optional(),
    expectedDeliveryDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
    currency: z.string().trim().min(3).max(3).optional(),
    paymentTerms: z.string().trim().max(100).optional(),
    deliveryTerms: z.string().trim().max(100).optional(),
    taxAmount: z.number().nonnegative().optional(),
    notes: z.string().trim().max(1000).optional(),
    status: z.enum(['DRAFT', 'ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED']).optional()
  })
};

export const queryPurchaseOrderSchema: ValidationSchema = {
  query: z.object({
    search: z.string().trim().optional(),
    status: z.enum(['DRAFT', 'ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED']).optional(),
    supplierName: z.string().trim().optional(),
    supplierCode: z.string().trim().optional(),
    itemCode: z.string().trim().optional(),
    recipeCode: z.string().trim().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    sortBy: z.string().trim().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional()
  }).optional()
};
