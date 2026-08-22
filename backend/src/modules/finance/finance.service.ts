import { BaseService } from '../../core/services/base.service.js';
import { IFinanceRepository, financeRepository } from './finance.repository.js';
import { auditService } from '../audit/audit.service.js';
import { DomainEvents } from '../../core/constants/events.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../core/errors/app-error.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';
import {
  AccountDocument,
  CostCenterDocument,
  AccountingPeriodDocument,
  JournalEntryDocument,
  CreateAccountDto,
  UpdateAccountDto,
  CreateCostCenterDto,
  CreatePeriodDto,
  ClosePeriodDto,
  CreateJournalEntryDto,
  ReverseJournalEntryDto,
  QueryJournalEntriesDto,
  QueryLedgerDto,
  QueryTrialBalanceDto,
  ITrialBalanceReport,
  ITrialBalanceRow,
  IGeneralLedgerAccountReport,
  ILedgerTransaction,
  IJournalLine
} from './finance.types.js';

export interface IActorContext {
  userId: string;
  email?: string;
  role?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

export class FinanceService extends BaseService {
  constructor(private readonly repo: IFinanceRepository = financeRepository) {
    super('FinanceService');
  }

  // ==========================================
  // 1. Chart of Accounts Management
  // ==========================================

  public async createAccount(
    tenantId: string,
    actor: IActorContext,
    dto: CreateAccountDto
  ): Promise<AccountDocument> {
    const existing = await this.repo.findAccountByCode(tenantId, dto.accountCode);
    if (existing) {
      throw new ConflictError(`Account with code '${dto.accountCode}' already exists`);
    }

    if (dto.parentAccountCode) {
      const parent = await this.repo.findAccountByCode(tenantId, dto.parentAccountCode);
      if (!parent) {
        throw new NotFoundError(`Parent account '${dto.parentAccountCode}' not found`);
      }
    }

    const account = await this.repo.createAccount(tenantId, {
      accountCode: dto.accountCode.toUpperCase(),
      accountName: dto.accountName,
      accountType: dto.accountType,
      normalBalance: dto.normalBalance,
      parentAccountCode: dto.parentAccountCode?.toUpperCase(),
      description: dto.description,
      isActive: true,
      isSystem: false
    });

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'FINANCE_ACCOUNT_CREATED',
      entityType: 'Account',
      entityId: account.id,
      afterState: account.toJSON(),
      metadata: { accountCode: account.accountCode, accountType: account.accountType }
    });

    return account;
  }

  public async getAllAccounts(tenantId: string, onlyActive = true): Promise<AccountDocument[]> {
    let accounts = await this.repo.findAllAccounts(tenantId, onlyActive);
    if (accounts.length === 0) {
      accounts = await this.repo.seedDefaultAccounts(tenantId);
    }
    return accounts;
  }

  public async getAccountByCode(tenantId: string, code: string): Promise<AccountDocument> {
    const account = await this.repo.findAccountByCode(tenantId, code);
    if (!account) {
      throw new NotFoundError(`Account with code '${code}' not found`);
    }
    return account;
  }

  public async updateAccount(
    tenantId: string,
    actor: IActorContext,
    code: string,
    dto: UpdateAccountDto
  ): Promise<AccountDocument> {
    const existing = await this.getAccountByCode(tenantId, code);
    const beforeState = existing.toJSON();

    const updated = await this.repo.updateAccount(tenantId, code, dto as any);
    if (!updated) {
      throw new NotFoundError(`Account with code '${code}' not found`);
    }

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'FINANCE_ACCOUNT_UPDATED',
      entityType: 'Account',
      entityId: updated.id,
      beforeState,
      afterState: updated.toJSON()
    });

    return updated;
  }

  // ==========================================
  // 2. Factory Cost Centers Management
  // ==========================================

  public async createCostCenter(
    tenantId: string,
    actor: IActorContext,
    dto: CreateCostCenterDto
  ): Promise<CostCenterDocument> {
    const existing = await this.repo.findCostCenterByCode(tenantId, dto.costCenterCode);
    if (existing) {
      throw new ConflictError(`Cost Center with code '${dto.costCenterCode}' already exists`);
    }

    const costCenter = await this.repo.createCostCenter(tenantId, {
      costCenterCode: dto.costCenterCode.toUpperCase(),
      name: dto.name,
      department: dto.department,
      description: dto.description,
      isActive: true
    });

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'FINANCE_COST_CENTER_CREATED',
      entityType: 'CostCenter',
      entityId: costCenter.id,
      afterState: costCenter.toJSON(),
      metadata: { costCenterCode: costCenter.costCenterCode }
    });

    return costCenter;
  }

  public async getAllCostCenters(tenantId: string, onlyActive = true): Promise<CostCenterDocument[]> {
    let costCenters = await this.repo.findAllCostCenters(tenantId, onlyActive);
    if (costCenters.length === 0) {
      costCenters = await this.repo.seedDefaultCostCenters(tenantId);
    }
    return costCenters;
  }

  // ==========================================
  // 3. Accounting Periods Management
  // ==========================================

  public async createPeriod(
    tenantId: string,
    actor: IActorContext,
    dto: CreatePeriodDto
  ): Promise<AccountingPeriodDocument> {
    const existing = await this.repo.findPeriodByCode(tenantId, dto.periodCode);
    if (existing) {
      throw new ConflictError(`Accounting Period with code '${dto.periodCode}' already exists`);
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (startDate >= endDate) {
      throw new BadRequestError('Period startDate must be earlier than endDate');
    }

    const period = await this.repo.createPeriod(tenantId, {
      periodCode: dto.periodCode.toUpperCase(),
      name: dto.name,
      startDate,
      endDate,
      status: 'OPEN'
    });

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'FINANCE_PERIOD_CREATED',
      entityType: 'AccountingPeriod',
      entityId: period.id,
      afterState: period.toJSON(),
      metadata: { periodCode: period.periodCode }
    });

    return period;
  }

  public async getAllPeriods(tenantId: string): Promise<AccountingPeriodDocument[]> {
    let periods = await this.repo.findAllPeriods(tenantId);
    if (periods.length === 0) {
      periods = await this.repo.seedDefaultPeriods(tenantId);
    }
    return periods;
  }

  public async closePeriod(
    tenantId: string,
    actor: IActorContext,
    periodCode: string,
    dto: ClosePeriodDto
  ): Promise<AccountingPeriodDocument> {
    const period = await this.repo.findPeriodByCode(tenantId, periodCode);
    if (!period) {
      throw new NotFoundError(`Accounting Period '${periodCode}' not found`);
    }

    if (period.status === 'CLOSED') {
      throw new BadRequestError(`Accounting Period '${periodCode}' is already CLOSED`);
    }

    const now = new Date();
    const beforeState = period.toJSON();

    period.status = 'CLOSED';
    period.closedAt = now;
    period.closedBy = {
      userId: actor.userId,
      email: actor.email,
      role: actor.role
    };
    period.closingNotes = dto.closingNotes;

    const updated = await period.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'FINANCE_PERIOD_CLOSED',
      entityType: 'AccountingPeriod',
      entityId: updated.id,
      beforeState,
      afterState: updated.toJSON(),
      metadata: { periodCode: updated.periodCode, closedAt: now.toISOString() }
    });

    this.publishEvent(
      DomainEvents.PERIOD_CLOSED,
      tenantId,
      { periodCode: updated.periodCode, closedAt: now },
      actor.userId
    );

    return updated;
  }

  public async reopenPeriod(
    tenantId: string,
    actor: IActorContext,
    periodCode: string
  ): Promise<AccountingPeriodDocument> {
    const period = await this.repo.findPeriodByCode(tenantId, periodCode);
    if (!period) {
      throw new NotFoundError(`Accounting Period '${periodCode}' not found`);
    }

    if (period.status === 'OPEN') {
      throw new BadRequestError(`Accounting Period '${periodCode}' is already OPEN`);
    }

    const beforeState = period.toJSON();
    period.status = 'OPEN';
    period.closedAt = undefined;
    period.closedBy = undefined;
    period.closingNotes = undefined;

    const updated = await period.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'FINANCE_PERIOD_REOPENED',
      entityType: 'AccountingPeriod',
      entityId: updated.id,
      beforeState,
      afterState: updated.toJSON(),
      metadata: { periodCode: updated.periodCode }
    });

    this.publishEvent(
      DomainEvents.PERIOD_REOPENED,
      tenantId,
      { periodCode: updated.periodCode },
      actor.userId
    );

    return updated;
  }

  // ==========================================
  // 4. Double-Entry Journal Lifecycle
  // ==========================================

  /**
   * Create a new Journal Entry
   * Validates debits == credits, account validity, cost center validity, and period status.
   */
  public async createJournalEntry(
    tenantId: string,
    actor: IActorContext,
    dto: CreateJournalEntryDto
  ): Promise<JournalEntryDocument> {
    const postingDate = new Date(dto.postingDate);

    // 1. Determine & Validate Accounting Period
    let periodCode = dto.accountingPeriod;
    if (!periodCode) {
      const year = postingDate.getFullYear();
      const month = String(postingDate.getMonth() + 1).padStart(2, '0');
      periodCode = `${year}-${month}`;
    }

    let period = await this.repo.findPeriodByCode(tenantId, periodCode);
    if (!period) {
      // Auto-create standard monthly period if missing
      const year = postingDate.getFullYear();
      const month = postingDate.getMonth();
      period = await this.repo.createPeriod(tenantId, {
        periodCode,
        name: `Period ${periodCode}`,
        startDate: new Date(Date.UTC(year, month, 1)),
        endDate: new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)),
        status: 'OPEN'
      });
    }

    if (period.status === 'CLOSED') {
      throw new BadRequestError(
        `Cannot post transaction: Accounting Period '${periodCode}' is CLOSED for new journal entries.`
      );
    }

    // 2. Validate Double-Entry Balance
    let totalDebit = 0;
    let totalCredit = 0;
    const validatedLines: IJournalLine[] = [];

    for (let i = 0; i < dto.lines.length; i++) {
      const line = dto.lines[i];
      const debit = Number(line.debit) || 0;
      const credit = Number(line.credit) || 0;

      if (debit < 0 || credit < 0) {
        throw new BadRequestError(`Line ${i + 1}: Debits and Credits must be non-negative numbers.`);
      }

      if (debit === 0 && credit === 0) {
        throw new BadRequestError(`Line ${i + 1}: Either Debit or Credit must be greater than 0.`);
      }

      if (debit > 0 && credit > 0) {
        throw new BadRequestError(
          `Line ${i + 1}: A journal line cannot contain both Debit and Credit simultaneously.`
        );
      }

      // Verify Account exists in Chart of Accounts
      const account = await this.repo.findAccountByCode(tenantId, line.accountCode);
      if (!account) {
        throw new NotFoundError(
          `Line ${i + 1}: Account with code '${line.accountCode}' not found in Chart of Accounts.`
        );
      }

      if (!account.isActive) {
        throw new BadRequestError(
          `Line ${i + 1}: Account '${account.accountCode} - ${account.accountName}' is INACTIVE.`
        );
      }

      // Verify Cost Center if provided
      if (line.costCenterCode) {
        const cc = await this.repo.findCostCenterByCode(tenantId, line.costCenterCode);
        if (!cc) {
          throw new NotFoundError(
            `Line ${i + 1}: Cost Center '${line.costCenterCode}' not found.`
          );
        }
        if (!cc.isActive) {
          throw new BadRequestError(
            `Line ${i + 1}: Cost Center '${line.costCenterCode}' is INACTIVE.`
          );
        }
      }

      totalDebit += debit;
      totalCredit += credit;

      validatedLines.push({
        lineId: `LINE-${String(i + 1).padStart(3, '0')}`,
        accountCode: account.accountCode,
        accountName: account.accountName,
        costCenterCode: line.costCenterCode?.toUpperCase(),
        debit,
        credit,
        description: line.description || dto.description,
        jobId: line.jobId,
        jobNumber: line.jobNumber,
        customerId: line.customerId,
        customerCode: line.customerCode?.toUpperCase(),
        itemId: line.itemId,
        itemCode: line.itemCode?.toUpperCase()
      });
    }

    // Floating-point precision validation tolerance ($0.001)
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001;
    if (!isBalanced) {
      throw new BadRequestError(
        `Journal entry is out of balance. Total Debits: ${totalDebit.toFixed(2)}, Total Credits: ${totalCredit.toFixed(2)} (Difference: ${(totalDebit - totalCredit).toFixed(2)})`
      );
    }

    if (totalDebit <= 0) {
      throw new BadRequestError('Total journal amount must be greater than 0');
    }

    const entryNumber = await this.repo.generateNextEntryNumber(tenantId);
    const now = new Date();

    const journal = await this.repo.createJournalEntry(tenantId, {
      entryNumber,
      postingDate,
      accountingPeriod: periodCode,
      status: dto.autoPost ? 'POSTED' : 'DRAFT',
      entryType: dto.entryType || 'STANDARD',
      sourceModule: dto.sourceModule || 'MANUAL',
      sourceReferenceId: dto.sourceReferenceId,
      sourceReferenceNumber: dto.sourceReferenceNumber,
      description: dto.description,
      lines: validatedLines,
      totalDebit: Number(totalDebit.toFixed(2)),
      totalCredit: Number(totalCredit.toFixed(2)),
      isBalanced: true,
      postedBy: dto.autoPost
        ? {
            userId: actor.userId,
            email: actor.email,
            role: actor.role
          }
        : undefined,
      postedAt: dto.autoPost ? now : undefined,
      notes: dto.notes
    });

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: dto.autoPost ? 'FINANCE_JOURNAL_POSTED' : 'FINANCE_JOURNAL_CREATED',
      entityType: 'JournalEntry',
      entityId: journal.id,
      afterState: journal.toJSON(),
      metadata: {
        entryNumber: journal.entryNumber,
        accountingPeriod: journal.accountingPeriod,
        totalAmount: journal.totalDebit,
        status: journal.status
      }
    });

    if (dto.autoPost) {
      this.publishEvent(
        DomainEvents.JOURNAL_POSTED,
        tenantId,
        {
          journalId: journal.id,
          entryNumber: journal.entryNumber,
          totalAmount: journal.totalDebit,
          accountingPeriod: journal.accountingPeriod
        },
        actor.userId
      );
    }

    return journal;
  }

  /**
   * Post a DRAFT Journal Entry
   */
  public async postJournalEntry(
    tenantId: string,
    actor: IActorContext,
    id: string
  ): Promise<JournalEntryDocument> {
    const journal = await this.repo.findJournalById(tenantId, id);
    if (!journal || journal.isDeleted) {
      throw new NotFoundError(`Journal Entry with ID '${id}' not found`);
    }

    if (journal.status === 'POSTED') {
      throw new BadRequestError(`Journal Entry '${journal.entryNumber}' is already POSTED`);
    }

    if (journal.status === 'REVERSED') {
      throw new BadRequestError(`Cannot post REVERSED journal entry '${journal.entryNumber}'`);
    }

    // Verify Accounting Period status
    const period = await this.repo.findPeriodByCode(tenantId, journal.accountingPeriod);
    if (period && period.status === 'CLOSED') {
      throw new BadRequestError(
        `Cannot post journal: Accounting Period '${journal.accountingPeriod}' is CLOSED.`
      );
    }

    if (!journal.isBalanced || Math.abs(journal.totalDebit - journal.totalCredit) >= 0.001) {
      throw new BadRequestError(`Cannot post un-balanced journal entry '${journal.entryNumber}'`);
    }

    const now = new Date();
    const beforeState = journal.toJSON();

    journal.status = 'POSTED';
    journal.postedAt = now;
    journal.postedBy = {
      userId: actor.userId,
      email: actor.email,
      role: actor.role
    };

    const updated = await journal.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'FINANCE_JOURNAL_POSTED',
      entityType: 'JournalEntry',
      entityId: updated.id,
      beforeState,
      afterState: updated.toJSON(),
      metadata: {
        entryNumber: updated.entryNumber,
        totalAmount: updated.totalDebit,
        postedAt: now.toISOString()
      }
    });

    this.publishEvent(
      DomainEvents.JOURNAL_POSTED,
      tenantId,
      {
        journalId: updated.id,
        entryNumber: updated.entryNumber,
        totalAmount: updated.totalDebit,
        accountingPeriod: updated.accountingPeriod
      },
      actor.userId
    );

    return updated;
  }

  /**
   * Controlled Reversal of a POSTED Journal Entry
   * Creates an opposing reversal entry (swaps debits/credits) and marks original as REVERSED.
   */
  public async reverseJournalEntry(
    tenantId: string,
    actor: IActorContext,
    id: string,
    dto: ReverseJournalEntryDto
  ): Promise<{ originalEntry: JournalEntryDocument; reversalEntry: JournalEntryDocument }> {
    const original = await this.repo.findJournalById(tenantId, id);
    if (!original || original.isDeleted) {
      throw new NotFoundError(`Journal Entry with ID '${id}' not found`);
    }

    if (original.status !== 'POSTED') {
      throw new BadRequestError(
        `Cannot reverse journal in '${original.status}' status. Only POSTED journals can be reversed.`
      );
    }

    const reversalPostingDate = dto.reversalPostingDate ? new Date(dto.reversalPostingDate) : new Date();

    // Create opposing reversal lines
    const reversalLines = original.lines.map((l, index) => ({
      lineId: `LINE-${String(index + 1).padStart(3, '0')}`,
      accountCode: l.accountCode,
      accountName: l.accountName,
      costCenterCode: l.costCenterCode,
      debit: l.credit, // SWAP
      credit: l.debit, // SWAP
      description: `Reversal: ${l.description || original.description}`,
      jobId: l.jobId,
      jobNumber: l.jobNumber,
      customerId: l.customerId,
      customerCode: l.customerCode,
      itemId: l.itemId,
      itemCode: l.itemCode
    }));

    const reversalEntry = await this.createJournalEntry(tenantId, actor, {
      postingDate: reversalPostingDate.toISOString(),
      entryType: 'REVERSAL',
      sourceModule: original.sourceModule,
      sourceReferenceId: original.id,
      sourceReferenceNumber: original.entryNumber,
      description: `Reversal of ${original.entryNumber}: ${dto.reversalReason}`,
      lines: reversalLines,
      autoPost: true
    });

    const now = new Date();
    const beforeState = original.toJSON();

    original.status = 'REVERSED';
    original.reversedAt = now;
    original.reversedBy = {
      userId: actor.userId,
      email: actor.email,
      role: actor.role
    };
    original.reversalEntryId = reversalEntry.id;
    original.reversalReason = dto.reversalReason;

    const updatedOriginal = await original.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'FINANCE_JOURNAL_REVERSED',
      entityType: 'JournalEntry',
      entityId: updatedOriginal.id,
      beforeState,
      afterState: updatedOriginal.toJSON(),
      metadata: {
        originalEntryNumber: updatedOriginal.entryNumber,
        reversalEntryNumber: reversalEntry.entryNumber,
        reversalReason: dto.reversalReason
      }
    });

    this.publishEvent(
      DomainEvents.JOURNAL_REVERSED,
      tenantId,
      {
        originalJournalId: updatedOriginal.id,
        originalEntryNumber: updatedOriginal.entryNumber,
        reversalEntryId: reversalEntry.id,
        reversalEntryNumber: reversalEntry.entryNumber,
        reason: dto.reversalReason
      },
      actor.userId
    );

    return { originalEntry: updatedOriginal, reversalEntry };
  }

  // ==========================================
  // 5. General Ledger & Trial Balance Reports
  // ==========================================

  public async getGeneralLedgerReport(
    tenantId: string,
    query: QueryLedgerDto
  ): Promise<IGeneralLedgerAccountReport> {
    const account = await this.getAccountByCode(tenantId, query.accountCode);

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (query.periodCode) {
      const period = await this.repo.findPeriodByCode(tenantId, query.periodCode);
      if (period) {
        startDate = period.startDate;
        endDate = period.endDate;
      }
    }

    if (query.startDate) startDate = new Date(query.startDate);
    if (query.endDate) endDate = new Date(query.endDate);

    // Calculate opening balance before startDate
    let openingBalance = 0;
    if (startDate) {
      const priorEntries = await this.repo.getAllPostedJournalsUpTo(tenantId, new Date(startDate.getTime() - 1));
      for (const entry of priorEntries) {
        for (const line of entry.lines) {
          if (line.accountCode === account.accountCode) {
            if (account.normalBalance === 'DEBIT') {
              openingBalance += line.debit - line.credit;
            } else {
              openingBalance += line.credit - line.debit;
            }
          }
        }
      }
    }

    const journalEntries = await this.repo.getJournalEntriesForLedger(
      tenantId,
      account.accountCode,
      startDate,
      endDate,
      query.costCenterCode
    );

    let runningBalance = openingBalance;
    let totalDebits = 0;
    let totalCredits = 0;
    const transactions: ILedgerTransaction[] = [];

    for (const entry of journalEntries) {
      for (const line of entry.lines) {
        if (line.accountCode === account.accountCode) {
          if (account.normalBalance === 'DEBIT') {
            runningBalance += line.debit - line.credit;
          } else {
            runningBalance += line.credit - line.debit;
          }

          totalDebits += line.debit;
          totalCredits += line.credit;

          transactions.push({
            journalEntryId: entry.id,
            entryNumber: entry.entryNumber,
            postingDate: entry.postingDate,
            accountingPeriod: entry.accountingPeriod,
            sourceModule: entry.sourceModule,
            sourceReferenceNumber: entry.sourceReferenceNumber,
            description: line.description || entry.description,
            costCenterCode: line.costCenterCode,
            debit: line.debit,
            credit: line.credit,
            runningBalance: Number(runningBalance.toFixed(2)),
            jobId: line.jobId,
            jobNumber: line.jobNumber,
            customerCode: line.customerCode
          });
        }
      }
    }

    return {
      accountCode: account.accountCode,
      accountName: account.accountName,
      accountType: account.accountType,
      normalBalance: account.normalBalance,
      periodCode: query.periodCode,
      openingBalance: Number(openingBalance.toFixed(2)),
      transactions,
      totalDebits: Number(totalDebits.toFixed(2)),
      totalCredits: Number(totalCredits.toFixed(2)),
      closingBalance: Number(runningBalance.toFixed(2))
    };
  }

  public async getTrialBalanceReport(
    tenantId: string,
    query: QueryTrialBalanceDto
  ): Promise<ITrialBalanceReport> {
    const accounts = await this.getAllAccounts(tenantId, false);
    const asOfDate = query.asOfDate ? new Date(query.asOfDate) : new Date();

    const postedJournals = await this.repo.getAllPostedJournalsUpTo(tenantId, asOfDate);

    // Compute debit/credit aggregates per account
    const accountAggregates: Record<
      string,
      { periodDebits: number; periodCredits: number; netBalance: number }
    > = {};

    for (const acc of accounts) {
      accountAggregates[acc.accountCode] = {
        periodDebits: 0,
        periodCredits: 0,
        netBalance: 0
      };
    }

    for (const journal of postedJournals) {
      for (const line of journal.lines) {
        if (accountAggregates[line.accountCode]) {
          accountAggregates[line.accountCode].periodDebits += line.debit;
          accountAggregates[line.accountCode].periodCredits += line.credit;
        }
      }
    }

    const rows: ITrialBalanceRow[] = [];
    let totalPeriodDebits = 0;
    let totalPeriodCredits = 0;
    let totalClosingDebit = 0;
    let totalClosingCredit = 0;

    for (const acc of accounts) {
      const agg = accountAggregates[acc.accountCode] || { periodDebits: 0, periodCredits: 0 };
      const net =
        acc.normalBalance === 'DEBIT'
          ? agg.periodDebits - agg.periodCredits
          : agg.periodCredits - agg.periodDebits;

      totalPeriodDebits += agg.periodDebits;
      totalPeriodCredits += agg.periodCredits;

      if (net >= 0) {
        if (acc.normalBalance === 'DEBIT') {
          totalClosingDebit += net;
        } else {
          totalClosingCredit += net;
        }
      } else {
        if (acc.normalBalance === 'DEBIT') {
          totalClosingCredit += Math.abs(net);
        } else {
          totalClosingDebit += Math.abs(net);
        }
      }

      rows.push({
        accountCode: acc.accountCode,
        accountName: acc.accountName,
        accountType: acc.accountType,
        normalBalance: acc.normalBalance,
        openingBalance: 0,
        periodDebits: Number(agg.periodDebits.toFixed(2)),
        periodCredits: Number(agg.periodCredits.toFixed(2)),
        closingBalance: Number(net.toFixed(2))
      });
    }

    const isBalanced = Math.abs(totalPeriodDebits - totalPeriodCredits) < 0.001;

    return {
      tenantId,
      periodCode: query.periodCode,
      asOfDate,
      rows,
      totalOpeningDebit: 0,
      totalOpeningCredit: 0,
      totalPeriodDebits: Number(totalPeriodDebits.toFixed(2)),
      totalPeriodCredits: Number(totalPeriodCredits.toFixed(2)),
      totalClosingDebit: Number(totalClosingDebit.toFixed(2)),
      totalClosingCredit: Number(totalClosingCredit.toFixed(2)),
      isBalanced
    };
  }

  // ==========================================
  // 6. Query Journals
  // ==========================================

  public async queryJournals(
    tenantId: string,
    query: QueryJournalEntriesDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<JournalEntryDocument>> {
    return await this.repo.queryJournalEntries(tenantId, query, pagination);
  }

  public async getJournalById(tenantId: string, id: string): Promise<JournalEntryDocument> {
    const journal = await this.repo.findJournalById(tenantId, id);
    if (!journal || journal.isDeleted) {
      throw new NotFoundError(`Journal Entry with ID '${id}' not found`);
    }
    return journal;
  }

  public async getJournalByNumber(tenantId: string, entryNumber: string): Promise<JournalEntryDocument> {
    const journal = await this.repo.findJournalByNumber(tenantId, entryNumber);
    if (!journal || journal.isDeleted) {
      throw new NotFoundError(`Journal Entry '${entryNumber}' not found`);
    }
    return journal;
  }
}

export const financeService = new FinanceService();
