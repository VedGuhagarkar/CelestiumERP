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

describe('Authoritative Inspection Phase Reconstruction: waiting for inspection → in inspection → waiting for dispatch / inspection (failure)', () => {
  jest.setTimeout(30000);
  const app = createApp();
  const testTenant = 'tenant_heat_treat_qa_001';
  const eventBus = DomainEventBus.getInstance();

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const createMockJobDocument = (overrides: any = {}) => {
    const doc: any = {
      _id: 'bo_qa_001',
      id: 'bo_qa_001',
      jobNumber: 'BO-202609-0888',
      boNumber: 'BO-202609-0888',
      tenantId: testTenant,
      poId: 'po_aero_888',
      poNumber: 'PO-2026-00888',
      grnId: 'grn_aero_888',
      grnNumber: 'GRN-202609-0888',
      status: JobStatus.WAITING_FOR_INSPECTION,
      waitingForProduction: false,
      inProduction: false,
      waitingForInspection: true,
      inInspection: false,
      waitingForDispatch: false,
      dispatched: false,
      inspection: false,
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
        loadedQuantity: 100,
        completedQuantity: 100,
        scrappedQuantity: 0
      },
      weightKg: 50,
      recipeSnapshot: {
        recipeId: 'rec_vac_4340',
        recipeCode: 'REC-VAC-4340',
        name: 'Vacuum Austenitize & Quench',
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
        furnaceId: 'furnace_vac_01',
        locationBay: 'Bay 1 Vacuum Bay'
      },
      timeline: {
        plannedStartDate: new Date('2026-09-10T08:00:00.000Z'),
        targetCompletionDate: new Date('2026-09-11T08:00:00.000Z')
      },
      execution: {
        furnaceCharge: {
          furnaceId: 'furnace_vac_01',
          furnaceCode: 'FURNACE-VAC-01',
          loadedWeightKg: 50
        },
        stageProgress: [],
        qualityHandoff: {
          completedQuantity: 100,
          scrappedQuantity: 0,
          handoffNotes: 'Production stages complete, ready for QA'
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

  describe('1. RBAC & Access Control for Inspection Operations', () => {
    it('should reject unauthorized user without inspection permissions from claiming BO', async () => {
      const nonQaToken = generateToken('usr_dispatch', ['DISPATCH_COORDINATOR']);
      const job = createMockJobDocument();

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/take-for-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${nonQaToken}`)
        .send({ notes: 'Attempting unauthorized inspection take' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should permit authorized QC inspector or metallurgist to take a BO for inspection', async () => {
      const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);
      const job = createMockJobDocument();

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(productionJobRepository, 'atomicTakeForInspection').mockResolvedValue({
        ...job,
        status: JobStatus.IN_INSPECTION,
        waitingForInspection: false,
        inInspection: true,
        execution: {
          ...job.execution,
          inspectionData: {
            inspectedBy: { userId: 'usr_qc_lead', role: 'QC_INSPECTOR' }
          }
        }
      } as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/take-for-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({ notes: 'Claimed by metallurgical inspector' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inInspection).toBe(true);
      expect(res.body.data.waitingForInspection).toBe(false);
    });
  });

  describe('2. State Preconditions & Mutual Exclusivity', () => {
    it('should reject take-for-inspection if the BO is NOT in waitingForInspection (e.g. in production)', async () => {
      const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);
      const notReadyJob = createMockJobDocument({
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true,
        waitingForInspection: false,
        inInspection: false
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(notReadyJob as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${notReadyJob.id}/take-for-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('waiting for inspection');
    });

    it('should enforce exactly ONE active flag when taking for inspection (sum = 1)', async () => {
      const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);
      const job = createMockJobDocument();

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      const updatedJob = {
        ...job,
        status: JobStatus.IN_INSPECTION,
        waitingForProduction: false,
        inProduction: false,
        waitingForInspection: false,
        inInspection: true,
        waitingForDispatch: false,
        dispatched: false,
        inspection: false
      };
      jest.spyOn(productionJobRepository, 'atomicTakeForInspection').mockResolvedValue(updatedJob as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/take-for-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({});

      expect(res.status).toBe(200);
      const data = res.body.data;
      const flags = [
        data.waitingForProduction,
        data.inProduction,
        data.waitingForInspection,
        data.inInspection,
        data.waitingForDispatch,
        data.dispatched,
        data.inspection
      ];
      const activeCount = flags.filter(Boolean).length;
      expect(activeCount).toBe(1);
      expect(data.inInspection).toBe(true);
    });
  });

  describe('3. Concurrency Protection & Race Condition Handling', () => {
    it('should return 409 Conflict if two inspectors attempt to take the same BO concurrently', async () => {
      const qcToken = generateToken('usr_qc_2', ['QC_INSPECTOR']);
      const job = createMockJobDocument();

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      // atomicTakeForInspection returns null when conditional query findOneAndUpdate finds no matching waitingForInspection doc
      jest.spyOn(productionJobRepository, 'atomicTakeForInspection').mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/take-for-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({ notes: 'Concurrent take attempt' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already claimed by another inspector');
    });
  });

  describe('4. Post-Production Lock Protection', () => {
    it('should reject production operations once BO is in waitingForInspection or inInspection', async () => {
      const prodToken = generateToken('usr_operator', ['FURNACE_OPERATOR']);
      const jobInInspection = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        waitingForInspection: false,
        inInspection: true
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(jobInInspection as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${jobInInspection.id}/take-production`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${prodToken}`)
        .send({
          furnaceCode: 'FURNACE-VAC-01',
          loadedPieceCount: 100,
          loadedWeightKg: 50,
          initialFurnaceTempC: 25,
          chargeNumber: 'CHG-999',
          shift: 'SHIFT_A'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('waiting for production');
    });
  });

  describe('5. Six Mandatory Heat-Treatment Fields Validation on Inspection Approval', () => {
    beforeEach(() => {
      const job = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        waitingForInspection: false,
        inInspection: true
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
    });

    const validApprovalPayload = {
      furnaceId: 'furnace_vac_01',
      furnaceCode: 'FURNACE-VAC-01',
      minHardness: 58,
      maxHardness: 62,
      scale: 'HRC',
      measuredAverage: 60.5,
      effectiveCaseDepthMm: 0.85,
      caseDepthMethod: 'Microhardness Traverse (HV0.5 to 50 HRC)',
      isCaseDepthCompliant: true,
      quantityReceived: 100,
      quantityDelivered: 98,
      quantityRejected: 2,
      testPoints: [
        { pointIdentifier: 'P1-SURFACE', location: 'SURFACE', measuredValue: 60.5, scale: 'HRC', passed: true },
        { pointIdentifier: 'P2-SURFACE', location: 'SURFACE', measuredValue: 60.5, scale: 'HRC', passed: true }
      ],
      remarks: 'All CQI-9 criteria satisfied'
    };

    it('should reject approval if furnace / equipment identifier is missing', async () => {
      const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);
      const job = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        waitingForInspection: false,
        inInspection: true,
        equipmentAssignment: null,
        execution: { furnaceCharge: null, inspectionData: null }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const { furnaceId, furnaceCode, ...missingFurnacePayload } = validApprovalPayload;

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(missingFurnacePayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message.toLowerCase()).toContain('furnace');
    });

    it('should reject approval if hardness specification is missing or invalid', async () => {
      const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);
      const job = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        waitingForInspection: false,
        inInspection: true
      });

      const { minHardness, maxHardness, ...missingSpecPayload } = validApprovalPayload;

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(missingSpecPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Hardness');
    });

    it('should reject approval if actual hardness measurements / test points are missing', async () => {
      const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);
      const job = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        waitingForInspection: false,
        inInspection: true
      });

      const { measuredAverage, ...missingAveragePayload } = validApprovalPayload;

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(missingAveragePayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message.toLowerCase()).toContain('actual hardness');
    });

    it('should reject approval if case depth measurement is missing', async () => {
      const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);
      const job = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        waitingForInspection: false,
        inInspection: true
      });

      const { effectiveCaseDepthMm, ...missingCaseDepthPayload } = validApprovalPayload;

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(missingCaseDepthPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message.toLowerCase()).toContain('case depth');
    });

    it('should reject approval if quantity received is <= 0', async () => {
      const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);
      const job = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        waitingForInspection: false,
        inInspection: true
      });

      const invalidQtyPayload = {
        ...validApprovalPayload,
        quantityReceived: 0
      };

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(invalidQtyPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message.toLowerCase()).toContain('quantity received');
    });

    it('should reject approval if quantity delivered exceeds quantity received or is <= 0', async () => {
      const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);
      const job = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        waitingForInspection: false,
        inInspection: true
      });

      const excessiveDeliveredPayload = {
        ...validApprovalPayload,
        quantityReceived: 100,
        quantityDelivered: 105 // exceeds 100!
      };

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(excessiveDeliveredPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message.toLowerCase()).toContain('quantity delivered');
    });
  });

  describe('6. Authoritative Transitions: Approval to Waiting for Dispatch & Inspection Boundary', () => {
    it('should transition BO to waitingForDispatch on valid approval and emit domain event', async () => {
      const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);
      const job = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        waitingForInspection: false,
        inInspection: true
      });

      const approvalPayload = {
        furnaceId: 'furnace_vac_01',
        furnaceCode: 'FURNACE-VAC-01',
        minHardness: 58,
        maxHardness: 62,
        scale: 'HRC',
        measuredAverage: 60.5,
        effectiveCaseDepthMm: 0.85,
        caseDepthMethod: 'Microhardness Traverse (HV0.5 to 50 HRC)',
        isCaseDepthCompliant: true,
        quantityReceived: 100,
        quantityDelivered: 95,
        quantityRejected: 5,
        testPoints: [
          { pointIdentifier: 'P1-SURFACE', location: 'SURFACE', measuredValue: 60.5, scale: 'HRC', passed: true }
        ],
        remarks: 'Passes AMS 2759 specification'
      };

      const approvedJob = {
        ...job,
        status: JobStatus.WAITING_FOR_DISPATCH,
        waitingForProduction: false,
        inProduction: false,
        waitingForInspection: false,
        inInspection: false,
        waitingForDispatch: true,
        dispatched: false,
        inspection: false,
        execution: {
          ...job.execution,
          inspectionData: {
            ...approvalPayload,
            inspectedBy: { userId: 'usr_qc_lead', role: 'QC_INSPECTOR' },
            inspectedAt: new Date()
          }
        }
      };

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(productionJobRepository, 'atomicApproveForDispatch').mockResolvedValue(approvedJob as any);
      const eventSpy = jest.spyOn(eventBus, 'publish').mockResolvedValue();

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

      // Verify domain event emitted
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: DomainEvents.JOB_INSPECTION_APPROVED
        })
      );
    });

    it('INSPECTION BOUNDARY: Inspection phase cannot directly mark a BO as DISPATCHED', async () => {
      // Trying to approve for dispatch should set waitingForDispatch: true, NEVER dispatched: true
      const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);
      const job = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        waitingForInspection: false,
        inInspection: true
      });

      const approvedJob = {
        ...job,
        status: JobStatus.WAITING_FOR_DISPATCH,
        waitingForDispatch: true,
        dispatched: false
      };

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(productionJobRepository, 'atomicApproveForDispatch').mockResolvedValue(approvedJob as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({
          furnaceId: 'furnace_vac_01',
          furnaceCode: 'FURNACE-VAC-01',
          minHardness: 58,
          maxHardness: 62,
          scale: 'HRC',
          measuredAverage: 60.5,
          effectiveCaseDepthMm: 0.85,
          caseDepthMethod: 'Traverse',
          quantityReceived: 100,
          quantityDelivered: 100
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('WAITING_FOR_DISPATCH');
      expect(res.body.data.dispatched).toBe(false);
    });
  });

  describe('7. Authoritative Inspection Failure & Quarantine Disposition', () => {
    it('should reject failure disposition if defectReason is missing', async () => {
      const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);
      const job = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        waitingForInspection: false,
        inInspection: true
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/fail-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({
          defectCategory: 'OUT_OF_SPEC_HARDNESS'
          // missing defectReason!
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toContain('defectReason');
    });

    it('should transition BO to failure state "inspection" (flag inspection: true, status: "INSPECTION")', async () => {
      const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);
      const job = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        waitingForInspection: false,
        inInspection: true
      });

      const failPayload = {
        defectCategory: 'OUT_OF_SPEC_HARDNESS',
        defectReason: 'Surface hardness 52 HRC below minimum 58 HRC specification.',
        furnaceId: 'furnace_vac_01',
        furnaceCode: 'FURNACE-VAC-01',
        quantityReceived: 100
      };

      const failedJob = {
        ...job,
        status: JobStatus.INSPECTION,
        waitingForProduction: false,
        inProduction: false,
        waitingForInspection: false,
        inInspection: false,
        waitingForDispatch: false,
        dispatched: false,
        inspection: true,
        execution: {
          ...job.execution,
          inspectionData: {
            ...failPayload,
            quantityDelivered: 0,
            quantityRejected: 100,
            inspectedBy: { userId: 'usr_qc_lead', role: 'QC_INSPECTOR' }
          }
        }
      };

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(productionJobRepository, 'atomicFailInspection').mockResolvedValue(failedJob as any);
      const eventSpy = jest.spyOn(eventBus, 'publish').mockResolvedValue();

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/fail-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(failPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inspection).toBe(true);
      expect(res.body.data.inInspection).toBe(false);
      expect(res.body.data.status).toBe('INSPECTION');

      // Verify domain event emitted
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: DomainEvents.JOB_INSPECTION_FAILED
        })
      );
    });
  });

  describe('8. Inspection Queue Endpoints', () => {
    it('should return waiting-for-inspection queue', async () => {
      const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);
      jest.spyOn(productionJobRepository, 'findWaitingForInspectionQueue').mockResolvedValue([
        createMockJobDocument()
      ] as any);

      const res = await request(app)
        .get('/api/v1/production-jobs/queue/waiting-for-inspection')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
    });

    it('should return in-inspection queue', async () => {
      const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);
      jest.spyOn(productionJobRepository, 'findInInspectionQueue').mockResolvedValue([
        createMockJobDocument({
          status: JobStatus.IN_INSPECTION,
          waitingForInspection: false,
          inInspection: true
        })
      ] as any);

      const res = await request(app)
        .get('/api/v1/production-jobs/queue/in-inspection')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
    });

    it('should return waiting-for-dispatch queue', async () => {
      const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);
      jest.spyOn(productionJobRepository, 'findWaitingForDispatchQueue').mockResolvedValue([
        createMockJobDocument({
          status: JobStatus.WAITING_FOR_DISPATCH,
          waitingForInspection: false,
          waitingForDispatch: true
        })
      ] as any);

      const res = await request(app)
        .get('/api/v1/production-jobs/queue/waiting-for-dispatch')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
    });

    it('should return inspection-failed queue', async () => {
      const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);
      jest.spyOn(productionJobRepository, 'findInspectionFailedQueue').mockResolvedValue([
        createMockJobDocument({
          status: JobStatus.INSPECTION,
          waitingForInspection: false,
          inspection: true
        })
      ] as any);

      const res = await request(app)
        .get('/api/v1/production-jobs/queue/inspection-failed')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
    });
  });
});
