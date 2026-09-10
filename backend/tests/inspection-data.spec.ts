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

describe('Inspection Phase Prompt 4: Required Heat-Treatment Inspection Data Structure', () => {
  jest.setTimeout(30000);
  const app = createApp();
  const testTenant = 'tenant_heat_treat_data_004';

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const createMockJobDocument = (overrides: any = {}) => {
    const doc: any = {
      _id: overrides._id || 'bo_inspect_data_001',
      id: overrides.id || overrides._id || 'bo_inspect_data_001',
      jobNumber: overrides.jobNumber || 'BO-202609-0904',
      boNumber: overrides.boNumber || overrides.jobNumber || 'BO-202609-0904',
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

      claimedBy: overrides.claimedBy ?? 'usr_qc_001',
      claimedAt: overrides.claimedAt ?? new Date(),
      claimedByEmail: overrides.claimedByEmail ?? 'usr_qc_001@factory.com',
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
          surfaceHardnessScale: 'HRC'
        }
      },

      specificationSnapshot: {
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
          minMm: 0.75,
          maxMm: 1.0,
          method: 'MICROHARDNESS_TRAVERSE'
        }
      },

      equipmentAssignment: {
        furnaceCode: 'FURNACE-VAC-01',
        furnaceId: 'furnace_vac_01',
        locationBay: 'Bay 1 Vacuum Bay'
      },

      execution: {
        furnaceCharge: {
          furnaceId: 'furnace_vac_01',
          furnaceCode: 'FURNACE-VAC-01',
          loadedWeightKg: 65,
          chargeNumber: 'CHG-2026-0904'
        },
        stageProgress: [
          { sequence: 1, stageName: 'Pre-Heat', status: 'COMPLETED' },
          { sequence: 2, stageName: 'Austenitizing Soak', status: 'COMPLETED' },
          { sequence: 3, stageName: 'Oil Quench', status: 'COMPLETED' }
        ],
        inspectionData: overrides.execution?.inspectionData ?? {
          furnaceId: 'furnace_vac_01',
          furnaceCode: 'FURNACE-VAC-01',
          minHardness: 58,
          maxHardness: 62,
          scale: 'HRC',
          disposition: 'PENDING'
        }
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

    // Default furnaceCapacityRepository mock to resolve furnace_vac_01
    jest.spyOn(furnaceCapacityRepository, 'findFurnaceById').mockImplementation(async (_tenant: string, id: string) => {
      if (id === 'furnace_vac_01' || id === 'furnace_pit_02') {
        return {
          id,
          _id: id,
          furnaceCode: id === 'furnace_vac_01' ? 'FURNACE-VAC-01' : 'FURNACE-PIT-02',
          status: 'OPERATIONAL'
        } as any;
      }
      return null;
    });

    jest.spyOn(furnaceCapacityRepository, 'findFurnaceByCode').mockImplementation(async (_tenant: string, code: string) => {
      if (code === 'FURNACE-VAC-01' || code === 'FURNACE-PIT-02') {
        return {
          id: code === 'FURNACE-VAC-01' ? 'furnace_vac_01' : 'furnace_pit_02',
          _id: code === 'FURNACE-VAC-01' ? 'furnace_vac_01' : 'furnace_pit_02',
          furnaceCode: code,
          status: 'OPERATIONAL'
        } as any;
      }
      return null;
    });

    jest.spyOn(machineRepository, 'findById').mockResolvedValue(null);
    jest.spyOn(machineRepository, 'findByCode').mockResolvedValue(null);
  });

  describe('1. All Six Required Fields Present', () => {
    it('should successfully record all six mandatory heat-treatment fields while in inspection', async () => {
      const qcToken = generateToken('usr_qc_001', ['QC_INSPECTOR']);
      const job = createMockJobDocument({ inInspection: true, status: JobStatus.IN_INSPECTION });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const payload = {
        furnaceId: 'furnace_vac_01',
        furnaceCode: 'FURNACE-VAC-01',
        minHardness: 58,
        maxHardness: 62,
        scale: 'HRC',
        measuredAverage: 60.5,
        effectiveCaseDepthMm: 0.85,
        caseDepthMethod: 'MICROHARDNESS_TRAVERSE',
        quantityReceived: 100,
        quantityDelivered: 96,
        quantityRejected: 4,
        testPoints: [
          { pointIdentifier: 'TP-1', location: 'SURFACE', value: 60.5, scale: 'HRC', passed: true }
        ],
        remarks: 'All test points conforming to ASTM E18'
      };

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/inspection-data`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(job.save).toHaveBeenCalled();

      const saved = job.execution.inspectionData;
      // Structured and flat accessors verified
      expect(saved.furnaceId).toBe('furnace_vac_01');
      expect(saved.furnaceCode).toBe('FURNACE-VAC-01');
      expect(saved.equipment.furnaceId).toBe('furnace_vac_01');

      expect(saved.minHardness).toBe(58);
      expect(saved.maxHardness).toBe(62);
      expect(saved.hardnessSpecification.minHardness).toBe(58);
      expect(saved.hardnessSpecification.maxHardness).toBe(62);

      expect(saved.measuredAverage).toBe(60.5);
      expect(saved.actualHardness.measuredAverage).toBe(60.5);
      expect(saved.isHardnessCompliant).toBe(true);

      expect(saved.effectiveCaseDepthMm).toBe(0.85);
      expect(saved.caseDepth.effectiveCaseDepthMm).toBe(0.85);

      expect(saved.quantityReceived).toBe(100);
      expect(saved.quantityDelivered).toBe(96);
      expect(saved.quantityRejected).toBe(4);
      expect(saved.quantities.quantityReceived).toBe(100);
      expect(saved.quantities.quantityDelivered).toBe(96);
    });

    it('should successfully approve inspection for dispatch when all six fields are valid and complete', async () => {
      const qcToken = generateToken('usr_qc_001', ['QC_INSPECTOR']);
      const job = createMockJobDocument({ inInspection: true, status: JobStatus.IN_INSPECTION });
      const approvedJob = {
        ...job,
        status: JobStatus.WAITING_FOR_DISPATCH,
        waitingForDispatch: true,
        inInspection: false,
        workflowState: {
          ...job.workflowState,
          waitingForDispatch: true,
          inInspection: false
        }
      };

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);
      jest.spyOn(productionJobRepository, 'atomicApproveForDispatch').mockResolvedValue(approvedJob as any);

      const approvalPayload = {
        furnaceId: 'furnace_vac_01',
        furnaceCode: 'FURNACE-VAC-01',
        minHardness: 58,
        maxHardness: 62,
        scale: 'HRC',
        measuredAverage: 60.5,
        effectiveCaseDepthMm: 0.85,
        quantityReceived: 100,
        quantityDelivered: 96,
        quantityRejected: 4,
        remarks: 'Full metallurgical conformance'
      };

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(approvalPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.waitingForDispatch).toBe(true);
      expect(res.body.data.inInspection).toBe(false);
      expect(res.body.data.status).toBe(JobStatus.WAITING_FOR_DISPATCH);

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          name: DomainEvents.JOB_INSPECTION_APPROVED
        })
      );
    });
  });

  describe('2. Each Field Missing Individually during Approval', () => {
    it('should reject approval when furnace/equipment is missing', async () => {
      const qcToken = generateToken('usr_qc_001', ['QC_INSPECTOR']);
      // Job with no assigned equipment or furnaceCharge
      const job = createMockJobDocument({
        equipmentAssignment: null,
        execution: { furnaceCharge: null, stageProgress: [], inspectionData: null }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({
          minHardness: 58,
          maxHardness: 62,
          scale: 'HRC',
          measuredAverage: 60.5,
          effectiveCaseDepthMm: 0.85,
          quantityReceived: 100,
          quantityDelivered: 96
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Furnace\/Equipment/i);
    });

    it('should reject approval when hardness specification is missing', async () => {
      const qcToken = generateToken('usr_qc_001', ['QC_INSPECTOR']);
      const job = createMockJobDocument({
        specificationSnapshot: null,
        recipeSnapshot: { metallurgicalTargets: null },
        execution: { inspectionData: null }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({
          furnaceId: 'furnace_vac_01',
          furnaceCode: 'FURNACE-VAC-01',
          measuredAverage: 60.5,
          effectiveCaseDepthMm: 0.85,
          quantityReceived: 100,
          quantityDelivered: 96
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Hardness Specification/i);
    });

    it('should reject approval when actual hardness is missing', async () => {
      const qcToken = generateToken('usr_qc_001', ['QC_INSPECTOR']);
      const job = createMockJobDocument({
        execution: { inspectionData: null }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({
          furnaceId: 'furnace_vac_01',
          furnaceCode: 'FURNACE-VAC-01',
          minHardness: 58,
          maxHardness: 62,
          effectiveCaseDepthMm: 0.85,
          quantityReceived: 100,
          quantityDelivered: 96
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Actual Hardness/i);
    });

    it('should reject approval when case depth is missing', async () => {
      const qcToken = generateToken('usr_qc_001', ['QC_INSPECTOR']);
      const job = createMockJobDocument({
        execution: { inspectionData: null }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({
          furnaceId: 'furnace_vac_01',
          furnaceCode: 'FURNACE-VAC-01',
          minHardness: 58,
          maxHardness: 62,
          measuredAverage: 60.5,
          quantityReceived: 100,
          quantityDelivered: 96
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Case Depth/i);
    });

    it('should reject approval when quantity received is missing', async () => {
      const qcToken = generateToken('usr_qc_001', ['QC_INSPECTOR']);
      const job = createMockJobDocument({
        quantity: null,
        execution: { inspectionData: null }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({
          furnaceId: 'furnace_vac_01',
          furnaceCode: 'FURNACE-VAC-01',
          minHardness: 58,
          maxHardness: 62,
          measuredAverage: 60.5,
          effectiveCaseDepthMm: 0.85,
          quantityDelivered: 96
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Quantity Received/i);
    });

    it('should reject approval when quantity delivered is missing', async () => {
      const qcToken = generateToken('usr_qc_001', ['QC_INSPECTOR']);
      const job = createMockJobDocument({
        execution: { inspectionData: null }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({
          furnaceId: 'furnace_vac_01',
          furnaceCode: 'FURNACE-VAC-01',
          minHardness: 58,
          maxHardness: 62,
          measuredAverage: 60.5,
          effectiveCaseDepthMm: 0.85,
          quantityReceived: 100
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Quantity Delivered/i);
    });
  });

  describe('3. Negative Numeric Values', () => {
    it('should reject negative actual measured hardness', async () => {
      const qcToken = generateToken('usr_qc_001', ['QC_INSPECTOR']);
      const job = createMockJobDocument({ inInspection: true });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/inspection-data`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({
          measuredAverage: -5.0
        });

      expect([400, 422]).toContain(res.status);
      expect(JSON.stringify(res.body)).toMatch(/non-negative|greater than or equal to 0/i);
    });

    it('should reject negative case depth', async () => {
      const qcToken = generateToken('usr_qc_001', ['QC_INSPECTOR']);
      const job = createMockJobDocument({ inInspection: true });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/inspection-data`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({
          effectiveCaseDepthMm: -0.25
        });

      expect([400, 422]).toContain(res.status);
      expect(JSON.stringify(res.body)).toMatch(/non-negative|greater than or equal to 0/i);
    });

    it('should reject negative quantity received', async () => {
      const qcToken = generateToken('usr_qc_001', ['QC_INSPECTOR']);
      const job = createMockJobDocument({ inInspection: true });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/inspection-data`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({
          quantityReceived: -10
        });

      expect([400, 422]).toContain(res.status);
      expect(JSON.stringify(res.body)).toMatch(/non-negative|greater than or equal to 0/i);
    });

    it('should reject negative quantity delivered', async () => {
      const qcToken = generateToken('usr_qc_001', ['QC_INSPECTOR']);
      const job = createMockJobDocument({ inInspection: true });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/inspection-data`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({
          quantityDelivered: -1
        });

      expect([400, 422]).toContain(res.status);
      expect(JSON.stringify(res.body)).toMatch(/non-negative|greater than or equal to 0/i);
    });

    it('should reject negative hardness specification minHardness', async () => {
      const qcToken = generateToken('usr_qc_001', ['QC_INSPECTOR']);
      const job = createMockJobDocument({ inInspection: true });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/inspection-data`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({
          minHardness: -58
        });

      expect([400, 422]).toContain(res.status);
      expect(JSON.stringify(res.body)).toMatch(/non-negative|greater than or equal to 0/i);
    });
  });

  describe('4. Malformed Numeric Values & Precision Preservation', () => {
    it('should reject non-numeric string values for actual hardness', async () => {
      const qcToken = generateToken('usr_qc_001', ['QC_INSPECTOR']);
      const job = createMockJobDocument({ inInspection: true });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/inspection-data`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({
          measuredAverage: 'SIXTY_POINT_FIVE'
        });

      expect([400, 422]).toContain(res.status);
      expect(JSON.stringify(res.body)).toMatch(/number|received string/i);
    });

    it('should reject non-numeric string values for case depth', async () => {
      const qcToken = generateToken('usr_qc_001', ['QC_INSPECTOR']);
      const job = createMockJobDocument({ inInspection: true });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/inspection-data`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({
          effectiveCaseDepthMm: 'ZERO_POINT_EIGHT'
        });

      expect([400, 422]).toContain(res.status);
      expect(JSON.stringify(res.body)).toMatch(/number|received string/i);
    });

    it('should preserve appropriate decimal precision for actual hardness and case depth', async () => {
      const qcToken = generateToken('usr_qc_001', ['QC_INSPECTOR']);
      const job = createMockJobDocument({ inInspection: true });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/inspection-data`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({
          measuredAverage: 60.475,
          effectiveCaseDepthMm: 0.8625
        });

      expect(res.status).toBe(200);
      expect(job.save).toHaveBeenCalled();
      expect(job.execution.inspectionData.measuredAverage).toBe(60.475);
      expect(job.execution.inspectionData.effectiveCaseDepthMm).toBe(0.8625);
    });
  });

  describe('5. Furnace / Equipment Master Relationship Validation', () => {
    it('should reject arbitrary furnace/equipment identifier not present in master records', async () => {
      const qcToken = generateToken('usr_qc_001', ['QC_INSPECTOR']);
      const job = createMockJobDocument({ inInspection: true });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/inspection-data`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({
          furnaceId: 'ARBITRARY_FURNACE_9999',
          furnaceCode: 'FAKE-9999'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid equipment.*ARBITRARY_FURNACE_9999.*Arbitrary equipment identifiers are prohibited/i);
    });

    it('should accept valid furnace identifier from equipment master records', async () => {
      const qcToken = generateToken('usr_qc_001', ['QC_INSPECTOR']);
      const job = createMockJobDocument({ inInspection: true });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/inspection-data`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({
          furnaceId: 'furnace_pit_02',
          furnaceCode: 'FURNACE-PIT-02'
        });

      expect(res.status).toBe(200);
      expect(job.execution.inspectionData.furnaceId).toBe('furnace_pit_02');
      expect(job.execution.inspectionData.furnaceCode).toBe('FURNACE-PIT-02');
    });
  });

  describe('6. Inspection State Restriction (workflow.inInspection = true)', () => {
    it('should reject editing inspection data when BO is in WAITING_FOR_PRODUCTION', async () => {
      const qcToken = generateToken('usr_qc_001', ['QC_INSPECTOR']);
      const job = createMockJobDocument({
        status: JobStatus.WAITING_FOR_PRODUCTION,
        waitingForProduction: true,
        inInspection: false,
        workflowState: { waitingForProduction: true, inInspection: false }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/inspection-data`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({ measuredAverage: 60.0 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not in active inspection/i);
    });

    it('should reject editing inspection data when BO is in IN_PRODUCTION', async () => {
      const qcToken = generateToken('usr_qc_001', ['QC_INSPECTOR']);
      const job = createMockJobDocument({
        status: JobStatus.IN_PRODUCTION,
        inProduction: true,
        inInspection: false,
        workflowState: { inProduction: true, inInspection: false }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/inspection-data`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({ measuredAverage: 60.0 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not in active inspection/i);
    });

    it('should reject editing inspection data when BO is in WAITING_FOR_INSPECTION (before being taken)', async () => {
      const qcToken = generateToken('usr_qc_001', ['QC_INSPECTOR']);
      const job = createMockJobDocument({
        status: JobStatus.WAITING_FOR_INSPECTION,
        waitingForInspection: true,
        inInspection: false,
        workflowState: { waitingForInspection: true, inInspection: false }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/inspection-data`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({ measuredAverage: 60.0 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not in active inspection/i);
    });

    it('should reject editing inspection data when BO has already been approved for dispatch', async () => {
      const qcToken = generateToken('usr_qc_001', ['QC_INSPECTOR']);
      const job = createMockJobDocument({
        status: JobStatus.WAITING_FOR_DISPATCH,
        waitingForDispatch: true,
        inInspection: false,
        workflowState: { waitingForDispatch: true, inInspection: false }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/inspection-data`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({ measuredAverage: 60.0 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not in active inspection/i);
    });
  });

  describe('7. Planned vs Actual Distinction Preservation', () => {
    it('should preserve required specification separate from actual measured hardness and never overwrite recipe specification', async () => {
      const qcToken = generateToken('usr_qc_001', ['QC_INSPECTOR']);
      const job = createMockJobDocument({ inInspection: true });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      // Attempt to submit measuredAverage = 61.2, but without passing specification
      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/inspection-data`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({
          measuredAverage: 61.2
        });

      expect(res.status).toBe(200);
      // Hardness specification must remain pinned to authoritative recipe limits 58 - 62
      expect(job.execution.inspectionData.minHardness).toBe(58);
      expect(job.execution.inspectionData.maxHardness).toBe(62);
      expect(job.execution.inspectionData.hardnessSpecification.minHardness).toBe(58);
      expect(job.execution.inspectionData.hardnessSpecification.maxHardness).toBe(62);
      // Measured average is kept distinct
      expect(job.execution.inspectionData.measuredAverage).toBe(61.2);
      expect(job.execution.inspectionData.actualHardness.measuredAverage).toBe(61.2);
    });

    it('should reject quantity delivered exceeding quantity received', async () => {
      const qcToken = generateToken('usr_qc_001', ['QC_INSPECTOR']);
      const job = createMockJobDocument({ inInspection: true });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/inspection-data`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({
          quantityReceived: 100,
          quantityDelivered: 115
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cannot exceed quantity received/i);
    });
  });
});
