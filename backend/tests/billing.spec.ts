import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { billingRepository } from '../src/modules/billing/billing.repository.js';
import { dispatchRepository } from '../src/modules/dispatch/dispatch.repository.js';
import { customerRepository } from '../src/modules/customer/customer.repository.js';
import { financeService } from '../src/modules/finance/finance.service.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';

describe('Factory Billing & Accounts Receivable Subsystem', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_001';
  const otherTenant = 'tenant_heat_treat_002';

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  beforeEach(() => {
    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);
    jest.spyOn(roleRepository, 'seedDefaultRolesForTenant').mockResolvedValue([] as any);
    jest.spyOn(roleRepository, 'findRolesByCodes').mockImplementation(async (_tenantId, codes) => {
      return DEFAULT_FACTORY_ROLES.filter((r) => codes.includes(r.code)).map((r) => ({
        ...r,
        id: `role_${r.code}`,
        status: 'active'
      })) as any;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Invoice Generation & Source Record Gating', () => {
    const mockCustomer: any = {
      id: 'cust_001',
      code: 'CUST-AERO-001',
      name: 'Aero Dynamics Precision Ltd',
      taxId: 'GSTIN27AABCA1234F1Z5',
      billingAddress: { street: '42 Aerospace Boulevard, Industrial Zone' }
    };

    const mockDispatchedConsignment: any = {
      id: 'dsp_001',
      tenantId: testTenant,
      dispatchNumber: 'DSP-202608-0001',
      customerId: 'cust_001',
      customerCode: 'CUST-AERO-001',
      customerName: 'Aero Dynamics Precision Ltd',
      status: 'DISPATCHED',
      lines: [
        {
          lineId: 'LINE-001',
          jobId: 'job_001',
          jobNumber: 'JOB-202608-0010',
          itemCode: 'AERO-SHAFT-01',
          itemName: 'Turbine Drive Shaft',
          dispatchedQuantity: 120,
          uom: 'PCS',
          heatLotNumber: 'HL-4340-9982',
          certificateOfConformanceNumber: 'COC-202608-0001'
        }
      ],
      isDeleted: false
    };

    it('should generate an invoice from an authorized DISPATCHED consignment with taxes and line items', async () => {
      const token = generateToken('usr_billing', ['FINANCE_CONTROLLER']);

      jest.spyOn(customerRepository, 'findByCode').mockResolvedValue(mockCustomer);
      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(mockDispatchedConsignment);
      jest.spyOn(billingRepository, 'findActiveInvoiceForDispatch').mockResolvedValue(null);
      jest.spyOn(billingRepository, 'generateNextInvoiceNumber').mockResolvedValue('INV-202608-0001');
      jest.spyOn(billingRepository, 'createInvoice').mockImplementation(async (_tenantId, data) => {
        return {
          id: 'inv_001',
          ...data,
          toJSON: function () {
            return { ...this };
          }
        } as any;
      });

      const res = await request(app)
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customerId: 'cust_001',
          customerCode: 'CUST-AERO-001',
          dispatchId: 'dsp_001',
          taxRatePercent: 18.0,
          paymentTermsDays: 30
        });

      expect(res.status).toBe(201);
      expect(res.body.data.invoiceNumber).toBe('INV-202608-0001');
      expect(res.body.data.customerCode).toBe('CUST-AERO-001');
      expect(res.body.data.status).toBe('DRAFT');
      expect(res.body.data.lines.length).toBe(1);
      expect(res.body.data.lines[0].quantity).toBe(120);
      expect(res.body.data.lines[0].jobNumber).toBe('JOB-202608-0010');
      expect(res.body.data.subtotal).toBe(2220.0); // 120 * 18.50
      expect(res.body.data.totalTaxAmount).toBe(399.6); // 18% of 2220
      expect(res.body.data.totalAmount).toBe(2619.6);
      expect(res.body.data.outstandingBalance).toBe(2619.6);
    });

    it('should reject invoice creation against an unauthorized DRAFT dispatch consignment', async () => {
      const token = generateToken('usr_billing', ['FINANCE_CONTROLLER']);

      const draftConsignment = {
        ...mockDispatchedConsignment,
        status: 'DRAFT'
      };

      jest.spyOn(customerRepository, 'findByCode').mockResolvedValue(mockCustomer);
      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(draftConsignment as any);

      const res = await request(app)
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customerId: 'cust_001',
          customerCode: 'CUST-AERO-001',
          dispatchId: 'dsp_001'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('only be issued against DISPATCHED or DELIVERED');
    });

    it('should prevent duplicate invoice issuance for the same dispatch consignment', async () => {
      const token = generateToken('usr_billing', ['FINANCE_CONTROLLER']);

      const existingInvoice: any = {
        id: 'inv_existing_01',
        invoiceNumber: 'INV-202608-0001',
        dispatchId: 'dsp_001',
        status: 'ISSUED'
      };

      jest.spyOn(customerRepository, 'findByCode').mockResolvedValue(mockCustomer);
      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(mockDispatchedConsignment);
      jest.spyOn(billingRepository, 'findActiveInvoiceForDispatch').mockResolvedValue(existingInvoice);

      const res = await request(app)
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customerId: 'cust_001',
          customerCode: 'CUST-AERO-001',
          dispatchId: 'dsp_001'
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('already been billed');
    });
  });

  describe('Invoice Finalization & Double-Entry General Ledger Linkage', () => {
    it('should finalize an invoice, lock status to ISSUED, and post balanced journal entries to Finance', async () => {
      const token = generateToken('usr_billing', ['FINANCE_CONTROLLER']);

      const mockDraftInvoice: any = {
        id: 'inv_001',
        tenantId: testTenant,
        invoiceNumber: 'INV-202608-0001',
        customerCode: 'CUST-AERO-001',
        customerName: 'Aero Dynamics Precision Ltd',
        invoiceDate: new Date('2026-08-15T00:00:00Z'),
        status: 'DRAFT',
        subtotal: 2220.0,
        totalTaxAmount: 399.6,
        totalAmount: 2619.6,
        isFinalized: false,
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
        toJSON: function () {
          return { ...this };
        }
      };

      const mockJournal: any = {
        id: 'je_billing_001',
        entryNumber: 'JE-202608-0005',
        status: 'POSTED'
      };

      jest.spyOn(billingRepository, 'findInvoiceById').mockResolvedValue(mockDraftInvoice);
      jest.spyOn(financeService, 'createJournalEntry').mockResolvedValue(mockJournal);

      const res = await request(app)
        .post('/api/v1/billing/invoices/inv_001/finalize')
        .set('Authorization', `Bearer ${token}`)
        .send({
          notes: 'Invoice finalized and sent to customer finance department'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ISSUED');
      expect(res.body.data.isFinalized).toBe(true);
      expect(res.body.data.journalEntryNumber).toBe('JE-202608-0005');
      expect(financeService.createJournalEntry).toHaveBeenCalledWith(
        testTenant,
        expect.anything(),
        expect.objectContaining({
          sourceModule: 'BILLING',
          sourceReferenceNumber: 'INV-202608-0001',
          autoPost: true
        })
      );
    });
  });

  describe('Payment Receipts & AR Balance Tracking', () => {
    it('should record partial payment, update outstanding balance, and post cash receipt journal', async () => {
      const token = generateToken('usr_billing', ['FINANCE_CONTROLLER']);

      const mockIssuedInvoice: any = {
        id: 'inv_001',
        tenantId: testTenant,
        invoiceNumber: 'INV-202608-0001',
        customerCode: 'CUST-AERO-001',
        customerName: 'Aero Dynamics Precision Ltd',
        status: 'ISSUED',
        totalAmount: 2619.6,
        paidAmount: 0,
        outstandingBalance: 2619.6,
        payments: [],
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
        toJSON: function () {
          return { ...this };
        }
      };

      const mockReceiptJournal: any = {
        id: 'je_receipt_001',
        entryNumber: 'JE-202608-0008',
        status: 'POSTED'
      };

      jest.spyOn(billingRepository, 'findInvoiceById').mockResolvedValue(mockIssuedInvoice);
      jest.spyOn(billingRepository, 'generateNextPaymentNumber').mockResolvedValue('PAY-202608-5432');
      jest.spyOn(financeService, 'createJournalEntry').mockResolvedValue(mockReceiptJournal);

      const res = await request(app)
        .post('/api/v1/billing/invoices/inv_001/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 1000.0,
          paymentMethod: 'WIRE',
          referenceNumber: 'UTR-HDFC-9918231',
          notes: 'Advance wire payment for Job 001'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PARTIALLY_PAID');
      expect(res.body.data.paidAmount).toBe(1000.0);
      expect(res.body.data.outstandingBalance).toBe(1619.6);
      expect(res.body.data.payments.length).toBe(1);
      expect(res.body.data.payments[0].paymentNumber).toBe('PAY-202608-5432');
    });

    it('should record final balance payment and transition invoice status to PAID', async () => {
      const token = generateToken('usr_billing', ['FINANCE_CONTROLLER']);

      const mockPartiallyPaidInvoice: any = {
        id: 'inv_001',
        tenantId: testTenant,
        invoiceNumber: 'INV-202608-0001',
        customerCode: 'CUST-AERO-001',
        customerName: 'Aero Dynamics Precision Ltd',
        status: 'PARTIALLY_PAID',
        totalAmount: 2619.6,
        paidAmount: 1000.0,
        outstandingBalance: 1619.6,
        payments: [{ paymentNumber: 'PAY-202608-5432', amount: 1000.0 }],
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
        toJSON: function () {
          return { ...this };
        }
      };

      jest.spyOn(billingRepository, 'findInvoiceById').mockResolvedValue(mockPartiallyPaidInvoice);
      jest.spyOn(billingRepository, 'generateNextPaymentNumber').mockResolvedValue('PAY-202608-8877');
      jest.spyOn(financeService, 'createJournalEntry').mockResolvedValue({ id: 'je_02' } as any);

      const res = await request(app)
        .post('/api/v1/billing/invoices/inv_001/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 1619.6,
          paymentMethod: 'BANK_TRANSFER',
          referenceNumber: 'NEFT-889123'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PAID');
      expect(res.body.data.paidAmount).toBe(2619.6);
      expect(res.body.data.outstandingBalance).toBe(0);
    });

    it('should reject payment exceeding the outstanding balance', async () => {
      const token = generateToken('usr_billing', ['FINANCE_CONTROLLER']);

      const mockInvoice: any = {
        id: 'inv_001',
        tenantId: testTenant,
        status: 'ISSUED',
        totalAmount: 500.0,
        paidAmount: 0,
        outstandingBalance: 500.0
      };

      jest.spyOn(billingRepository, 'findInvoiceById').mockResolvedValue(mockInvoice);

      const res = await request(app)
        .post('/api/v1/billing/invoices/inv_001/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 750.0,
          paymentMethod: 'CHECK'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('exceeds outstanding balance');
    });
  });

  describe('Invoice Voiding & Finance Reversal', () => {
    it('should void an unpaid invoice and reverse associated general ledger journal', async () => {
      const token = generateToken('usr_billing', ['FINANCE_CONTROLLER']);

      const mockIssuedInvoice: any = {
        id: 'inv_001',
        tenantId: testTenant,
        invoiceNumber: 'INV-202608-0001',
        status: 'ISSUED',
        paidAmount: 0,
        outstandingBalance: 2619.6,
        journalEntryId: 'je_billing_001',
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
        toJSON: function () {
          return { ...this };
        }
      };

      jest.spyOn(billingRepository, 'findInvoiceById').mockResolvedValue(mockIssuedInvoice);
      jest.spyOn(financeService, 'reverseJournalEntry').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/billing/invoices/inv_001/void')
        .set('Authorization', `Bearer ${token}`)
        .send({
          voidReason: 'Dispatched batch recalled by customer for rework; invoice cancelled'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('VOID');
      expect(res.body.data.isVoid).toBe(true);
      expect(res.body.data.voidReason).toContain('Dispatched batch recalled');
      expect(financeService.reverseJournalEntry).toHaveBeenCalledWith(
        testTenant,
        expect.anything(),
        'je_billing_001',
        expect.objectContaining({ reversalReason: expect.stringContaining('voided') })
      );
    });

    it('should reject voiding an invoice with recorded payments', async () => {
      const token = generateToken('usr_billing', ['FINANCE_CONTROLLER']);

      const mockPaidInvoice: any = {
        id: 'inv_001',
        tenantId: testTenant,
        invoiceNumber: 'INV-202608-0001',
        status: 'PARTIALLY_PAID',
        paidAmount: 500.0,
        outstandingBalance: 1000.0
      };

      jest.spyOn(billingRepository, 'findInvoiceById').mockResolvedValue(mockPaidInvoice);

      const res = await request(app)
        .post('/api/v1/billing/invoices/inv_001/void')
        .set('Authorization', `Bearer ${token}`)
        .send({
          voidReason: 'Attempted cancellation after partial payment'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('existing recorded payments');
    });
  });

  describe('Accounts Receivable Aging & Summary Reports', () => {
    it('should generate an AR aging report categorized into overdue day buckets', async () => {
      const token = generateToken('usr_billing', ['FINANCE_CONTROLLER']);

      const mockAging = {
        tenantId: testTenant,
        asOfDate: new Date(),
        totalReceivables: 18500,
        totalCurrent: 10000,
        totalDays31To60: 5000,
        totalDays61To90: 2500,
        totalOver90Days: 1000,
        customers: [
          {
            customerId: 'cust_01',
            customerCode: 'CUST-AERO-001',
            customerName: 'Aero Dynamics Precision Ltd',
            currentAmount: 10000,
            days31To60Amount: 5000,
            days61To90Amount: 2500,
            over90DaysAmount: 1000,
            totalOutstanding: 18500,
            unpaidInvoicesCount: 4
          }
        ]
      };

      jest.spyOn(billingRepository, 'getAgingReport').mockResolvedValue(mockAging as any);

      const res = await request(app)
        .get('/api/v1/billing/aging')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalReceivables).toBe(18500);
      expect(res.body.data.totalCurrent).toBe(10000);
      expect(res.body.data.totalDays31To60).toBe(5000);
      expect(res.body.data.customers[0].customerCode).toBe('CUST-AERO-001');
    });

    it('should retrieve overall factory receivables summary', async () => {
      const token = generateToken('usr_billing', ['FINANCE_CONTROLLER']);

      const mockSummary = {
        totalInvoicedAmount: 150000,
        totalCollectedAmount: 120000,
        totalOutstandingAmount: 30000,
        totalOverdueAmount: 8500,
        totalActiveInvoicesCount: 45,
        overdueInvoicesCount: 6
      };

      jest.spyOn(billingRepository, 'getReceivablesSummary').mockResolvedValue(mockSummary as any);

      const res = await request(app)
        .get('/api/v1/billing/invoices/summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalInvoicedAmount).toBe(150000);
      expect(res.body.data.totalOutstandingAmount).toBe(30000);
      expect(res.body.data.overdueInvoicesCount).toBe(6);
    });
  });

  describe('Tenant Isolation & Authorization', () => {
    it('should reject unauthorized access without billing permissions', async () => {
      const unauthorizedToken = generateToken('usr_operator', ['FURNACE_OPERATOR']);

      const res = await request(app)
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .send({ customerId: 'cust_01', customerCode: 'CUST-01' });

      expect(res.status).toBe(403);
    });

    it('should prevent cross-tenant invoice access', async () => {
      const otherToken = generateToken('usr_other_billing', ['FINANCE_CONTROLLER'], otherTenant);

      jest.spyOn(billingRepository, 'findInvoiceById').mockImplementation(async (tenantId, _id) => {
        if (tenantId === otherTenant) return null;
        return { id: 'inv_001', tenantId: testTenant } as any;
      });

      const res = await request(app)
        .get('/api/v1/billing/invoices/inv_001')
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(404);
    });
  });
});
