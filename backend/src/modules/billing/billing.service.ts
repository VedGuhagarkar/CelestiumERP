import { BaseService } from '../../core/services/base.service.js';
import { IBillingRepository, billingRepository } from './billing.repository.js';
import { dispatchRepository, IDispatchRepository } from '../dispatch/dispatch.repository.js';
import { productionJobRepository, IProductionJobRepository } from '../production-job/production-job.repository.js';
import { customerRepository, ICustomerRepository } from '../customer/customer.repository.js';
import { financeService, FinanceService } from '../finance/finance.service.js';
import { auditService } from '../audit/audit.service.js';
import { DomainEvents } from '../../core/constants/events.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../core/errors/app-error.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';
import {
  InvoiceDocument,
  CreateInvoiceDto,
  FinalizeInvoiceDto,
  RecordPaymentDto,
  VoidInvoiceDto,
  QueryInvoicesDto,
  IInvoiceLine,
  ITaxBreakdown,
  IAgingReport,
  IReceivablesSummary
} from './billing.types.js';

export interface IActorContext {
  userId: string;
  email?: string;
  role?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

export class BillingService extends BaseService {
  constructor(
    private readonly repo: IBillingRepository = billingRepository,
    private readonly dispatchRepo: IDispatchRepository = dispatchRepository,
    private readonly jobRepo: IProductionJobRepository = productionJobRepository,
    private readonly customerRepo: ICustomerRepository = customerRepository,
    private readonly finance: FinanceService = financeService
  ) {
    super('BillingService');
  }

  // ==========================================
  // 1. Invoice Creation & Calculation
  // ==========================================

  public async createInvoice(
    tenantId: string,
    actor: IActorContext,
    dto: CreateInvoiceDto
  ): Promise<InvoiceDocument> {
    let customerId = dto.customerId;
    let customerCode = dto.customerCode.toUpperCase();
    let customerName = dto.customerName || 'Standard Factory Customer';
    let customerBillingAddress = dto.customerBillingAddress;
    let customerGstVatNumber = dto.customerGstVatNumber;

    const customer = await this.customerRepo.findByCode(tenantId, customerCode);
    if (customer) {
      customerId = customer.id;
      customerName =
        (customer as any).companyName ||
        (customer as any).tradeName ||
        (customer as any).name ||
        'Standard Factory Customer';
      customerBillingAddress =
        customerBillingAddress || customer.billingAddress?.street || 'Factory Customer Billing Office';
      customerGstVatNumber =
        customerGstVatNumber || customer.taxDetails?.gstin || (customer as any).taxId;
    }

    const invoiceLines: IInvoiceLine[] = [];
    const jobIdsSet = new Set<string>(dto.jobIds || []);
    const jobNumbersSet = new Set<string>();

    const defaultTaxRate = dto.taxRatePercent !== undefined ? dto.taxRatePercent : 18.0;

    // 1. If dispatchId is provided, generate authoritative lines from Dispatch Consignment
    if (dto.dispatchId) {
      const dispatch = await this.dispatchRepo.findById(tenantId, dto.dispatchId);
      if (!dispatch || dispatch.isDeleted) {
        throw new NotFoundError(`Dispatch Consignment with ID '${dto.dispatchId}' not found`);
      }

      // Gating: Only DISPATCHED or DELIVERED consignments can be invoiced
      if (!['DISPATCHED', 'DELIVERED'].includes(dispatch.status)) {
        throw new BadRequestError(
          `Cannot generate invoice: Dispatch Consignment '${dispatch.dispatchNumber}' is in status '${dispatch.status}'. Invoices can only be issued against DISPATCHED or DELIVERED consignments.`
        );
      }

      // Duplicate Check
      const existingInvoice = await this.repo.findActiveInvoiceForDispatch(tenantId, dispatch.id);
      if (existingInvoice) {
        throw new ConflictError(
          `Dispatch Consignment '${dispatch.dispatchNumber}' has already been billed on Invoice '${existingInvoice.invoiceNumber}'`
        );
      }

      customerId = (dispatch.customer as any)?.customerId || (dispatch as any).customerId;
      customerCode = (
        (dispatch.customer as any)?.customerCode ||
        (dispatch as any).customerCode ||
        'CUST-STD'
      ).toUpperCase();
      customerName = (dispatch.customer as any)?.customerName || (dispatch as any).customerName || 'Customer';

      for (let i = 0; i < dispatch.lines.length; i++) {
        const dLine = dispatch.lines[i];
        const lineQty = dLine.dispatchedQuantity || 1;
        const unitPrice = (dLine as any).unitPrice || 18.50; // Standard heat-treatment fee per unit
        const lineSubtotal = Number((lineQty * unitPrice).toFixed(2));
        const lineTax = Number(((lineSubtotal * defaultTaxRate) / 100).toFixed(2));
        const lineTotal = Number((lineSubtotal + lineTax).toFixed(2));

        if (dLine.jobId) jobIdsSet.add(dLine.jobId);
        if (dLine.jobNumber) jobNumbersSet.add(dLine.jobNumber);

        invoiceLines.push({
          lineId: `LINE-${String(i + 1).padStart(3, '0')}`,
          jobId: dLine.jobId,
          jobNumber: dLine.jobNumber,
          dispatchLineId: dLine.lineId,
          itemCode: dLine.itemCode,
          description: `Commercial Heat-Treatment: ${dLine.itemName || dLine.itemCode} (Job ${dLine.jobNumber})`,
          quantity: lineQty,
          uom: dLine.uom || 'PCS',
          unitPrice,
          subtotal: lineSubtotal,
          heatLotNumber: dLine.heatLotNumber,
          certificateOfConformanceNumber:
            (dLine as any).certificateOfConformanceNumber || dLine.qualityVerification?.cocNumber,
          taxRatePercent: defaultTaxRate,
          taxAmount: lineTax,
          totalAmount: lineTotal
        });
      }
    } else if (dto.lines && dto.lines.length > 0) {
      // 2. Explicit invoice lines provided
      for (let i = 0; i < dto.lines.length; i++) {
        const line = dto.lines[i];
        const lineQty = line.quantity;
        const unitPrice = line.unitPrice;
        const lineSubtotal = Number((lineQty * unitPrice).toFixed(2));
        const taxRate = line.taxRatePercent !== undefined ? line.taxRatePercent : defaultTaxRate;
        const lineTax = Number(((lineSubtotal * taxRate) / 100).toFixed(2));
        const lineTotal = Number((lineSubtotal + lineTax).toFixed(2));

        if (line.jobId) {
          // Check for duplicate billing of job
          const existingJobInvoice = await this.repo.findActiveInvoiceForJob(tenantId, line.jobId);
          if (existingJobInvoice) {
            throw new ConflictError(
              `Production Job '${line.jobNumber || line.jobId}' has already been billed on Invoice '${existingJobInvoice.invoiceNumber}'`
            );
          }
          jobIdsSet.add(line.jobId);
        }
        if (line.jobNumber) jobNumbersSet.add(line.jobNumber);

        invoiceLines.push({
          lineId: `LINE-${String(i + 1).padStart(3, '0')}`,
          jobId: line.jobId,
          jobNumber: line.jobNumber,
          dispatchLineId: line.dispatchLineId,
          itemCode: line.itemCode.toUpperCase(),
          description: line.description,
          quantity: lineQty,
          uom: line.uom.toUpperCase(),
          unitPrice,
          subtotal: lineSubtotal,
          heatLotNumber: line.heatLotNumber,
          certificateOfConformanceNumber: line.certificateOfConformanceNumber,
          taxRatePercent: taxRate,
          taxAmount: lineTax,
          totalAmount: lineTotal
        });
      }
    } else if (dto.jobIds && dto.jobIds.length > 0) {
      // 3. Generate from Job IDs
      for (let i = 0; i < dto.jobIds.length; i++) {
        const jobId = dto.jobIds[i];
        const job = await this.jobRepo.findById(tenantId, jobId);
        if (!job) {
          throw new NotFoundError(`Production Job '${jobId}' not found`);
        }

        if (!['COMPLETED', 'DISPATCHED', 'QUALITY_CHECK', 'STORAGE', 'READY_FOR_DISPATCH'].includes(job.status)) {
          throw new BadRequestError(
            `Cannot invoice Job '${job.jobNumber}': Status is '${job.status}'. Only finalized/completed jobs can be billed.`
          );
        }

        const existingJobInvoice = await this.repo.findActiveInvoiceForJob(tenantId, job.id);
        if (existingJobInvoice) {
          throw new ConflictError(
            `Production Job '${job.jobNumber}' has already been billed on Invoice '${existingJobInvoice.invoiceNumber}'`
          );
        }

        const jobQty = typeof job.quantity === 'number' ? job.quantity : ((job.quantity as any)?.completedQuantity || 100);
        const unitPrice = 22.0; // Standard per unit fee
        const lineSubtotal = Number((jobQty * unitPrice).toFixed(2));
        const lineTax = Number(((lineSubtotal * defaultTaxRate) / 100).toFixed(2));
        const lineTotal = Number((lineSubtotal + lineTax).toFixed(2));

        jobIdsSet.add(job.id);
        jobNumbersSet.add(job.jobNumber);

        invoiceLines.push({
          lineId: `LINE-${String(i + 1).padStart(3, '0')}`,
          jobId: job.id,
          jobNumber: job.jobNumber,
          itemCode: (job.item as any)?.itemCode || (job.item as any)?.code || 'PART-001',
          description: `Heat-Treatment Processing for Job ${job.jobNumber}`,
          quantity: jobQty,
          uom: (job.item as any)?.uom || (job as any).uom || 'PCS',
          unitPrice,
          subtotal: lineSubtotal,
          taxRatePercent: defaultTaxRate,
          taxAmount: lineTax,
          totalAmount: lineTotal
        });
      }
    } else {
      throw new BadRequestError(
        'Invoice must contain either a valid dispatchId, jobIds list, or explicit invoice lines.'
      );
    }

    // Totals and Tax Breakdown Calculation
    let subtotal = 0;
    let totalTaxAmount = 0;

    for (const l of invoiceLines) {
      subtotal += l.subtotal;
      totalTaxAmount += l.taxAmount;
    }

    subtotal = Number(subtotal.toFixed(2));
    totalTaxAmount = Number(totalTaxAmount.toFixed(2));
    const totalAmount = Number((subtotal + totalTaxAmount).toFixed(2));

    const taxBreakdown: ITaxBreakdown[] = [
      {
        taxType: dto.taxType || 'GST_CGST_SGST',
        taxRatePercent: defaultTaxRate,
        taxableAmount: subtotal,
        taxAmount: totalTaxAmount,
        exemptionReason: dto.exemptionReason
      }
    ];

    const invoiceDate = dto.invoiceDate ? new Date(dto.invoiceDate) : new Date();
    const paymentTermsDays = dto.paymentTermsDays || 30;
    const dueDate = new Date(invoiceDate.getTime() + paymentTermsDays * 24 * 60 * 60 * 1000);

    const invoiceNumber = await this.repo.generateNextInvoiceNumber(tenantId);

    const invoice = await this.repo.createInvoice(tenantId, {
      invoiceNumber,
      customerId,
      customerCode,
      customerName,
      customerBillingAddress,
      customerGstVatNumber,
      dispatchId: dto.dispatchId,
      dispatchNumber: dto.dispatchNumber,
      jobIds: Array.from(jobIdsSet),
      jobNumbers: Array.from(jobNumbersSet),
      invoiceDate,
      dueDate,
      paymentTermsDays,
      status: dto.autoFinalize ? 'ISSUED' : 'DRAFT',
      lines: invoiceLines,
      currency: dto.currency || 'USD',
      subtotal,
      taxBreakdown,
      totalTaxAmount,
      totalAmount,
      paidAmount: 0,
      outstandingBalance: totalAmount,
      payments: [],
      isFinalized: Boolean(dto.autoFinalize),
      finalizedAt: dto.autoFinalize ? new Date() : undefined,
      finalizedBy: dto.autoFinalize
        ? {
            userId: actor.userId,
            email: actor.email,
            role: actor.role
          }
        : undefined,
      isVoid: false,
      notes: dto.notes
    });

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: dto.autoFinalize ? 'BILLING_INVOICE_FINALIZED' : 'BILLING_INVOICE_CREATED',
      entityType: 'Invoice',
      entityId: invoice.id,
      afterState: invoice.toJSON(),
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        customerCode: invoice.customerCode,
        totalAmount: invoice.totalAmount,
        status: invoice.status
      }
    });

    // If auto-finalized, link to double-entry finance
    if (dto.autoFinalize) {
      await this.postInvoiceFinanceJournal(tenantId, actor, invoice);
      this.publishEvent(
        DomainEvents.INVOICE_ISSUED,
        tenantId,
        {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          customerCode: invoice.customerCode,
          totalAmount: invoice.totalAmount
        },
        actor.userId
      );
    }

    return invoice;
  }

  // ==========================================
  // 2. Invoice Finalization & Accounting Integration
  // ==========================================

  public async finalizeInvoice(
    tenantId: string,
    actor: IActorContext,
    id: string,
    dto: FinalizeInvoiceDto
  ): Promise<InvoiceDocument> {
    const invoice = await this.repo.findInvoiceById(tenantId, id);
    if (!invoice || invoice.isDeleted) {
      throw new NotFoundError(`Invoice with ID '${id}' not found`);
    }

    if (invoice.isFinalized || invoice.status !== 'DRAFT') {
      throw new BadRequestError(`Invoice '${invoice.invoiceNumber}' is already in status '${invoice.status}'`);
    }

    const beforeState = invoice.toJSON();
    const now = new Date();

    invoice.status = 'ISSUED';
    invoice.isFinalized = true;
    invoice.finalizedAt = now;
    invoice.finalizedBy = {
      userId: actor.userId,
      email: actor.email,
      role: actor.role
    };
    if (dto.notes) invoice.notes = dto.notes;

    // Post to Double-Entry General Ledger
    await this.postInvoiceFinanceJournal(tenantId, actor, invoice);

    const updated = await invoice.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'BILLING_INVOICE_FINALIZED',
      entityType: 'Invoice',
      entityId: updated.id,
      beforeState,
      afterState: updated.toJSON(),
      metadata: {
        invoiceNumber: updated.invoiceNumber,
        customerCode: updated.customerCode,
        totalAmount: updated.totalAmount,
        journalEntryNumber: updated.journalEntryNumber
      }
    });

    this.publishEvent(
      DomainEvents.INVOICE_ISSUED,
      tenantId,
      {
        invoiceId: updated.id,
        invoiceNumber: updated.invoiceNumber,
        customerCode: updated.customerCode,
        totalAmount: updated.totalAmount
      },
      actor.userId
    );

    return updated;
  }

  // ==========================================
  // 3. Payment Receipt Recording
  // ==========================================

  public async recordPayment(
    tenantId: string,
    actor: IActorContext,
    id: string,
    dto: RecordPaymentDto
  ): Promise<InvoiceDocument> {
    const invoice = await this.repo.findInvoiceById(tenantId, id);
    if (!invoice || invoice.isDeleted) {
      throw new NotFoundError(`Invoice with ID '${id}' not found`);
    }

    if (invoice.isVoid || invoice.status === 'VOID') {
      throw new BadRequestError(`Cannot record payment on VOID invoice '${invoice.invoiceNumber}'`);
    }

    if (invoice.status === 'DRAFT') {
      throw new BadRequestError(
        `Cannot record payment on DRAFT invoice '${invoice.invoiceNumber}'. Finalize invoice first.`
      );
    }

    if (invoice.status === 'PAID' || invoice.outstandingBalance <= 0.001) {
      throw new BadRequestError(`Invoice '${invoice.invoiceNumber}' is already PAID in full`);
    }

    const amount = Number(dto.amount.toFixed(2));
    if (amount > invoice.outstandingBalance + 0.01) {
      throw new BadRequestError(
        `Payment amount ($${amount.toFixed(2)}) exceeds outstanding balance ($${invoice.outstandingBalance.toFixed(2)})`
      );
    }

    const paymentNumber = await this.repo.generateNextPaymentNumber(tenantId);
    const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();

    // 1. Create and Post Double-Entry Journal Entry in Finance
    // Debit 1010 Cash/Bank, Credit 1100 Trade Accounts Receivable
    let receiptJournalId: string | undefined;
    try {
      const receiptJournal = await this.finance.createJournalEntry(tenantId, actor, {
        postingDate: paymentDate.toISOString(),
        entryType: 'OPERATIONAL',
        sourceModule: 'BILLING',
        sourceReferenceNumber: invoice.invoiceNumber,
        description: `Customer payment receipt ${paymentNumber} for Invoice ${invoice.invoiceNumber}`,
        autoPost: true,
        lines: [
          {
            accountCode: '1010', // Cash / Operating Bank
            debit: amount,
            credit: 0,
            description: `Payment ${paymentNumber} from ${invoice.customerName}`
          },
          {
            accountCode: '1100', // Trade Accounts Receivable
            customerCode: invoice.customerCode,
            debit: 0,
            credit: amount,
            description: `AR clearance for Invoice ${invoice.invoiceNumber}`
          }
        ]
      });
      receiptJournalId = receiptJournal.id;
    } catch (err) {
      this.logger.warn(`Could not auto-post receipt journal for payment ${paymentNumber}: ${(err as Error).message}`);
    }

    const beforeState = invoice.toJSON();

    invoice.payments.push({
      paymentNumber,
      paymentDate,
      amount,
      paymentMethod: dto.paymentMethod,
      referenceNumber: dto.referenceNumber,
      recordedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      journalEntryId: receiptJournalId,
      notes: dto.notes
    });

    invoice.paidAmount = Number((invoice.paidAmount + amount).toFixed(2));
    invoice.outstandingBalance = Number((invoice.totalAmount - invoice.paidAmount).toFixed(2));

    if (invoice.outstandingBalance <= 0.001) {
      invoice.outstandingBalance = 0;
      invoice.status = 'PAID';
    } else {
      invoice.status = 'PARTIALLY_PAID';
    }

    const updated = await invoice.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'BILLING_PAYMENT_RECORDED',
      entityType: 'Invoice',
      entityId: updated.id,
      beforeState,
      afterState: updated.toJSON(),
      metadata: {
        invoiceNumber: updated.invoiceNumber,
        paymentNumber,
        amount,
        outstandingBalance: updated.outstandingBalance,
        status: updated.status
      }
    });

    this.publishEvent(
      DomainEvents.PAYMENT_RECEIVED,
      tenantId,
      {
        invoiceId: updated.id,
        invoiceNumber: updated.invoiceNumber,
        paymentNumber,
        amount,
        outstandingBalance: updated.outstandingBalance
      },
      actor.userId
    );

    return updated;
  }

  // ==========================================
  // 4. Voiding & Reversal Controls
  // ==========================================

  public async voidInvoice(
    tenantId: string,
    actor: IActorContext,
    id: string,
    dto: VoidInvoiceDto
  ): Promise<InvoiceDocument> {
    const invoice = await this.repo.findInvoiceById(tenantId, id);
    if (!invoice || invoice.isDeleted) {
      throw new NotFoundError(`Invoice with ID '${id}' not found`);
    }

    if (invoice.isVoid || invoice.status === 'VOID') {
      throw new BadRequestError(`Invoice '${invoice.invoiceNumber}' is already VOID`);
    }

    if (invoice.paidAmount > 0) {
      throw new BadRequestError(
        `Cannot void invoice '${invoice.invoiceNumber}' with existing recorded payments ($${invoice.paidAmount.toFixed(2)}). Process refund first.`
      );
    }

    const beforeState = invoice.toJSON();
    const now = new Date();

    invoice.status = 'VOID';
    invoice.isVoid = true;
    invoice.voidedAt = now;
    invoice.voidedBy = {
      userId: actor.userId,
      email: actor.email,
      role: actor.role
    };
    invoice.voidReason = dto.voidReason;
    invoice.outstandingBalance = 0;

    // Reverse finance journal if posted
    if (invoice.journalEntryId) {
      try {
        await this.finance.reverseJournalEntry(tenantId, actor, invoice.journalEntryId, {
          reversalReason: `Invoice ${invoice.invoiceNumber} voided: ${dto.voidReason}`
        });
      } catch (err) {
        this.logger.warn(`Could not reverse journal for voided invoice ${invoice.invoiceNumber}: ${(err as Error).message}`);
      }
    }

    const updated = await invoice.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'BILLING_INVOICE_VOIDED',
      entityType: 'Invoice',
      entityId: updated.id,
      beforeState,
      afterState: updated.toJSON(),
      metadata: {
        invoiceNumber: updated.invoiceNumber,
        voidReason: dto.voidReason,
        voidedAt: now.toISOString()
      }
    });

    this.publishEvent(
      DomainEvents.INVOICE_VOIDED,
      tenantId,
      {
        invoiceId: updated.id,
        invoiceNumber: updated.invoiceNumber,
        voidReason: dto.voidReason
      },
      actor.userId
    );

    return updated;
  }

  // ==========================================
  // 5. Query & AR Aging Reports
  // ==========================================

  public async getInvoiceById(tenantId: string, id: string): Promise<InvoiceDocument> {
    const invoice = await this.repo.findInvoiceById(tenantId, id);
    if (!invoice || invoice.isDeleted) {
      throw new NotFoundError(`Invoice with ID '${id}' not found`);
    }
    return invoice;
  }

  public async getInvoiceByNumber(tenantId: string, invoiceNumber: string): Promise<InvoiceDocument> {
    const invoice = await this.repo.findInvoiceByNumber(tenantId, invoiceNumber);
    if (!invoice || invoice.isDeleted) {
      throw new NotFoundError(`Invoice '${invoiceNumber}' not found`);
    }
    return invoice;
  }

  public async queryInvoices(
    tenantId: string,
    query: QueryInvoicesDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<InvoiceDocument>> {
    return await this.repo.queryInvoices(tenantId, query, pagination);
  }

  public async getAgingReport(tenantId: string, asOfDate?: Date): Promise<IAgingReport> {
    return await this.repo.getAgingReport(tenantId, asOfDate);
  }

  public async getReceivablesSummary(tenantId: string): Promise<IReceivablesSummary> {
    return await this.repo.getReceivablesSummary(tenantId);
  }

  // ==========================================
  // Private Helper: Post Finance Journal
  // ==========================================

  private async postInvoiceFinanceJournal(
    tenantId: string,
    actor: IActorContext,
    invoice: InvoiceDocument
  ): Promise<void> {
    try {
      const lines = [
        {
          accountCode: '1100', // Trade Accounts Receivable
          customerCode: invoice.customerCode,
          debit: invoice.totalAmount,
          credit: 0,
          description: `Trade AR for Invoice ${invoice.invoiceNumber}`
        },
        {
          accountCode: '4010', // Heat Treatment Service Revenue
          costCenterCode: 'CC-FURNACE-VAC',
          debit: 0,
          credit: invoice.subtotal,
          description: `Commercial Heat-Treatment Revenue (${invoice.invoiceNumber})`
        }
      ];

      if (invoice.totalTaxAmount > 0) {
        lines.push({
          accountCode: '2200', // Statutory Taxes (GST/VAT)
          debit: 0,
          credit: invoice.totalTaxAmount,
          description: `Output GST/VAT Tax for Invoice ${invoice.invoiceNumber}`
        } as any);
      }

      const journal = await this.finance.createJournalEntry(tenantId, actor, {
        postingDate: invoice.invoiceDate.toISOString(),
        entryType: 'OPERATIONAL',
        sourceModule: 'BILLING',
        sourceReferenceId: invoice.id,
        sourceReferenceNumber: invoice.invoiceNumber,
        description: `Revenue billing for Invoice ${invoice.invoiceNumber} (${invoice.customerName})`,
        autoPost: true,
        lines
      });

      invoice.journalEntryId = journal.id;
      invoice.journalEntryNumber = journal.entryNumber;
    } catch (err) {
      this.logger.warn(
        `Failed to post finance journal entry for invoice ${invoice.invoiceNumber}: ${(err as Error).message}`
      );
    }
  }
}

export const billingService = new BillingService();
