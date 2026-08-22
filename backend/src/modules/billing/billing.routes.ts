import { Router } from 'express';
import { billingController } from './billing.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import {
  requirePermission,
  requireAnyPermission
} from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';
import {
  createInvoiceSchema,
  finalizeInvoiceSchema,
  recordPaymentSchema,
  voidInvoiceSchema,
  queryInvoicesSchema,
  queryAgingReportSchema
} from './billing.validator.js';

export const billingRouter = Router();

billingRouter.use(authenticateJwt);

// ==========================================
// Billing & Invoices Endpoints
// ==========================================

billingRouter.post(
  '/invoices',
  requirePermission(PERMISSIONS.BILLING_INVOICE_CREATE),
  validateRequest({ body: createInvoiceSchema }),
  billingController.createInvoice
);

billingRouter.get(
  '/invoices',
  requireAnyPermission(
    PERMISSIONS.BILLING_INVOICE_VIEW,
    PERMISSIONS.REPORTS_ANALYTICS_VIEW_FINANCE
  ),
  validateRequest({ query: queryInvoicesSchema }),
  billingController.queryInvoices
);

billingRouter.get(
  '/invoices/summary',
  requireAnyPermission(
    PERMISSIONS.BILLING_INVOICE_VIEW,
    PERMISSIONS.REPORTS_ANALYTICS_VIEW_FINANCE
  ),
  billingController.getReceivablesSummary
);

billingRouter.get(
  '/aging',
  requireAnyPermission(
    PERMISSIONS.BILLING_AGING_VIEW,
    PERMISSIONS.REPORTS_ANALYTICS_VIEW_FINANCE
  ),
  validateRequest({ query: queryAgingReportSchema }),
  billingController.getAgingReport
);

billingRouter.get(
  '/invoices/number/:invoiceNumber',
  requireAnyPermission(
    PERMISSIONS.BILLING_INVOICE_VIEW,
    PERMISSIONS.REPORTS_ANALYTICS_VIEW_FINANCE
  ),
  billingController.getInvoiceByNumber
);

billingRouter.get(
  '/invoices/:id',
  requireAnyPermission(
    PERMISSIONS.BILLING_INVOICE_VIEW,
    PERMISSIONS.REPORTS_ANALYTICS_VIEW_FINANCE
  ),
  billingController.getInvoiceById
);

billingRouter.post(
  '/invoices/:id/finalize',
  requirePermission(PERMISSIONS.BILLING_INVOICE_FINALIZE),
  validateRequest({ body: finalizeInvoiceSchema }),
  billingController.finalizeInvoice
);

billingRouter.post(
  '/invoices/:id/payments',
  requirePermission(PERMISSIONS.BILLING_PAYMENT_RECORD),
  validateRequest({ body: recordPaymentSchema }),
  billingController.recordPayment
);

billingRouter.post(
  '/invoices/:id/void',
  requirePermission(PERMISSIONS.BILLING_INVOICE_VOID),
  validateRequest({ body: voidInvoiceSchema }),
  billingController.voidInvoice
);
