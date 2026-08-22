import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { financeRepository, DEFAULT_FACTORY_COA, DEFAULT_FACTORY_COST_CENTERS } from '../src/modules/finance/finance.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';

describe('Manufacturing Finance & Double-Entry Accounting Foundation', () => {
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

  describe('Chart of Accounts & Cost Centers', () => {
    it('should retrieve seeded Chart of Accounts for heat-treatment operations', async () => {
      const token = generateToken('usr_finance', ['FINANCE_CONTROLLER']);
      const mockAccounts = DEFAULT_FACTORY_COA.map((c) => ({
        ...c,
        id: `acc_${c.accountCode}`,
        tenantId: testTenant,
        isActive: true,
        toJSON: function () {
          return { ...this };
        }
      }));

      jest.spyOn(financeRepository, 'findAllAccounts').mockResolvedValue(mockAccounts as any);

      const res = await request(app)
        .get('/api/v1/finance/accounts')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(20);
      expect(res.body.data.some((a: any) => a.accountCode === '4010')).toBe(true);
      expect(res.body.data.some((a: any) => a.accountCode === '5020')).toBe(true);
    });

    it('should create a custom factory account', async () => {
      const token = generateToken('usr_finance', ['FINANCE_CONTROLLER']);

      jest.spyOn(financeRepository, 'findAccountByCode').mockResolvedValue(null);
      jest.spyOn(financeRepository, 'createAccount').mockImplementation(async (_tenantId, data) => {
        return {
          id: 'acc_5060',
          ...data,
          toJSON: function () {
            return { ...this };
          }
        } as any;
      });

      const res = await request(app)
        .post('/api/v1/finance/accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          accountCode: '5060',
          accountName: 'Cryogenic Liquid Nitrogen Expense',
          accountType: 'COGS',
          normalBalance: 'DEBIT',
          description: 'Sub-zero quenching cryogenic treatment gas'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.accountCode).toBe('5060');
      expect(res.body.data.accountType).toBe('COGS');
    });

    it('should retrieve factory cost centers', async () => {
      const token = generateToken('usr_finance', ['FINANCE_CONTROLLER']);
      const mockCostCenters = DEFAULT_FACTORY_COST_CENTERS.map((c) => ({
        ...c,
        id: `cc_${c.costCenterCode}`,
        tenantId: testTenant,
        isActive: true,
        toJSON: function () {
          return { ...this };
        }
      }));

      jest.spyOn(financeRepository, 'findAllCostCenters').mockResolvedValue(mockCostCenters as any);

      const res = await request(app)
        .get('/api/v1/finance/cost-centers')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.some((cc: any) => cc.costCenterCode === 'CC-FURNACE-VAC')).toBe(true);
      expect(res.body.data.some((cc: any) => cc.costCenterCode === 'CC-LAB-MET')).toBe(true);
    });
  });

  describe('Accounting Period Lifecycle', () => {
    it('should open an accounting period and support closing controls', async () => {
      const token = generateToken('usr_finance', ['FINANCE_CONTROLLER']);
      const mockPeriod: any = {
        id: 'period_2026_08',
        tenantId: testTenant,
        periodCode: '2026-08',
        name: 'August 2026',
        startDate: new Date('2026-08-01T00:00:00.000Z'),
        endDate: new Date('2026-08-31T23:59:59.999Z'),
        status: 'OPEN',
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
        toJSON: function () {
          return { ...this };
        }
      };

      jest.spyOn(financeRepository, 'findPeriodByCode').mockResolvedValue(mockPeriod);

      const closeRes = await request(app)
        .post('/api/v1/finance/periods/2026-08/close')
        .set('Authorization', `Bearer ${token}`)
        .send({
          closingNotes: 'Monthly reconciliation complete. All WIP and dispatch entries verified.'
        });

      expect(closeRes.status).toBe(200);
      expect(closeRes.body.data.status).toBe('CLOSED');
      expect(closeRes.body.data.closedBy.userId).toBe('usr_finance');
    });

    it('should allow reopening a closed accounting period', async () => {
      const token = generateToken('usr_finance', ['FINANCE_CONTROLLER']);
      const mockPeriod: any = {
        id: 'period_2026_08',
        tenantId: testTenant,
        periodCode: '2026-08',
        status: 'CLOSED',
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
        toJSON: function () {
          return { ...this };
        }
      };

      jest.spyOn(financeRepository, 'findPeriodByCode').mockResolvedValue(mockPeriod);

      const reopenRes = await request(app)
        .post('/api/v1/finance/periods/2026-08/reopen')
        .set('Authorization', `Bearer ${token}`);

      expect(reopenRes.status).toBe(200);
      expect(reopenRes.body.data.status).toBe('OPEN');
    });
  });

  describe('Double-Entry Journal Management', () => {
    it('should create and auto-post a balanced operational journal entry for heat-treatment revenue', async () => {
      const token = generateToken('usr_finance', ['FINANCE_CONTROLLER']);

      const mockArAccount: any = {
        accountCode: '1100',
        accountName: 'Accounts Receivable (Trade Customers)',
        accountType: 'ASSET',
        normalBalance: 'DEBIT',
        isActive: true
      };

      const mockRevenueAccount: any = {
        accountCode: '4010',
        accountName: 'Commercial Heat-Treatment Service Revenue',
        accountType: 'REVENUE',
        normalBalance: 'CREDIT',
        isActive: true
      };

      const mockCostCenter: any = {
        costCenterCode: 'CC-FURNACE-VAC',
        name: 'Vacuum Furnaces & Gas Quench Bay',
        isActive: true
      };

      const mockPeriod: any = {
        periodCode: '2026-08',
        status: 'OPEN'
      };

      jest.spyOn(financeRepository, 'findAccountByCode').mockImplementation(async (_tenantId, code) => {
        if (code === '1100') return mockArAccount;
        if (code === '4010') return mockRevenueAccount;
        return null;
      });
      jest.spyOn(financeRepository, 'findCostCenterByCode').mockResolvedValue(mockCostCenter);
      jest.spyOn(financeRepository, 'findPeriodByCode').mockResolvedValue(mockPeriod);
      jest.spyOn(financeRepository, 'generateNextEntryNumber').mockResolvedValue('JE-202608-0001');
      jest.spyOn(financeRepository, 'createJournalEntry').mockImplementation(async (_tenantId, data) => {
        return {
          id: 'je_001',
          ...data,
          save: jest.fn().mockResolvedValue(this),
          toJSON: function () {
            return { ...this };
          }
        } as any;
      });

      const res = await request(app)
        .post('/api/v1/finance/journals')
        .set('Authorization', `Bearer ${token}`)
        .send({
          postingDate: '2026-08-15T10:00:00.000Z',
          accountingPeriod: '2026-08',
          entryType: 'OPERATIONAL',
          sourceModule: 'DISPATCH',
          sourceReferenceNumber: 'DSP-202608-0001',
          description: 'Commercial heat treatment revenue billing for Job JOB-202608-0010',
          autoPost: true,
          lines: [
            {
              accountCode: '1100',
              debit: 4500.0,
              credit: 0,
              customerCode: 'CUST-AERO-001',
              jobNumber: 'JOB-202608-0010',
              description: 'Trade AR Billing'
            },
            {
              accountCode: '4010',
              costCenterCode: 'CC-FURNACE-VAC',
              debit: 0,
              credit: 4500.0,
              jobNumber: 'JOB-202608-0010',
              description: 'Vacuum Carburizing Revenue'
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.data.entryNumber).toBe('JE-202608-0001');
      expect(res.body.data.status).toBe('POSTED');
      expect(res.body.data.totalDebit).toBe(4500.0);
      expect(res.body.data.totalCredit).toBe(4500.0);
      expect(res.body.data.isBalanced).toBe(true);
    });

    it('should reject an un-balanced journal entry (Total Debits != Total Credits)', async () => {
      const token = generateToken('usr_finance', ['FINANCE_CONTROLLER']);
      const mockPeriod: any = { periodCode: '2026-08', status: 'OPEN' };

      jest.spyOn(financeRepository, 'findPeriodByCode').mockResolvedValue(mockPeriod);
      jest.spyOn(financeRepository, 'findAccountByCode').mockImplementation(async (_tenantId, code) => ({
        accountCode: code,
        accountName: `Account ${code}`,
        isActive: true
      } as any));

      const res = await request(app)
        .post('/api/v1/finance/journals')
        .set('Authorization', `Bearer ${token}`)
        .send({
          postingDate: '2026-08-15T10:00:00.000Z',
          description: 'Faulty out of balance entry',
          lines: [
            { accountCode: '1100', debit: 5000, credit: 0 },
            { accountCode: '4010', debit: 0, credit: 4000 }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('out of balance');
    });

    it('should reject journal entry posting when accounting period is CLOSED', async () => {
      const token = generateToken('usr_finance', ['FINANCE_CONTROLLER']);
      const mockPeriod: any = { periodCode: '2026-07', status: 'CLOSED' };

      jest.spyOn(financeRepository, 'findPeriodByCode').mockResolvedValue(mockPeriod);

      const res = await request(app)
        .post('/api/v1/finance/journals')
        .set('Authorization', `Bearer ${token}`)
        .send({
          postingDate: '2026-07-15T10:00:00.000Z',
          accountingPeriod: '2026-07',
          description: 'Late entry into closed period',
          lines: [
            { accountCode: '1100', debit: 1000, credit: 0 },
            { accountCode: '4010', debit: 0, credit: 1000 }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('CLOSED');
    });

    it('should reject journal entry containing non-existent account code', async () => {
      const token = generateToken('usr_finance', ['FINANCE_CONTROLLER']);
      const mockPeriod: any = { periodCode: '2026-08', status: 'OPEN' };

      jest.spyOn(financeRepository, 'findPeriodByCode').mockResolvedValue(mockPeriod);
      jest.spyOn(financeRepository, 'findAccountByCode').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/finance/journals')
        .set('Authorization', `Bearer ${token}`)
        .send({
          postingDate: '2026-08-15T10:00:00.000Z',
          description: 'Entry with invalid account',
          lines: [
            { accountCode: '9999', debit: 1000, credit: 0 },
            { accountCode: '4010', debit: 0, credit: 1000 }
          ]
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Account with code \'9999\' not found');
    });
  });

  describe('Controlled Journal Reversal', () => {
    it('should reverse a POSTED journal entry and generate an opposing reversal journal', async () => {
      const token = generateToken('usr_finance', ['FINANCE_CONTROLLER']);

      const mockOriginalJournal: any = {
        id: 'je_001',
        tenantId: testTenant,
        entryNumber: 'JE-202608-0001',
        postingDate: new Date('2026-08-15T10:00:00.000Z'),
        accountingPeriod: '2026-08',
        status: 'POSTED',
        sourceModule: 'DISPATCH',
        description: 'Incorrect customer billing',
        lines: [
          { accountCode: '1100', accountName: 'Accounts Receivable', debit: 1200, credit: 0 },
          { accountCode: '4010', accountName: 'Commercial Revenue', debit: 0, credit: 1200 }
        ],
        totalDebit: 1200,
        totalCredit: 1200,
        isBalanced: true,
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
        toJSON: function () {
          return { ...this };
        }
      };

      jest.spyOn(financeRepository, 'findJournalById').mockResolvedValue(mockOriginalJournal);
      jest.spyOn(financeRepository, 'findPeriodByCode').mockResolvedValue({ periodCode: '2026-08', status: 'OPEN' } as any);
      jest.spyOn(financeRepository, 'findAccountByCode').mockImplementation(async (_tenantId, code) => ({
        accountCode: code,
        accountName: code === '1100' ? 'Accounts Receivable' : 'Commercial Revenue',
        isActive: true
      } as any));
      jest.spyOn(financeRepository, 'generateNextEntryNumber').mockResolvedValue('JE-202608-0002');
      jest.spyOn(financeRepository, 'createJournalEntry').mockImplementation(async (_tenantId, data) => {
        return {
          id: 'je_rev_002',
          ...data,
          save: jest.fn().mockResolvedValue(this),
          toJSON: function () {
            return { ...this };
          }
        } as any;
      });

      const res = await request(app)
        .post('/api/v1/finance/journals/je_001/reverse')
        .set('Authorization', `Bearer ${token}`)
        .send({
          reversalReason: 'Billing duplicated on job dispatch; reversing original entry.'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.originalEntry.status).toBe('REVERSED');
      expect(res.body.data.originalEntry.reversalReason).toContain('Billing duplicated');
      expect(res.body.data.reversalEntry.entryType).toBe('REVERSAL');
      expect(res.body.data.reversalEntry.lines[0].credit).toBe(1200); // Reversed: was debit 1200
      expect(res.body.data.reversalEntry.lines[1].debit).toBe(1200);  // Reversed: was credit 1200
    });
  });

  describe('General Ledger & Trial Balance', () => {
    it('should generate an account ledger with running balance', async () => {
      const token = generateToken('usr_finance', ['FINANCE_CONTROLLER']);
      const mockAccount: any = {
        accountCode: '4010',
        accountName: 'Commercial Heat-Treatment Service Revenue',
        accountType: 'REVENUE',
        normalBalance: 'CREDIT',
        isActive: true,
        toJSON: function () {
          return { ...this };
        }
      };

      const mockJournals: any[] = [
        {
          id: 'je_01',
          entryNumber: 'JE-202608-0001',
          postingDate: new Date('2026-08-01'),
          accountingPeriod: '2026-08',
          sourceModule: 'DISPATCH',
          description: 'Batch 1 Revenue',
          lines: [{ accountCode: '4010', debit: 0, credit: 3000 }]
        },
        {
          id: 'je_02',
          entryNumber: 'JE-202608-0002',
          postingDate: new Date('2026-08-05'),
          accountingPeriod: '2026-08',
          sourceModule: 'DISPATCH',
          description: 'Batch 2 Revenue',
          lines: [{ accountCode: '4010', debit: 0, credit: 2000 }]
        }
      ];

      jest.spyOn(financeRepository, 'findAccountByCode').mockResolvedValue(mockAccount);
      jest.spyOn(financeRepository, 'getJournalEntriesForLedger').mockResolvedValue(mockJournals as any);

      const res = await request(app)
        .get('/api/v1/finance/ledger?accountCode=4010')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.accountCode).toBe('4010');
      expect(res.body.data.totalCredits).toBe(5000);
      expect(res.body.data.closingBalance).toBe(5000);
      expect(res.body.data.transactions.length).toBe(2);
    });

    it('should generate a balanced Trial Balance report', async () => {
      const token = generateToken('usr_finance', ['FINANCE_CONTROLLER']);
      const mockAccounts = [
        { accountCode: '1100', accountName: 'Accounts Receivable', accountType: 'ASSET', normalBalance: 'DEBIT' },
        { accountCode: '4010', accountName: 'Commercial Revenue', accountType: 'REVENUE', normalBalance: 'CREDIT' }
      ];

      const mockPostedJournals: any[] = [
        {
          id: 'je_01',
          status: 'POSTED',
          lines: [
            { accountCode: '1100', debit: 5000, credit: 0 },
            { accountCode: '4010', debit: 0, credit: 5000 }
          ]
        }
      ];

      jest.spyOn(financeRepository, 'findAllAccounts').mockResolvedValue(mockAccounts as any);
      jest.spyOn(financeRepository, 'getAllPostedJournalsUpTo').mockResolvedValue(mockPostedJournals as any);

      const res = await request(app)
        .get('/api/v1/finance/trial-balance')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isBalanced).toBe(true);
      expect(res.body.data.totalPeriodDebits).toBe(5000);
      expect(res.body.data.totalPeriodCredits).toBe(5000);
    });
  });

  describe('Tenant Isolation & RBAC', () => {
    it('should block unauthorized users lacking finance permissions', async () => {
      const unauthorizedToken = generateToken('usr_op', ['FURNACE_OPERATOR']);

      const res = await request(app)
        .get('/api/v1/finance/journals')
        .set('Authorization', `Bearer ${unauthorizedToken}`);

      expect(res.status).toBe(403);
    });

    it('should prevent cross-tenant journal access', async () => {
      const otherToken = generateToken('usr_other_fin', ['FINANCE_CONTROLLER'], otherTenant);

      jest.spyOn(financeRepository, 'findJournalById').mockImplementation(async (tenantId, _id) => {
        if (tenantId === otherTenant) return null;
        return { id: 'je_001', tenantId: testTenant } as any;
      });

      const res = await request(app)
        .get('/api/v1/finance/journals/je_001')
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(404);
    });
  });
});
