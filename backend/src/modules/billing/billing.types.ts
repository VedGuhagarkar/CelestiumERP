import { Document } from 'mongoose';

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'VOID';
export type PaymentMethod = 'BANK_TRANSFER' | 'CHECK' | 'WIRE' | 'CREDIT_CARD' | 'CASH';
export type TaxExemptionReason = 'SEZ_UNIT' | 'EXPORT_100' | 'GOVT_EXEMPT' | 'NONE';

export interface IInvoiceLine {
  lineId: string;
  jobId?: string;
  jobNumber?: string;
  dispatchLineId?: string;
  itemCode: string;
  description: string;
  quantity: number;
  uom: string;
  unitPrice: number; // Process treatment fee per kg or piece
  subtotal: number;
  heatLotNumber?: string;
  certificateOfConformanceNumber?: string;
  taxRatePercent: number;
  taxAmount: number;
  totalAmount: number;
}

export interface IPaymentRecord {
  paymentNumber: string; // e.g. 'PAY-202608-0001'
  paymentDate: Date;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNumber?: string; // Cheque / UTR / Transaction ID
  recordedBy: {
    userId: string;
    email?: string;
    role?: string;
  };
  journalEntryId?: string;
  notes?: string;
}

export interface ITaxBreakdown {
  taxType: 'GST_CGST_SGST' | 'GST_IGST' | 'VAT' | 'SALES_TAX' | 'EXEMPT';
  taxRatePercent: number;
  taxableAmount: number;
  taxAmount: number;
  exemptionReason?: TaxExemptionReason;
}

export interface IInvoice {
  tenantId: string;
  invoiceNumber: string; // e.g. 'INV-202608-0001'
  customerId: string;
  customerCode: string;
  customerName: string;
  customerBillingAddress?: string;
  customerGstVatNumber?: string;
  dispatchId?: string;
  dispatchNumber?: string;
  jobIds: string[];
  jobNumbers: string[];
  invoiceDate: Date;
  dueDate: Date;
  paymentTermsDays: number;
  status: InvoiceStatus;
  lines: IInvoiceLine[];
  currency: string;
  subtotal: number;
  taxBreakdown: ITaxBreakdown[];
  totalTaxAmount: number;
  totalAmount: number;
  paidAmount: number;
  outstandingBalance: number;
  payments: IPaymentRecord[];
  journalEntryId?: string;
  journalEntryNumber?: string;
  isFinalized: boolean;
  finalizedAt?: Date;
  finalizedBy?: {
    userId: string;
    email?: string;
    role?: string;
  };
  isVoid: boolean;
  voidedAt?: Date;
  voidedBy?: {
    userId: string;
    email?: string;
    role?: string;
  };
  voidReason?: string;
  notes?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type InvoiceDocument = IInvoice & Document;

// ==========================================
// DTOs & Aging Types
// ==========================================

export interface CreateInvoiceLineDto {
  jobId?: string;
  jobNumber?: string;
  dispatchLineId?: string;
  itemCode: string;
  description: string;
  quantity: number;
  uom: string;
  unitPrice: number;
  heatLotNumber?: string;
  certificateOfConformanceNumber?: string;
  taxRatePercent?: number;
}

export interface CreateInvoiceDto {
  customerId: string;
  customerCode: string;
  customerName?: string;
  customerBillingAddress?: string;
  customerGstVatNumber?: string;
  dispatchId?: string;
  dispatchNumber?: string;
  jobIds?: string[];
  invoiceDate?: string;
  paymentTermsDays?: number;
  currency?: string;
  taxType?: 'GST_CGST_SGST' | 'GST_IGST' | 'VAT' | 'SALES_TAX' | 'EXEMPT';
  taxRatePercent?: number;
  exemptionReason?: TaxExemptionReason;
  lines?: CreateInvoiceLineDto[];
  autoFinalize?: boolean;
  notes?: string;
}

export interface FinalizeInvoiceDto {
  notes?: string;
}

export interface RecordPaymentDto {
  amount: number;
  paymentDate?: string;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
}

export interface VoidInvoiceDto {
  voidReason: string;
}

export interface QueryInvoicesDto {
  customerId?: string;
  customerCode?: string;
  dispatchId?: string;
  status?: InvoiceStatus;
  startDate?: string;
  endDate?: string;
  isOverdue?: boolean;
  hasOutstanding?: boolean;
}

export interface IAgingCustomerBucket {
  customerId: string;
  customerCode: string;
  customerName: string;
  currentAmount: number;    // 0 - 30 days
  days31To60Amount: number; // 31 - 60 days
  days61To90Amount: number; // 61 - 90 days
  over90DaysAmount: number; // > 90 days
  totalOutstanding: number;
  unpaidInvoicesCount: number;
}

export interface IAgingReport {
  tenantId: string;
  asOfDate: Date;
  totalReceivables: number;
  totalCurrent: number;
  totalDays31To60: number;
  totalDays61To90: number;
  totalOver90Days: number;
  customers: IAgingCustomerBucket[];
}

export interface IReceivablesSummary {
  totalInvoicedAmount: number;
  totalCollectedAmount: number;
  totalOutstandingAmount: number;
  totalOverdueAmount: number;
  totalActiveInvoicesCount: number;
  overdueInvoicesCount: number;
}
