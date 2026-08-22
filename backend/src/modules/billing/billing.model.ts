import mongoose, { Schema } from 'mongoose';
import { InvoiceDocument } from './billing.types.js';

const InvoiceLineSchema = new Schema(
  {
    lineId: { type: String, required: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'ProductionJob' },
    jobNumber: { type: String, uppercase: true, trim: true },
    dispatchLineId: { type: String },
    itemCode: { type: String, required: true, uppercase: true, trim: true },
    description: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0.001 },
    uom: { type: String, required: true, uppercase: true },
    unitPrice: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    heatLotNumber: { type: String, uppercase: true, trim: true },
    certificateOfConformanceNumber: { type: String, uppercase: true, trim: true },
    taxRatePercent: { type: Number, required: true, min: 0, default: 0 },
    taxAmount: { type: Number, required: true, min: 0, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const PaymentRecordSchema = new Schema(
  {
    paymentNumber: { type: String, required: true },
    paymentDate: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    paymentMethod: {
      type: String,
      enum: ['BANK_TRANSFER', 'CHECK', 'WIRE', 'CREDIT_CARD', 'CASH'],
      required: true
    },
    referenceNumber: { type: String, trim: true },
    recordedBy: {
      userId: { type: String, required: true },
      email: { type: String },
      role: { type: String }
    },
    journalEntryId: { type: String },
    notes: { type: String }
  },
  { _id: false }
);

const TaxBreakdownSchema = new Schema(
  {
    taxType: {
      type: String,
      enum: ['GST_CGST_SGST', 'GST_IGST', 'VAT', 'SALES_TAX', 'EXEMPT'],
      required: true
    },
    taxRatePercent: { type: Number, required: true, min: 0 },
    taxableAmount: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, required: true, min: 0 },
    exemptionReason: {
      type: String,
      enum: ['SEZ_UNIT', 'EXPORT_100', 'GOVT_EXEMPT', 'NONE']
    }
  },
  { _id: false }
);

const InvoiceSchema = new Schema<InvoiceDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    invoiceNumber: { type: String, required: true, uppercase: true, trim: true },
    customerId: { type: String, required: true, index: true },
    customerCode: { type: String, required: true, uppercase: true, trim: true, index: true },
    customerName: { type: String, required: true },
    customerBillingAddress: { type: String },
    customerGstVatNumber: { type: String },
    dispatchId: { type: Schema.Types.ObjectId, ref: 'DispatchConsignment', index: true },
    dispatchNumber: { type: String, uppercase: true, trim: true },
    jobIds: [{ type: String, index: true }],
    jobNumbers: [{ type: String, uppercase: true, trim: true }],
    invoiceDate: { type: Date, required: true, index: true },
    dueDate: { type: Date, required: true, index: true },
    paymentTermsDays: { type: Number, required: true, default: 30 },
    status: {
      type: String,
      enum: ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID'],
      default: 'DRAFT',
      index: true
    },
    lines: { type: [InvoiceLineSchema], required: true },
    currency: { type: String, required: true, default: 'USD', uppercase: true },
    subtotal: { type: Number, required: true, min: 0 },
    taxBreakdown: { type: [TaxBreakdownSchema], default: [] },
    totalTaxAmount: { type: Number, required: true, min: 0, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, required: true, min: 0, default: 0 },
    outstandingBalance: { type: Number, required: true, min: 0 },
    payments: { type: [PaymentRecordSchema], default: [] },
    journalEntryId: { type: String },
    journalEntryNumber: { type: String },
    isFinalized: { type: Boolean, default: false, index: true },
    finalizedAt: { type: Date },
    finalizedBy: {
      userId: { type: String },
      email: { type: String },
      role: { type: String }
    },
    isVoid: { type: Boolean, default: false, index: true },
    voidedAt: { type: Date },
    voidedBy: {
      userId: { type: String },
      email: { type: String },
      role: { type: String }
    },
    voidReason: { type: String },
    notes: { type: String },
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

InvoiceSchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true });
InvoiceSchema.index({ tenantId: 1, customerCode: 1, status: 1 });
InvoiceSchema.index({ tenantId: 1, dispatchId: 1, status: 1 });
InvoiceSchema.index({ tenantId: 1, isVoid: 1, outstandingBalance: 1, dueDate: 1 });

export const Invoice = mongoose.model<InvoiceDocument>('Invoice', InvoiceSchema);
