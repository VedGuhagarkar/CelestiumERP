import { z } from 'zod';

export const AccountTypeEnum = z.enum([
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'COGS',
  'EXPENSE'
]);

export const NormalBalanceEnum = z.enum(['DEBIT', 'CREDIT']);

export const JournalStatusEnum = z.enum(['DRAFT', 'POSTED', 'REVERSED']);

export const JournalEntryTypeEnum = z.enum([
  'STANDARD',
  'OPERATIONAL',
  'REVERSAL',
  'CLOSING',
  'ADJUSTMENT'
]);

export const SourceModuleTypeEnum = z.enum([
  'PRODUCTION',
  'QUALITY',
  'INVENTORY',
  'DISPATCH',
  'MAINTENANCE',
  'WORKFORCE',
  'BILLING',
  'COSTING',
  'MANUAL'
]);

export const createAccountSchema = z.object({
  accountCode: z.string().min(2, 'Account code is required (e.g. 1010)'),
  accountName: z.string().min(2, 'Account name is required'),
  accountType: AccountTypeEnum,
  normalBalance: NormalBalanceEnum,
  parentAccountCode: z.string().optional(),
  description: z.string().optional()
});

export const updateAccountSchema = z.object({
  accountName: z.string().min(2).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional()
});

export const createCostCenterSchema = z.object({
  costCenterCode: z.string().min(2, 'Cost center code is required (e.g. CC-FURNACE-VAC)'),
  name: z.string().min(2, 'Cost center name is required'),
  department: z.string().min(2, 'Department is required'),
  description: z.string().optional()
});

export const createPeriodSchema = z.object({
  periodCode: z.string().min(4, 'Period code is required (e.g. 2026-08)'),
  name: z.string().min(2, 'Period name is required'),
  startDate: z.string().datetime({ message: 'Valid ISO datetime required for startDate' }),
  endDate: z.string().datetime({ message: 'Valid ISO datetime required for endDate' })
});

export const closePeriodSchema = z.object({
  closingNotes: z.string().optional()
});

export const createJournalLineSchema = z.object({
  accountCode: z.string().min(2, 'Account code is required'),
  costCenterCode: z.string().optional(),
  debit: z.number().min(0, 'Debit must be non-negative').default(0),
  credit: z.number().min(0, 'Credit must be non-negative').default(0),
  description: z.string().optional(),
  jobId: z.string().optional(),
  jobNumber: z.string().optional(),
  customerId: z.string().optional(),
  customerCode: z.string().optional(),
  itemId: z.string().optional(),
  itemCode: z.string().optional()
});

export const createJournalEntrySchema = z.object({
  postingDate: z.string().datetime({ message: 'Valid ISO datetime required for postingDate' }),
  accountingPeriod: z.string().optional(),
  entryType: JournalEntryTypeEnum.optional().default('STANDARD'),
  sourceModule: SourceModuleTypeEnum.optional().default('MANUAL'),
  sourceReferenceId: z.string().optional(),
  sourceReferenceNumber: z.string().optional(),
  description: z.string().min(3, 'Journal description is required (min 3 chars)'),
  lines: z
    .array(createJournalLineSchema)
    .min(2, 'Journal entry must have at least 2 lines (double-entry standard)'),
  notes: z.string().optional(),
  autoPost: z.boolean().optional().default(false)
});

export const reverseJournalEntrySchema = z.object({
  reversalReason: z.string().min(5, 'A clear reason for reversal is mandatory (min 5 chars)'),
  reversalPostingDate: z.string().datetime().optional()
});

export const queryJournalEntriesSchema = z.object({
  status: JournalStatusEnum.optional(),
  entryType: JournalEntryTypeEnum.optional(),
  sourceModule: SourceModuleTypeEnum.optional(),
  accountingPeriod: z.string().optional(),
  accountCode: z.string().optional(),
  costCenterCode: z.string().optional(),
  jobNumber: z.string().optional(),
  customerCode: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20)
});

export const queryLedgerSchema = z.object({
  accountCode: z.string().min(1, 'Account code is required'),
  periodCode: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  costCenterCode: z.string().optional()
});

export const queryTrialBalanceSchema = z.object({
  periodCode: z.string().optional(),
  asOfDate: z.string().datetime().optional()
});
