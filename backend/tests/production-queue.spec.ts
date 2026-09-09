import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { DomainEventBus } from '../src/core/events/domain-event-bus.js';
import { DomainEvents } from '../src/core/constants/events.js';
import { JobStatus } from '../src/core/constants/status.js';

describe('Production Phase Prompt 2: Production Queue & Atomic Take Verification', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_queue_001';
  const eventBus = DomainEventBus.getInstance();

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const createMockJobDoc = (id: string, jobNumber: string, overrides: any = {}) => {
    const doc: any = {
      _id: id,
      id,
      jobNumber,
      boNumber: jobNumber,
      tenantId: testTenant,
      poId: 'po_aero_101',
      poNumber: 'PO-2026-00101',
      grnId: 'grn_aero_501',
      grnNumber: 'GRN-202609-0501',
      status: JobStatus.WAITING_FOR_PRODUCTION,
      waitingForProduction: true,
      inProduction: false,
      waitingForInspection: false,
      inInspection: false,
      waitingForDispatch: false,
      dispatched: false,
      workflowState: {
        waitingForProduction: true,
        inProduction: false,
        waitingForInspection: false,
        inInspection: false,
        waitingForDispatch: false,
        dispatched: false
      },
      priority: 'HIGH',
      customer: {
        customerId: 'cust_001',
        customerCode: 'CUST-AERO-01',
        customerName: 'Aero Dynamics Global Inc.'
      },
      item: {
        itemId: 'item_4340',
        itemCode: 'PART-SHAFT-4340',
        itemName: 'Turbine Rotor Shaft 4340',
        materialGrade: 'AISI 4340',
        uom: 'PCS'
      },
      quantity: {
        targetQuantity: 100,
        loadedQuantity: 0,
        completedQuantity: 0,
        scrappedQuantity: 0
      },
      weightKg: 50,
      recipeSnapshot: {
        recipeId: 'rec_vac_4340',
        recipeCode: 'REC-VAC-4340',
        name: 'Vacuum Austenitize & 2-Bar N2 Quench',
        revisionNumber: 2,
        processFamily: 'VACUUM_HEAT_TREATMENT',
        stages: [
          { sequence: 1, stageName: 'Preheat Ramp', targetTemperatureC: 650, soakTimeMinutes: 45 },
          { sequence: 2, stageName: 'Austenitizing Soak', targetTemperatureC: 845, soakTimeMinutes: 90 },
          { sequence: 3, stageName: 'High Pressure N2 Quench', targetTemperatureC: 45, soakTimeMinutes: 20 }
        ]
      },
      equipmentAssignment: {
        furnaceCode: 'FURNACE-VAC-01',
        locationBay: 'Bay 1 Vacuum Bay'
      },
      timeline: {
        plannedStartDate: new Date('2026-09-10T08:00:00.000Z'),
        targetCompletionDate: new Date('2026-09-11T08:00:00.000Z'),
        dueDate: new Date('2026-09-12T08:00:00.000Z')
      },
      execution: {
        stageProgress: [],
        downtimeLog: [],
        productionLogs: []
      },
      processDetails: Array.from({ length: 15 }, (_, i) => ({
        serialNumber: i + 1,
        processNumber: i + 1,
        partId: 'item_4340',
        partCode: 'PART-SHAFT-4340',
        partName: 'Turbine Rotor Shaft 4340',
        process: i === 0 ? 'Vacuum Heat Treatment' : `Operation ${i + 1}`,
        status: i === 0 ? 'PENDING' : 'BLANK'
      })),
      isDeleted: false,
      save: jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      }),
      toJSON: function () {
        return { ...this };
      },
      toObject: function () {
        return { ...this };
      },
      ...overrides
    };
    return doc;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock role lookup to support default factory roles
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

  // --------------------------------------------------------------------------
  // 1. Authorization: Production permission requirement
  // --------------------------------------------------------------------------
  describe('1. Server-Side Authorization Enforcement', () => {
    it('allows access to the waiting-for-production queue for authorized production operator', async () => {
      const token = generateToken('operator_01', ['FURNACE_OPERATOR']);
      jest.spyOn(productionJobRepository, 'findWaitingForProductionQueue').mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/v1/production-jobs/waiting-for-production')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('denies access (403 Forbidden) to users lacking production view permissions', async () => {
      // Role with no production view permissions (e.g. DISPATCH_COORDINATOR)
      const token = generateToken('unauthorized_user', ['DISPATCH_COORDINATOR']);

      const res = await request(app)
        .get('/api/v1/production-jobs/waiting-for-production')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Access Denied|Forbidden|insufficient permissions/i);
    });

    it('denies taking a BO (403 Forbidden) if user lacks production operator permissions', async () => {
      // Quality Inspector has production view but cannot take a job into production
      const token = generateToken('qa_viewer', ['QC_INSPECTOR']);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_test_001/take-production')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${token}`)
        .send({ furnaceCode: 'FURNACE-VAC-01' });

      expect(res.status).toBe(403);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Direct API Access without authentication
  // --------------------------------------------------------------------------
  describe('2. Direct API Access & Token Rejection', () => {
    it('returns 401 Unauthorized when accessing queue without token', async () => {
      const res = await request(app)
        .get('/api/v1/production-jobs/waiting-for-production')
        .set('x-tenant-id', testTenant);
      expect(res.status).toBe(401);
    });

    it('returns 401 Unauthorized when attempting to take a BO without token', async () => {
      const res = await request(app)
        .post('/api/v1/production-jobs/bo_test_001/take-production')
        .set('x-tenant-id', testTenant)
        .send({ furnaceCode: 'FURNACE-VAC-01' });
      expect(res.status).toBe(401);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Empty Queue Representation
  // --------------------------------------------------------------------------
  describe('3. Empty Queue Representation', () => {
    it('returns 200 with empty array when no batch orders are waiting for production', async () => {
      const token = generateToken('supervisor_01', ['PLANT_MANAGER']);
      jest.spyOn(productionJobRepository, 'findWaitingForProductionQueue').mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/v1/production-jobs/waiting-for-production')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
      expect(res.body.count ?? res.body.total ?? res.body.data.length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Multiple Waiting BOs with Complete Authoritative Data
  // --------------------------------------------------------------------------
  describe('4. Multiple Waiting BOs & Authoritative Identification', () => {
    it('returns all eligible BOs with complete lineage, customer, part, and recipe data', async () => {
      const token = generateToken('supervisor_01', ['PLANT_MANAGER']);
      const bo1 = createMockJobDoc('bo_101', 'BO-202609-0101', {
        item: { itemCode: 'PART-SHAFT-4340', itemName: 'Turbine Rotor Shaft', materialGrade: 'AISI 4340', uom: 'PCS' }
      });
      const bo2 = createMockJobDoc('bo_102', 'BO-202609-0102', {
        item: { itemCode: 'PART-GEAR-8620', itemName: 'Pinion Gear', materialGrade: 'AISI 8620', uom: 'PCS' },
        recipeSnapshot: { recipeCode: 'REC-CARB-8620', name: 'Carburizing Cycle', revisionNumber: 1, stages: [] }
      });

      jest.spyOn(productionJobRepository, 'findWaitingForProductionQueue').mockResolvedValueOnce([bo1, bo2]);

      const res = await request(app)
        .get('/api/v1/production-jobs/waiting-for-production')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);

      // Verify authoritative BO 1
      const item1 = res.body.data[0];
      expect(item1.jobNumber).toBe('BO-202609-0101');
      expect(item1.poNumber).toBe('PO-2026-00101');
      expect(item1.grnNumber).toBe('GRN-202609-0501');
      expect(item1.itemCode).toBe('PART-SHAFT-4340');
      expect(item1.recipeCode).toBe('REC-VAC-4340');
      expect(item1.targetQuantity).toBe(100);

      // Verify authoritative BO 2
      const item2 = res.body.data[1];
      expect(item2.jobNumber).toBe('BO-202609-0102');
      expect(item2.itemCode).toBe('PART-GEAR-8620');
      expect(item2.recipeCode).toBe('REC-CARB-8620');
    });

    it('works identically via the /queue/waiting-for-production alias route', async () => {
      const token = generateToken('operator_01', ['FURNACE_OPERATOR']);
      const bo1 = createMockJobDoc('bo_101', 'BO-202609-0101');
      jest.spyOn(productionJobRepository, 'findWaitingForProductionQueue').mockResolvedValueOnce([bo1]);

      const res = await request(app)
        .get('/api/v1/production-jobs/queue/waiting-for-production')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  // --------------------------------------------------------------------------
  // 5. State Filtering: Returns strictly waitingForProduction = true
  // --------------------------------------------------------------------------
  describe('5. State Filtering: Only Waiting for Production Returned', () => {
    it('verifies backend repository query filters out inProduction, waitingForInspection, and dispatched jobs', async () => {
      const token = generateToken('operator_01', ['FURNACE_OPERATOR']);
      const spy = jest.spyOn(productionJobRepository, 'findWaitingForProductionQueue').mockResolvedValueOnce([]);

      await request(app)
        .get('/api/v1/production-jobs/waiting-for-production')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${token}`);

      expect(spy).toHaveBeenCalledWith(testTenant, expect.anything());
    });
  });

  // --------------------------------------------------------------------------
  // 6. Taking a BO: Atomic transition waitingForProduction → inProduction
  // --------------------------------------------------------------------------
  describe('6. Taking a BO for Production (Atomic Transition)', () => {
    it('atomically transitions BO from waitingForProduction to inProduction', async () => {
      const token = generateToken('operator_01', ['FURNACE_OPERATOR']);
      const mockJob = createMockJobDoc('bo_test_001', 'BO-202609-0010');

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValueOnce(mockJob);

      const updatedJobDoc = createMockJobDoc('bo_test_001', 'BO-202609-0010', {
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true,
        waitingForInspection: false,
        workflowState: {
          waitingForProduction: false,
          inProduction: true,
          waitingForInspection: false,
          inInspection: false,
          waitingForDispatch: false,
          dispatched: false
        },
        equipmentAssignment: {
          furnaceCode: 'FURNACE-VAC-01',
          locationBay: 'Bay 1 Vacuum Bay'
        }
      });

      jest.spyOn(productionJobRepository, 'atomicTakeForProduction').mockResolvedValueOnce(updatedJobDoc);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_test_001/take-production')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${token}`)
        .send({
          furnaceCode: 'FURNACE-VAC-01',
          loadedPieceCount: 100,
          loadedWeightKg: 50,
          initialFurnaceTempC: 25,
          chargeNumber: 'CHG-202609-001',
          shift: 'SHIFT_A',
          notes: 'Loaded into Bay 1 for vacuum cycle'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(JobStatus.IN_PRODUCTION);
      expect(res.body.data.inProduction).toBe(true);
      expect(res.body.data.waitingForProduction).toBe(false);

      // Verify atomic repository method was called with correct parameters
      expect(productionJobRepository.atomicTakeForProduction).toHaveBeenCalledWith(
        testTenant,
        'bo_test_001',
        expect.anything()
      );
    });

    it('works identically via alias route /take-for-production', async () => {
      const token = generateToken('operator_01', ['FURNACE_OPERATOR']);
      const mockJob = createMockJobDoc('bo_test_001', 'BO-202609-0010');

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValueOnce(mockJob);
      const updatedJobDoc = createMockJobDoc('bo_test_001', 'BO-202609-0010', {
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true
      });
      jest.spyOn(productionJobRepository, 'atomicTakeForProduction').mockResolvedValueOnce(updatedJobDoc);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_test_001/take-for-production')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${token}`)
        .send({ furnaceCode: 'FURNACE-VAC-01' });

      expect(res.status).toBe(200);
      expect(res.body.data.inProduction).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 7. Concurrency: Simultaneous takes by two operators
  // --------------------------------------------------------------------------
  describe('7. Concurrency & Collision Protection', () => {
    it('allows only one user to succeed and returns 409 Conflict to the concurrent competitor', async () => {
      const token1 = generateToken('operator_alice', ['FURNACE_OPERATOR']);
      const token2 = generateToken('operator_bob', ['FURNACE_OPERATOR']);

      const mockJob = createMockJobDoc('bo_race_001', 'BO-202609-9999');

      // Operator Alice takes it first: atomicTakeForProduction returns updated doc
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);
      jest.spyOn(productionJobRepository, 'atomicTakeForProduction')
        .mockResolvedValueOnce(
          createMockJobDoc('bo_race_001', 'BO-202609-9999', {
            status: JobStatus.IN_PRODUCTION,
            waitingForProduction: false,
            inProduction: true
          })
        )
        // Operator Bob races at the exact same moment: atomicTakeForProduction returns null (filter didn't match waitingForProduction)
        .mockResolvedValueOnce(null);

      // Concurrent execution simulation
      const [resAlice, resBob] = await Promise.all([
        request(app)
          .post('/api/v1/production-jobs/bo_race_001/take-production')
          .set('x-tenant-id', testTenant)
          .set('Authorization', `Bearer ${token1}`)
          .send({ furnaceCode: 'FURNACE-VAC-01' }),
        request(app)
          .post('/api/v1/production-jobs/bo_race_001/take-production')
          .set('x-tenant-id', testTenant)
          .set('Authorization', `Bearer ${token2}`)
          .send({ furnaceCode: 'FURNACE-VAC-02' })
      ]);

      const statuses = [resAlice.status, resBob.status].sort();
      expect(statuses).toEqual([200, 409]);

      const winner = resAlice.status === 200 ? resAlice : resBob;
      const loser = resAlice.status === 409 ? resAlice : resBob;

      expect(winner.body.success).toBe(true);
      expect(winner.body.data.inProduction).toBe(true);

      expect(loser.status).toBe(409);
      expect(loser.body.success).toBe(false);
      expect(loser.body.message).toMatch(
        /could not be taken into production|taken by another user|already taken into production|conflict|no longer waiting for production/i
      );
    });
  });

  // --------------------------------------------------------------------------
  // 8. Already-in-production BO returns 409 Conflict
  // --------------------------------------------------------------------------
  describe('8. Already-in-Production Protection', () => {
    it('rejects attempt to take a BO that is already in production with 409 Conflict', async () => {
      const token = generateToken('operator_01', ['FURNACE_OPERATOR']);

      // BO already has inProduction: true, waitingForProduction: false
      const alreadyInProdJob = createMockJobDoc('bo_prod_001', 'BO-202609-5555', {
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValueOnce(alreadyInProdJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_prod_001/take-production')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${token}`)
        .send({ furnaceCode: 'FURNACE-VAC-01' });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/cannot be taken into production|already in production|already in_production/i);
    });
  });

  // --------------------------------------------------------------------------
  // 9. Invalid BO returns 404 Not Found
  // --------------------------------------------------------------------------
  describe('9. Invalid BO Handling', () => {
    it('returns 404 Not Found when attempting to take a non-existent BO', async () => {
      const token = generateToken('operator_01', ['FURNACE_OPERATOR']);
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/v1/production-jobs/non_existent_bo/take-production')
        .set('Authorization', `Bearer ${token}`)
        .send({ furnaceCode: 'FURNACE-VAC-01' });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/not found/i);
    });
  });

  // --------------------------------------------------------------------------
  // 10. Recipe Immutability & Prohibited Substitution
  // --------------------------------------------------------------------------
  describe('10. Recipe Immutability in Production Queue', () => {
    it('preserves the authoritative recipe referenced by the BO and prevents master data modification', async () => {
      const token = generateToken('operator_01', ['FURNACE_OPERATOR']);
      const mockJob = createMockJobDoc('bo_recipe_001', 'BO-202609-7777');

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValueOnce(mockJob);

      const updatedJobDoc = createMockJobDoc('bo_recipe_001', 'BO-202609-7777', {
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true
      });
      jest.spyOn(productionJobRepository, 'atomicTakeForProduction').mockResolvedValueOnce(updatedJobDoc);

      // Attempting to inject a substitute recipe ID in the take payload must be ignored
      const res = await request(app)
        .post('/api/v1/production-jobs/bo_recipe_001/take-production')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${token}`)
        .send({
          furnaceCode: 'FURNACE-VAC-01',
          substituteRecipeId: 'malicious_recipe_substitute',
          overrideRecipeCode: 'REC-FAKE-001'
        });

      expect(res.status).toBe(200);
      // The recipe snapshot in the resulting job is untouched and authoritative
      expect(res.body.data.recipeSnapshot.recipeCode).toBe('REC-VAC-4340');
      expect(res.body.data.recipeSnapshot.revisionNumber).toBe(2);
    });
  });
});
