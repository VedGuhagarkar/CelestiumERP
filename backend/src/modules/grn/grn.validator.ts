import { z } from 'zod';
import { ValidationSchema } from '../../core/middleware/validate.middleware.js';

export const recordMaterialReceiptItemSchema = z.object({
  poLineItemId: z.string().trim().min(1, 'PO line item ID is required').optional(),
  itemId: z.string().trim().min(1, 'Item ID is required'),
  receivedQuantity: z.number().positive('Received quantity must be greater than zero'),
  supplierHeatNumber: z.string().trim().min(1, 'Supplier Heat Number is required').max(100),
  supplierLotNumber: z.string().trim().max(100).optional(),
  mtrNumber: z.string().trim().max(100).optional(),
  chemicalComposition: z.record(z.string(), z.number()).optional(),
  lineNotes: z.string().trim().max(500).optional()
});

export const recordMaterialReceiptSchema: ValidationSchema = {
  body: z.object({
    poId: z.string().trim().min(1, 'Purchase Order ID is required'),
    idempotencyKey: z.string().trim().max(100).optional(),
    supplierChallanNumber: z.string().trim().min(1, 'Supplier Delivery Challan Number is required').max(100),
    supplierChallanDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
    supplierInvoiceNumber: z.string().trim().max(100).optional(),
    carrierVehicle: z.string().trim().max(100).optional(),
    driverName: z.string().trim().max(100).optional(),
    receivedDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
    items: z.array(recordMaterialReceiptItemSchema).min(1, 'At least one item must be recorded upon receipt'),
    notes: z.string().trim().max(1000).optional()
  })
};

export const storeMaterialSchema: ValidationSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Material Receipt ID is required')
  }),
  body: z.object({
    warehouseId: z.string().trim().min(1, 'Warehouse ID is required'),
    storageLocationCode: z.string().trim().min(1, 'Storage location code (bay/bin) is required').max(100),
    storageNotes: z.string().trim().max(500).optional()
  })
};

export const createGrnSchema: ValidationSchema = {
  body: z.object({
    materialReceiptId: z.string().trim().min(1, 'Material Receipt ID is required'),
    inspectedBy: z.string().trim().max(100).optional(),
    approvedBy: z.string().trim().max(100).optional(),
    remarks: z.string().trim().max(1000).optional(),
    unitGenerationMode: z.enum(['BY_PCS', 'BY_LOT']).optional()
  })
};

export const queryGrnSchema: ValidationSchema = {
  query: z.object({
    search: z.string().trim().optional(),
    poNumber: z.string().trim().optional(),
    status: z.enum(['ISSUED', 'PRINTED', 'AVAILABLE_FOR_PLANNING']).optional(),
    supplierName: z.string().trim().optional(),
    supplierChallanNumber: z.string().trim().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    sortBy: z.string().trim().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional()
  }).optional()
};

export const queryGrnUnitSchema: ValidationSchema = {
  query: z.object({
    search: z.string().trim().optional(),
    poNumber: z.string().trim().optional(),
    grnNumber: z.string().trim().optional(),
    itemCode: z.string().trim().optional(),
    recipeId: z.string().trim().optional(),
    recipeCode: z.string().trim().optional(),
    status: z.enum(['AVAILABLE_FOR_PLANNING', 'ALLOCATED_TO_PLAN', 'IN_PRODUCTION', 'CONSUMED']).optional(),
    supplierHeatNumber: z.string().trim().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional()
  }).optional()
};
