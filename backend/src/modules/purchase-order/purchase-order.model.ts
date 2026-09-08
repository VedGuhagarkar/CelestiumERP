import { Schema, model } from 'mongoose';
import { createBaseSchema } from '../../core/models/base.schema.js';
import { IndexRegistry } from '../../core/database/index-registry.js';
import { PurchaseOrderDocument, IPurchaseOrderItem } from './purchase-order.types.js';

const PurchaseOrderItemSchema = new Schema<IPurchaseOrderItem>(
  {
    lineItemId: { type: String, required: true },
    itemId: { type: String, required: true },
    itemCode: { type: String, required: true, uppercase: true, trim: true },
    itemName: { type: String, required: true, trim: true },
    materialGrade: { type: String, required: true, trim: true },
    processFamily: { type: String, required: true },
    processingRequirement: { type: String, trim: true },
    recipeId: { type: String, required: true },
    recipeCode: { type: String, required: true, uppercase: true, trim: true },
    recipeRevision: { type: Number, required: true },
    orderedQuantity: { type: Number, required: true, min: 0.0001 },
    receivedQuantity: { type: Number, required: true, default: 0, min: 0 },
    balanceQuantity: { type: Number, min: 0 },
    uom: { type: String, required: true, trim: true },
    unitPrice: { type: Number, required: true, default: 0, min: 0 },
    lineTotal: { type: Number, required: true, default: 0, min: 0 },
    lineNotes: { type: String, trim: true }
  },
  { _id: false }
);

const PurchaseOrderSchema = createBaseSchema<PurchaseOrderDocument>({
  poNumber: { type: String, required: true, uppercase: true, trim: true },
  idempotencyKey: { type: String, trim: true },
  supplierName: { type: String, required: true, trim: true },
  supplierCode: { type: String, uppercase: true, trim: true },
  vendorAddress: { type: String, trim: true },
  contactEmail: { type: String, trim: true, lowercase: true },
  contactPhone: { type: String, trim: true },
  orderDate: { type: Date, required: true, default: Date.now },
  expectedDeliveryDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ['DRAFT', 'ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED'],
    default: 'ISSUED',
    index: true
  },
  items: { type: [PurchaseOrderItemSchema], required: true },
  totalOrderedQuantity: { type: Number, required: true, min: 0 },
  totalReceivedQuantity: { type: Number, required: true, default: 0, min: 0 },
  currency: { type: String, required: true, default: 'USD', uppercase: true, trim: true },
  paymentTerms: { type: String, trim: true },
  deliveryTerms: { type: String, trim: true },
  subtotalAmount: { type: Number, required: true, default: 0, min: 0 },
  taxAmount: { type: Number, default: 0, min: 0 },
  totalAmount: { type: Number, required: true, default: 0, min: 0 },
  notes: { type: String, trim: true },
  createdById: { type: String, required: true },
  createdByName: { type: String, trim: true },
  approvedBy: {
    userId: { type: String },
    userName: { type: String },
    approvedAt: { type: Date },
    comments: { type: String }
  }
});

// Indexes
IndexRegistry.addTenantUniqueIndex(PurchaseOrderSchema, 'poNumber');
PurchaseOrderSchema.index({ tenantId: 1, idempotencyKey: 1 }, { sparse: true });
PurchaseOrderSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
PurchaseOrderSchema.index({ tenantId: 1, 'items.itemId': 1 });
PurchaseOrderSchema.index({ tenantId: 1, 'items.recipeId': 1 });

export const PurchaseOrderModel = model<PurchaseOrderDocument>('PurchaseOrder', PurchaseOrderSchema);
