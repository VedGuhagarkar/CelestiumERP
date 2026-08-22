import { Invoice } from './billing.model.js';
import {
  InvoiceDocument,
  IInvoice,
  QueryInvoicesDto,
  IAgingReport,
  IAgingCustomerBucket,
  IReceivablesSummary
} from './billing.types.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export interface IBillingRepository {
  generateNextInvoiceNumber(tenantId: string): Promise<string>;
  generateNextPaymentNumber(tenantId: string): Promise<string>;
  createInvoice(tenantId: string, data: Partial<IInvoice>): Promise<InvoiceDocument>;
  findInvoiceById(tenantId: string, id: string): Promise<InvoiceDocument | null>;
  findInvoiceByNumber(tenantId: string, invoiceNumber: string): Promise<InvoiceDocument | null>;
  findInvoiceByDispatchId(tenantId: string, dispatchId: string): Promise<InvoiceDocument | null>;
  findActiveInvoiceForDispatch(tenantId: string, dispatchId: string): Promise<InvoiceDocument | null>;
  findActiveInvoiceForJob(tenantId: string, jobId: string): Promise<InvoiceDocument | null>;
  queryInvoices(
    tenantId: string,
    query: QueryInvoicesDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<InvoiceDocument>>;
  getAgingReport(tenantId: string, asOfDate?: Date): Promise<IAgingReport>;
  getReceivablesSummary(tenantId: string): Promise<IReceivablesSummary>;
}

export class BillingRepository implements IBillingRepository {
  public async generateNextInvoiceNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `INV-${year}${month}-`;

    const latest = await Invoice.findOne({
      tenantId,
      invoiceNumber: new RegExp(`^${prefix}`)
    }).sort({ invoiceNumber: -1 });

    if (!latest) {
      return `${prefix}0001`;
    }

    const currentSequence = parseInt(latest.invoiceNumber.replace(prefix, ''), 10);
    const nextSeq = isNaN(currentSequence) ? 1 : currentSequence + 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  public async generateNextPaymentNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `PAY-${year}${month}-`;

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}${randomSuffix}`;
  }

  public async createInvoice(tenantId: string, data: Partial<IInvoice>): Promise<InvoiceDocument> {
    return await Invoice.create({ ...data, tenantId });
  }

  public async findInvoiceById(tenantId: string, id: string): Promise<InvoiceDocument | null> {
    return await Invoice.findOne({ tenantId, _id: id, isDeleted: false });
  }

  public async findInvoiceByNumber(tenantId: string, invoiceNumber: string): Promise<InvoiceDocument | null> {
    return await Invoice.findOne({
      tenantId,
      invoiceNumber: invoiceNumber.toUpperCase(),
      isDeleted: false
    });
  }

  public async findInvoiceByDispatchId(tenantId: string, dispatchId: string): Promise<InvoiceDocument | null> {
    return await Invoice.findOne({ tenantId, dispatchId, isDeleted: false });
  }

  public async findActiveInvoiceForDispatch(tenantId: string, dispatchId: string): Promise<InvoiceDocument | null> {
    return await Invoice.findOne({
      tenantId,
      dispatchId,
      status: { $ne: 'VOID' },
      isDeleted: false
    });
  }

  public async findActiveInvoiceForJob(tenantId: string, jobId: string): Promise<InvoiceDocument | null> {
    return await Invoice.findOne({
      tenantId,
      jobIds: jobId,
      status: { $ne: 'VOID' },
      isDeleted: false
    });
  }

  public async queryInvoices(
    tenantId: string,
    query: QueryInvoicesDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<InvoiceDocument>> {
    const filter: Record<string, any> = { tenantId, isDeleted: false };

    if (query.customerId) filter.customerId = query.customerId;
    if (query.customerCode) filter.customerCode = query.customerCode.toUpperCase();
    if (query.dispatchId) filter.dispatchId = query.dispatchId;
    if (query.status) filter.status = query.status;

    if (query.hasOutstanding) {
      filter.status = { $in: ['ISSUED', 'PARTIALLY_PAID'] };
      filter.outstandingBalance = { $gt: 0 };
    }

    if (query.isOverdue) {
      filter.status = { $in: ['ISSUED', 'PARTIALLY_PAID'] };
      filter.outstandingBalance = { $gt: 0 };
      filter.dueDate = { $lt: new Date() };
    }

    if (query.startDate || query.endDate) {
      filter.invoiceDate = {};
      if (query.startDate) filter.invoiceDate.$gte = new Date(query.startDate);
      if (query.endDate) filter.invoiceDate.$lte = new Date(query.endDate);
    }

    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Invoice.find(filter).sort({ invoiceDate: -1, createdAt: -1 }).skip(skip).limit(limit),
      Invoice.countDocuments(filter)
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  public async getAgingReport(tenantId: string, asOfDate: Date = new Date()): Promise<IAgingReport> {
    const activeUnpaidInvoices = await Invoice.find({
      tenantId,
      status: { $in: ['ISSUED', 'PARTIALLY_PAID'] },
      outstandingBalance: { $gt: 0 },
      isDeleted: false
    });

    const customerMap: Record<string, IAgingCustomerBucket> = {};

    let totalReceivables = 0;
    let totalCurrent = 0;
    let totalDays31To60 = 0;
    let totalDays61To90 = 0;
    let totalOver90Days = 0;

    for (const inv of activeUnpaidInvoices) {
      const balance = inv.outstandingBalance;
      totalReceivables += balance;

      // Calculate days overdue based on dueDate relative to asOfDate
      const diffMs = asOfDate.getTime() - new Date(inv.dueDate).getTime();
      const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (!customerMap[inv.customerCode]) {
        customerMap[inv.customerCode] = {
          customerId: inv.customerId,
          customerCode: inv.customerCode,
          customerName: inv.customerName,
          currentAmount: 0,
          days31To60Amount: 0,
          days61To90Amount: 0,
          over90DaysAmount: 0,
          totalOutstanding: 0,
          unpaidInvoicesCount: 0
        };
      }

      const cust = customerMap[inv.customerCode];
      cust.totalOutstanding += balance;
      cust.unpaidInvoicesCount += 1;

      if (daysOverdue <= 0 || daysOverdue <= 30) {
        cust.currentAmount += balance;
        totalCurrent += balance;
      } else if (daysOverdue <= 60) {
        cust.days31To60Amount += balance;
        totalDays31To60 += balance;
      } else if (daysOverdue <= 90) {
        cust.days61To90Amount += balance;
        totalDays61To90 += balance;
      } else {
        cust.over90DaysAmount += balance;
        totalOver90Days += balance;
      }
    }

    // Format numbers to 2 decimal places
    const customers = Object.values(customerMap).map((c) => ({
      ...c,
      currentAmount: Number(c.currentAmount.toFixed(2)),
      days31To60Amount: Number(c.days31To60Amount.toFixed(2)),
      days61To90Amount: Number(c.days61To90Amount.toFixed(2)),
      over90DaysAmount: Number(c.over90DaysAmount.toFixed(2)),
      totalOutstanding: Number(c.totalOutstanding.toFixed(2))
    }));

    return {
      tenantId,
      asOfDate,
      totalReceivables: Number(totalReceivables.toFixed(2)),
      totalCurrent: Number(totalCurrent.toFixed(2)),
      totalDays31To60: Number(totalDays31To60.toFixed(2)),
      totalDays61To90: Number(totalDays61To90.toFixed(2)),
      totalOver90Days: Number(totalOver90Days.toFixed(2)),
      customers
    };
  }

  public async getReceivablesSummary(tenantId: string): Promise<IReceivablesSummary> {
    const allInvoices = await Invoice.find({
      tenantId,
      status: { $ne: 'VOID' },
      isDeleted: false
    });

    const now = new Date();
    let totalInvoicedAmount = 0;
    let totalCollectedAmount = 0;
    let totalOutstandingAmount = 0;
    let totalOverdueAmount = 0;
    let overdueInvoicesCount = 0;

    for (const inv of allInvoices) {
      totalInvoicedAmount += inv.totalAmount || 0;
      totalCollectedAmount += inv.paidAmount || 0;
      totalOutstandingAmount += inv.outstandingBalance || 0;

      if (inv.outstandingBalance > 0 && new Date(inv.dueDate) < now) {
        totalOverdueAmount += inv.outstandingBalance;
        overdueInvoicesCount += 1;
      }
    }

    return {
      totalInvoicedAmount: Number(totalInvoicedAmount.toFixed(2)),
      totalCollectedAmount: Number(totalCollectedAmount.toFixed(2)),
      totalOutstandingAmount: Number(totalOutstandingAmount.toFixed(2)),
      totalOverdueAmount: Number(totalOverdueAmount.toFixed(2)),
      totalActiveInvoicesCount: allInvoices.length,
      overdueInvoicesCount
    };
  }
}

export const billingRepository = new BillingRepository();
