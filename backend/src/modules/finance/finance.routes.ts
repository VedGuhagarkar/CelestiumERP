import { Router } from 'express';
import { financeController } from './finance.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import {
  requirePermission,
  requireAnyPermission
} from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';
import {
  createAccountSchema,
  updateAccountSchema,
  createCostCenterSchema,
  createPeriodSchema,
  closePeriodSchema,
  createJournalEntrySchema,
  reverseJournalEntrySchema,
  queryJournalEntriesSchema,
  queryLedgerSchema,
  queryTrialBalanceSchema
} from './finance.validator.js';

export const financeRouter = Router();

financeRouter.use(authenticateJwt);

// ==========================================
// 1. Chart of Accounts Endpoints
// ==========================================

financeRouter.post(
  '/accounts',
  requirePermission(PERMISSIONS.FINANCE_ACCOUNT_MANAGE),
  validateRequest({ body: createAccountSchema }),
  financeController.createAccount
);

financeRouter.get(
  '/accounts',
  requireAnyPermission(
    PERMISSIONS.FINANCE_ACCOUNT_VIEW,
    PERMISSIONS.REPORTS_ANALYTICS_VIEW_FINANCE
  ),
  financeController.getAllAccounts
);

financeRouter.get(
  '/accounts/:code',
  requireAnyPermission(
    PERMISSIONS.FINANCE_ACCOUNT_VIEW,
    PERMISSIONS.REPORTS_ANALYTICS_VIEW_FINANCE
  ),
  financeController.getAccountByCode
);

financeRouter.patch(
  '/accounts/:code',
  requirePermission(PERMISSIONS.FINANCE_ACCOUNT_MANAGE),
  validateRequest({ body: updateAccountSchema }),
  financeController.updateAccount
);

// ==========================================
// 2. Factory Cost Centers Endpoints
// ==========================================

financeRouter.post(
  '/cost-centers',
  requirePermission(PERMISSIONS.FINANCE_ACCOUNT_MANAGE),
  validateRequest({ body: createCostCenterSchema }),
  financeController.createCostCenter
);

financeRouter.get(
  '/cost-centers',
  requireAnyPermission(
    PERMISSIONS.FINANCE_ACCOUNT_VIEW,
    PERMISSIONS.REPORTS_ANALYTICS_VIEW_FINANCE
  ),
  financeController.getAllCostCenters
);

// ==========================================
// 3. Accounting Periods Endpoints
// ==========================================

financeRouter.post(
  '/periods',
  requirePermission(PERMISSIONS.FINANCE_PERIOD_MANAGE),
  validateRequest({ body: createPeriodSchema }),
  financeController.createPeriod
);

financeRouter.get(
  '/periods',
  requireAnyPermission(
    PERMISSIONS.FINANCE_PERIOD_MANAGE,
    PERMISSIONS.FINANCE_ACCOUNT_VIEW,
    PERMISSIONS.REPORTS_ANALYTICS_VIEW_FINANCE
  ),
  financeController.getAllPeriods
);

financeRouter.post(
  '/periods/:periodCode/close',
  requirePermission(PERMISSIONS.FINANCE_PERIOD_MANAGE),
  validateRequest({ body: closePeriodSchema }),
  financeController.closePeriod
);

financeRouter.post(
  '/periods/:periodCode/reopen',
  requirePermission(PERMISSIONS.FINANCE_PERIOD_MANAGE),
  financeController.reopenPeriod
);

// ==========================================
// 4. Double-Entry Journal Endpoints
// ==========================================

financeRouter.post(
  '/journals',
  requireAnyPermission(
    PERMISSIONS.FINANCE_JOURNAL_CREATE,
    PERMISSIONS.FINANCE_JOURNAL_POST
  ),
  validateRequest({ body: createJournalEntrySchema }),
  financeController.createJournalEntry
);

financeRouter.get(
  '/journals',
  requireAnyPermission(
    PERMISSIONS.FINANCE_JOURNAL_VIEW,
    PERMISSIONS.REPORTS_ANALYTICS_VIEW_FINANCE
  ),
  validateRequest({ query: queryJournalEntriesSchema }),
  financeController.queryJournals
);

financeRouter.get(
  '/journals/number/:entryNumber',
  requireAnyPermission(
    PERMISSIONS.FINANCE_JOURNAL_VIEW,
    PERMISSIONS.REPORTS_ANALYTICS_VIEW_FINANCE
  ),
  financeController.getJournalByNumber
);

financeRouter.get(
  '/journals/:id',
  requireAnyPermission(
    PERMISSIONS.FINANCE_JOURNAL_VIEW,
    PERMISSIONS.REPORTS_ANALYTICS_VIEW_FINANCE
  ),
  financeController.getJournalById
);

financeRouter.post(
  '/journals/:id/post',
  requirePermission(PERMISSIONS.FINANCE_JOURNAL_POST),
  financeController.postJournalEntry
);

financeRouter.post(
  '/journals/:id/reverse',
  requirePermission(PERMISSIONS.FINANCE_JOURNAL_REVERSE),
  validateRequest({ body: reverseJournalEntrySchema }),
  financeController.reverseJournalEntry
);

// ==========================================
// 5. General Ledger & Trial Balance Reports
// ==========================================

financeRouter.get(
  '/ledger',
  requireAnyPermission(
    PERMISSIONS.FINANCE_JOURNAL_VIEW,
    PERMISSIONS.REPORTS_ANALYTICS_VIEW_FINANCE
  ),
  validateRequest({ query: queryLedgerSchema }),
  financeController.getGeneralLedgerReport
);

financeRouter.get(
  '/trial-balance',
  requireAnyPermission(
    PERMISSIONS.FINANCE_TRIAL_BALANCE_VIEW,
    PERMISSIONS.REPORTS_ANALYTICS_VIEW_FINANCE
  ),
  validateRequest({ query: queryTrialBalanceSchema }),
  financeController.getTrialBalanceReport
);
