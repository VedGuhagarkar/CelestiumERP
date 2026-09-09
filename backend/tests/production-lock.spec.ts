import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { purchaseOrderService } from '../src/modules/purchase-order/purchase-order.service.js';
import { purchaseOrderRepository } from '../src/modules/purchase-order/purchase-order.repository.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { furnaceCapacityRepository } from '../src/modules/furnace-capacity/furnace-capacity.repository.js';
import { JobStatus } from '../src/core/constants/status.js';

describe('Production Phase Prompt 3: BO Production Lock & Exclusive Ownership Verification', () => {
  const app = createApp();
  const testTenant = 'tenant_prod_lock_001';

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
        loadedQuantity: 100,
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
        furnaceId: 'furnace_vac_01',
        furnaceCode: 'FURNACE-VAC-01',
        locationBay: 'Bay 1 Vacuum Bay',
        pyrometryClass: 'CLASS_2'
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

    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);
    jest.spyOn(roleRepository, 'seedDefaultRolesForTenant').mockResolvedValue([] as any);
    jest.spyOn(roleRepository, 'findRolesByCodes').mockImplementation(async (_tenantId, codes) => {
      return DEFAULT_FACTORY_ROLES.filter((r) => codes.includes(r.code)).map((r) => ({
        ...r,
        id: `role_${r.code}`,
        status: 'active'
      })) as any;
    });

    jest.spyOn(furnaceCapacityRepository, 'findFurnaceById').mockImplementation(async (_tenantId, _id) => {
      return {
        id: 'furnace_vac_01',
        furnaceCode: 'FURNACE-VAC-01',
        locationBay: 'Bay 1 Vacuum Bay',
        status: 'OPERATIONAL',
        isDeleted: false,
        thermalCapabilities: {
          minOperatingTempC: 100,
          maxOperatingTempC: 1300,
          pyrometryClass: 'CLASS_2'
        },
        processCapabilities: {
          supportedProcessFamilies: ['VACUUM_HEAT_TREATMENT']
        }
      } as any;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // 1. Atomic Transition & Workflow Exclusivity
  // --------------------------------------------------------------------------
  describe('1. Atomic Transition & Workflow Exclusivity', () => {
    it('atomically transitions waitingForProduction -> inProduction with exactly one active flag', async () => {
      const token = generateToken('operator_01', ['FURNACE_OPERATOR']);
      const waitingJob = createMockJobDoc('job_lock_01', 'BO-202609-0001');

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(waitingJob);

      const inProductionJob = createMockJobDoc('job_lock_01', 'BO-202609-0001', {
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true,
        workflowState: {
          waitingForProduction: false,
          inProduction: true,
          waitingForInspection: false,
          inInspection: false,
          waitingForDispatch: false,
          dispatched: false
        }
      });

      jest.spyOn(productionJobRepository, 'atomicTakeForProduction').mockResolvedValue(inProductionJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/job_lock_01/take-for-production')
        .set('Authorization', `Bearer ${token}`)
        .send({
          furnaceId: 'furnace_vac_01',
          loadedPieceCount: 100,
          loadedWeightKg: 50
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('IN_PRODUCTION');
      expect(res.body.data.waitingForProduction).toBe(false);
      expect(res.body.data.inProduction).toBe(true);
      expect(res.body.data.workflowState.inProduction).toBe(true);
      expect(res.body.data.workflowState.waitingForProduction).toBe(false);

      // Verify single active flag invariant
      const flags = Object.values(res.body.data.workflowState);
      const activeCount = flags.filter((f) => f === true).length;
      expect(activeCount).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Exclusive Ownership & Race Condition Collision
  // --------------------------------------------------------------------------
  describe('2. Exclusive Ownership & Concurrency Race Protection', () => {
    it('allows only one user to claim the BO and returns 409 Conflict to the other', async () => {
      const tokenUser1 = generateToken('operator_01', ['FURNACE_OPERATOR']);
      const tokenUser2 = generateToken('operator_02', ['FURNACE_OPERATOR']);

      const waitingJob = createMockJobDoc('job_lock_race', 'BO-202609-0002');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(waitingJob);

      // Operator 1 wins atomic update
      const inProdJob = createMockJobDoc('job_lock_race', 'BO-202609-0002', {
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true,
        workflowState: { waitingForProduction: false, inProduction: true }
      });
      jest.spyOn(productionJobRepository, 'atomicTakeForProduction')
        .mockResolvedValueOnce(inProdJob)
        .mockResolvedValueOnce(null); // Operator 2 loses race

      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/v1/production-jobs/job_lock_race/take-for-production')
          .set('Authorization', `Bearer ${tokenUser1}`)
          .send({ furnaceId: 'furnace_vac_01' }),
        request(app)
          .post('/api/v1/production-jobs/job_lock_race/take-for-production')
          .set('Authorization', `Bearer ${tokenUser2}`)
          .send({ furnaceId: 'furnace_vac_01' })
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);
      const conflictRes = res1.status === 409 ? res1 : res2;
      expect(conflictRes.body.message).toMatch(/conflict|taken by another user/i);
    });

    it('rejects attempt to start an already in-production BO with 409 Conflict', async () => {
      const token = generateToken('operator_01', ['FURNACE_OPERATOR']);
      const inProdJob = createMockJobDoc('job_in_prod_active', 'BO-202609-0003', {
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true,
        workflowState: { waitingForProduction: false, inProduction: true }
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(inProdJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/job_in_prod_active/take-for-production')
        .set('Authorization', `Bearer ${token}`)
        .send({ furnaceId: 'furnace_vac_01' });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already in production/i);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Queue Lock: Excluded from Waiting Queues
  // --------------------------------------------------------------------------
  describe('3. Queue Lock Semantics', () => {
    it('ensures in-production BO does not appear in the waiting-for-production queue', async () => {
      const token = generateToken('operator_01', ['FURNACE_OPERATOR']);

      const waitingJob = createMockJobDoc('job_waiting_01', 'BO-202609-0010');
      const inProdJob = createMockJobDoc('job_in_prod_01', 'BO-202609-0011', {
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true,
        workflowState: { waitingForProduction: false, inProduction: true }
      });

      // The repository strictly returns only waiting jobs
      jest.spyOn(productionJobRepository, 'findWaitingForProductionQueue')
        .mockResolvedValue([waitingJob]);

      const res = await request(app)
        .get('/api/v1/production-jobs/waiting-for-production')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].jobId).toBe('job_waiting_01');
      expect(res.body.data.some((j: any) => j.jobId === inProdJob.id)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Planning Lock: Modifications Rejected
  // --------------------------------------------------------------------------
  describe('4. Planning Lock Semantics', () => {
    it('rejects updateJob via PATCH /batch-orders/:id when BO is in production (400 Bad Request)', async () => {
      const token = generateToken('planner_01', ['PLANT_MANAGER', 'FURNACE_OPERATOR']);
      const inProdJob = createMockJobDoc('job_in_prod_02', 'BO-202609-0020', {
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true,
        workflowState: { waitingForProduction: false, inProduction: true }
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(inProdJob);

      const res = await request(app)
        .patch('/api/v1/production-jobs/batch-orders/job_in_prod_02')
        .set('Authorization', `Bearer ${token}`)
        .send({
          priority: 'URGENT',
          notes: 'Attempting unauthorized planning update'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/In-Production Lock Violation/i);
    });

    it('rejects updateProcessDetails via PUT /:id/process-details when BO is in production (400 Bad Request)', async () => {
      const token = generateToken('planner_01', ['PLANT_MANAGER', 'FURNACE_OPERATOR']);
      const inProdJob = createMockJobDoc('job_in_prod_03', 'BO-202609-0021', {
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true,
        workflowState: { waitingForProduction: false, inProduction: true }
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(inProdJob);

      const res = await request(app)
        .put('/api/v1/production-jobs/job_in_prod_03/process-details')
        .set('Authorization', `Bearer ${token}`)
        .send({
          processDetails: [
            {
              serialNumber: 1,
              processNumber: 1,
              partId: 'item_4340',
              partCode: 'PART-SHAFT-4340',
              partName: 'Turbine Rotor Shaft 4340',
              process: 'Altered Thermal Process',
              status: 'PENDING'
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/In-Production Lock Violation/i);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Equipment & Operator Planning Lock
  // --------------------------------------------------------------------------
  describe('5. Equipment & Operator Planning Reassignment Lock', () => {
    it('rejects operator assignment and removal while BO is in production', async () => {
      const token = generateToken('planner_01', ['PLANT_MANAGER', 'FURNACE_OPERATOR']);
      const inProdJob = createMockJobDoc('job_in_prod_04', 'BO-202609-0030', {
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true,
        workflowState: { waitingForProduction: false, inProduction: true }
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(inProdJob);

      const assignRes = await request(app)
        .post('/api/v1/production-jobs/job_in_prod_04/assign-operator')
        .set('Authorization', `Bearer ${token}`)
        .send({ operatorId: 'emp_002', shift: 'SHIFT_3_NIGHT', reason: 'Reassignment attempt' });

      expect(assignRes.status).toBe(400);
      expect(assignRes.body.message).toMatch(/In-Production Lock Violation/i);

      const removeRes = await request(app)
        .post('/api/v1/production-jobs/job_in_prod_04/remove-operator')
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Unauthorized removal' });

      expect(removeRes.status).toBe(400);
      expect(removeRes.body.message).toMatch(/In-Production Lock Violation/i);
    });

    it('rejects furnace reassignment and removal while BO is in production', async () => {
      const token = generateToken('planner_01', ['PLANT_MANAGER', 'FURNACE_OPERATOR']);
      const inProdJob = createMockJobDoc('job_in_prod_05', 'BO-202609-0031', {
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true,
        workflowState: { waitingForProduction: false, inProduction: true }
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(inProdJob);

      const assignRes = await request(app)
        .post('/api/v1/production-jobs/job_in_prod_05/assign-furnace')
        .set('Authorization', `Bearer ${token}`)
        .send({ furnaceId: 'furnace_vac_02' });

      expect(assignRes.status).toBe(400);
      expect(assignRes.body.message).toMatch(/In-Production Lock Violation/i);

      const removeRes = await request(app)
        .post('/api/v1/production-jobs/job_in_prod_05/remove-furnace')
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Unauthorized removal' });

      expect(removeRes.status).toBe(400);
      expect(removeRes.body.message).toMatch(/In-Production Lock Violation/i);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Generic Lifecycle Transition & Cancellation Lock
  // --------------------------------------------------------------------------
  describe('6. Lifecycle Status & Cancellation Lock', () => {
    it('rejects arbitrary transition via /transition when BO is in production', async () => {
      const token = generateToken('planner_01', ['PLANT_MANAGER', 'FURNACE_OPERATOR']);
      const inProdJob = createMockJobDoc('job_in_prod_06', 'BO-202609-0040', {
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true,
        workflowState: { waitingForProduction: false, inProduction: true }
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(inProdJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/job_in_prod_06/transition')
        .set('Authorization', `Bearer ${token}`)
        .send({ toStatus: 'PAUSED', reason: 'Attempted arbitrary transition' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/In-Production Lock Violation/i);
    });

    it('rejects planning cancellation via /cancel when BO is in production', async () => {
      const token = generateToken('planner_01', ['PLANT_MANAGER', 'FURNACE_OPERATOR']);
      const inProdJob = createMockJobDoc('job_in_prod_07', 'BO-202609-0041', {
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true,
        workflowState: { waitingForProduction: false, inProduction: true }
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(inProdJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/job_in_prod_07/cancel')
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Attempted cancellation of active run' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/In-Production Lock Violation/i);
    });
  });

  // --------------------------------------------------------------------------
  // 7. Source Genealogy Protection (PO -> GRN -> BO)
  // --------------------------------------------------------------------------
  describe('7. Source Genealogy Protection', () => {
    it('blocks cancelling parent PO when an associated BO is in production', async () => {
      const actor = { userId: 'procurement_mgr_01', role: 'PLANT_MANAGER', email: 'pm@factory.com' };

      const mockPo: any = {
        id: 'po_aero_101',
        poNumber: 'PO-2026-00101',
        status: 'ISSUED',
        totalReceivedQuantity: 0,
        toJSON: () => ({ id: 'po_aero_101', poNumber: 'PO-2026-00101', status: 'ISSUED' })
      };

      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValue(mockPo);

      const activeJob = createMockJobDoc('job_in_prod_po', 'BO-202609-0050', {
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true
      });

      jest.spyOn(productionJobRepository, 'findInProductionJobsForPo').mockResolvedValue([activeJob]);

      await expect(
        purchaseOrderService.cancelOrder(testTenant, 'po_aero_101', actor as any, 'Testing PO cancellation')
      ).rejects.toThrow(/Source Genealogy Protection/i);
    });
  });

  // --------------------------------------------------------------------------
  // 8. Audit Trail Verification
  // --------------------------------------------------------------------------
  describe('8. Authoritative Audit Trail Recording', () => {
    it('records audit log with BO, acting user, timestamp, and resulting state on production start', async () => {
      const token = generateToken('operator_audit_01', ['FURNACE_OPERATOR']);
      const waitingJob = createMockJobDoc('job_audit_01', 'BO-202609-0060');

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(waitingJob);

      const inProductionJob = createMockJobDoc('job_audit_01', 'BO-202609-0060', {
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true,
        workflowState: { waitingForProduction: false, inProduction: true }
      });

      jest.spyOn(productionJobRepository, 'atomicTakeForProduction').mockResolvedValue(inProductionJob);
      const auditSpy = jest.spyOn(auditService, 'record');

      const res = await request(app)
        .post('/api/v1/production-jobs/job_audit_01/take-for-production')
        .set('Authorization', `Bearer ${token}`)
        .send({ furnaceId: 'furnace_vac_01', loadedPieceCount: 100 });

      expect(res.status).toBe(200);
      expect(auditSpy).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          action: 'PRODUCTION_JOB_TAKE',
          entityType: 'PRODUCTION_JOB',
          entityId: 'job_audit_01',
          actorId: 'operator_audit_01',
          beforeState: expect.objectContaining({
            status: JobStatus.WAITING_FOR_PRODUCTION,
            waitingForProduction: true,
            inProduction: false
          }),
          afterState: expect.objectContaining({
            status: 'IN_PRODUCTION',
            waitingForProduction: false,
            inProduction: true
          }),
          metadata: expect.objectContaining({
            jobId: 'job_audit_01',
            boNumber: 'BO-202609-0060',
            actingUser: 'operator_audit_01',
            resultingState: expect.objectContaining({
              status: 'IN_PRODUCTION',
              inProduction: true
            })
          })
        })
      );
    });
  });

  // --------------------------------------------------------------------------
  // 9. Authorized Production Workflow & Historical Viewing Allowed
  // --------------------------------------------------------------------------
  describe('9. Authorized Production Operations & Read-Only Viewing', () => {
    it('allows authorized operator to view the BO record while in production (200 OK)', async () => {
      const token = generateToken('operator_01', ['FURNACE_OPERATOR']);
      const inProdJob = createMockJobDoc('job_view_01', 'BO-202609-0070', {
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true,
        workflowState: { waitingForProduction: false, inProduction: true }
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(inProdJob);

      const res = await request(app)
        .get('/api/v1/production-jobs/job_view_01')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('job_view_01');
      expect(res.body.data.status).toBe('IN_PRODUCTION');
      expect(res.body.data.inProduction).toBe(true);
    });

    it('allows authorized operator to log stage progress against the referenced Recipe', async () => {
      const token = generateToken('operator_01', ['FURNACE_OPERATOR']);
      const inProdJob = createMockJobDoc('job_prog_01', 'BO-202609-0071', {
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true,
        workflowState: { waitingForProduction: false, inProduction: true }
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(inProdJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/job_prog_01/recipe-stage-progress')
        .set('Authorization', `Bearer ${token}`)
        .send({
          stageSequence: 1,
          stageName: 'Preheat Ramp',
          stageType: 'PREHEAT',
          targetTemperatureC: 650,
          actualTemperatureC: 652,
          targetDurationMinutes: 45,
          actualDurationMinutes: 45
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects logging recipe progress with a stage name not in the referenced Recipe', async () => {
      const token = generateToken('operator_01', ['FURNACE_OPERATOR']);
      const inProdJob = createMockJobDoc('job_prog_02', 'BO-202609-0072', {
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true,
        workflowState: { waitingForProduction: false, inProduction: true }
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(inProdJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/job_prog_02/recipe-stage-progress')
        .set('Authorization', `Bearer ${token}`)
        .send({
          stageSequence: 99,
          stageName: 'Nonexistent Stage Name',
          stageType: 'OTHER',
          targetTemperatureC: 500,
          actualTemperatureC: 500,
          targetDurationMinutes: 30,
          actualDurationMinutes: 30
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/referenced Recipe/i);
    });
  });
});
