import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { JobStatus } from '../src/core/constants/status.js';
import { eventBus } from '../src/core/events/domain-event-bus.js';
import { DomainEvents } from '../src/core/constants/events.js';

describe('Inspection Phase Prompt 3: Inspection Lock, Exclusive Ownership, and Protection Invariants', () => {
  jest.setTimeout(30000);
  const app = createApp();
  const testTenant = 'tenant_heat_treat_lock_003';

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const createMockJobDocument = (overrides: any = {}) => {
    const doc: any = {
      _id: overrides._id || 'bo_lock_001',
      id: overrides.id || overrides._id || 'bo_lock_001',
      jobNumber: overrides.jobNumber || 'BO-202609-0903',
      boNumber: overrides.boNumber || overrides.jobNumber || 'BO-202609-0903',
      tenantId: testTenant,
      status: overrides.status || JobStatus.WAITING_FOR_INSPECTION,
      priority: 'HIGH',

      // Workflow Flags
      waitingForProduction: overrides.waitingForProduction ?? false,
      inProduction: overrides.inProduction ?? false,
      waitingForInspection: overrides.waitingForInspection ?? true,
      inInspection: overrides.inInspection ?? false,
      waitingForDispatch: overrides.waitingForDispatch ?? false,
      dispatched: overrides.dispatched ?? false,
      inspection: overrides.inspection ?? false,

      workflowState: {
        waitingForProduction: overrides.workflowState?.waitingForProduction ?? (overrides.waitingForProduction ?? false),
        inProduction: overrides.workflowState?.inProduction ?? (overrides.inProduction ?? false),
        waitingForInspection: overrides.workflowState?.waitingForInspection ?? (overrides.waitingForInspection ?? true),
        inInspection: overrides.workflowState?.inInspection ?? (overrides.inInspection ?? false),
        waitingForDispatch: overrides.workflowState?.waitingForDispatch ?? (overrides.waitingForDispatch ?? false),
        dispatched: overrides.workflowState?.dispatched ?? (overrides.dispatched ?? false),
        inspection: overrides.workflowState?.inspection ?? (overrides.inspection ?? false)
      },

      claimedBy: overrides.claimedBy ?? null,
      claimedAt: overrides.claimedAt ?? null,
      claimedByEmail: overrides.claimedByEmail ?? null,
      claimedByRole: overrides.claimedByRole ?? null,

      customer: {
        customerId: 'cust_ats_01',
        customerCode: 'CUST-ATS-01',
        customerName: 'Aero Turbine Systems'
      },

      item: {
        itemId: 'item_gear_01',
        itemCode: 'PART-GEAR-PINION',
        itemName: 'Pinion Gear Heat Treated',
        materialGrade: 'EN36B Alloy Steel',
        drawingNumber: 'DRW-ATS-9912-A',
        uom: 'PCS'
      },

      quantity: {
        targetQuantity: 100,
        loadedQuantity: 100,
        completedQuantity: 98,
        scrappedQuantity: 2
      },

      weightKg: 85,

      recipeSnapshot: {
        recipeId: 'rec_carb_en36b',
        recipeCode: 'REC-CARB-EN36B',
        recipeName: 'Gas Carburizing & Oil Quench',
        name: 'Gas Carburizing & Oil Quench',
        revision: 2,
        recipeRevision: 2,
        processFamily: 'CASE_HARDENING',
        stages: [
          { sequence: 1, stageName: 'Pre-Heat', targetTemperatureC: 750, soakTimeMinutes: 60 },
          { sequence: 2, stageName: 'Carburizing Soak', targetTemperatureC: 930, soakTimeMinutes: 240 },
          { sequence: 3, stageName: 'Diffusion', targetTemperatureC: 850, soakTimeMinutes: 90 },
          { sequence: 4, stageName: 'Oil Quench', targetTemperatureC: 60, soakTimeMinutes: 30 }
        ]
      },

      execution: {
        furnaceCharge: {
          furnaceId: 'furnace_carb_01',
          furnaceCode: 'FURNACE-CARB-01',
          loadedWeightKg: 85,
          chargeNumber: 'CHG-2026-0903',
          loadedAt: new Date('2026-09-09T08:30:00.000Z')
        },
        stageProgress: [
          { sequence: 1, stageName: 'Pre-Heat', status: 'COMPLETED' },
          { sequence: 2, stageName: 'Carburizing Soak', status: 'COMPLETED' },
          { sequence: 3, stageName: 'Diffusion', status: 'COMPLETED' },
          { sequence: 4, stageName: 'Oil Quench', status: 'COMPLETED' }
        ],
        inspectionData: overrides.execution?.inspectionData || {}
      },

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
    jest.spyOn(eventBus, 'publish').mockReturnValue(true as any);
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

  describe('1. Atomic Transition & Single-Flag Exclusivity Invariant', () => {
    it('atomically transitions waitingForInspection -> inInspection with sum(flags) == 1 and sets exclusive claimedBy metadata', async () => {
      const inspectorToken = generateToken('inspector_alice', ['QC_INSPECTOR']);
      const initialJob = createMockJobDocument({
        status: JobStatus.WAITING_FOR_INSPECTION,
        waitingForInspection: true,
        inInspection: false,
        claimedBy: null
      });

      const claimedJob = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        waitingForProduction: false,
        inProduction: false,
        waitingForInspection: false,
        inInspection: true,
        waitingForDispatch: false,
        dispatched: false,
        inspection: false,
        workflowState: {
          waitingForProduction: false,
          inProduction: false,
          waitingForInspection: false,
          inInspection: true,
          waitingForDispatch: false,
          dispatched: false,
          inspection: false
        },
        claimedBy: 'inspector_alice',
        claimedAt: new Date(),
        claimedByEmail: 'inspector_alice@factory.com',
        claimedByRole: 'QC_INSPECTOR',
        execution: {
          inspectionData: {
            inspectorId: 'inspector_alice',
            inspectorName: 'inspector_alice@factory.com',
            inspectedBy: {
              userId: 'inspector_alice',
              email: 'inspector_alice@factory.com',
              role: 'QC_INSPECTOR'
            },
            disposition: 'PENDING'
          }
        }
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValueOnce(initialJob);
      jest.spyOn(productionJobRepository, 'atomicTakeForInspection').mockResolvedValueOnce(claimedJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_lock_001/take-for-inspection')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({ notes: 'Alice claiming BO at Station 1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(JobStatus.IN_INSPECTION);
      expect(res.body.data.waitingForInspection).toBe(false);
      expect(res.body.data.inInspection).toBe(true);
      expect(res.body.data.claimedBy).toBe('inspector_alice');

      // Exact single active flag invariant: sum(flags) == 1
      const flags = [
        res.body.data.waitingForProduction,
        res.body.data.inProduction,
        res.body.data.waitingForInspection,
        res.body.data.inInspection,
        res.body.data.waitingForDispatch,
        res.body.data.dispatched,
        res.body.data.inspection
      ];
      expect(flags.filter(Boolean).length).toBe(1);

      // Audit and Domain Event verification
      expect(auditService.record).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          action: 'INSPECTION_STARTED',
          actorId: 'inspector_alice'
        })
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          name: DomainEvents.JOB_INSPECTION_STARTED,
          actorId: 'inspector_alice'
        })
      );
    });
  });

  describe('2. Exclusive Inspection Ownership & Single-Winner Concurrency', () => {
    it('simultaneous claims: first inspector succeeds, second inspector receives 409 Conflict', async () => {
      const aliceToken = generateToken('inspector_alice', ['QC_INSPECTOR']);
      const bobToken = generateToken('inspector_bob', ['QC_INSPECTOR']);

      const waitingJob = createMockJobDocument({
        status: JobStatus.WAITING_FOR_INSPECTION,
        waitingForInspection: true,
        inInspection: false,
        claimedBy: null
      });

      const claimedJob = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        waitingForInspection: false,
        inInspection: true,
        claimedBy: 'inspector_alice'
      });

      // Alice's findById sees waitingJob, Bob's findById sees already claimed job
      jest.spyOn(productionJobRepository, 'findById')
        .mockResolvedValueOnce(waitingJob)
        .mockResolvedValueOnce(claimedJob);

      jest.spyOn(productionJobRepository, 'atomicTakeForInspection').mockResolvedValueOnce(claimedJob);

      // Alice takes
      const resAlice = await request(app)
        .post('/api/v1/production-jobs/bo_lock_001/take-for-inspection')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ notes: 'Alice take' });

      expect(resAlice.status).toBe(200);
      expect(resAlice.body.data.inInspection).toBe(true);

      // Bob concurrent take
      const resBob = await request(app)
        .post('/api/v1/production-jobs/bo_lock_001/take-for-inspection')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ notes: 'Bob simultaneous take' });

      expect(resBob.status).toBe(409);
      expect(resBob.body.success).toBe(false);
      expect(resBob.body.message).toMatch(/conflict|already in inspection/i);
    });

    it('returns 409 Conflict if atomic database update fails due to race condition (returns null)', async () => {
      const inspectorToken = generateToken('inspector_alice', ['QC_INSPECTOR']);
      const initialJob = createMockJobDocument({
        status: JobStatus.WAITING_FOR_INSPECTION,
        waitingForInspection: true,
        inInspection: false,
        claimedBy: null
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValueOnce(initialJob);
      // Simulating atomic update race condition where another node updated it in microsecond between find and update
      jest.spyOn(productionJobRepository, 'atomicTakeForInspection').mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_lock_001/take-for-inspection')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({ notes: 'Contended claim' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already claimed by another inspector/i);
    });

    it('denies competitor inspector from modifying an active inspection session with 403 Forbidden', async () => {
      const bobToken = generateToken('inspector_bob', ['QC_INSPECTOR']);

      // BO claimed exclusively by Alice
      const aliceClaimedJob = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        waitingForInspection: false,
        inInspection: true,
        claimedBy: 'inspector_alice',
        claimedByEmail: 'inspector_alice@factory.com'
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(aliceClaimedJob);

      // Bob tries to record inspection data
      const resRecord = await request(app)
        .post('/api/v1/production-jobs/bo_lock_001/inspection-data')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          sampleSize: 5,
          passedPieces: 5,
          failedPieces: 0,
          readings: [{ location: 'SURFACE', observedValue: 60, unit: 'HRC' }]
        });

      expect(resRecord.status).toBe(403);
      expect(resRecord.body.message).toMatch(/Inspection Ownership Violation.*exclusively claimed/i);

      // Bob tries to approve inspection
      const resApprove = await request(app)
        .post('/api/v1/production-jobs/bo_lock_001/approve-inspection')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ approvedQuantity: 98, scrappedQuantity: 2 });

      expect(resApprove.status).toBe(403);
      expect(resApprove.body.message).toMatch(/Inspection Ownership Violation.*exclusively claimed/i);

      // Bob tries to fail inspection
      const resFail = await request(app)
        .post('/api/v1/production-jobs/bo_lock_001/fail-inspection')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ defectCategory: 'HARDNESS_LOW', defectReason: 'Sub-spec surface hardness' });

      expect(resFail.status).toBe(403);
      expect(resFail.body.message).toMatch(/Inspection Ownership Violation.*exclusively claimed/i);
    });

    it('allows Quality Lead or Admin to override/proceed with inspection session', async () => {
      const leadToken = generateToken('lead_charlie', ['METALLURGIST']);

      const aliceClaimedJob = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        waitingForInspection: false,
        inInspection: true,
        claimedBy: 'inspector_alice',
        claimedByEmail: 'inspector_alice@factory.com'
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(aliceClaimedJob);
      jest.spyOn(productionJobRepository, 'updateById').mockResolvedValue(aliceClaimedJob);

      // Quality Lead records inspection data
      const resRecord = await request(app)
        .post('/api/v1/production-jobs/bo_lock_001/inspection-data')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${leadToken}`)
        .send({
          sampleSize: 5,
          passedPieces: 5,
          failedPieces: 0,
          readings: [{ location: 'SURFACE', observedValue: 60, unit: 'HRC' }]
        });

      expect(resRecord.status).toBe(200);
      expect(resRecord.body.success).toBe(true);
    });
  });

  describe('3. Lock Behavior: Excluded from Waiting Queue and Lockout of Other Operations', () => {
    it('excludes BO in inspection from the waiting-for-inspection queue', async () => {
      const inspectorToken = generateToken('inspector_alice', ['QC_INSPECTOR']);

      // Mocking repo behavior: findWaitingForInspectionQueue only returns jobs with waitingForInspection=true and status != IN_INSPECTION
      jest.spyOn(productionJobRepository, 'findWaitingForInspectionQueue').mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/v1/production-jobs/queue/waiting-for-inspection')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${inspectorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('rejects taking the BO for production with 400 Bad Request while in inspection', async () => {
      const operatorToken = generateToken('op_user_01', ['FURNACE_OPERATOR']);
      const inInspectionJob = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        waitingForInspection: false,
        inInspection: true,
        claimedBy: 'inspector_alice'
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValueOnce(inInspectionJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_lock_001/take-for-production')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Inspection Lock Violation.*cannot be taken (into|for) production/i);
    });

    it('rejects recording recipe stage progress or furnace charge with 400 Bad Request while in inspection', async () => {
      const operatorToken = generateToken('op_user_01', ['FURNACE_OPERATOR']);
      const inInspectionJob = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        waitingForInspection: false,
        inInspection: true,
        claimedBy: 'inspector_alice'
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(inInspectionJob);

      // Attempt recipe stage progress
      const resStage = await request(app)
        .post('/api/v1/production-jobs/bo_lock_001/recipe-stage-progress')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ stageSequence: 1, actualTemperatureC: 750, actualDurationMinutes: 60 });

      expect(resStage.status).toBe(400);
      expect(resStage.body.message).toMatch(/Post-Production Lock Violation.*Quality Inspection/i);

      // Attempt furnace charge
      const resCharge = await request(app)
        .post('/api/v1/production-jobs/bo_lock_001/furnace-charge')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          furnaceId: 'furnace_carb_01',
          chargeNumber: 'CHG-999',
          loadedWeightKg: 80,
          loadedPieceCount: 100,
          initialFurnaceTempC: 750
        });

      expect(resCharge.status).toBe(400);
      expect(resCharge.body.message).toMatch(/Post-Production Lock Violation.*Quality Inspection/i);
    });

    it('rejects planning operations (updateJob, updateProcessDetails, assign/remove operator/furnace, cancel) with 400 Bad Request', async () => {
      const plannerToken = generateToken('planner_dan', ['PRODUCTION_PLANNER', 'ADMIN']);
      const inInspectionJob = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        waitingForInspection: false,
        inInspection: true,
        claimedBy: 'inspector_alice'
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(inInspectionJob);

      // 1. Generic updateJob
      const resUpdate = await request(app)
        .patch('/api/v1/production-jobs/bo_lock_001')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ priority: 'URGENT' });

      expect(resUpdate.status).toBe(400);
      expect(resUpdate.body.message).toMatch(/Inspection Lock Violation/i);

      // 2. updateProcessDetails
      const resProcess = await request(app)
        .put('/api/v1/production-jobs/bo_lock_001/process-details')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ rows: [{ position: 1, process: 'Carburizing', status: 'BLANK' }] });

      expect(resProcess.status).toBe(400);
      expect(resProcess.body.message).toMatch(/Inspection Lock Violation/i);

      // 3. assign-operator
      const resAssignOp = await request(app)
        .post('/api/v1/production-jobs/bo_lock_001/assign-operator')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ operatorId: 'op_new_01' });

      expect(resAssignOp.status).toBe(400);
      expect(resAssignOp.body.message).toMatch(/(Inspection Lock Violation|Post-Production Lock Violation)/i);

      // 4. remove-operator
      const resRemoveOp = await request(app)
        .post('/api/v1/production-jobs/bo_lock_001/remove-operator')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ reason: 'Reallocation requested' });

      expect(resRemoveOp.status).toBe(400);
      expect(resRemoveOp.body.message).toMatch(/(Inspection Lock Violation|Post-Production Lock Violation)/i);

      // 5. assign-furnace
      const resAssignFurnace = await request(app)
        .post('/api/v1/production-jobs/bo_lock_001/assign-furnace')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ furnaceId: 'furnace_carb_02' });

      expect(resAssignFurnace.status).toBe(400);
      expect(resAssignFurnace.body.message).toMatch(/(Inspection Lock Violation|Post-Production Lock Violation)/i);

      // 6. remove-furnace
      const resRemoveFurnace = await request(app)
        .post('/api/v1/production-jobs/bo_lock_001/remove-furnace')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ reason: 'Reallocation requested' });

      expect(resRemoveFurnace.status).toBe(400);
      expect(resRemoveFurnace.body.message).toMatch(/(Inspection Lock Violation|Post-Production Lock Violation)/i);

      // 7. cancelJob
      const resCancel = await request(app)
        .post('/api/v1/production-jobs/bo_lock_001/cancel')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ reason: 'Cancellation attempt during QA' });

      expect(resCancel.status).toBe(400);
      expect(resCancel.body.message).toMatch(/(Inspection Lock Violation|Post-Production Lock Violation)/i);
    });

    it('rejects generic status transitions (e.g. to WAITING_FOR_DISPATCH or DISPATCHED) with 400 Bad Request', async () => {
      const coordinatorToken = generateToken('coord_frank', ['DISPATCH_COORDINATOR', 'ADMIN']);
      const inInspectionJob = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        waitingForInspection: false,
        inInspection: true,
        claimedBy: 'inspector_alice'
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValueOnce(inInspectionJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_lock_001/transition')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ toStatus: 'WAITING_FOR_DISPATCH', reason: 'Attempt bypass of quality inspection' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Inspection Lock Violation.*(Quality Inspection|approve-inspection)/i);
    });
  });

  describe('4. Recipe & Production Data Protection Invariants', () => {
    it('rejects inspection payload attempting to alter recipeSnapshot or substitute recipe with 400 Bad Request', async () => {
      const aliceToken = generateToken('inspector_alice', ['QC_INSPECTOR']);
      const inInspectionJob = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        waitingForInspection: false,
        inInspection: true,
        claimedBy: 'inspector_alice'
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValueOnce(inInspectionJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_lock_001/inspection-data')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          sampleSize: 5,
          passedPieces: 5,
          recipeId: 'rec_altered_002',
          recipeCode: 'REC-SUBSTITUTE'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Recipe Protection Violation.*immutable/i);
    });

    it('rejects inspection payload attempting to rewrite production telemetry, piece counts, or charge actuals with 400 Bad Request', async () => {
      const aliceToken = generateToken('inspector_alice', ['QC_INSPECTOR']);
      const inInspectionJob = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        waitingForInspection: false,
        inInspection: true,
        claimedBy: 'inspector_alice'
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValueOnce(inInspectionJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_lock_001/inspection-data')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          sampleSize: 5,
          passedPieces: 5,
          loadedPieces: 120, // attempted rewrite of production loadedPieces
          actualTemperatureC: 950 // attempted rewrite of telemetry
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Production Data Protection Violation.*Historical production telemetry/i);
    });
  });

  describe('5. Inspection Editing & Read-Only Viewing Permitted', () => {
    it('allows claimed inspector to record valid heat-treatment inspection data', async () => {
      const aliceToken = generateToken('inspector_alice', ['QC_INSPECTOR']);
      const inInspectionJob = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        waitingForInspection: false,
        inInspection: true,
        claimedBy: 'inspector_alice'
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(inInspectionJob);
      jest.spyOn(productionJobRepository, 'updateById').mockResolvedValue(inInspectionJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_lock_001/inspection-data')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          sampleSize: 5,
          passedPieces: 5,
          failedPieces: 0,
          furnaceId: 'furnace_carb_01',
          furnaceCode: 'FURNACE-CARB-01',
          minHardness: 58,
          maxHardness: 62,
          scale: 'HRC',
          caseDepthMinMm: 0.8,
          caseDepthMaxMm: 1.2,
          readings: [
            { location: 'SURFACE', observedValue: 60, unit: 'HRC' },
            { location: 'SURFACE', observedValue: 59, unit: 'HRC' }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('allows read-only viewing of the locked Batch Order via GET endpoint', async () => {
      const anyUserToken = generateToken('viewer_user', ['QC_INSPECTOR']);
      const inInspectionJob = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        waitingForInspection: false,
        inInspection: true,
        claimedBy: 'inspector_alice'
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValueOnce(inInspectionJob);

      const res = await request(app)
        .get('/api/v1/production-jobs/bo_lock_001')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${anyUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.boNumber).toBe('BO-202609-0903');
      expect(res.body.data.inInspection).toBe(true);
      expect(res.body.data.claimedBy).toBe('inspector_alice');
    });
  });
});
