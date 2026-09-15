import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { furnaceCapacityRepository } from '../src/modules/furnace-capacity/furnace-capacity.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { JobStatus } from '../src/core/constants/status.js';
import { eventBus } from '../src/core/events/domain-event-bus.js';
import { DomainEvents } from '../src/core/constants/events.js';

describe('Inspection Phase Prompt 5: Recipe-Based Inspection and Process Verification', () => {
  jest.setTimeout(30000);
  const app = createApp();
  const testTenant = 'tenant_recipe_inspect_005';

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const createMockJobDocument = (overrides: any = {}) => {
    const doc: any = {
      _id: overrides._id || 'bo_recipe_verify_001',
      id: overrides.id || overrides._id || 'bo_recipe_verify_001',
      jobNumber: overrides.jobNumber || 'BO-202609-0905',
      boNumber: overrides.boNumber || overrides.jobNumber || 'BO-202609-0905',
      tenantId: testTenant,
      status: overrides.status || JobStatus.IN_INSPECTION,
      priority: 'HIGH',

      waitingForProduction: overrides.waitingForProduction ?? false,
      inProduction: overrides.inProduction ?? false,
      waitingForInspection: overrides.waitingForInspection ?? false,
      inInspection: overrides.inInspection ?? true,
      waitingForDispatch: overrides.waitingForDispatch ?? false,
      dispatched: overrides.dispatched ?? false,
      inspection: overrides.inspection ?? false,

      workflowState: {
        waitingForProduction: overrides.workflowState?.waitingForProduction ?? (overrides.waitingForProduction ?? false),
        inProduction: overrides.workflowState?.inProduction ?? (overrides.inProduction ?? false),
        waitingForInspection: overrides.workflowState?.waitingForInspection ?? (overrides.waitingForInspection ?? false),
        inInspection: overrides.workflowState?.inInspection ?? (overrides.inInspection ?? true),
        waitingForDispatch: overrides.workflowState?.waitingForDispatch ?? (overrides.waitingForDispatch ?? false),
        dispatched: overrides.workflowState?.dispatched ?? (overrides.dispatched ?? false),
        inspection: overrides.workflowState?.inspection ?? (overrides.inspection ?? false)
      },

      claimedBy: overrides.claimedBy ?? 'usr_qc_bob',
      claimedAt: overrides.claimedAt ?? new Date(),
      claimedByEmail: overrides.claimedByEmail ?? 'usr_qc_bob@factory.com',
      claimedByRole: overrides.claimedByRole ?? 'QC_INSPECTOR',

      customer: {
        customerId: 'cust_aero_01',
        customerCode: 'CUST-AERO-01',
        customerName: 'Aero Dynamics Global'
      },

      item: {
        itemId: 'item_pinion_01',
        itemCode: 'PART-PINION-4340',
        itemName: 'Turbine Pinion Gear 4340',
        materialGrade: 'AISI 4340 Alloy Steel',
        drawingNumber: 'DRW-PINION-4340-A',
        uom: 'PCS'
      },

      quantity: {
        targetQuantity: 100,
        loadedQuantity: 100,
        completedQuantity: 100,
        scrappedQuantity: 0
      },

      weightKg: 65,

      recipeSnapshot: {
        recipeId: 'rec_austenitize_4340',
        recipeCode: 'REC-AUST-4340',
        recipeName: 'Austenitize & Oil Quench',
        name: 'Austenitize & Oil Quench',
        revision: 1,
        processFamily: 'HARDENING_TEMPERING',
        stages: [
          { sequence: 1, stageName: 'Pre-Heat', targetTemperatureC: 650, soakTimeMinutes: 45 },
          { sequence: 2, stageName: 'Austenitizing Soak', targetTemperatureC: 845, soakTimeMinutes: 90 },
          { sequence: 3, stageName: 'Oil Quench', targetTemperatureC: 50, soakTimeMinutes: 20 }
        ],
        metallurgicalTargets: {
          minHardness: 58,
          maxHardness: 62,
          surfaceHardnessScale: 'HRC',
          caseDepthMinMm: 0.8,
          caseDepthMaxMm: 1.2
        }
      },

      specificationSnapshot: {
        surfaceHardness: {
          min: 58,
          max: 62,
          scale: 'HRC'
        },
        caseDepth: {
          minMm: 0.8,
          maxMm: 1.2
        }
      },

      equipmentAssignment: {
        furnaceId: 'FURNACE-01',
        furnaceCode: 'FURNACE-01'
      },

      execution: {
        furnaceCharge: {
          chargeNumber: 'CHG-202609-001',
          furnaceId: 'FURNACE-01',
          furnaceCode: 'FURNACE-01',
          loadedPieceCount: 100
        },
        stageProgress: [
          { sequence: 1, stageName: 'Pre-Heat', status: 'COMPLETED' },
          { sequence: 2, stageName: 'Austenitizing Soak', status: 'COMPLETED' },
          { sequence: 3, stageName: 'Oil Quench', status: 'COMPLETED' }
        ],
        downtimeLog: [],
        productionLogs: [],
        inspectionData: null
      },

      processDetails: Array.from({ length: 15 }, (_, i) => ({
        serialNumber: i + 1,
        partId: 'item_pinion_01',
        partCode: 'PART-PINION-4340',
        process: i === 0 ? 'Hardening & Quench' : i === 1 ? 'Tempering' : `Process Position ${i + 1}`,
        recipeId: 'rec_austenitize_4340',
        recipeCode: 'REC-AUST-4340',
        minhardness: 58,
        maxhardness: 62,
        actualHardness: null,
        isCompliant: null,
        userId: null,
        userName: null,
        status: i < 2 ? 'PENDING' : 'BLANK',
        notes: null
      })),

      save: jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      }),
      markModified: jest.fn(),
      toJSON: jest.fn().mockImplementation(function (this: any) {
        return { ...this };
      })
    };

    if (overrides.processDetails) {
      doc.processDetails = overrides.processDetails;
    }
    if (overrides.execution?.inspectionData) {
      doc.execution.inspectionData = overrides.execution.inspectionData;
    }

    return doc;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);
    jest.spyOn(eventBus, 'publish').mockResolvedValue();
    jest.spyOn(roleRepository, 'seedDefaultRolesForTenant').mockResolvedValue([] as any);
    jest.spyOn(roleRepository, 'findRolesByCodes').mockImplementation(async (_tenantId, codes) => {
      return DEFAULT_FACTORY_ROLES.filter((r) => codes.includes(r.code)).map((r) => ({
        ...r,
        id: `role_${r.code}`,
        status: 'active'
      })) as any;
    });

    jest.spyOn(furnaceCapacityRepository, 'findFurnaceById').mockImplementation(async (_tenant: string, id: string) => {
      if (id === 'FURNACE-01') {
        return {
          id,
          _id: id,
          furnaceCode: 'FURNACE-01',
          status: 'OPERATIONAL'
        } as any;
      }
      return null;
    });

    jest.spyOn(furnaceCapacityRepository, 'findFurnaceByCode').mockImplementation(async (_tenant: string, code: string) => {
      if (code === 'FURNACE-01') {
        return {
          id: 'FURNACE-01',
          _id: 'FURNACE-01',
          furnaceCode: 'FURNACE-01',
          status: 'OPERATIONAL'
        } as any;
      }
      return null;
    });
  });

  describe('1. Recipe Authority & Read-Only Exposure', () => {
    it('displays authoritative recipe requirements in read-only mode via workbench data', async () => {
      const bobToken = generateToken('usr_qc_bob', ['QC_INSPECTOR']);
      const mockJob = createMockJobDocument();
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .get('/api/v1/production-jobs/bo_recipe_verify_001/inspection-workbench')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${bobToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.recipeAuthority).toBeDefined();
      expect(data.recipeAuthority.recipeId).toBe('rec_austenitize_4340');
      expect(data.recipeAuthority.recipeCode).toBe('REC-AUST-4340');
      expect(data.recipeAuthority.isRecipeLocked).toBe(true);
      expect(data.recipeAuthority.canReplaceRecipe).toBe(false);
      expect(data.recipeAuthority.stages).toHaveLength(3);
      expect(data.recipeAuthority.metallurgicalTargets.minHardness).toBe(58);
      expect(data.recipeAuthority.metallurgicalTargets.maxHardness).toBe(62);

      // Process details table exposed with 15 positions
      expect(data.processDetails).toHaveLength(15);
      expect(data.processVerificationSummary).toBeDefined();
      expect(data.processVerificationSummary.totalPositions).toBe(15);
    });

    it('prohibits inspector from replacing the recipe with 400 Bad Request', async () => {
      const bobToken = generateToken('usr_qc_bob', ['QC_INSPECTOR']);
      const mockJob = createMockJobDocument();
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_recipe_verify_001/verify-process-row')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          serialNumber: 1,
          recipeId: 'REC-DIFFERENT-UNAUTHORIZED',
          recipeCode: 'REC-SUBSTITUTE',
          actualHardness: 60
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Recipe Authority Violation|Recipe Protection Violation/i);
    });
  });

  describe('2. Process Details Structure (15 Positions)', () => {
    it('verifies an individual process row within the authoritative 15-position table', async () => {
      const bobToken = generateToken('usr_qc_bob', ['QC_INSPECTOR']);
      const mockJob = createMockJobDocument();
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_recipe_verify_001/verify-process-row')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          serialNumber: 1,
          actualHardness: 60,
          notes: 'Pre-heat and hardening verified conforming'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockJob.save).toHaveBeenCalled();

      const verifiedRow = mockJob.processDetails.find((r: any) => r.serialNumber === 1);
      expect(verifiedRow.actualHardness).toBe(60);
      expect(verifiedRow.isCompliant).toBe(true);
      expect(verifiedRow.status).toBe('PASSED');
      expect(verifiedRow.userId).toBe('usr_qc_bob');
      expect(verifiedRow.notes).toBe('Pre-heat and hardening verified conforming');
    });

    it('rejects invalid process row serialNumber outside 1 to 15 with 400 Bad Request', async () => {
      const bobToken = generateToken('usr_qc_bob', ['QC_INSPECTOR']);
      const mockJob = createMockJobDocument();
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_recipe_verify_001/verify-process-row')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          serialNumber: 16,
          actualHardness: 60
        });

      expect([400, 422]).toContain(res.status);
      expect(JSON.stringify(res.body)).toMatch(/serialNumber|15/i);
    });
  });

  describe('3. Hardness Verification & Silent Failure Conversion Prevention', () => {
    it('verifies conforming hardness within specified range [58, 62] HRC and marks PASSED', async () => {
      const bobToken = generateToken('usr_qc_bob', ['QC_INSPECTOR']);
      const mockJob = createMockJobDocument();
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_recipe_verify_001/verify-process-row')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          serialNumber: 1,
          actualHardness: 59.5
        });

      expect(res.status).toBe(200);
      expect(res.body.data.processDetails[0].isCompliant).toBe(true);
      expect(res.body.data.processDetails[0].status).toBe('PASSED');
    });

    it('marks non-conforming hardness below min range as FAILED and non-compliant', async () => {
      const bobToken = generateToken('usr_qc_bob', ['QC_INSPECTOR']);
      const mockJob = createMockJobDocument();
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_recipe_verify_001/verify-process-row')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          serialNumber: 1,
          actualHardness: 52 // Below specified min 58
        });

      expect(res.status).toBe(200);
      expect(res.body.data.processDetails[0].isCompliant).toBe(false);
      expect(res.body.data.processDetails[0].status).toBe('FAILED');
    });

    it('strictly prohibits silently converting hardness failures into passes with 400 Bad Request', async () => {
      const bobToken = generateToken('usr_qc_bob', ['QC_INSPECTOR']);
      const mockJob = createMockJobDocument();
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      // Client attempts to assert status 'PASSED' or isHardnessCompliant: true when measured hardness is 52 HRC (spec 58-62)
      const res = await request(app)
        .post('/api/v1/production-jobs/bo_recipe_verify_001/verify-process-row')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          serialNumber: 1,
          actualHardness: 52,
          status: 'PASSED',
          isHardnessCompliant: true
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Hardness Verification Violation.*outside specified range.*silently converted/i);
    });

    it('rejects silent pass conversion in recordHeatTreatmentInspectionData when measured average is out of spec', async () => {
      const bobToken = generateToken('usr_qc_bob', ['QC_INSPECTOR']);
      const mockJob = createMockJobDocument();
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_recipe_verify_001/inspection-data')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          furnaceId: 'FURNACE-01',
          minHardness: 58,
          maxHardness: 62,
          measuredAverage: 50, // Out of spec!
          isHardnessCompliant: true, // Attempted silent pass!
          effectiveCaseDepthMm: 1.0,
          quantityReceived: 100,
          quantityDelivered: 100
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Hardness Verification Violation.*outside specified range.*silently converted/i);
    });
  });

  describe('4. Specification Integrity & Evaluation against Applicable Requirements', () => {
    it('rejects evaluation payload referencing an unrelated part or item with 400 Bad Request', async () => {
      const bobToken = generateToken('usr_qc_bob', ['QC_INSPECTOR']);
      const mockJob = createMockJobDocument();
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_recipe_verify_001/verify-process-row')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          serialNumber: 1,
          partId: 'ITEM_UNRELATED_999',
          partCode: 'PART-UNRELATED',
          actualHardness: 60
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Specification Integrity Violation.*does not match Batch Order part/i);
    });

    it('rejects inspection data referencing an unrelated part with 400 Bad Request', async () => {
      const bobToken = generateToken('usr_qc_bob', ['QC_INSPECTOR']);
      const mockJob = createMockJobDocument();
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_recipe_verify_001/inspection-data')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          partCode: 'PART-WRONG-FOREIGN',
          furnaceId: 'FURNACE-01',
          measuredAverage: 60,
          effectiveCaseDepthMm: 1.0,
          quantityReceived: 100,
          quantityDelivered: 100
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Specification Integrity Violation.*does not match Batch Order part/i);
    });
  });

  describe('5. Actual Results Separation (Preservation of Specifications)', () => {
    it('stores actual inspection and verification results separately without mutating recipe specs', async () => {
      const bobToken = generateToken('usr_qc_bob', ['QC_INSPECTOR']);
      const mockJob = createMockJobDocument();
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      await request(app)
        .post('/api/v1/production-jobs/bo_recipe_verify_001/verify-process-row')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          serialNumber: 1,
          actualHardness: 60.5
        });

      // Recipe and specification snapshots remain completely unchanged
      expect(mockJob.recipeSnapshot.metallurgicalTargets.minHardness).toBe(58);
      expect(mockJob.recipeSnapshot.metallurgicalTargets.maxHardness).toBe(62);
      expect(mockJob.specificationSnapshot.surfaceHardness.min).toBe(58);
      expect(mockJob.specificationSnapshot.surfaceHardness.max).toBe(62);

      // Only actualHardness on process row is populated
      expect(mockJob.processDetails[0].actualHardness).toBe(60.5);
    });
  });

  describe('6. User Attribution Security', () => {
    it('derives inspector attribution strictly from authenticated JWT and ignores client spoofed user IDs', async () => {
      const bobToken = generateToken('usr_qc_bob', ['QC_INSPECTOR']);
      const mockJob = createMockJobDocument();
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_recipe_verify_001/verify-process-row')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          serialNumber: 1,
          actualHardness: 60,
          userId: 'usr_hacker_attacker', // Spoofed user ID
          userName: 'Mr. Evil Auditor' // Spoofed user Name
        });

      expect(res.status).toBe(200);
      const verifiedRow = mockJob.processDetails[0];
      expect(verifiedRow.userId).toBe('usr_qc_bob');
      expect(verifiedRow.userId).not.toBe('usr_hacker_attacker');
    });
  });

  describe('7. Controlled Process Row Statuses', () => {
    it('rejects arbitrary uncontrolled status values with 400 Bad Request', async () => {
      const bobToken = generateToken('usr_qc_bob', ['QC_INSPECTOR']);
      const mockJob = createMockJobDocument();
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_recipe_verify_001/verify-process-row')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          serialNumber: 1,
          status: 'TOTALLY_FINE_BRO', // Arbitrary status
          actualHardness: 60
        });

      expect([400, 422]).toContain(res.status);
      expect(JSON.stringify(res.body)).toMatch(/status|Invalid/i);
    });

    it('accepts strictly controlled status values (e.g. SKIPPED, COMPLETED)', async () => {
      const bobToken = generateToken('usr_qc_bob', ['QC_INSPECTOR']);
      const mockJob = createMockJobDocument();
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_recipe_verify_001/verify-process-row')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          serialNumber: 3,
          status: 'SKIPPED',
          notes: 'Operation not applicable for this batch'
        });

      expect(res.status).toBe(200);
      expect(mockJob.processDetails[2].status).toBe('SKIPPED');
    });
  });

  describe('8. Failure Identification & Pre-Dispatch Approval Blocking', () => {
    it('blocks dispatch approval if measured hardness is non-compliant with 400 Bad Request', async () => {
      const bobToken = generateToken('usr_qc_bob', ['QC_INSPECTOR']);
      const mockJob = createMockJobDocument({
        execution: {
          inspectionData: {
            furnaceId: 'FURNACE-01',
            furnaceCode: 'FURNACE-01',
            minHardness: 58,
            maxHardness: 62,
            measuredAverage: 51, // Out of spec
            isHardnessCompliant: false,
            effectiveCaseDepthMm: 1.0,
            quantityReceived: 100,
            quantityDelivered: 100
          }
        }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_recipe_verify_001/approve-dispatch')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          furnaceId: 'FURNACE-01',
          measuredAverage: 51,
          effectiveCaseDepthMm: 1.0,
          quantityReceived: 100,
          quantityDelivered: 100
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Hardness Verification Violation.*outside specified range.*cannot be approved for dispatch/i);
    });

    it('blocks dispatch approval if any process row has status FAILED with 400 Bad Request', async () => {
      const bobToken = generateToken('usr_qc_bob', ['QC_INSPECTOR']);
      const failingProcessDetails = Array.from({ length: 15 }, (_, i) => ({
        serialNumber: i + 1,
        process: `Process ${i + 1}`,
        status: i === 0 ? 'FAILED' : 'BLANK'
      }));

      const mockJob = createMockJobDocument({
        processDetails: failingProcessDetails
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_recipe_verify_001/approve-dispatch')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          furnaceId: 'FURNACE-01',
          minHardness: 58,
          maxHardness: 62,
          measuredAverage: 60,
          effectiveCaseDepthMm: 1.0,
          quantityReceived: 100,
          quantityDelivered: 100
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Process Verification Violation.*failed verification.*cannot be approved for dispatch/i);
    });

    it('transitions non-compliant BO to authoritative INSPECTION failure quarantine via failInspection', async () => {
      const bobToken = generateToken('usr_qc_bob', ['QC_INSPECTOR']);
      const mockJob = createMockJobDocument();
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);
      jest.spyOn(productionJobRepository, 'atomicFailInspection').mockResolvedValue({
        ...mockJob,
        status: JobStatus.INSPECTION,
        workflowState: { ...mockJob.workflowState, inInspection: false, inspection: true }
      } as any);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_recipe_verify_001/fail-inspection')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          defectCategory: 'METALLURGICAL_HARDNESS_OUT_OF_SPEC',
          defectReason: 'Surface hardness measured 52 HRC below 58 HRC minimum',
          correctiveAction: 'Re-temper or evaluate MRB disposition',
          quantityReceived: 100,
          quantityRejected: 100,
          notes: 'Failing batch quarantined'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(JobStatus.INSPECTION);
      expect(res.body.data.workflowState.inspection).toBe(true);
    });
  });

  describe('9. Quality Inspection Router Compatibility & Dual Route Access', () => {
    it('allows process row verification via /api/v1/quality-inspections/:id/verify-process-row', async () => {
      const bobToken = generateToken('usr_qc_bob', ['QC_INSPECTOR']);
      const mockJob = createMockJobDocument();
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/quality-inspections/bo_recipe_verify_001/verify-process-row')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          serialNumber: 2,
          actualHardness: 61,
          notes: 'Second position tempering verified conforming'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockJob.processDetails[1].status).toBe('PASSED');
      expect(mockJob.processDetails[1].actualHardness).toBe(61);
      expect(mockJob.processDetails[1].isCompliant).toBe(true);
    });
  });
});
