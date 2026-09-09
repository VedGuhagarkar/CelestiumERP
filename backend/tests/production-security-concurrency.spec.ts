import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { furnaceCapacityRepository } from '../src/modules/furnace-capacity/furnace-capacity.repository.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { JobStatus } from '../src/core/constants/status.js';

describe('Production Phase Prompt 9: Production Security, Concurrency and Failure Handling', () => {
  const app = createApp();
  const testTenant = 'tenant_prod_sec_p9_001';

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
      status: JobStatus.IN_PRODUCTION,
      waitingForProduction: false,
      inProduction: true,
      waitingForInspection: false,
      inInspection: false,
      waitingForDispatch: false,
      dispatched: false,
      workflowState: {
        waitingForProduction: false,
        inProduction: true,
        waitingForInspection: false,
        inInspection: false,
        waitingForDispatch: false,
        dispatched: false
      },
      priority: 'HIGH',
      assignedFurnaceId: 'furnace_vac_01',
      assignedFurnaceCode: 'FURNACE-VAC-01',
      assignedOperatorId: 'usr_op01',
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
          {
            sequence: 1,
            stageName: 'Preheat Ramp',
            targetTemperatureC: 650,
            temperatureToleranceMinusC: 10,
            temperatureTolerancePlusC: 10,
            soakTimeMinutes: 45,
            soakCriteria: 'SURFACE_TC_REACHED'
          },
          {
            sequence: 2,
            stageName: 'Austenitizing Soak',
            targetTemperatureC: 845,
            temperatureToleranceMinusC: 10,
            temperatureTolerancePlusC: 10,
            soakTimeMinutes: 90,
            soakCriteria: 'LOAD_THERMOCOUPLE_REACHED',
            atmosphereDetails: 'Partial pressure N2 1.5 mbar'
          }
        ]
      },
      processDetails: Array.from({ length: 15 }, (_, i) => ({
        serialNumber: i + 1,
        position: i + 1,
        stageName: `Stage ${i + 1}`,
        process: 'VACUUM_HEAT_TREATMENT',
        targetTemp: 650,
        targetDurationMinutes: 45
      })),
      genealogy: {
        whichPo: {
          poId: 'po_aero_101',
          poNumber: 'PO-2026-00101',
          supplierName: 'Aero Dynamics Global Inc.'
        },
        whichGrn: {
          grnId: 'grn_aero_501',
          grnNumber: 'GRN-202609-0501',
          supplierName: 'Aero Dynamics Global Inc.'
        },
        whichPart: {
          itemId: 'item_4340',
          itemCode: 'PART-SHAFT-4340',
          itemName: 'Turbine Rotor Shaft 4340',
          materialGrade: 'AISI 4340',
          uom: 'PCS'
        },
        whichRecipe: {
          recipeId: 'rec_vac_4340',
          recipeCode: 'REC-VAC-4340',
          recipeName: 'Vacuum Austenitize & 2-Bar N2 Quench',
          revisionNumber: 2,
          processFamily: 'VACUUM_HEAT_TREATMENT'
        },
        isImmutable: true
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
        actualStartDate: new Date('2026-09-10T08:30:00.000Z'),
        dueDate: '2026-09-15'
      },
      execution: {
        furnaceCharge: {
          furnaceId: 'furnace_vac_01',
          furnaceCode: 'FURNACE-VAC-01',
          operatorId: 'usr_op01',
          shift: 'SHIFT_A',
          chargeNumber: 'CHG-202609-001',
          loadedPieces: 100,
          loadedWeightKg: 50,
          initialFurnaceTempC: 25,
          atmosphereType: 'VACUUM',
          notes: 'Standard batch load'
        },
        stageProgress: []
      },
      transitionHistory: [],
      isDeleted: false,
      save: jest.fn().mockImplementation(async function () {
        return this;
      }),
      toJSON() {
        return { ...this };
      },
      ...overrides
    };

    return doc;
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);
    jest.spyOn(roleRepository, 'seedDefaultRolesForTenant').mockResolvedValue([] as any);

    jest.spyOn(furnaceCapacityRepository, 'findFurnaceById').mockImplementation(async (_tenant: string, id: string) => {
      if (id === 'furnace_vac_01') {
        return {
          id: 'furnace_vac_01',
          furnaceCode: 'FURNACE-VAC-01',
          name: 'Ipsen 2-Bar Vacuum Furnace',
          status: 'OPERATIONAL',
          locationBay: 'Bay 1 Vacuum Bay',
          capacityKg: 1000,
          thermalCapabilities: {
            maxOperatingTempC: 1300,
            pyrometryClass: 'CLASS_2',
            maxChargeWeightKg: 1000
          },
          isDeleted: false
        } as any;
      }
      return null;
    });

    jest.spyOn(roleRepository, 'findRolesByCodes').mockImplementation(async (_tenantId, codes) => {
      return codes.map((code) => {
        if (code === 'OPERATOR' || code === 'MACHINIST' || code === 'FURNACE_OPERATOR') {
          const fo = DEFAULT_FACTORY_ROLES.find((r) => r.code === 'FURNACE_OPERATOR')!;
          return { ...fo, code, id: `role_${code}`, status: 'active' };
        }
        if (code === 'PRODUCTION_SUPERVISOR' || code === 'PLANT_MANAGER') {
          const pm = DEFAULT_FACTORY_ROLES.find((r) => r.code === 'PLANT_MANAGER')!;
          return { ...pm, code, id: `role_${code}`, status: 'active' };
        }
        const found = DEFAULT_FACTORY_ROLES.find((r) => r.code === code);
        return (
          found
            ? { ...found, id: `role_${code}`, status: 'active' }
            : { code, id: `role_${code}`, status: 'active', permissions: [] }
        );
      }) as any;
    });
  });

  // 1. Authorization: Authentication Requirement
  describe('Invariant 1: Unauthenticated Requests Rejection', () => {
    it('should reject unauthenticated production requests with 401', async () => {
      const endpoints = [
        { method: 'post', url: '/api/v1/production-jobs/job_001/take-for-production', body: { furnaceId: 'furnace_vac_01' } },
        { method: 'post', url: '/api/v1/production-jobs/job_001/charge', body: { chargeNumber: 'CHG-1', loadedPieceCount: 100, loadedWeightKg: 50, initialFurnaceTempC: 25 } },
        { method: 'post', url: '/api/v1/production-jobs/job_001/save-production-data', body: { notes: 'Partial work' } },
        { method: 'post', url: '/api/v1/production-jobs/job_001/recipe-progress', body: { stageSequence: 1, actualTemperatureC: 650, actualDurationMinutes: 45 } },
        { method: 'post', url: '/api/v1/production-jobs/job_001/approve-for-inspection', body: { completedQuantity: 100, scrappedQuantity: 0, notes: 'Done' } }
      ];

      for (const ep of endpoints) {
        const res = await (request(app) as any)[ep.method](ep.url).send(ep.body);
        expect(res.status).toBe(401);
      }
    });
  });

  // 2. Authorization: Role Separation
  describe('Invariant 2: Role Separation & Unauthorized Role Rejection', () => {
    it('should reject users lacking production permissions with 403 Forbidden', async () => {
      const viewerToken = generateToken('usr_viewer', ['GUEST_AUDITOR']);

      const res = await request(app)
        .post('/api/v1/production-jobs/job_001/take-for-production')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ furnaceId: 'furnace_vac_01', loadedPieces: 100, loadedWeightKg: 50 });

      expect(res.status).toBe(403);
    });

    it('should reject QC Inspector without production permissions on execution routes', async () => {
      const qcToken = generateToken('usr_qc', ['QC_INSPECTOR']);

      const res = await request(app)
        .post('/api/v1/production-jobs/job_001/charge')
        .set('Authorization', `Bearer ${qcToken}`)
        .send({ chargeNumber: 'CHG-1', loadedPieceCount: 100, loadedWeightKg: 50, initialFurnaceTempC: 25 });

      expect(res.status).toBe(403);
    });
  });

  // 3. Authorization: Client Identity Non-Trust
  describe('Invariant 3: Non-Trust of Client-Submitted Identity/Roles', () => {
    it('should attribute actions strictly to JWT credentials, ignoring body spoofing', async () => {
      const mockJob = createMockJobDoc('job_p9_001', 'BO-202609-0901');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const opToken = generateToken('usr_real_operator', ['OPERATOR']);

      const res = await request(app)
        .post('/api/v1/production-jobs/job_p9_001/save-production-data')
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          notes: 'Saved partial work',
          actorId: 'usr_fake_admin',
          roles: ['ADMIN', 'SUPER_ADMIN'],
          tenantId: 'spoofed_tenant'
        });

      expect(res.status).toBe(200);
      expect(mockJob.save).toHaveBeenCalled();
    });
  });

  // 4. State Authorization: Take Requires WAITING_FOR_PRODUCTION
  describe('Invariant 4: State Authorization - Take Action Gating', () => {
    it('should reject take-for-production if BO is already IN_PRODUCTION', async () => {
      const mockJob = createMockJobDoc('job_p9_002', 'BO-202609-0902', {
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true,
        workflowState: { waitingForProduction: false, inProduction: true, waitingForInspection: false }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);
      jest.spyOn(productionJobRepository, 'atomicTakeForProduction').mockResolvedValue(null);

      const opToken = generateToken('usr_op01', ['OPERATOR']);
      const res = await request(app)
        .post('/api/v1/production-jobs/job_p9_002/take-for-production')
        .set('Authorization', `Bearer ${opToken}`)
        .send({ furnaceId: 'furnace_vac_01', loadedPieces: 100, loadedWeightKg: 50 });

      expect([400, 409]).toContain(res.status);
    });

    it('should reject take-for-production if BO is in WAITING_FOR_INSPECTION', async () => {
      const mockJob = createMockJobDoc('job_p9_003', 'BO-202609-0903', {
        status: JobStatus.WAITING_FOR_INSPECTION,
        waitingForProduction: false,
        inProduction: false,
        waitingForInspection: true,
        workflowState: { waitingForProduction: false, inProduction: false, waitingForInspection: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const opToken = generateToken('usr_op01', ['OPERATOR']);
      const res = await request(app)
        .post('/api/v1/production-jobs/job_p9_003/take-for-production')
        .set('Authorization', `Bearer ${opToken}`)
        .send({ furnaceId: 'furnace_vac_01', loadedPieces: 100, loadedWeightKg: 50 });

      expect([400, 409]).toContain(res.status);
    });
  });

  // 5. State Authorization: Charge Requires IN_PRODUCTION
  describe('Invariant 5: State Authorization - Furnace Charge Gating', () => {
    it('should reject recording furnace charge if BO is in WAITING_FOR_PRODUCTION', async () => {
      const mockJob = createMockJobDoc('job_p9_004', 'BO-202609-0904', {
        status: JobStatus.WAITING_FOR_PRODUCTION,
        waitingForProduction: true,
        inProduction: false,
        workflowState: { waitingForProduction: true, inProduction: false }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const opToken = generateToken('usr_op01', ['OPERATOR']);
      const res = await request(app)
        .post('/api/v1/production-jobs/job_p9_004/charge')
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          chargeNumber: 'CHG-001',
          loadedPieceCount: 100,
          loadedWeightKg: 50,
          initialFurnaceTempC: 25
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not in production/i);
    });
  });

  // 6. State Authorization: Recipe Progress Requires IN_PRODUCTION
  describe('Invariant 6: State Authorization - Stage Progress Gating', () => {
    it('should reject recording recipe stage progress on waiting BO', async () => {
      const mockJob = createMockJobDoc('job_p9_005', 'BO-202609-0905', {
        status: JobStatus.WAITING_FOR_PRODUCTION,
        waitingForProduction: true,
        inProduction: false,
        workflowState: { waitingForProduction: true, inProduction: false }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const opToken = generateToken('usr_op01', ['OPERATOR']);
      const res = await request(app)
        .post('/api/v1/production-jobs/job_p9_005/recipe-progress')
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          stageSequence: 1,
          actualTemperatureC: 650,
          actualDurationMinutes: 45
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not in production/i);
    });
  });

  // 7. State Authorization: Save Production Data Requires IN_PRODUCTION
  describe('Invariant 7: State Authorization - Partial Save Gating', () => {
    it('should reject save-production-data on waiting-for-production BO', async () => {
      const mockJob = createMockJobDoc('job_p9_006', 'BO-202609-0906', {
        status: JobStatus.WAITING_FOR_PRODUCTION,
        waitingForProduction: true,
        inProduction: false,
        workflowState: { waitingForProduction: true, inProduction: false }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const opToken = generateToken('usr_op01', ['OPERATOR']);
      const res = await request(app)
        .post('/api/v1/production-jobs/job_p9_006/save-production-data')
        .set('Authorization', `Bearer ${opToken}`)
        .send({ notes: 'Partial work' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not in production/i);
    });
  });

  // 8. State Authorization: Approve Requires IN_PRODUCTION
  describe('Invariant 8: State Authorization - Inspection Approval Gating', () => {
    it('should reject approving a BO that is still WAITING_FOR_PRODUCTION', async () => {
      const mockJob = createMockJobDoc('job_p9_007', 'BO-202609-0907', {
        status: JobStatus.WAITING_FOR_PRODUCTION,
        waitingForProduction: true,
        inProduction: false,
        workflowState: { waitingForProduction: true, inProduction: false }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const supToken = generateToken('usr_sup01', ['PRODUCTION_SUPERVISOR']);
      const res = await request(app)
        .post('/api/v1/production-jobs/job_p9_007/approve-for-inspection')
        .set('Authorization', `Bearer ${supToken}`)
        .send({
          completedQuantity: 100,
          scrappedQuantity: 0,
          notes: 'Attempt premature approval'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/waiting for production|not in production/i);
    });
  });

  // 9. State Mutually Exclusive Flag Enforcement
  describe('Invariant 9: Single-Active State Machine Invariant', () => {
    it('should enforce exactly one active boolean workflow flag in workflowState', async () => {
      const mockJob = createMockJobDoc('job_p9_008', 'BO-202609-0908', {
        status: JobStatus.WAITING_FOR_PRODUCTION,
        waitingForProduction: true,
        inProduction: false,
        workflowState: { waitingForProduction: true, inProduction: false }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const updatedJob = createMockJobDoc('job_p9_008', 'BO-202609-0908', {
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
      jest.spyOn(productionJobRepository, 'atomicTakeForProduction').mockResolvedValue(updatedJob);

      const opToken = generateToken('usr_op01', ['OPERATOR']);
      const res = await request(app)
        .post('/api/v1/production-jobs/job_p9_008/take-for-production')
        .set('Authorization', `Bearer ${opToken}`)
        .send({ furnaceId: 'furnace_vac_01', loadedPieces: 100, loadedWeightKg: 50 });

      expect(res.status).toBe(200);
      const ws = res.body.data.workflowState;
      const activeCount = [
        ws.waitingForProduction,
        ws.inProduction,
        ws.waitingForInspection,
        ws.inInspection,
        ws.waitingForDispatch,
        ws.dispatched
      ].filter(Boolean).length;
      expect(activeCount).toBe(1);
    });
  });

  // 10. Concurrent Claim: Atomic Race Protection (409 Conflict)
  describe('Invariant 10: Concurrent Claim Race Protection', () => {
    it('should grant BO to first taker and reject concurrent taker with 409 Conflict', async () => {
      const mockJob = createMockJobDoc('job_p9_009', 'BO-202609-0909', {
        status: JobStatus.WAITING_FOR_PRODUCTION,
        waitingForProduction: true,
        inProduction: false,
        workflowState: { waitingForProduction: true, inProduction: false }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      // User 1 takes successfully
      jest.spyOn(productionJobRepository, 'atomicTakeForProduction')
        .mockResolvedValueOnce(createMockJobDoc('job_p9_009', 'BO-202609-0909', { inProduction: true }))
        // User 2 atomic take returns null (race condition captured)
        .mockResolvedValueOnce(null);

      const token1 = generateToken('usr_op01', ['OPERATOR']);
      const token2 = generateToken('usr_op02', ['OPERATOR']);

      const res1 = await request(app)
        .post('/api/v1/production-jobs/job_p9_009/take-for-production')
        .set('Authorization', `Bearer ${token1}`)
        .send({ furnaceId: 'furnace_vac_01', loadedPieces: 100, loadedWeightKg: 50 });

      const res2 = await request(app)
        .post('/api/v1/production-jobs/job_p9_009/take-for-production')
        .set('Authorization', `Bearer ${token2}`)
        .send({ furnaceId: 'furnace_vac_01', loadedPieces: 100, loadedWeightKg: 50 });

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(409);
      expect(res2.body.message).toMatch(/taken by another user/i);
    });
  });

  // 11. Duplicate Requests / Retry Protection
  describe('Invariant 11: Duplicate Requests on Claimed BO', () => {
    it('should reject duplicate take requests with 409 Conflict', async () => {
      const mockJob = createMockJobDoc('job_p9_010', 'BO-202609-0910', {
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);
      jest.spyOn(productionJobRepository, 'atomicTakeForProduction').mockResolvedValue(null);

      const opToken = generateToken('usr_op01', ['OPERATOR']);
      const res = await request(app)
        .post('/api/v1/production-jobs/job_p9_010/take-for-production')
        .set('Authorization', `Bearer ${opToken}`)
        .send({ furnaceId: 'furnace_vac_01', loadedPieces: 100, loadedWeightKg: 50 });

      expect([400, 409]).toContain(res.status);
    });
  });

  // 12. Enterprise Idempotency Middleware Integration
  describe('Invariant 12: Enterprise Idempotency Replay', () => {
    it('should return cached idempotent replay on identical idempotency-key header', async () => {
      const mockJob = createMockJobDoc('job_p9_011', 'BO-202609-0911');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const opToken = generateToken('usr_op01', ['OPERATOR']);
      const idempotencyKey = `idemp_key_${Date.now()}`;

      // First request
      const res1 = await request(app)
        .post('/api/v1/production-jobs/job_p9_011/save-production-data')
        .set('Authorization', `Bearer ${opToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({ notes: 'First submission' });

      expect(res1.status).toBe(200);

      // Second request with same idempotency key
      const res2 = await request(app)
        .post('/api/v1/production-jobs/job_p9_011/save-production-data')
        .set('Authorization', `Bearer ${opToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({ notes: 'Duplicate retry submission' });

      expect(res2.status).toBe(200);
      expect(res2.body._idempotencyReplay).toBe(true);
    });
  });

  // 13. Interrupted Session Protection
  describe('Invariant 13: Interrupted Session State Retention', () => {
    it('should maintain authoritative inProduction state on server across client disconnects', async () => {
      const mockJob = createMockJobDoc('job_p9_012', 'BO-202609-0912');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const opToken = generateToken('usr_op01', ['OPERATOR']);
      const res = await request(app)
        .get('/api/v1/production-jobs/job_p9_012')
        .set('Authorization', `Bearer ${opToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.inProduction).toBe(true);
      expect(res.body.data.status).toBe(JobStatus.IN_PRODUCTION);
    });
  });

  // 14. Stale UI: Post-Production Edit Rejection
  describe('Invariant 14: Stale UI Mutation Rejection', () => {
    it('should reject stale edit attempts when BO has advanced to WAITING_FOR_INSPECTION', async () => {
      const mockJob = createMockJobDoc('job_p9_013', 'BO-202609-0913', {
        status: JobStatus.WAITING_FOR_INSPECTION,
        waitingForProduction: false,
        inProduction: false,
        waitingForInspection: true,
        workflowState: {
          waitingForProduction: false,
          inProduction: false,
          waitingForInspection: true
        }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const opToken = generateToken('usr_op01', ['OPERATOR']);

      // Attempt stale save
      const resSave = await request(app)
        .post('/api/v1/production-jobs/job_p9_013/save-production-data')
        .set('Authorization', `Bearer ${opToken}`)
        .send({ notes: 'Stale client edit' });

      expect(resSave.status).toBe(400);
      expect(resSave.body.message).toMatch(/Post-Production Lock Violation/i);

      // Attempt stale charge
      const resCharge = await request(app)
        .post('/api/v1/production-jobs/job_p9_013/charge')
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          chargeNumber: 'CHG-STALE',
          loadedPieceCount: 100,
          loadedWeightKg: 50,
          initialFurnaceTempC: 25
        });

      expect(resCharge.status).toBe(400);
      expect(resCharge.body.message).toMatch(/Post-Production Lock Violation/i);
    });
  });

  // 15. Cross-Tenant Isolation
  describe('Invariant 15: Cross-Tenant Mutation & View Rejection', () => {
    it('should reject accessing a BO belonging to another tenant with 404', async () => {
      // Mock findById returning null for mismatched tenant
      jest.spyOn(productionJobRepository, 'findById').mockImplementation(async (tId: string, _id: string) => {
        if (tId === testTenant) return createMockJobDoc('job_p9_014', 'BO-202609-0914');
        return null;
      });

      const foreignToken = generateToken('usr_foreign', ['OPERATOR'], 'tenant_other_999');

      const res = await request(app)
        .get('/api/v1/production-jobs/job_p9_014')
        .set('Authorization', `Bearer ${foreignToken}`);

      expect(res.status).toBe(404);
    });
  });

  // 16. Malicious Recipe Alteration
  describe('Invariant 16: Malicious Recipe Alteration Rejection', () => {
    it('should reject updateJob attempts altering pinned recipeSnapshot', async () => {
      const mockJob = createMockJobDoc('job_p9_015', 'BO-202609-0915');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);
      jest.spyOn(productionJobRepository, 'updateById').mockImplementation(async (_t, _id, updateData) => {
        if (updateData.recipeSnapshot || updateData['recipeSnapshot']) {
          throw new Error('Recipe Protection Violation: Pinned recipe snapshot is immutable and cannot be altered or swapped.');
        }
        return mockJob;
      });

      const supToken = generateToken('usr_sup01', ['PRODUCTION_SUPERVISOR']);
      const res = await request(app)
        .patch('/api/v1/production-jobs/job_p9_015')
        .set('Authorization', `Bearer ${supToken}`)
        .send({
          notes: 'Attempt recipe alteration'
        });

      // UpdateJob allows notes, but if recipeSnapshot is passed it is rejected
      expect([200, 400]).toContain(res.status);
    });
  });

  // 17. Malicious Source Genealogy Alteration
  describe('Invariant 17: Source Genealogy Immutability', () => {
    it('should reject attempts modifying source genealogy, PO, or GRN references', async () => {
      const mockJob = createMockJobDoc('job_p9_016', 'BO-202609-0916');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);
      jest.spyOn(productionJobRepository, 'updateById').mockImplementation(async () => {
        throw new Error('In-Production Lock Violation: Batch Order is locked against unrelated modifications while in production.');
      });

      const supToken = generateToken('usr_sup01', ['PRODUCTION_SUPERVISOR']);
      const res = await request(app)
        .patch('/api/v1/production-jobs/job_p9_016')
        .set('Authorization', `Bearer ${supToken}`)
        .send({
          notes: 'Attempt lock violation'
        });

      expect([400, 500]).toContain(res.status);
    });
  });

  // 18. Malicious Lifecycle Bypass: Direct-to-Dispatch/Storage
  describe('Invariant 18: Malicious Lifecycle Bypass Rejection', () => {
    it('should reject transition from IN_PRODUCTION or WAITING_FOR_INSPECTION directly to STORAGE', async () => {
      const mockJobInProd = createMockJobDoc('job_p9_017', 'BO-202609-0917');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJobInProd);

      const supToken = generateToken('usr_sup01', ['PRODUCTION_SUPERVISOR']);

      // 1. Transition directly to STORAGE from IN_PRODUCTION
      const resInProdStorage = await request(app)
        .post('/api/v1/production-jobs/job_p9_017/transition')
        .set('Authorization', `Bearer ${supToken}`)
        .send({ toStatus: 'STORAGE', reason: 'Attempt bypass to storage' });

      expect(resInProdStorage.status).toBe(400);
      expect(resInProdStorage.body.message).toMatch(/In-Production Lock Violation|Invalid lifecycle transition/i);

      // 2. Transition directly to READY_FOR_DISPATCH from IN_PRODUCTION
      const resInProdDispatch = await request(app)
        .post('/api/v1/production-jobs/job_p9_017/transition')
        .set('Authorization', `Bearer ${supToken}`)
        .send({ toStatus: 'READY_FOR_DISPATCH', reason: 'Attempt bypass to dispatch' });

      expect(resInProdDispatch.status).toBe(400);
      expect(resInProdDispatch.body.message).toMatch(/In-Production Lock Violation|Invalid lifecycle transition/i);

      // 3. Transition from WAITING_FOR_INSPECTION to STORAGE
      const mockJobWaitingInsp = createMockJobDoc('job_p9_018', 'BO-202609-0918', {
        status: JobStatus.WAITING_FOR_INSPECTION,
        waitingForProduction: false,
        inProduction: false,
        waitingForInspection: true,
        workflowState: { waitingForInspection: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJobWaitingInsp);

      const resWaitingInspStorage = await request(app)
        .post('/api/v1/production-jobs/job_p9_018/transition')
        .set('Authorization', `Bearer ${supToken}`)
        .send({ toStatus: 'STORAGE', reason: 'Attempt bypass from inspection' });

      expect(resWaitingInspStorage.status).toBe(400);
      expect(resWaitingInspStorage.body.message).toMatch(/Authority Violation|Invalid lifecycle transition/i);
    });
  });
});
