import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { JobStatus } from '../src/core/constants/status.js';

describe('Inspection Phase Prompt 2: Inspection Queue, Authorization, Authoritative Payload & Concurrency Control', () => {
  jest.setTimeout(30000);
  const app = createApp();
  const testTenant = 'tenant_heat_treat_qa_002';

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const createMockJobDocument = (overrides: any = {}) => {
    const doc: any = {
      _id: overrides._id || 'bo_queue_001',
      id: overrides.id || overrides._id || 'bo_queue_001',
      jobNumber: overrides.jobNumber || 'BO-202609-0901',
      boNumber: overrides.boNumber || overrides.jobNumber || 'BO-202609-0901',
      tenantId: testTenant,
      status: JobStatus.WAITING_FOR_INSPECTION,
      priority: 'HIGH',

      // Authoritative Flags: waitingForInspection = true
      waitingForProduction: false,
      inProduction: false,
      waitingForInspection: true,
      inInspection: false,
      waitingForDispatch: false,
      dispatched: false,
      inspection: false,

      workflowState: {
        waitingForProduction: false,
        inProduction: false,
        waitingForInspection: true,
        inInspection: false,
        waitingForDispatch: false,
        dispatched: false,
        inspection: false
      },

      genealogy: {
        poId: 'po_ht_901',
        poNumber: 'PO-2026-0901',
        customerName: 'Aero Turbine Systems',
        customerCode: 'CUST-ATS-01',
        grnId: 'grn_ht_901',
        grnNumber: 'GRN-2026-0901',
        heatLotNumber: 'HEAT-9944-B',
        rawMaterialReceivedDate: new Date('2026-09-05T10:00:00.000Z'),
        supplierName: 'Titanium & Alloy Mills Ltd'
      },

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
        targetQuantity: 150,
        loadedQuantity: 150,
        completedQuantity: 148,
        scrappedQuantity: 2
      },

      weightKg: 120,

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
          { sequence: 4, stageName: 'Oil Quench', targetTemperatureC: 60, soakTimeMinutes: 30 },
          { sequence: 5, stageName: 'Tempering', targetTemperatureC: 180, soakTimeMinutes: 120 }
        ]
      },

      equipmentAssignment: {
        furnaceCode: 'FURNACE-CARB-02',
        furnaceId: 'furnace_carb_02',
        locationBay: 'Bay 2 Gas Atmosphere'
      },

      timeline: {
        plannedStartDate: new Date('2026-09-09T08:00:00.000Z'),
        dueDate: new Date('2026-09-12T18:00:00.000Z'),
        targetCompletionDate: new Date('2026-09-12T18:00:00.000Z'),
        actualEndDate: new Date('2026-09-10T04:30:00.000Z')
      },

      execution: {
        furnaceCharge: {
          furnaceId: 'furnace_carb_02',
          furnaceCode: 'FURNACE-CARB-02',
          loadedWeightKg: 120,
          chargeNumber: 'CHG-2026-0901',
          loadedAt: new Date('2026-09-09T08:30:00.000Z')
        },
        operatorAssignment: {
          operatorId: 'op_user_01',
          operatorName: 'Michael Miller',
          shiftId: 'SHIFT-MORNING-A'
        },
        recipeExecution: {
          stagesCompleted: [1, 2, 3, 4, 5],
          deviations: [],
          concessionApproved: false
        },
        qualityHandoff: {
          completedQuantity: 148,
          scrappedQuantity: 2,
          handoffNotes: 'Completed cycle without alarms. Handed off to QA.'
        },
        inspectionData: {}
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

  describe('1. Server-Side Authorization Enforcement', () => {
    it('allows an authorized QA Inspector with QUALITY_INSPECTION_VIEW to query the inspection queue', async () => {
      const inspectorToken = generateToken('qa_inspector_01', ['QC_INSPECTOR']);
      const mockJob = createMockJobDocument();

      jest.spyOn(productionJobRepository, 'findWaitingForInspectionQueue').mockResolvedValueOnce([mockJob]);

      const res = await request(app)
        .get('/api/v1/production-jobs/queue/waiting-for-inspection')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${inspectorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].boNumber).toBe('BO-202609-0901');
    });

    it('strictly denies unauthorized users without inspection permissions with 403 Forbidden', async () => {
      // DISPATCH_COORDINATOR lacks QUALITY_INSPECTION_VIEW, QUALITY_INSPECTION_RECORD, QUALITY_INSPECTION_VERIFY
      const unauthorizedToken = generateToken('usr_dispatch', ['DISPATCH_COORDINATOR']);

      const res = await request(app)
        .get('/api/v1/production-jobs/queue/waiting-for-inspection')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${unauthorizedToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Access Denied|Requires at least one/i);
    });

    it('strictly denies unauthorized direct API access to take-for-inspection with 403 Forbidden', async () => {
      const unauthorizedToken = generateToken('usr_dispatch', ['DISPATCH_COORDINATOR']);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_queue_001/take-for-inspection')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .send({ notes: 'Attempted intake by unauthorized user' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('2. Dedicated Inspection Queue & Authoritative 9-Dimension Payload', () => {
    it('returns an empty array when no Batch Orders are waiting for inspection', async () => {
      const inspectorToken = generateToken('qa_inspector_01', ['QC_INSPECTOR']);

      jest.spyOn(productionJobRepository, 'findWaitingForInspectionQueue').mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/v1/production-jobs/queue/waiting-for-inspection')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${inspectorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
      expect(res.body.data.length).toBe(0);
    });

    it('returns multiple waiting BOs with all 9 authoritative dimensions without master data duplication', async () => {
      const inspectorToken = generateToken('qa_inspector_01', ['QC_INSPECTOR']);

      const job1 = createMockJobDocument({
        _id: 'bo_queue_001',
        jobNumber: 'BO-202609-0901',
        boNumber: 'BO-202609-0901'
      });
      const job2 = createMockJobDocument({
        _id: 'bo_queue_002',
        jobNumber: 'BO-202609-0902',
        boNumber: 'BO-202609-0902',
        priority: 'URGENT',
        quantity: { targetQuantity: 50, loadedQuantity: 50, completedQuantity: 50, scrappedQuantity: 0 },
        weightKg: 42
      });

      jest.spyOn(productionJobRepository, 'findWaitingForInspectionQueue').mockResolvedValueOnce([job1, job2]);

      const res = await request(app)
        .get('/api/v1/production-jobs/queue/waiting-for-inspection')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${inspectorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);

      const record = res.body.data[0];

      // Dimension 1: BO Identity
      expect(record.boNumber).toBe('BO-202609-0901');
      expect(record.jobNumber).toBe('BO-202609-0901');
      expect(record.priority).toBe('HIGH');
      expect(record.status).toBe(JobStatus.WAITING_FOR_INSPECTION);

      // Dimension 2: PO Lineage
      expect(record.poNumber).toBe('PO-2026-0901');
      expect(record.customerName).toBe('Aero Turbine Systems');

      // Dimension 3: GRN Lineage
      expect(record.grnNumber).toBe('GRN-2026-0901');
      expect(record.heatLotNumber).toBe('HEAT-9944-B');

      // Dimension 4: Part Specifications
      expect(record.itemCode).toBe('PART-GEAR-PINION');
      expect(record.itemName).toBe('Pinion Gear Heat Treated');
      expect(record.materialGrade).toBe('EN36B Alloy Steel');
      expect(record.drawingNumber).toBe('DRW-ATS-9912-A');
      expect(record.uom).toBe('PCS');

      // Dimension 5: Recipe Specifications & Protected Status
      expect(record.recipeCode).toBe('REC-CARB-EN36B');
      expect(record.recipeName).toBe('Gas Carburizing & Oil Quench');
      expect(record.recipeRevision).toBe(2);
      expect(record.processFamily).toBe('CASE_HARDENING');
      expect(record.recipeStagesCount).toBe(5);
      expect(record.isMasterRecipeProtected).toBe(true);

      // Dimension 6: Quantities
      expect(record.loadedQuantity).toBe(150);
      expect(record.completedQuantity).toBe(148);
      expect(record.scrappedQuantity).toBe(2);

      // Dimension 7: Weight
      expect(record.weightKg).toBe(120);

      // Dimension 8: Timeline / Due Date
      expect(record.dueDate).toBeDefined();

      // Dimension 9: Production Completion & Locked Telemetry
      expect(record.assignedFurnaceCode).toBe('FURNACE-CARB-02');
      expect(record.assignedOperatorName).toBe('Michael Miller');
      expect(record.shiftId).toBe('SHIFT-MORNING-A');
      expect(record.chargeNumber).toBe('CHG-2026-0901');
      expect(record.stagesCompletedCount).toBe(5);
      expect(record.productionCompleted).toBe(true);
      expect(record.isProductionDataLocked).toBe(true);
    });
  });

  describe('3. Strict Backend State Filtering & Incompatible State Exclusion', () => {
    it('verifies that findWaitingForInspectionQueue strictly excludes inProduction, inInspection, waitingForDispatch, dispatched, and inspection (quarantine)', async () => {
      // Test repository query filter directly to prove backend enforcement
      const mockFind = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([])
        })
      });
      const originalModel = (productionJobRepository as any).model;
      (productionJobRepository as any).model = { find: mockFind };

      await productionJobRepository.findWaitingForInspectionQueue(testTenant);

      expect(mockFind).toHaveBeenCalled();
      const query = mockFind.mock.calls[0][0];

      // Must require waitingForInspection = true
      expect(query).toEqual(
        expect.objectContaining({
          tenantId: testTenant,
          isDeleted: false
        })
      );

      // Verify strict exclusion of other lifecycle phases
      expect(query['$and']).toBeDefined();
      const hasWaitingCondition = query['$and'].some((c: any) =>
        c['$or']?.some((orC: any) => orC['workflowState.waitingForInspection'] === true || orC.waitingForInspection === true)
      );
      expect(hasWaitingCondition).toBe(true);

      // Verify strict exclusion of other lifecycle phases
      expect(query['workflowState.inInspection']).toEqual({ $ne: true });
      expect(query['inInspection']).toEqual({ $ne: true });
      expect(query['workflowState.waitingForDispatch']).toEqual({ $ne: true });
      expect(query['waitingForDispatch']).toEqual({ $ne: true });
      expect(query['workflowState.dispatched']).toEqual({ $ne: true });
      expect(query['dispatched']).toEqual({ $ne: true });
      expect(query['workflowState.inspection']).toEqual({ $ne: true });
      expect(query['workflowState.inProduction']).toEqual({ $ne: true });
      expect(query['inProduction']).toEqual({ $ne: true });
      expect(query.status['$nin']).toEqual(
        expect.arrayContaining([
          'IN_PRODUCTION',
          'IN_INSPECTION',
          'WAITING_FOR_DISPATCH',
          'DISPATCHED',
          'COMPLETED',
          'CANCELLED',
          'INSPECTION'
        ])
      );

      (productionJobRepository as any).model = originalModel;
    });
  });

  describe('4. Recipe Immutability: Governed by Pinned Recipe Revision', () => {
    it('provides the pinned recipe and revision in the queue payload and maintains master protection', async () => {
      const inspectorToken = generateToken('qa_inspector_01', ['QC_INSPECTOR']);
      const job = createMockJobDocument({
        recipeSnapshot: {
          recipeId: 'rec_pinned_001',
          recipeCode: 'REC-NITRIDING-REV3',
          recipeName: 'Plasma Ion Nitriding',
          name: 'Plasma Ion Nitriding',
          revision: 3,
          recipeRevision: 3,
          processFamily: 'NITRIDING',
          stages: [
            { sequence: 1, stageName: 'Sputter Clean', targetTemperatureC: 480, soakTimeMinutes: 60 },
            { sequence: 2, stageName: 'Nitriding Dwell', targetTemperatureC: 520, soakTimeMinutes: 360 }
          ]
        }
      });

      jest.spyOn(productionJobRepository, 'findWaitingForInspectionQueue').mockResolvedValueOnce([job]);

      const res = await request(app)
        .get('/api/v1/production-jobs/queue/waiting-for-inspection')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${inspectorToken}`);

      expect(res.status).toBe(200);
      const bo = res.body.data[0];
      expect(bo.recipeCode).toBe('REC-NITRIDING-REV3');
      expect(bo.recipeRevision).toBe(3);
      expect(bo.isMasterRecipeProtected).toBe(true);
      expect(bo.recipeStages.length).toBe(2);
    });
  });

  describe('5. Atomic Transition: waitingForInspection → inInspection', () => {
    it('atomically claims a waiting BO for inspection, verifying exact single-flag invariant', async () => {
      const inspectorToken = generateToken('qa_inspector_01', ['QC_INSPECTOR']);
      const initialJob = createMockJobDocument();

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
        }
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValueOnce(initialJob);
      jest.spyOn(productionJobRepository, 'atomicTakeForInspection').mockResolvedValueOnce(claimedJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_queue_001/take-for-inspection')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({ notes: 'Inspector claim at QA Station 1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(JobStatus.IN_INSPECTION);
      expect(res.body.data.waitingForInspection).toBe(false);
      expect(res.body.data.inInspection).toBe(true);

      // Single-flag invariant: sum(flags) == 1
      const flags = [
        res.body.data.waitingForProduction,
        res.body.data.inProduction,
        res.body.data.waitingForInspection,
        res.body.data.inInspection,
        res.body.data.waitingForDispatch,
        res.body.data.dispatched,
        res.body.data.inspection
      ];
      const activeFlagCount = flags.filter(Boolean).length;
      expect(activeFlagCount).toBe(1);
    });
  });

  describe('6. Concurrency Control: Simultaneous Claims on the Same BO', () => {
    it('ensures only one inspector succeeds and the second receives 409 Conflict', async () => {
      const inspector1Token = generateToken('qa_inspector_01', ['QC_INSPECTOR']);
      const inspector2Token = generateToken('qa_inspector_02', ['QC_INSPECTOR']);

      const initialJob = createMockJobDocument();
      const claimedJob = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        waitingForInspection: false,
        inInspection: true
      });

      // Inspector 1: finds waiting BO and atomically claims it successfully
      jest.spyOn(productionJobRepository, 'findById')
        .mockResolvedValueOnce(initialJob) // for Inspector 1
        .mockResolvedValueOnce(claimedJob); // for Inspector 2 (already claimed)

      jest.spyOn(productionJobRepository, 'atomicTakeForInspection')
        .mockResolvedValueOnce(claimedJob);

      // Call Inspector 1
      const res1 = await request(app)
        .post('/api/v1/production-jobs/bo_queue_001/take-for-inspection')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${inspector1Token}`)
        .send({ notes: 'Inspector 1 taking BO' });

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.data.inInspection).toBe(true);

      // Call Inspector 2 attempting to take the same BO concurrently
      const res2 = await request(app)
        .post('/api/v1/production-jobs/bo_queue_001/take-for-inspection')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${inspector2Token}`)
        .send({ notes: 'Inspector 2 simultaneous take attempt' });

      // Inspector 2 must receive a 409 Conflict
      expect(res2.status).toBe(409);
      expect(res2.body.success).toBe(false);
      expect(res2.body.message).toMatch(/conflict|already in inspection/i);
    });

    it('rejects taking a BO that is already in inspection with 409 Conflict', async () => {
      const inspectorToken = generateToken('qa_inspector_01', ['QC_INSPECTOR']);
      const alreadyInInspectionJob = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        waitingForInspection: false,
        inInspection: true
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValueOnce(alreadyInInspectionJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_queue_001/take-for-inspection')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({ notes: 'Taking already claimed BO' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already in inspection/i);
    });

    it('rejects taking a completed, dispatched, or quarantined BO with 400 Bad Request', async () => {
      const inspectorToken = generateToken('qa_inspector_01', ['QC_INSPECTOR']);

      // Dispatched BO
      const dispatchedJob = createMockJobDocument({
        status: JobStatus.DISPATCHED,
        waitingForInspection: false,
        dispatched: true
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValueOnce(dispatchedJob);

      const res1 = await request(app)
        .post('/api/v1/production-jobs/bo_queue_001/take-for-inspection')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({ notes: 'Take dispatched BO' });

      expect(res1.status).toBe(400);
      expect(res1.body.message).toMatch(/cannot take.*(completed|dispatched|quarantined|not waiting)/i);

      // Quarantined / Failed BO
      const quarantinedJob = createMockJobDocument({
        status: JobStatus.INSPECTION,
        waitingForInspection: false,
        inspection: true
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValueOnce(quarantinedJob);

      const res2 = await request(app)
        .post('/api/v1/production-jobs/bo_queue_001/take-for-inspection')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({ notes: 'Take quarantined BO' });

      expect(res2.status).toBe(400);
      expect(res2.body.message).toMatch(/cannot take.*(completed|dispatched|quarantined|not waiting)/i);
    });
  });
});
