import { Schema, model } from 'mongoose';
import { createBaseSchema } from '../../core/models/base.schema.js';
import { IndexRegistry } from '../../core/database/index-registry.js';
import {
  MaterialReceiptDocument,
  GRNDocument,
  GRNUnitDocument,
  IMaterialReceiptItem,
  IGRNItem
} from './grn.types.js';

// 1. Material Receipt Item Schema
const MaterialReceiptItemSchema = new Schema<IMaterialReceiptItem>(
  {
    poLineItemId: { type: String, required: true },
    itemId: { type: String, required: true },
    itemCode: { type: String, required: true, uppercase: true, trim: true },
    itemName: { type: String, required: true, trim: true },
    materialGrade: { type: String, required: true, trim: true },
    processFamily: { type: String, required: true },
    recipeId: { type: String, required: true },
    recipeCode: { type: String, required: true, uppercase: true, trim: true },
    recipeRevision: { type: Number, required: true },
    receivedQuantity: { type: Number, required: true, min: 0.0001 },
    uom: { type: String, required: true, trim: true },
    supplierHeatNumber: { type: String, required: true, uppercase: true, trim: true },
    supplierLotNumber: { type: String, uppercase: true, trim: true },
    mtrNumber: { type: String, uppercase: true, trim: true },
    chemicalComposition: { type: Map, of: Number },
    lineNotes: { type: String }
  },
  { _id: false }
);

// 2. Material Receipt Schema
const MaterialReceiptSchema = createBaseSchema<MaterialReceiptDocument>({
  receiptNumber: { type: String, required: true, uppercase: true, trim: true },
  poId: { type: String, required: true },
  poNumber: { type: String, required: true, uppercase: true, trim: true },
  supplierName: { type: String, required: true, trim: true },
  supplierChallanNumber: { type: String, required: true, uppercase: true, trim: true },
  supplierInvoiceNumber: { type: String, uppercase: true, trim: true },
  carrierVehicle: { type: String, uppercase: true, trim: true },
  driverName: { type: String, trim: true },
  receivedDate: { type: Date, required: true, default: Date.now },
  receivedBy: { type: String, required: true },
  warehouseId: { type: String },
  warehouseCode: { type: String, uppercase: true, trim: true },
  storageLocationCode: { type: String, uppercase: true, trim: true },
  items: { type: [MaterialReceiptItemSchema], required: true },
  status: {
    type: String,
    enum: ['RECEIVED', 'STORED', 'GRN_CREATED'],
    default: 'RECEIVED',
    index: true
  },
  storedAt: { type: Date },
  storedBy: { type: String },
  notes: { type: String, trim: true }
});

IndexRegistry.addTenantUniqueIndex(MaterialReceiptSchema, 'receiptNumber');
MaterialReceiptSchema.index({ tenantId: 1, poId: 1 });
MaterialReceiptSchema.index({ tenantId: 1, poNumber: 1 });
MaterialReceiptSchema.index({ tenantId: 1, status: 1 });

export const MaterialReceiptModel = model<MaterialReceiptDocument>('MaterialReceipt', MaterialReceiptSchema);

// 3. GRN Item Schema
const GRNItemSchema = new Schema<IGRNItem>(
  {
    poLineItemId: { type: String, required: true },
    itemId: { type: String, required: true },
    itemCode: { type: String, required: true, uppercase: true, trim: true },
    itemName: { type: String, required: true, trim: true },
    materialGrade: { type: String, required: true, trim: true },
    processFamily: { type: String, required: true },
    recipeId: { type: String, required: true },
    recipeCode: { type: String, required: true, uppercase: true, trim: true },
    recipeRevision: { type: Number, required: true },
    acceptedQuantity: { type: Number, required: true, min: 0.0001 },
    uom: { type: String, required: true, trim: true },
    unitCount: { type: Number, required: true, min: 1 },
    supplierHeatNumber: { type: String, required: true, uppercase: true, trim: true },
    mtrNumber: { type: String, uppercase: true, trim: true },
    unitIdentifiers: { type: [String], required: true }
  },
  { _id: false }
);

// 4. GRN Schema (Every GRN belongs to exactly one PO)
const GRNSchema = createBaseSchema<GRNDocument>({
  grnNumber: { type: String, required: true, uppercase: true, trim: true },
  poId: { type: String, required: true },
  poNumber: { type: String, required: true, uppercase: true, trim: true },
  materialReceiptId: { type: String, required: true },
  receiptNumber: { type: String, required: true, uppercase: true, trim: true },
  supplierName: { type: String, required: true, trim: true },
  supplierChallanNumber: { type: String, required: true, uppercase: true, trim: true },
  supplierInvoiceNumber: { type: String, uppercase: true, trim: true },
  carrierVehicle: { type: String, uppercase: true, trim: true },
  warehouseId: { type: String, required: true },
  warehouseCode: { type: String, required: true, uppercase: true, trim: true },
  storageLocationCode: { type: String, required: true, uppercase: true, trim: true },
  items: { type: [GRNItemSchema], required: true },
  totalUnitsGenerated: { type: Number, required: true, min: 1 },
  status: {
    type: String,
    enum: ['ISSUED', 'PRINTED', 'AVAILABLE_FOR_PLANNING'],
    default: 'AVAILABLE_FOR_PLANNING',
    index: true
  },
  receivedBy: { type: String, required: true },
  inspectedBy: { type: String },
  approvedBy: { type: String },
  grnDate: { type: Date, required: true, default: Date.now },
  printedAt: { type: Date },
  printedBy: { type: String },
  printCount: { type: Number, default: 0 },
  remarks: { type: String, trim: true }
});

IndexRegistry.addTenantUniqueIndex(GRNSchema, 'grnNumber');
GRNSchema.index({ tenantId: 1, poId: 1 });
GRNSchema.index({ tenantId: 1, poNumber: 1 });
GRNSchema.index({ tenantId: 1, materialReceiptId: 1 });
GRNSchema.index({ tenantId: 1, status: 1 });

export const GRNModel = model<GRNDocument>('GRN', GRNSchema);

// 5. GRN Individual Material/Part Unit Schema
const GRNUnitSchema = createBaseSchema<GRNUnitDocument>({
  unitIdentifier: { type: String, required: true, uppercase: true, trim: true },
  poId: { type: String, required: true },
  poNumber: { type: String, required: true, uppercase: true, trim: true },
  grnId: { type: String, required: true },
  grnNumber: { type: String, required: true, uppercase: true, trim: true },
  materialReceiptId: { type: String, required: true },
  receiptNumber: { type: String, required: true, uppercase: true, trim: true },
  itemId: { type: String, required: true },
  itemCode: { type: String, required: true, uppercase: true, trim: true },
  itemName: { type: String, required: true, trim: true },
  materialGrade: { type: String, required: true, trim: true },
  processFamily: { type: String, required: true },
  recipeId: { type: String, required: true },
  recipeCode: { type: String, required: true, uppercase: true, trim: true },
  recipeRevision: { type: Number, required: true },
  warehouseId: { type: String, required: true },
  warehouseCode: { type: String, required: true, uppercase: true, trim: true },
  storageLocationCode: { type: String, required: true, uppercase: true, trim: true },
  supplierHeatNumber: { type: String, required: true, uppercase: true, trim: true },
  supplierLotNumber: { type: String, uppercase: true, trim: true },
  mtrNumber: { type: String, uppercase: true, trim: true },
  supplierChallanNumber: { type: String, required: true, uppercase: true, trim: true },
  chemicalComposition: { type: Map, of: Number },
  quantity: { type: Number, required: true, min: 0.0001 },
  uom: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ['AVAILABLE_FOR_PLANNING', 'ALLOCATED_TO_PLAN', 'IN_PRODUCTION', 'CONSUMED'],
    default: 'AVAILABLE_FOR_PLANNING',
    index: true
  },
  allocatedPlanId: { type: String },
  allocatedPlanNumber: { type: String, uppercase: true },
  allocatedJobId: { type: String }
});

IndexRegistry.addTenantUniqueIndex(GRNUnitSchema, 'unitIdentifier');
GRNUnitSchema.index({ tenantId: 1, grnNumber: 1 });
GRNUnitSchema.index({ tenantId: 1, poNumber: 1 });
GRNUnitSchema.index({ tenantId: 1, itemId: 1, recipeId: 1, status: 1 });
GRNUnitSchema.index({ tenantId: 1, supplierHeatNumber: 1 });

export const GRNUnitModel = model<GRNUnitDocument>('GRNUnit', GRNUnitSchema);
