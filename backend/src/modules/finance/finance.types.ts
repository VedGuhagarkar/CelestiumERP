import { Document } from 'mongoose';

export type AccountType =
  | 'ASSET'
  | 'LIABILITY'
  | 'EQUITY'
  | 'REVENUE'
  | 'COGS'
  | 'EXPENSE';

export type NormalBalance = 'DEBIT' | 'CREDIT';

export type PeriodStatus = 'OPEN' | 'CLOSING' | 'CLOSED';

export type JournalStatus = 'DRAFT' | 'POSTED' | 'REVERSED';

export type JournalEntryType =
  | 'STANDARD'
  | 'OPERATIONAL'
  | 'REVERSAL'
  | 'CLOSING'
  | 'ADJUSTMENT';

export type SourceModuleType =
  | 'PRODUCTION'
  | 'QUALITY'
  | 'INVENTORY'
  | 'DISPATCH'
  | 'MAINTENANCE'
  | 'WORKFORCE'
  | 'MANUAL';

export interface IActorSnapshot {
  userId: string;
  email?: string;
  role?: string;
}

// 1. Chart of Accounts Entity
export interface IAccount {
  tenantId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  parentAccountCode?: string;
  description?: string;
  isActive: boolean;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccountDocument extends IAccount, Document {}

// 2. Factory Cost Center Entity
export interface ICostCenter {
  tenantId: string;
  costCenterCode: string;
  name: string;
  department: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CostCenterDocument extends ICostCenter, Document {}

// 3. Accounting Period Entity
export interface IAccountingPeriod {
  tenantId: string;
  periodCode: string; // e.g. "2026-08" or "FY2026-M08"
  name: string; // e.g. "August 2026"
  startDate: Date;
  endDate: Date;
  status: PeriodStatus;
  closedBy?: IActorSnapshot;
  closedAt?: Date;
  closingNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccountingPeriodDocument extends IAccountingPeriod, Document {}

// 4. Journal Entry Line
export interface IJournalLine {
  lineId: string;
  accountCode: string;
  accountName: string;
  costCenterCode?: string;
  debit: number;
  credit: number;
  description?: string;
  jobId?: string;
  jobNumber?: string;
  customerId?: string;
  customerCode?: string;
  itemId?: string;
  itemCode?: string;
}

// 5. Journal Entry Entity
export interface IJournalEntry {
  tenantId: string;
  entryNumber: string;
  postingDate: Date;
  accountingPeriod: string;
  status: JournalStatus;
  entryType: JournalEntryType;
  sourceModule: SourceModuleType;
  sourceReferenceId?: string;
  sourceReferenceNumber?: string;
  description: string;
  lines: IJournalLine[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  postedBy?: IActorSnapshot;
  postedAt?: Date;
  reversedBy?: IActorSnapshot;
  reversedAt?: Date;
  reversalEntryId?: string;
  reversalReason?: string;
  notes?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface JournalEntryDocument extends IJournalEntry, Document {}

// 6. Trial Balance Row
export interface ITrialBalanceRow {
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  openingBalance: number;
  periodDebits: number;
  periodCredits: number;
  closingBalance: number;
}

export interface ITrialBalanceReport {
  tenantId: string;
  periodCode?: string;
  asOfDate: Date;
  rows: ITrialBalanceRow[];
  totalOpeningDebit: number;
  totalOpeningCredit: number;
  totalPeriodDebits: number;
  totalPeriodCredits: number;
  totalClosingDebit: number;
  totalClosingCredit: number;
  isBalanced: boolean;
}

// 7. General Ledger Query & Result
export interface ILedgerTransaction {
  journalEntryId: string;
  entryNumber: string;
  postingDate: Date;
  accountingPeriod: string;
  sourceModule: SourceModuleType;
  sourceReferenceNumber?: string;
  description: string;
  costCenterCode?: string;
  debit: number;
  credit: number;
  runningBalance: number;
  jobId?: string;
  jobNumber?: string;
  customerCode?: string;
}

export interface IGeneralLedgerAccountReport {
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  periodCode?: string;
  openingBalance: number;
  transactions: ILedgerTransaction[];
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
}

// DTOs
export interface CreateAccountDto {
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  parentAccountCode?: string;
  description?: string;
}

export interface UpdateAccountDto {
  accountName?: string;
  description?: string;
  isActive?: boolean;
}

export interface CreateCostCenterDto {
  costCenterCode: string;
  name: string;
  department: string;
  description?: string;
}

export interface CreatePeriodDto {
  periodCode: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface ClosePeriodDto {
  closingNotes?: string;
}

export interface CreateJournalLineDto {
  accountCode: string;
  costCenterCode?: string;
  debit: number;
  credit: number;
  description?: string;
  jobId?: string;
  jobNumber?: string;
  customerId?: string;
  customerCode?: string;
  itemId?: string;
  itemCode?: string;
}

export interface CreateJournalEntryDto {
  postingDate: string;
  accountingPeriod?: string;
  entryType?: JournalEntryType;
  sourceModule?: SourceModuleType;
  sourceReferenceId?: string;
  sourceReferenceNumber?: string;
  description: string;
  lines: CreateJournalLineDto[];
  notes?: string;
  autoPost?: boolean;
}

export interface ReverseJournalEntryDto {
  reversalReason: string;
  reversalPostingDate?: string;
}

export interface QueryJournalEntriesDto {
  status?: JournalStatus;
  entryType?: JournalEntryType;
  sourceModule?: SourceModuleType;
  accountingPeriod?: string;
  accountCode?: string;
  costCenterCode?: string;
  jobNumber?: string;
  customerCode?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface QueryLedgerDto {
  accountCode: string;
  periodCode?: string;
  startDate?: string;
  endDate?: string;
  costCenterCode?: string;
}

export interface QueryTrialBalanceDto {
  periodCode?: string;
  asOfDate?: string;
}
