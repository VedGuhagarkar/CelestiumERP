import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { costingRepository, DEFAULT_FACTORY_RATE_SNAPSHOT } from '../src/modules/costing/costing.repository.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';

describe('Manufacturing Job Costing & Rate Management Domain', () => {
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

  describe('Cost Rate Cards & Authoritative Rates', () => {
    it('should retrieve active factory rate card with machine, labor, energy, and overhead rates', async () => {
      const token = generateToken('usr_cost_acct', ['FINANCE_CONTROLLER']);
      const mockRateCard: any = {
        id: 'rate_card_01',
        tenantId: testTenant,
        rateCardCode: 'RATE-2026-DEFAULT',
        name: 'Standard Heat-Treatment Factory Rate Card 2026',
        revisionNumber: 1,
        status: 'ACTIVE',
        rates: DEFAULT_FACTORY_RATE_SNAPSHOT,
        toJSON: function () {
          return { ...this };
        }
      };

      jest.spyOn(costingRepository, 'findActiveRateCard').mockResolvedValue(mockRateCard);

      const res = await request(app)
        .get('/api/v1/costing/rate-cards/active')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.rateCardCode).toBe('RATE-2026-DEFAULT');
      expect(res.body.data.rates.standardLaborRatePerHour).toBe(35.0);
      expect(res.body.data.rates.utilityRates.electricityRatePerKwh).toBe(0.14);
      expect(res.body.data.rates.machineSpecificRates.length).toBeGreaterThanOrEqual(4);
    });

    it('should create a new rate card revision and supersede previous revision', async () => {
      const token = generateToken('usr_cost_acct', ['FINANCE_CONTROLLER']);

      const existingCard: any = {
        id: 'rate_card_01',
        tenantId: testTenant,
        rateCardCode: 'RATE-2026-DEFAULT',
        revisionNumber: 1,
        status: 'ACTIVE',
        save: jest.fn().mockResolvedValue(this),
        toJSON: function () {
          return { ...this };
        }
      };

      const newCard: any = {
        id: 'rate_card_02',
        tenantId: testTenant,
        rateCardCode: 'RATE-2026-DEFAULT',
        name: 'Updated Mid-Year 2026 Energy Rates',
        revisionNumber: 2,
        status: 'ACTIVE',
        rates: {
          ...DEFAULT_FACTORY_RATE_SNAPSHOT,
          utilityRates: {
            ...DEFAULT_FACTORY_RATE_SNAPSHOT.utilityRates,
            electricityRatePerKwh: 0.165 // Raised energy price
          }
        },
        toJSON: function () {
          return { ...this };
        }
      };

      jest.spyOn(costingRepository, 'findRateCardByCode').mockResolvedValue(existingCard);
      jest.spyOn(costingRepository, 'createRateCard').mockResolvedValue(newCard);

      const res = await request(app)
        .post('/api/v1/costing/rate-cards')
        .set('Authorization', `Bearer ${token}`)
        .send({
          rateCardCode: 'RATE-2026-DEFAULT',
          name: 'Updated Mid-Year 2026 Energy Rates',
          effectiveFrom: '2026-07-01T00:00:00.000Z',
          rates: newCard.rates
        });

      expect(res.status).toBe(201);
      expect(res.body.data.revisionNumber).toBe(2);
      expect(res.body.data.rates.utilityRates.electricityRatePerKwh).toBe(0.165);
      expect(existingCard.status).toBe('SUPERSEDED');
    });
  });

  describe('Job Costing Calculation Engine', () => {
    const mockProductionJob: any = {
      id: 'job_001',
      tenantId: testTenant,
      jobNumber: 'JOB-202608-0010',
      customer: { id: 'cust_01', code: 'CUST-AERO-001', name: 'Aero Dynamics Corp' },
      item: { id: 'item_01', code: 'AERO-SHAFT-01', name: 'Turbine Drive Shaft', standardCost: 15.0, actualCost: 15.5 },
      recipe: { id: 'rec_01', code: 'REC-VAC-CARB-920', totalCycleTimeHours: 6.0 },
      quantity: 120,
      totalWeightKg: 240,
      uom: 'PCS',
      equipmentAssignment: { furnaceId: 'furn_01', furnaceCode: 'FURN-VAC-01' },
      operatorAssignment: { operatorId: 'OP-101', operatorName: 'Frank Miller', shiftCode: 'SHIFT-A' },
      execution: {
        actualCycleDurationHours: 6.5,
        actualStartTime: new Date('2026-08-15T08:00:00Z'),
        actualEndTime: new Date('2026-08-15T14:30:00Z')
      },
      heatLots: [
        {
          heatLotNumber: 'HL-4340-9982',
          allocatedQuantity: 240,
          transactionId: 'TX-INV-9901'
        }
      ],
      targetSellingPrice: 4200.0,
      toJSON: function () {
        return { ...this };
      }
    };

    it('should calculate complete standard vs actual cost for a completed vacuum heat-treatment job', async () => {
      const token = generateToken('usr_cost_acct', ['FINANCE_CONTROLLER']);
      const mockRateCard: any = {
        id: 'rate_card_01',
        rateCardCode: 'RATE-2026-DEFAULT',
        revisionNumber: 1,
        rates: DEFAULT_FACTORY_RATE_SNAPSHOT
      };

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockProductionJob);
      jest.spyOn(costingRepository, 'findJobCostByJobId').mockResolvedValue(null);
      jest.spyOn(costingRepository, 'findActiveRateCard').mockResolvedValue(mockRateCard);
      jest.spyOn(costingRepository, 'generateNextCostingNumber').mockResolvedValue('COST-202608-0001');
      jest.spyOn(costingRepository, 'createJobCost').mockImplementation(async (_tenantId, data) => {
        return {
          id: 'cost_001',
          ...data,
          toJSON: function () {
            return { ...this };
          }
        } as any;
      });

      const res = await request(app)
        .post('/api/v1/costing/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send({
          jobId: 'job_001',
          notes: 'Standard batch cost calculation upon furnace unload'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.costingNumber).toBe('COST-202608-0001');
      expect(res.body.data.jobNumber).toBe('JOB-202608-0010');

      // 1. Material Costs
      expect(res.body.data.materialCosts.standardCost).toBe(3600); // 240 kg * $15.00
      expect(res.body.data.materialCosts.actualCost).toBe(3720);   // 240 kg * $15.50
      expect(res.body.data.materialCosts.variance).toBe(120);

      // 2. Machine Costs (FURN-VAC-01 @ $110/hr runtime + $60/hr setup)
      expect(res.body.data.machineCosts.actualCost).toBeGreaterThan(700);
      expect(res.body.data.machineCosts.components[0].furnaceCode).toBe('FURN-VAC-01');

      // 3. Labor Costs
      expect(res.body.data.laborCosts.actualCost).toBeGreaterThan(100);

      // 4. Energy & Consumables Costs
      expect(res.body.data.energyCosts.actualCost).toBeGreaterThan(0);
      expect(res.body.data.consumableCosts.actualCost).toBeGreaterThan(0);

      // 5. Total Economics & Variances
      expect(res.body.data.totalActualCost).toBeGreaterThan(res.body.data.totalStandardCost);
      expect(res.body.data.totalVariance).toBeGreaterThan(0);
      expect(res.body.data.unitCostActual).toBeGreaterThan(0);

      // 6. Profitability
      expect(res.body.data.totalRevenueBilled).toBe(4200.0);
      expect(res.body.data.grossProfit).toBeDefined();
      expect(res.body.data.grossMarginPercentage).toBeDefined();
      expect(res.body.data.isFrozen).toBe(false);
    });

    it('should recalculate job costs with an audit trail and preserve previous cost history', async () => {
      const token = generateToken('usr_cost_acct', ['FINANCE_CONTROLLER']);

      const mockExistingCost: any = {
        id: 'cost_001',
        tenantId: testTenant,
        costingNumber: 'COST-202608-0001',
        jobId: 'job_001',
        jobNumber: 'JOB-202608-0010',
        totalActualCost: 4800.0,
        isFrozen: false,
        recalculationHistory: [],
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
        toJSON: function () {
          return { ...this };
        }
      };

      const mockRateCard: any = {
        id: 'rate_card_01',
        rateCardCode: 'RATE-2026-DEFAULT',
        revisionNumber: 1,
        rates: DEFAULT_FACTORY_RATE_SNAPSHOT
      };

      jest.spyOn(costingRepository, 'findJobCostById').mockResolvedValue(mockExistingCost);
      jest.spyOn(costingRepository, 'findActiveRateCard').mockResolvedValue(mockRateCard);
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockProductionJob);

      const res = await request(app)
        .post('/api/v1/costing/jobs/cost_001/recalculate')
        .set('Authorization', `Bearer ${token}`)
        .send({
          reason: 'Correcting operator overtime allocation from final approved payroll roster'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.recalculationHistory.length).toBe(1);
      expect(res.body.data.recalculationHistory[0].reason).toContain('Correcting operator overtime');
      expect(res.body.data.recalculationHistory[0].previousTotalActualCost).toBe(4800.0);
    });

    it('should freeze finalized job costs and strictly prevent subsequent recalculations', async () => {
      const token = generateToken('usr_cost_acct', ['FINANCE_CONTROLLER']);

      const mockExistingCost: any = {
        id: 'cost_001',
        tenantId: testTenant,
        costingNumber: 'COST-202608-0001',
        jobId: 'job_001',
        jobNumber: 'JOB-202608-0010',
        totalActualCost: 4850.0,
        isFrozen: false,
        status: 'CALCULATED',
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
        toJSON: function () {
          return { ...this };
        }
      };

      jest.spyOn(costingRepository, 'findJobCostById').mockResolvedValue(mockExistingCost);

      const freezeRes = await request(app)
        .post('/api/v1/costing/jobs/cost_001/freeze')
        .set('Authorization', `Bearer ${token}`)
        .send({
          freezeJustification: 'Monthly accounting period closing reconciliation approved by Financial Controller'
        });

      expect(freezeRes.status).toBe(200);
      expect(freezeRes.body.data.isFrozen).toBe(true);
      expect(freezeRes.body.data.status).toBe('FROZEN');

      // Attempt to recalculate the frozen cost
      const recalcRes = await request(app)
        .post('/api/v1/costing/jobs/cost_001/recalculate')
        .set('Authorization', `Bearer ${token}`)
        .send({
          reason: 'Attempted modification after freeze'
        });

      expect(recalcRes.status).toBe(400);
      expect(recalcRes.body.message).toContain('FROZEN against rate changes');
    });
  });

  describe('Costing Summary & Profitability Reporting', () => {
    it('should generate an aggregated factory costing summary report', async () => {
      const token = generateToken('usr_cost_acct', ['FINANCE_CONTROLLER']);

      const mockSummary = {
        totalJobsCosted: 15,
        totalStandardCost: 45000,
        totalActualCost: 47250,
        totalVariance: 2250,
        netVariancePercentage: 5.0,
        totalRevenueBilled: 75000,
        totalGrossProfit: 27750,
        averageGrossMarginPercentage: 37.0,
        jobsByProfitability: {
          HIGH_MARGIN: 10,
          STANDARD_MARGIN: 4,
          LOW_MARGIN: 1,
          NEGATIVE_LOSS: 0,
          UNBILLED: 0
        }
      };

      jest.spyOn(costingRepository, 'getSummaryReport').mockResolvedValue(mockSummary as any);

      const res = await request(app)
        .get('/api/v1/costing/jobs/summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalJobsCosted).toBe(15);
      expect(res.body.data.averageGrossMarginPercentage).toBe(37.0);
      expect(res.body.data.jobsByProfitability.HIGH_MARGIN).toBe(10);
    });
  });

  describe('Tenant Isolation & Authorization', () => {
    it('should reject unauthorized access without costing permissions', async () => {
      const unauthorizedToken = generateToken('usr_operator', ['FURNACE_OPERATOR']);

      const res = await request(app)
        .post('/api/v1/costing/jobs')
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .send({ jobId: 'job_001' });

      expect(res.status).toBe(403);
    });

    it('should prevent cross-tenant job cost access', async () => {
      const otherToken = generateToken('usr_other_acct', ['FINANCE_CONTROLLER'], otherTenant);

      jest.spyOn(costingRepository, 'findJobCostById').mockImplementation(async (tenantId, _id) => {
        if (tenantId === otherTenant) return null;
        return { id: 'cost_001', tenantId: testTenant } as any;
      });

      const res = await request(app)
        .get('/api/v1/costing/jobs/cost_001')
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(404);
    });
  });
});
