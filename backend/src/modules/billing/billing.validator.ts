import { z } from 'zod';

const invoiceLineSchema = z.object({
  jobId: z.string().optional(),
  jobNumber: z.string().optional(),
  dispatchLineId: z.string().optional(),
  itemCode: z.string().min(1).trim(),
  description: z.string().min(1).trim(),
  quantity: z.number().positive(),
  uom: z.string().min(1).trim(),
  unitPrice: z.number().nonnegative(),
  heatLotNumber: z.string().optional(),
  certificateOfConformanceNumber: z.string().optional(),
  taxRatePercent: z.number().nonnegative().optional().default(0)
});

export const createInvoiceSchema = z.object({
  customerId: z.string().min(1),
  customerCode: z.string().min(1).trim(),
  customerName: z.string().min(1).trim().optional(),
  customerBillingAddress: z.string().optional(),
  customerGstVatNumber: z.string().optional(),
  dispatchId: z.string().optional(),
  dispatchNumber: z.string().optional(),
  jobIds: z.array(z.string()).optional(),
  invoiceDate: z.string().datetime().optional(),
  paymentTermsDays: z.number().int().nonnegative().optional().default(30),
  currency: z.string().length(3).optional().default('USD'),
  taxType: z.enum(['GST_CGST_SGST', 'GST_IGST', 'VAT', 'SALES_TAX', 'EXEMPT']).optional().default('GST_CGST_SGST'),
  taxRatePercent: z.number().nonnegative().optional().default(18.0),
  exemptionReason: z.enum(['SEZ_UNIT', 'EXPORT_100', 'GOVT_EXEMPT', 'NONE']).optional(),
  lines: z.array(invoiceLineSchema).optional(),
  autoFinalize: z.boolean().optional().default(false),
  notes: z.string().max(500).optional()
});

export const finalizeInvoiceSchema = z.object({
  notes: z.string().max(500).optional()
});

export const recordPaymentSchema = z.object({
  amount: z.number().positive(),
  paymentDate: z.string().datetime().optional(),
  paymentMethod: z.enum(['BANK_TRANSFER', 'CHECK', 'WIRE', 'CREDIT_CARD', 'CASH']),
  referenceNumber: z.string().min(1).max(100).trim().optional(),
  notes: z.string().max(500).optional()
});

export const voidInvoiceSchema = z.object({
  voidReason: z.string().min(5).max(500).trim()
});

export const queryInvoicesSchema = z.object({
  customerId: z.string().optional(),
  customerCode: z.string().optional(),
  dispatchId: z.string().optional(),
  status: z.enum(['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  isOverdue: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  hasOutstanding: z.enum(['true', 'false']).transform((v) => v === 'true').optional()
});

export const queryAgingReportSchema = z.object({
  asOfDate: z.string().datetime().optional()
});
