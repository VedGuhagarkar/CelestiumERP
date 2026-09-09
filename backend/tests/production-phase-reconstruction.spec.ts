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

describe('Authoritative Production Phase Reconstruction: waiting for production → in production → waiting for inspection', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_001';
  const eventBus = DomainEventBus.getInstance();

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const createMockJobDocument = (overrides: any = {}) => {
    const doc: any = {
      _id: 'bo_test_001',
      id: 'bo_test_001',
      jobNumber: 'BO-202609-0010',
      boNumber: 'BO-202609-0010',
      tenantId: testTenant,
      poId: 'po_aero_101',
      poNumber: 'PO-2026-00101',
      grnId: 'grn_aero_501',
      grnNumber: 'GRN-202609-0501',
      status: JobStatus.WAITING_FOR_PRODUCTION,
      waitingForProduction: true,
      inProduction: false,
      waitingForInspection: false,
      priority: 'HIGH',
      customer: {
        customerId: 'cust_001',
        customerCode: 'CUST-AERO-01',
        customerName: 'Aero Dynamics Global'
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
        revisionNumber: 1,
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
        targetCompletionDate: new Date('2026-09-11T08:00:00.000Z')
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

  describe('1. RBAC & Access Control', () => {
    it('should reject non-production permitted user from taking a BO into production', async () => {
      // User with billing/dispatch-only role (DISPATCH_COORDINATOR has no production take permissions)
      const nonProdToken = generateToken('usr_dispatch', ['DISPATCH_COORDINATOR']);
      const job = createMockJobDocument();

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/take-production`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${nonProdToken}`)
        .send({
          furnaceCode: 'FURNACE-VAC-01',
          loadedPieceCount: 100,
          loadedWeightKg: 50,
          initialFurnaceTempC: 25,
          chargeNumber: 'CHG-202609-001',
          shift: 'SHIFT_A'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should permit production operator with FURNACE_OPERATOR role to take a BO', async () => {
      const prodToken = generateToken('usr_operator', ['FURNACE_OPERATOR']);
      const job = createMockJobDocument();

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(productionJobRepository, 'atomicTakeForProduction').mockResolvedValue({
        ...job,
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true,
        waitingForInspection: false,
        quantity: { targetQuantity: 100, loadedQuantity: 100, completedQuantity: 0, scrappedQuantity: 0 },
        equipmentAssignment: { furnaceCode: 'FURNACE-VAC-01' }
      } as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/take-production`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${prodToken}`)
        .send({
          furnaceCode: 'FURNACE-VAC-01',
          loadedPieceCount: 100,
          loadedWeightKg: 50,
          initialFurnaceTempC: 25,
          chargeNumber: 'CHG-202609-001',
          shift: 'SHIFT_A',
          notes: 'Standard vacuum charge loaded'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inProduction).toBe(true);
      expect(res.body.data.waitingForProduction).toBe(false);
    });
  });

  describe('2. State Control: waiting for production → in production', () => {
    it('should reject taking a BO that is NOT in waitingForProduction state', async () => {
      const prodToken = generateToken('usr_operator', ['FURNACE_OPERATOR']);
      // Already in production
      const job = createMockJobDocument({
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/take-production`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${prodToken}`)
        .send({
          furnaceCode: 'FURNACE-VAC-01',
          loadedPieceCount: 100,
          loadedWeightKg: 50,
          initialFurnaceTempC: 25,
          chargeNumber: 'CHG-202609-001',
          shift: 'SHIFT_A'
        });

      expect(res.status).toBe(409); // ConflictError: already in production
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already in production/i);
    });

    it('should atomically update workflow flags: exactly one workflow flag is active (inProduction === true)', async () => {
      const prodToken = generateToken('usr_operator', ['FURNACE_OPERATOR']);
      const job = createMockJobDocument();

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const publishedEvents: string[] = [];
      jest.spyOn(eventBus, 'publish').mockImplementation((evt: any) => {
        publishedEvents.push(evt.name);
      });

      jest.spyOn(productionJobRepository, 'atomicTakeForProduction').mockImplementation(async (_tenantId, _id, updateData) => {
        return {
          ...job,
          ...updateData.$set,
          status: JobStatus.IN_PRODUCTION,
          waitingForProduction: false,
          inProduction: true,
          waitingForInspection: false
        } as any;
      });

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/take-production`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${prodToken}`)
        .send({
          furnaceCode: 'FURNACE-VAC-01',
          loadedPieceCount: 100,
          loadedWeightKg: 50,
          initialFurnaceTempC: 25,
          chargeNumber: 'CHG-202609-001',
          shift: 'SHIFT_A'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.waitingForProduction).toBe(false);
      expect(res.body.data.inProduction).toBe(true);
      expect(res.body.data.waitingForInspection).toBe(false);
      expect(publishedEvents).toContain(DomainEvents.JOB_IN_PRODUCTION);
    });

    it('should reject concurrent take attempts with 409 Conflict when atomic update fails', async () => {
      const prodToken = generateToken('usr_operator_2', ['FURNACE_OPERATOR']);
      const job = createMockJobDocument();

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      // Simulate atomic findOneAndUpdate returning null because another operator already took it
      jest.spyOn(productionJobRepository, 'atomicTakeForProduction').mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/take-production`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${prodToken}`)
        .send({
          furnaceCode: 'FURNACE-VAC-01',
          loadedPieceCount: 100,
          loadedWeightKg: 50,
          initialFurnaceTempC: 25,
          chargeNumber: 'CHG-202609-001',
          shift: 'SHIFT_A'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/taken by another user/i);
    });
  });

  describe('3. Recipe-Driven Production Data Logging', () => {
    it('should log stage progress following the Recipe referenced by the BO', async () => {
      const prodToken = generateToken('usr_operator', ['FURNACE_OPERATOR']);
      const job = createMockJobDocument({
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true,
        quantity: { targetQuantity: 100, loadedQuantity: 100, completedQuantity: 0, scrappedQuantity: 0 }
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/recipe-stage-progress`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${prodToken}`)
        .send({
          stageSequence: 1,
          actualTemperatureC: 652,
          actualDurationMinutes: 46,
          notes: 'Preheat ramp completed smoothly. Uniform surface color.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(job.execution.stageProgress).toHaveLength(1);
      expect(job.execution.stageProgress[0].stageName).toBe('Preheat Ramp');
      expect(job.execution.stageProgress[0].actualTemperatureC).toBe(652);
    });

    it('should reject logging a recipe stage sequence that does not exist in the referenced Recipe', async () => {
      const prodToken = generateToken('usr_operator', ['FURNACE_OPERATOR']);
      const job = createMockJobDocument({
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      // Recipe only has 3 stages (sequences 1, 2, 3). Stage 99 does not exist.
      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/recipe-stage-progress`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${prodToken}`)
        .send({
          stageSequence: 99,
          actualTemperatureC: 900,
          actualDurationMinutes: 60
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/does not exist in referenced Recipe/i);
    });
  });

  describe('4. Production Completion: in production → waiting for inspection', () => {
    it('should reject inspection approval when piece counts do not balance (completed + scrapped != loaded)', async () => {
      const prodToken = generateToken('usr_supervisor', ['PLANT_MANAGER']);
      // All 3 stages completed so it reaches the piece balance check
      const job = createMockJobDocument({
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true,
        quantity: { targetQuantity: 100, loadedQuantity: 100, completedQuantity: 0, scrappedQuantity: 0 },
        execution: {
          stageProgress: [
            { stageSequence: 1, stageName: 'Preheat Ramp' },
            { stageSequence: 2, stageName: 'Austenitizing Soak' },
            { stageSequence: 3, stageName: 'High Pressure N2 Quench' }
          ]
        }
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      // Loaded is 100. Completed 80 + Scrapped 10 = 90 != 100
      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${prodToken}`)
        .send({
          completedQuantity: 80,
          scrappedQuantity: 10,
          notes: 'Unbalanced pieces attempt'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Piece count balance discrepancy/i);
    });

    it('should reject inspection approval when required recipe stages are not completed', async () => {
      const prodToken = generateToken('usr_supervisor', ['PLANT_MANAGER']);
      // Only 1 of 3 stages completed
      const job = createMockJobDocument({
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true,
        quantity: { targetQuantity: 100, loadedQuantity: 100, completedQuantity: 0, scrappedQuantity: 0 },
        execution: {
          stageProgress: [
            { stageSequence: 1, stageName: 'Preheat Ramp' }
          ]
        }
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${prodToken}`)
        .send({
          completedQuantity: 98,
          scrappedQuantity: 2,
          notes: 'Attempt approval with uncompleted recipe stages'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Incomplete Recipe execution/i);
    });

    it('should approve BO for inspection when all recipe stages are completed and pieces balance', async () => {
      const prodToken = generateToken('usr_supervisor', ['PLANT_MANAGER']);
      // All 3 stages completed
      const job = createMockJobDocument({
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true,
        quantity: { targetQuantity: 100, loadedQuantity: 100, completedQuantity: 0, scrappedQuantity: 0 },
        execution: {
          stageProgress: [
            { stageSequence: 1, stageName: 'Preheat Ramp' },
            { stageSequence: 2, stageName: 'Austenitizing Soak' },
            { stageSequence: 3, stageName: 'High Pressure N2 Quench' }
          ]
        }
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const publishedEvents: string[] = [];
      jest.spyOn(eventBus, 'publish').mockImplementation((evt: any) => {
        publishedEvents.push(evt.name);
      });

      jest.spyOn(productionJobRepository, 'atomicApproveForInspection').mockResolvedValue({
        ...job,
        status: JobStatus.WAITING_FOR_INSPECTION,
        waitingForProduction: false,
        inProduction: false,
        waitingForInspection: true,
        quantity: { targetQuantity: 100, loadedQuantity: 100, completedQuantity: 98, scrappedQuantity: 2 },
        execution: {
          ...job.execution,
          qualityHandoff: {
            inspectionRequestId: 'INSP-REQ-202609-0010',
            completedQuantity: 98,
            scrappedQuantity: 2,
            handedOffAt: new Date()
          }
        }
      } as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${prodToken}`)
        .send({
          completedQuantity: 98,
          scrappedQuantity: 2,
          notes: 'Full vacuum thermal cycle complete with 2 scrapped coupon pieces'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inProduction).toBe(false);
      expect(res.body.data.waitingForInspection).toBe(true);
      expect(res.body.data.quantity.completedQuantity).toBe(98);
      expect(res.body.data.quantity.scrappedQuantity).toBe(2);
      expect(publishedEvents).toContain(DomainEvents.JOB_APPROVED_FOR_INSPECTION);
    });
  });

  describe('5. Queues Inspection Hand-Off', () => {
    it('should surface approved BOs in the waiting-for-inspection queue for Quality Inspectors', async () => {
      const qcToken = generateToken('usr_qc', ['QC_INSPECTOR']);
      const waitingInspJobs = [
        createMockJobDocument({
          status: JobStatus.WAITING_FOR_INSPECTION,
          waitingForProduction: false,
          inProduction: false,
          waitingForInspection: true,
          quantity: { targetQuantity: 100, loadedQuantity: 100, completedQuantity: 98, scrappedQuantity: 2 }
        })
      ];

      jest.spyOn(productionJobRepository, 'findWaitingForInspectionQueue').mockResolvedValue(waitingInspJobs as any);

      const res = await request(app)
        .get('/api/v1/production-jobs/waiting-for-inspection')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].waitingForInspection).toBe(true);
      expect(res.body.data[0].completedQuantity).toBe(98);
    });
  });
});
