import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { furnaceCapacityRepository } from '../src/modules/furnace-capacity/furnace-capacity.repository.js';
import { machineRepository } from '../src/modules/machine/machine.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { JobStatus } from '../src/core/constants/status.js';
import { eventBus } from '../src/core/events/domain-event-bus.js';
import { DomainEvents } from '../src/core/constants/events.js';

describe('Inspection Phase Prompt 6: Implement Inspection Approval for Dispatch', () => {
  jest.setTimeout(30000);
  const app = createApp();
  const testTenant = 'tenant_inspect_approval_006';

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const createMockJobDocument = (overrides: any = {}) => {
    const doc: any = {
      _id: overrides._id || 'bo_inspect_appr_001',
      id: overrides.id || overrides._id || 'bo_inspect_appr_001',
      jobNumber: overrides.jobNumber || 'BO-202609-0906',
      boNumber: overrides.boNumber || overrides.jobNumber || 'BO-202609-0906',
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

      claimedBy: overrides.claimedBy ?? 'usr_qc_lead',
      claimedAt: overrides.claimedAt ?? new Date(),
      claimedByEmail: overrides.claimedByEmail ?? 'usr_qc_lead@factory.com',
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
        heatNumber: 'HEAT-4340-V9812'
      },

      quantity: {
        targetQuantity: 100,
        loadedQuantity: 100,
        completedQuantity: 100,
        scrappedQuantity: 0
      },

      weightKg: 65,

      recipeSnapshot: 'recipeSnapshot' in overrides ? overrides.recipeSnapshot : {
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

      specificationSnapshot: 'specificationSnapshot' in overrides ? overrides.specificationSnapshot : {
        specificationId: 'spec_pinion_4340',
        specCode: 'SPEC-PINION-4340',
        revisionNumber: 1,
        title: 'Aerospace Pinion Hardness & Case Depth',
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

      equipmentAssignment: 'equipmentAssignment' in overrides ? overrides.equipmentAssignment : {
        furnaceId: 'furnace_vac_01',
        furnaceCode: 'FURNACE-VAC-01',
        bay: 'Bay 3 Thermal Processing'
      },

      execution: {
        furnaceCharge:
          overrides.execution && 'furnaceCharge' in overrides.execution
            ? overrides.execution.furnaceCharge
            : {
                furnaceId: 'furnace_vac_01',
                furnaceCode: 'FURNACE-VAC-01',
                operatorId: 'usr_op_01',
                shiftId: 'SHIFT-MORNING',
                loadedPieces: 100,
                loadedWeightKg: 65,
                setpointTempC: 845,
                loadedAt: new Date()
              },
        stageProgress: [
          { stageSequence: 1, stageName: 'Pre-Heat', actualTemperatureC: 650, actualDurationMinutes: 45, isCompliant: true },
          { stageSequence: 2, stageName: 'Austenitizing Soak', actualTemperatureC: 845, actualDurationMinutes: 90, isCompliant: true },
          { stageSequence: 3, stageName: 'Oil Quench', actualTemperatureC: 50, actualDurationMinutes: 20, isCompliant: true }
        ],
        inspectionData: overrides.execution?.inspectionData || undefined
      },

      processDetails: overrides.processDetails || Array.from({ length: 15 }, (_, i) => ({
        serialNumber: i + 1,
        processNumber: i + 1,
        partId: 'item_pinion_01',
        partCode: 'PART-PINION-4340',
        partName: 'Turbine Pinion Gear 4340',
        process: i === 0 ? 'Austenitize & Oil Quench' : `Inspection Step ${i + 1}`,
        minhardness: 58,
        maxhardness: 62,
        actualHardness: 60.5,
        isCompliant: true,
        status: i === 0 ? 'PASSED' : 'COMPLETED'
      })),

      isDeleted: false,
      transitionHistory: overrides.transitionHistory || [],
      save: jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      }),
      toJSON: function () {
        return { ...this };
      },
      toObject: function () {
        return { ...this };
      }
    };
    return doc;
  };

  const validInspectionApprovalPayload = {
    furnaceId: 'furnace_vac_01',
    furnaceCode: 'FURNACE-VAC-01',
    minHardness: 58,
    maxHardness: 62,
    scale: 'HRC',
    measuredAverage: 60.5,
    testPoints: [
      { pointIdentifier: 'TP-1', location: 'PITCH_LINE', measuredValue: 60.4 },
      { pointIdentifier: 'TP-2', location: 'ROOT', measuredValue: 60.6 }
    ],
    effectiveCaseDepthMm: 0.95,
    quantityReceived: 100,
    quantityDelivered: 98,
    quantityRejected: 2,
    notes: 'Conforming aerospace heat-treatment batch released for dispatch staging.'
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(roleRepository, 'seedDefaultRolesForTenant').mockResolvedValue([] as any);
    jest.spyOn(roleRepository, 'findRolesByCodes').mockImplementation(async (_tenantId, codes) => {
      return DEFAULT_FACTORY_ROLES.filter((r) => codes.includes(r.code)).map((r) => ({
        ...r,
        id: `role_${r.code}`,
        status: 'active'
      })) as any;
    });
    jest.spyOn(furnaceCapacityRepository, 'findFurnaceById').mockImplementation(async (_t: string, id: string) => {
      if (id === 'furnace_vac_01') {
        return { id: 'furnace_vac_01', furnaceCode: 'FURNACE-VAC-01', name: 'Vacuum Furnace 01' } as any;
      }
      return null;
    });
    jest.spyOn(furnaceCapacityRepository, 'findFurnaceByCode').mockImplementation(async (_t: string, code: string) => {
      if (code === 'FURNACE-VAC-01') {
        return { id: 'furnace_vac_01', furnaceCode: 'FURNACE-VAC-01', name: 'Vacuum Furnace 01' } as any;
      }
      return null;
    });
    jest.spyOn(machineRepository, 'findById').mockResolvedValue(null);
    jest.spyOn(machineRepository, 'findByCode').mockResolvedValue(null);
    jest.spyOn(productionJobRepository, 'atomicApproveForDispatch').mockImplementation(async (_t: string, _id: string, updateData: any) => {
      const set = updateData.$set || {};
      return createMockJobDocument({
        status: set.status,
        waitingForProduction: set.waitingForProduction,
        inProduction: set.inProduction,
        waitingForInspection: set.waitingForInspection,
        inInspection: set.inInspection,
        waitingForDispatch: set.waitingForDispatch,
        dispatched: set.dispatched,
        inspection: set.inspection,
        workflowState: {
          waitingForProduction: set['workflowState.waitingForProduction'],
          inProduction: set['workflowState.inProduction'],
          waitingForInspection: set['workflowState.waitingForInspection'],
          inInspection: set['workflowState.inInspection'],
          waitingForDispatch: set['workflowState.waitingForDispatch'],
          dispatched: set['workflowState.dispatched'],
          inspection: set['workflowState.inspection']
        },
        execution: {
          inspectionData: set['execution.inspectionData']
        }
      }) as any;
    });
    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);
  });

  // -------------------------------------------------------------------------
  // 1. Eligibility Enforcement
  // -------------------------------------------------------------------------
  describe('1. Eligibility Enforcement', () => {
    const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);

    it('rejects approval when BO is in WAITING_FOR_PRODUCTION with 400 Bad Request', async () => {
      const job = createMockJobDocument({
        status: JobStatus.WAITING_FOR_PRODUCTION,
        waitingForProduction: true,
        inInspection: false,
        workflowState: { waitingForProduction: true, inInspection: false }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-dispatch`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(validInspectionApprovalPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not in active inspection/i);
    });

    it('rejects approval when BO is in IN_PRODUCTION with 400 Bad Request', async () => {
      const job = createMockJobDocument({
        status: JobStatus.IN_PRODUCTION,
        inProduction: true,
        inInspection: false,
        workflowState: { inProduction: true, inInspection: false }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-dispatch`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(validInspectionApprovalPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not in active inspection/i);
    });

    it('rejects approval when BO is in WAITING_FOR_INSPECTION with 400 Bad Request', async () => {
      const job = createMockJobDocument({
        status: JobStatus.WAITING_FOR_INSPECTION,
        waitingForInspection: true,
        inInspection: false,
        workflowState: { waitingForInspection: true, inInspection: false }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-dispatch`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(validInspectionApprovalPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not in active inspection/i);
    });

    it('rejects approval when BO is already in WAITING_FOR_DISPATCH with 400 Bad Request', async () => {
      const job = createMockJobDocument({
        status: JobStatus.WAITING_FOR_DISPATCH,
        waitingForDispatch: true,
        inInspection: false,
        workflowState: { waitingForDispatch: true, inInspection: false }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-dispatch`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(validInspectionApprovalPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not in active inspection/i);
    });

    it('rejects approval when BO is DISPATCHED with 400 Bad Request', async () => {
      const job = createMockJobDocument({
        status: JobStatus.DISPATCHED,
        dispatched: true,
        inInspection: false,
        workflowState: { dispatched: true, inInspection: false }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-dispatch`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(validInspectionApprovalPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not in active inspection/i);
    });

    it('rejects approval when BO is in INSPECTION (quarantined / failed) with 400 Bad Request', async () => {
      const job = createMockJobDocument({
        status: JobStatus.INSPECTION,
        inspection: true,
        inInspection: false,
        workflowState: { inspection: true, inInspection: false }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-dispatch`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(validInspectionApprovalPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not in active inspection/i);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Permission & Ownership Enforcement
  // -------------------------------------------------------------------------
  describe('2. Permission & Ownership Enforcement', () => {
    it('rejects approval attempts by unauthorized non-inspection roles with 403 Forbidden', async () => {
      const operatorToken = generateToken('usr_op_01', ['FURNACE_OPERATOR']);
      const job = createMockJobDocument({ claimedBy: 'usr_qc_lead' });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-dispatch`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send(validInspectionApprovalPayload);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('allows approval by authorized QC Inspector with 200 OK', async () => {
      const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);
      const job = createMockJobDocument({ claimedBy: 'usr_qc_lead' });
      const approvedJob = createMockJobDocument({
        ...job,
        status: JobStatus.WAITING_FOR_DISPATCH,
        inInspection: false,
        waitingForDispatch: true,
        workflowState: { inInspection: false, waitingForDispatch: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(productionJobRepository, 'atomicApproveForDispatch').mockResolvedValue(approvedJob as any);
      jest.spyOn(eventBus, 'publish').mockResolvedValue();

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-dispatch`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(validInspectionApprovalPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('enforces exclusive claimed inspector ownership and rejects competing inspector with 403 Forbidden', async () => {
      const competitorToken = generateToken('usr_qc_competitor', ['QC_INSPECTOR']);
      const job = createMockJobDocument({ claimedBy: 'usr_qc_lead' });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-dispatch`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${competitorToken}`)
        .send(validInspectionApprovalPayload);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Inspection Ownership Violation/i);
    });

    it('allows QA Lead / Metallurgist to override and approve claimed inspection session with 200 OK', async () => {
      const metallurgistToken = generateToken('usr_chief_metallurgist', ['METALLURGIST']);
      const job = createMockJobDocument({ claimedBy: 'usr_qc_junior' });
      const approvedJob = createMockJobDocument({
        ...job,
        status: JobStatus.WAITING_FOR_DISPATCH,
        inInspection: false,
        waitingForDispatch: true,
        workflowState: { inInspection: false, waitingForDispatch: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(productionJobRepository, 'atomicApproveForDispatch').mockResolvedValue(approvedJob as any);
      jest.spyOn(eventBus, 'publish').mockResolvedValue();

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-dispatch`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metallurgistToken}`)
        .send(validInspectionApprovalPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Required Data Completeness Verification (Six Mandatory Fields)
  // -------------------------------------------------------------------------
  describe('3. Required Data Completeness Verification (Six Mandatory Fields)', () => {
    const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);

    it('rejects approval when furnace / equipment identification is missing with 400 Bad Request', async () => {
      const job = createMockJobDocument({
        claimedBy: 'usr_qc_lead',
        equipmentAssignment: undefined,
        execution: { ...createMockJobDocument().execution, furnaceCharge: undefined }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const { furnaceId, furnaceCode, ...payloadWithoutEquipment } = validInspectionApprovalPayload;
      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-dispatch`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(payloadWithoutEquipment);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Furnace\/Equipment/i);
    });

    it('rejects approval when arbitrary unverified equipment not in master records is provided with 400 Bad Request', async () => {
      const job = createMockJobDocument({
        claimedBy: 'usr_qc_lead',
        equipmentAssignment: undefined,
        execution: { ...createMockJobDocument().execution, furnaceCharge: undefined }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const { furnaceCode, ...payloadWithoutValidCode } = validInspectionApprovalPayload;
      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-dispatch`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({ ...payloadWithoutValidCode, furnaceId: 'unverified_unknown_furnace_999', furnaceCode: 'UNVERIFIED-UNKNOWN-999' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Furnace\/Equipment/i);
    });

    it('rejects approval when hardness specification (minHardness/maxHardness) is missing with 400 Bad Request', async () => {
      const job = createMockJobDocument({
        claimedBy: 'usr_qc_lead',
        recipeSnapshot: undefined,
        specificationSnapshot: undefined
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const { minHardness, maxHardness, ...payloadWithoutSpec } = validInspectionApprovalPayload;
      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-dispatch`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(payloadWithoutSpec);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Hardness Specification/i);
    });

    it('rejects approval when actual measured hardness is missing with 400 Bad Request', async () => {
      const job = createMockJobDocument({ claimedBy: 'usr_qc_lead' });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const { measuredAverage, ...payloadWithoutHardness } = validInspectionApprovalPayload;
      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-dispatch`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(payloadWithoutHardness);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Actual Hardness/i);
    });

    it('rejects approval when case depth (effectiveCaseDepthMm) is missing with 400 Bad Request', async () => {
      const job = createMockJobDocument({ claimedBy: 'usr_qc_lead' });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const { effectiveCaseDepthMm, ...payloadWithoutCaseDepth } = validInspectionApprovalPayload;
      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-dispatch`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(payloadWithoutCaseDepth);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Case Depth/i);
    });

    it('rejects approval when quantity received is missing or <= 0 with 400 Bad Request', async () => {
      const job = createMockJobDocument({ claimedBy: 'usr_qc_lead' });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-dispatch`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({ ...validInspectionApprovalPayload, quantityReceived: 0 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Quantity Received/i);
    });

    it('rejects approval when quantity delivered is missing or <= 0 with 400 Bad Request', async () => {
      const job = createMockJobDocument({ claimedBy: 'usr_qc_lead' });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-dispatch`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({ ...validInspectionApprovalPayload, quantityDelivered: 0 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Quantity Delivered/i);
    });

    it('rejects approval when quantity delivered exceeds quantity received with 400 Bad Request', async () => {
      const job = createMockJobDocument({ claimedBy: 'usr_qc_lead' });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-dispatch`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({ ...validInspectionApprovalPayload, quantityReceived: 100, quantityDelivered: 105 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/cannot exceed quantityReceived/i);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Process Validation & Mandatory Failure Blocking
  // -------------------------------------------------------------------------
  describe('4. Process Validation & Mandatory Failure Blocking', () => {
    const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);

    it('rejects approval when measured hardness is outside recipe specification range [58, 62] HRC with 400 Bad Request', async () => {
      const job = createMockJobDocument({ claimedBy: 'usr_qc_lead' });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-dispatch`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({ ...validInspectionApprovalPayload, measuredAverage: 52.0 }); // below 58 HRC!

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Hardness Verification Violation.*outside specified range/i);
    });

    it('rejects approval when case depth is outside target limits with 400 Bad Request', async () => {
      const job = createMockJobDocument({ claimedBy: 'usr_qc_lead' });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-dispatch`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({ ...validInspectionApprovalPayload, effectiveCaseDepthMm: 1.85 }); // target is [0.8, 1.2] mm!

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Case Depth Verification Violation/i);
    });

    it('rejects approval when any 15-position process detail row has status FAILED with 400 Bad Request', async () => {
      const job = createMockJobDocument({
        claimedBy: 'usr_qc_lead',
        processDetails: Array.from({ length: 15 }, (_, i) => ({
          serialNumber: i + 1,
          processNumber: i + 1,
          partId: 'item_pinion_01',
          partCode: 'PART-PINION-4340',
          partName: 'Turbine Pinion Gear 4340',
          process: `Operation ${i + 1}`,
          status: i === 2 ? 'FAILED' : 'COMPLETED' // Row 3 failed!
        }))
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-dispatch`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(validInspectionApprovalPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Process Verification Violation.*failed verification/i);
    });

    it('rejects approval when isHardnessCompliant is explicitly false with 400 Bad Request', async () => {
      const job = createMockJobDocument({ claimedBy: 'usr_qc_lead' });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-dispatch`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({ ...validInspectionApprovalPayload, isHardnessCompliant: false });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Measured hardness was marked non-compliant/i);
    });

    it('rejects approval when isCaseDepthCompliant is explicitly false with 400 Bad Request', async () => {
      const job = createMockJobDocument({ claimedBy: 'usr_qc_lead' });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-dispatch`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({ ...validInspectionApprovalPayload, isCaseDepthCompliant: false });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Case depth was marked non-compliant/i);
    });
  });

  // -------------------------------------------------------------------------
  // 5. State Transition & Concurrency Control
  // -------------------------------------------------------------------------
  describe('5. State Transition & Concurrency Control', () => {
    const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);

    it('atomically transitions inInspection=false and waitingForDispatch=true with single active flag (sum=1)', async () => {
      const job = createMockJobDocument({ claimedBy: 'usr_qc_lead' });
      const approvedJob = createMockJobDocument({
        ...job,
        status: JobStatus.WAITING_FOR_DISPATCH,
        inInspection: false,
        waitingForDispatch: true,
        workflowState: {
          waitingForProduction: false,
          inProduction: false,
          waitingForInspection: false,
          inInspection: false,
          waitingForDispatch: true,
          dispatched: false,
          inspection: false
        }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(productionJobRepository, 'atomicApproveForDispatch').mockResolvedValue(approvedJob as any);
      jest.spyOn(eventBus, 'publish').mockResolvedValue();

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-dispatch`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(validInspectionApprovalPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(JobStatus.WAITING_FOR_DISPATCH);
      expect(res.body.data.inInspection).toBe(false);
      expect(res.body.data.waitingForDispatch).toBe(true);

      const wf = res.body.data.workflowState;
      expect(wf.waitingForProduction).toBe(false);
      expect(wf.inProduction).toBe(false);
      expect(wf.waitingForInspection).toBe(false);
      expect(wf.inInspection).toBe(false);
      expect(wf.waitingForDispatch).toBe(true);
      expect(wf.dispatched).toBe(false);
      expect(wf.inspection).toBe(false);

      // Verify invariant: sum(flag_i) === 1
      const activeFlags = Object.values(wf).filter((v) => v === true).length;
      expect(activeFlags).toBe(1);
    });

    it('enforces concurrency collision protection (second simultaneous approval receives 409 Conflict)', async () => {
      const job = createMockJobDocument({ claimedBy: 'usr_qc_lead' });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      // Database findOneAndUpdate returns null because another concurrent request already updated it
      jest.spyOn(productionJobRepository, 'atomicApproveForDispatch').mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-dispatch`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(validInspectionApprovalPayload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Approval Conflict.*no longer in inspection/i);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Production Lock & Post-Approval Immutability
  // -------------------------------------------------------------------------
  describe('6. Production Lock & Post-Approval Immutability', () => {
    const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);

    it('prohibits editing inspection data after dispatch approval with 400 Bad Request', async () => {
      const job = createMockJobDocument({
        status: JobStatus.WAITING_FOR_DISPATCH,
        inInspection: false,
        waitingForDispatch: true,
        workflowState: { inInspection: false, waitingForDispatch: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/inspection-data`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({ measuredAverage: 61.0 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not in active inspection/i);
    });

    it('prohibits process row verification after dispatch approval with 400 Bad Request', async () => {
      const job = createMockJobDocument({
        status: JobStatus.WAITING_FOR_DISPATCH,
        inInspection: false,
        waitingForDispatch: true,
        workflowState: { inInspection: false, waitingForDispatch: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/verify-process-row`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({ serialNumber: 1, actualHardness: 60.5 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not in active inspection/i);
    });

    it('prohibits production operations (charge, progress, save) on approved BO with Post-Production Lock Violation', async () => {
      const prodToken = generateToken('usr_operator_01', ['FURNACE_OPERATOR']);
      const job = createMockJobDocument({
        status: JobStatus.WAITING_FOR_DISPATCH,
        inInspection: false,
        waitingForDispatch: true,
        workflowState: { inInspection: false, waitingForDispatch: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/charge`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${prodToken}`)
        .send({
          furnaceId: 'furnace_vac_01',
          chargeNumber: 'CHG-VAC-2026-001',
          loadedPieceCount: 100,
          loadedWeightKg: 65,
          initialFurnaceTempC: 25
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Post-Production Lock Violation|not in production/i);
    });
  });

  // -------------------------------------------------------------------------
  // 7. Dispatch Boundary Preservation
  // -------------------------------------------------------------------------
  describe('7. Dispatch Boundary Preservation', () => {
    const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);

    it('does not mark dispatched=true or create outward challan during inspection approval', async () => {
      const job = createMockJobDocument({ claimedBy: 'usr_qc_lead' });
      const approvedJob = createMockJobDocument({
        ...job,
        status: JobStatus.WAITING_FOR_DISPATCH,
        inInspection: false,
        waitingForDispatch: true,
        dispatched: false,
        workflowState: { inInspection: false, waitingForDispatch: true, dispatched: false }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(productionJobRepository, 'atomicApproveForDispatch').mockResolvedValue(approvedJob as any);
      jest.spyOn(eventBus, 'publish').mockResolvedValue();

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-dispatch`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(validInspectionApprovalPayload);

      expect(res.status).toBe(200);
      expect(res.body.data.waitingForDispatch).toBe(true);
      expect(res.body.data.dispatched).toBe(false);
      expect(res.body.data.workflowState.dispatched).toBe(false);
    });

    it('prohibits direct status skipping from IN_INSPECTION to DISPATCHED via generic transition route with 400 Bad Request', async () => {
      const plantMgrToken = generateToken('usr_plant_mgr', ['PLANT_MANAGER']);
      const job = createMockJobDocument({ claimedBy: 'usr_qc_lead' });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/transition`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plantMgrToken}`)
        .send({ toStatus: 'DISPATCHED', reason: 'Direct bypass attempt' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Inspection Lock Violation/i);
    });
  });

  // -------------------------------------------------------------------------
  // 8. Audit Trail & Domain Event Publication
  // -------------------------------------------------------------------------
  describe('8. Audit Trail & Domain Event Publication', () => {
    const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);

    it('records audit log and publishes DomainEvents.JOB_INSPECTION_APPROVED with complete payload', async () => {
      const job = createMockJobDocument({ claimedBy: 'usr_qc_lead' });
      const approvedJob = createMockJobDocument({
        ...job,
        status: JobStatus.WAITING_FOR_DISPATCH,
        inInspection: false,
        waitingForDispatch: true,
        workflowState: { inInspection: false, waitingForDispatch: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(productionJobRepository, 'atomicApproveForDispatch').mockResolvedValue(approvedJob as any);
      const auditSpy = jest.spyOn(auditService, 'record').mockResolvedValue({} as any);
      const eventSpy = jest.spyOn(eventBus, 'publish').mockResolvedValue();

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-dispatch`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(validInspectionApprovalPayload);

      expect(res.status).toBe(200);

      // Verify Audit Call
      expect(auditSpy).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          action: 'INSPECTION_APPROVED_FOR_DISPATCH',
          actorId: 'usr_qc_lead',
          entityType: 'BatchOrder',
          metadata: expect.objectContaining({
            toStatus: 'WAITING_FOR_DISPATCH',
            quantityDelivered: 98,
            quantityRejected: 2
          })
        })
      );

      // Verify Domain Event Publication
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: DomainEvents.JOB_INSPECTION_APPROVED,
          tenantId: testTenant,
          actorId: 'usr_qc_lead',
          payload: expect.objectContaining({
            jobId: approvedJob.id,
            toStatus: 'WAITING_FOR_DISPATCH',
            quantityDelivered: 98,
            quantityRejected: 2
          })
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // 9. Router Compatibility & Dual Route Access
  // -------------------------------------------------------------------------
  describe('9. Router Compatibility & Dual Route Access', () => {
    const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);

    it('allows approval via /api/v1/quality-inspections/:id/approve-dispatch', async () => {
      const job = createMockJobDocument({ claimedBy: 'usr_qc_lead' });
      const approvedJob = createMockJobDocument({
        ...job,
        status: JobStatus.WAITING_FOR_DISPATCH,
        inInspection: false,
        waitingForDispatch: true,
        workflowState: { inInspection: false, waitingForDispatch: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(productionJobRepository, 'atomicApproveForDispatch').mockResolvedValue(approvedJob as any);
      jest.spyOn(eventBus, 'publish').mockResolvedValue();

      const res = await request(app)
        .post(`/api/v1/quality-inspections/${job.id}/approve-dispatch`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(validInspectionApprovalPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.waitingForDispatch).toBe(true);
    });

    it('allows approval via unified endpoint /api/v1/production-jobs/:id/approve-inspection', async () => {
      const job = createMockJobDocument({ claimedBy: 'usr_qc_lead' });
      const approvedJob = createMockJobDocument({
        ...job,
        status: JobStatus.WAITING_FOR_DISPATCH,
        inInspection: false,
        waitingForDispatch: true,
        workflowState: { inInspection: false, waitingForDispatch: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(productionJobRepository, 'atomicApproveForDispatch').mockResolvedValue(approvedJob as any);
      jest.spyOn(eventBus, 'publish').mockResolvedValue();

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(validInspectionApprovalPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.waitingForDispatch).toBe(true);
    });
  });
});
