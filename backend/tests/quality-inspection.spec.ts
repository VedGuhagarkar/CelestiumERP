import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { qualityInspectionRepository } from '../src/modules/quality-inspection/quality-inspection.repository.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { workforceCapacityRepository } from '../src/modules/workforce-capacity/workforce-capacity.repository.js';
import { qualityPlanningRepository } from '../src/modules/quality-planning/quality-planning.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { DomainEventBus } from '../src/core/events/domain-event-bus.js';
import { DomainEvents } from '../src/core/constants/events.js';

describe('Quality Inspection Domain & Quality Lifecycle State Machine', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_001';
  const eventBus = DomainEventBus.getInstance();

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const mockJob = {
    id: 'job_001',
    jobNumber: 'JOB-202608-0001',
    planId: 'plan_001',
    planNumber: 'PLAN-202608-0001',
    tenantId: testTenant,
    status: 'QUALITY_CHECK',
    customer: {
      customerId: 'cust_001',
      customerCode: 'CUST-AERO-001',
      customerName: 'Apex Aerospace Components'
    },
    item: {
      itemId: 'item_4140',
      itemCode: 'MAT-4140-BAR',
      itemName: 'AISI 4140 Round Bar',
      materialGrade: 'AISI 4140',
      uom: 'KG'
    },
    quantity: {
      targetQuantity: 500,
      loadedQuantity: 500,
      completedQuantity: 495,
      scrappedQuantity: 5
    },
    recipeSnapshot: {
      recipeId: 'rec_001',
      recipeCode: 'REC-CARB-4140',
      revisionNumber: 1,
      processFamily: 'CARBURIZING',
      name: 'Carburizing Cycle 920C',
      applicableMaterialGrades: ['AISI 4140'],
      stages: [
        {
          stageName: 'Carburize Soak',
          targetTemperatureC: 920,
          soakTimeMinutes: 240
        }
      ],
      metallurgicalTargets: {
        targetHardnessMin: 58,
        targetHardnessMax: 62,
        hardnessScale: 'HRC',
        effectiveCaseDepthMinMm: 0.8,
        effectiveCaseDepthMaxMm: 1.2
      }
    },
    specificationSnapshot: {
      specificationId: 'spec_001',
      specCode: 'SPEC-AMS-2759',
      revisionNumber: 1,
      title: 'Aerospace Heat Treatment Specification',
      customerCode: 'CUST-AERO-001',
      surfaceHardness: { min: 58, max: 62, scale: 'HRC' },
      coreHardness: { min: 30, max: 35, scale: 'HRC' },
      caseDepth: { effectiveCaseDepthMinMm: 0.8, effectiveCaseDepthMaxMm: 1.2 },
      microstructure: { requiredStructure: 'Tempered Martensite' },
      customerAcceptance: { samplingPlan: 'LEVEL_II', cocRequired: true }
    },
    materialAllocations: [
      {
        heatLotId: 'hl_001',
        heatLotNumber: 'HL-202608-0001',
        allocatedQuantity: 500,
        uom: 'KG'
      }
    ],
    execution: {
      qualityHandoff: {
        inspectionRequestId: 'INSP-REQ-202608-1001',
        status: 'PENDING_INSPECTION'
      }
    },
    save: jest.fn().mockImplementation(function (this: any) {
      return Promise.resolve(this);
    })
  };

  const mockInspector = {
    id: 'emp_qc_001',
    employeeCode: 'EMP-QC-01',
    fullName: 'Elena Rostova',
    status: 'ACTIVE',
    skills: [
      {
        skillCode: 'METALLURGICAL_TESTING',
        isCertified: true
      }
    ]
  };

  const createMockInspectionDocument = (overrides: any = {}) => {
    const doc: any = {
      id: 'insp_001',
      inspectionNumber: 'INSP-202608-0001',
      tenantId: testTenant,
      jobId: 'job_001',
      jobNumber: 'JOB-202608-0001',
      planId: 'plan_001',
      planNumber: 'PLAN-202608-0001',
      status: 'PENDING',
      disposition: 'PENDING',
      customer: mockJob.customer,
      item: mockJob.item,
      heatLots: mockJob.materialAllocations,
      recipeSnapshot: mockJob.recipeSnapshot,
      specificationSnapshot: mockJob.specificationSnapshot,
      inspectionQuantity: {
        sampleSize: 5,
        totalLotQuantity: 495,
        unitOfMeasure: 'KG'
      },
      assignedInspector: null,
      testResults: {
        hardnessTests: []
      },
      reinspection: {
        reinspectionCount: 0,
        parentInspectionId: null,
        reinspectionReason: null
      },
      assignmentHistory: [],
      transitionHistory: [
        {
          fromStatus: 'PENDING',
          toStatus: 'PENDING',
          timestamp: new Date(),
          performedBy: { userId: 'usr_qc_lead' },
          reason: 'Quality inspection request created'
        }
      ],
      isDeleted: false,
      save: jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      }),
      toJSON: function () {
        return { ...this };
      },
      ...overrides
    };
    return doc;
  };

  beforeEach(() => {
    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);
    jest.spyOn(qualityPlanningRepository, 'findApplicablePlan').mockResolvedValue(null);
    jest.spyOn(qualityPlanningRepository, 'findById').mockResolvedValue(null);
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

  describe('POST /api/v1/quality-inspections (Inspection Initiation)', () => {
    it('should create a quality inspection with frozen job and specification snapshots', async () => {
      const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);
      const publishSpy = jest.spyOn(eventBus, 'publish');

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob as any);
      jest.spyOn(qualityInspectionRepository, 'generateNextInspectionNumber').mockResolvedValue('INSP-202608-0001');

      const mockCreated = createMockInspectionDocument();
      jest.spyOn(qualityInspectionRepository, 'create').mockResolvedValue(mockCreated as any);

      const res = await request(app)
        .post('/api/v1/quality-inspections')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({
          jobId: 'job_001',
          sampleSize: 5,
          notes: 'Standard Level II Aerospace Sampling'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inspectionNumber).toBe('INSP-202608-0001');
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.disposition).toBe('PENDING');
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({ name: DomainEvents.QC_INSPECTION_CREATED })
      );
    });

    it('should auto-advance to IN_REVIEW when inspector is assigned during creation', async () => {
      const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob as any);
      jest.spyOn(workforceCapacityRepository, 'findEmployeeById').mockResolvedValue(mockInspector as any);
      jest.spyOn(qualityInspectionRepository, 'generateNextInspectionNumber').mockResolvedValue('INSP-202608-0002');

      const mockCreated = createMockInspectionDocument({
        status: 'IN_REVIEW',
        assignedInspector: {
          inspectorId: mockInspector.id,
          inspectorCode: mockInspector.employeeCode,
          inspectorName: mockInspector.fullName
        }
      });
      jest.spyOn(qualityInspectionRepository, 'create').mockResolvedValue(mockCreated as any);

      const res = await request(app)
        .post('/api/v1/quality-inspections')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({
          jobId: 'job_001',
          assignedInspectorId: 'emp_qc_001'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('IN_REVIEW');
      expect(res.body.data.assignedInspector.inspectorCode).toBe('EMP-QC-01');
    });

    it('should reject creation if production job does not exist', async () => {
      const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/quality-inspections')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({ jobId: 'non_existent_job' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/quality-inspections/:id/assign (Inspector Assignment)', () => {
    it('should assign certified inspector and advance status to IN_REVIEW', async () => {
      const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);
      const publishSpy = jest.spyOn(eventBus, 'publish');

      const mockDoc = createMockInspectionDocument({ status: 'PENDING' });
      jest.spyOn(qualityInspectionRepository, 'findById').mockResolvedValue(mockDoc as any);
      jest.spyOn(workforceCapacityRepository, 'findEmployeeById').mockResolvedValue(mockInspector as any);

      const res = await request(app)
        .post('/api/v1/quality-inspections/insp_001/assign')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({
          inspectorId: 'emp_qc_001',
          reason: 'Assigned for micro-indentation hardness survey'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('IN_REVIEW');
      expect(res.body.data.assignedInspector.inspectorName).toBe('Elena Rostova');
      expect(res.body.data.assignmentHistory).toHaveLength(1);
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({ name: DomainEvents.QC_INSPECTION_STARTED })
      );
    });

    it('should reject assignment if employee is not found', async () => {
      const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);

      const mockDoc = createMockInspectionDocument({ status: 'PENDING' });
      jest.spyOn(qualityInspectionRepository, 'findById').mockResolvedValue(mockDoc as any);
      jest.spyOn(workforceCapacityRepository, 'findEmployeeById').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/quality-inspections/insp_001/assign')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({ inspectorId: 'invalid_emp' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('not active or does not exist');
    });

    it('should block reassigning inspector on APPROVED inspection', async () => {
      const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);

      const mockDoc = createMockInspectionDocument({ status: 'APPROVED' });
      jest.spyOn(qualityInspectionRepository, 'findById').mockResolvedValue(mockDoc as any);

      const res = await request(app)
        .post('/api/v1/quality-inspections/insp_001/assign')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({ inspectorId: 'emp_qc_001' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Cannot reassign inspector on APPROVED inspection');
    });
  });

  describe('POST /api/v1/quality-inspections/:id/test-results (Test Results Logging)', () => {
    it('should record comprehensive metallurgical test results and compute overall evaluation', async () => {
      const qcToken = generateToken('usr_inspector', ['QC_INSPECTOR']);
      const publishSpy = jest.spyOn(eventBus, 'publish');

      const mockDoc = createMockInspectionDocument({ status: 'IN_REVIEW' });
      jest.spyOn(qualityInspectionRepository, 'findById').mockResolvedValue(mockDoc as any);

      const res = await request(app)
        .post('/api/v1/quality-inspections/insp_001/test-results')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({
          hardnessTests: [
            { pointIdentifier: 'Surface-1', location: 'SURFACE', measuredValue: 60.5, scale: 'HRC', targetMin: 58, targetMax: 62, passed: true },
            { pointIdentifier: 'Surface-2', location: 'SURFACE', measuredValue: 60.0, scale: 'HRC', targetMin: 58, targetMax: 62, passed: true },
            { pointIdentifier: 'Core-1', location: 'CORE', measuredValue: 32.5, scale: 'HRC', targetMin: 30, targetMax: 35, passed: true }
          ],
          caseDepth: {
            effectiveCaseDepthMm: 1.05,
            totalCaseDepthMm: 1.45,
            cutoffHardnessHrc: 50,
            targetMinMm: 0.8,
            targetMaxMm: 1.2,
            passed: true
          },
          microstructure: {
            observedStructure: 'Fine Tempered Martensite with < 3% Retained Austenite',
            grainSizeAstm: 8,
            retainedAustenitePercent: 2.5,
            passed: true
          },
          visualDimensional: {
            distortionMm: 0.05,
            surfaceOxidationAcceptable: true,
            quenchCracksPresent: false,
            dimensionsWithinTolerance: true,
            passed: true
          },
          pyrometry: {
            pyrometryArchiveId: 'PYRO-202608-1001',
            soakTemperatureCompliant: true,
            soakTimeCompliant: true,
            quenchDelayCompliant: true,
            coolingRateCompliant: true,
            passed: true
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.testResults.overallTestPassed).toBe(true);
      expect(res.body.data.testResults.hardnessTests).toHaveLength(3);
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({ name: DomainEvents.QC_MEASUREMENTS_RECORDED })
      );
    });

    it('should evaluate overallTestPassed as false when any test point fails', async () => {
      const qcToken = generateToken('usr_inspector', ['QC_INSPECTOR']);

      const mockDoc = createMockInspectionDocument({ status: 'IN_REVIEW' });
      jest.spyOn(qualityInspectionRepository, 'findById').mockResolvedValue(mockDoc as any);

      const res = await request(app)
        .post('/api/v1/quality-inspections/insp_001/test-results')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({
          hardnessTests: [
            { pointIdentifier: 'Surface-1', location: 'SURFACE', measuredValue: 55.0, scale: 'HRC', targetMin: 58, targetMax: 62, passed: false }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.data.testResults.overallTestPassed).toBe(false);
    });
  });

  describe('POST /api/v1/quality-inspections/:id/approve (Approval Disposition)', () => {
    it('should approve conforming inspection and update linked production job', async () => {
      const metallurgistToken = generateToken('usr_metallurgist', ['METALLURGIST']);
      const publishSpy = jest.spyOn(eventBus, 'publish');

      const mockDoc = createMockInspectionDocument({
        status: 'IN_REVIEW',
        testResults: {
          hardnessTests: [{ pointIdentifier: 'Surface-1', location: 'SURFACE', measuredValue: 60.0, scale: 'HRC', passed: true }],
          overallTestPassed: true
        }
      });
      jest.spyOn(qualityInspectionRepository, 'findById').mockResolvedValue(mockDoc as any);
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob as any);

      const res = await request(app)
        .post('/api/v1/quality-inspections/insp_001/approve')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metallurgistToken}`)
        .send({
          disposition: 'CONFORMING',
          remarks: 'All aerospace hardness and case depth criteria fully met. CoC authorized.'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('APPROVED');
      expect(res.body.data.disposition).toBe('CONFORMING');
      expect(res.body.data.approvedBy.role).toBe('METALLURGIST');
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({ name: DomainEvents.QC_APPROVED })
      );
    });

    it('should reject approval if mandatory test records are missing', async () => {
      const metallurgistToken = generateToken('usr_metallurgist', ['METALLURGIST']);

      const mockDoc = createMockInspectionDocument({
        status: 'IN_REVIEW',
        testResults: { hardnessTests: [] }
      });
      jest.spyOn(qualityInspectionRepository, 'findById').mockResolvedValue(mockDoc as any);

      const res = await request(app)
        .post('/api/v1/quality-inspections/insp_001/approve')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metallurgistToken}`)
        .send({ disposition: 'CONFORMING' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Mandatory test results have not been recorded');
    });

    it('should reject approval as CONFORMING if test records contain failing measurements', async () => {
      const metallurgistToken = generateToken('usr_metallurgist', ['METALLURGIST']);

      const mockDoc = createMockInspectionDocument({
        status: 'IN_REVIEW',
        testResults: {
          hardnessTests: [{ pointIdentifier: 'Surface-1', location: 'SURFACE', measuredValue: 54.0, scale: 'HRC', passed: false }],
          overallTestPassed: false
        }
      });
      jest.spyOn(qualityInspectionRepository, 'findById').mockResolvedValue(mockDoc as any);

      const res = await request(app)
        .post('/api/v1/quality-inspections/insp_001/approve')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metallurgistToken}`)
        .send({ disposition: 'CONFORMING' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('as CONFORMING when test records contain failing measurements');
    });
  });

  describe('POST /api/v1/quality-inspections/:id/reject (Rejection & Non-Conformance NCR)', () => {
    it('should reject inspection, generate NCR, flag quarantine, and emit domain events', async () => {
      const metallurgistToken = generateToken('usr_metallurgist', ['METALLURGIST']);
      const publishSpy = jest.spyOn(eventBus, 'publish');

      const mockDoc = createMockInspectionDocument({ status: 'IN_REVIEW' });
      jest.spyOn(qualityInspectionRepository, 'findById').mockResolvedValue(mockDoc as any);
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob as any);

      const res = await request(app)
        .post('/api/v1/quality-inspections/insp_001/reject')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metallurgistToken}`)
        .send({
          defectCode: 'DEF-HARDNESS-LOW',
          defectDescription: 'Surface hardness measured 52 HRC, below minimum aerospace threshold of 58 HRC',
          severity: 'CRITICAL',
          rootCauseCategory: 'ATMOSPHERE_LOSS',
          dispositionRecommendation: 'REWORK_REHEAT',
          quarantineRequired: true,
          quarantineLocationBay: 'BAY_Q_HOLD_01'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('REJECTED');
      expect(res.body.data.disposition).toBe('NON_CONFORMING');
      expect(res.body.data.nonConformance.ncrNumber).toMatch(/^NCR-/);
      expect(res.body.data.nonConformance.severity).toBe('CRITICAL');
      expect(res.body.data.nonConformance.quarantineRequired).toBe(true);
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({ name: DomainEvents.QC_REJECTED })
      );
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({ name: DomainEvents.QC_NCR_RAISED })
      );
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({ name: DomainEvents.WAREHOUSE_MATERIAL_QUARANTINED })
      );
    });
  });

  describe('POST /api/v1/quality-inspections/:id/reinspection (Reinspection Workflow)', () => {
    it('should request reinspection cycle on rejected lot, increment cycle counter, and set status to REINSPECTION', async () => {
      const metallurgistToken = generateToken('usr_metallurgist', ['METALLURGIST']);
      const publishSpy = jest.spyOn(eventBus, 'publish');

      const mockDoc = createMockInspectionDocument({
        status: 'REJECTED',
        disposition: 'NON_CONFORMING',
        reinspection: { reinspectionCount: 0 }
      });
      jest.spyOn(qualityInspectionRepository, 'findById').mockResolvedValue(mockDoc as any);

      const res = await request(app)
        .post('/api/v1/quality-inspections/insp_001/reinspection')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metallurgistToken}`)
        .send({
          reinspectionReason: 'Retempering completed. Perform tightened sample size hardness survey.',
          revisedSampleSize: 10
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('REINSPECTION');
      expect(res.body.data.disposition).toBe('PENDING');
      expect(res.body.data.reinspection.reinspectionCount).toBe(1);
      expect(res.body.data.inspectionQuantity.sampleSize).toBe(10);
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({ name: DomainEvents.QC_REINSPECTION_REQUESTED })
      );
    });
  });

  describe('GET /api/v1/quality-inspections (Query & Retrieval)', () => {
    it('should query paginated quality inspections with filters', async () => {
      const qcToken = generateToken('usr_qc', ['QC_INSPECTOR']);

      const mockDoc = createMockInspectionDocument();
      jest.spyOn(qualityInspectionRepository, 'queryInspections').mockResolvedValue({
        items: [mockDoc as any],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1
      });

      const res = await request(app)
        .get('/api/v1/quality-inspections')
        .query({ status: 'PENDING', search: 'AERO' })
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
    });
  });

  describe('RBAC Permission Gates', () => {
    it('should block unauthorized user lacking QUALITY_INSPECTION_RECORD from creating inspection', async () => {
      const unauthorizedToken = generateToken('usr_unauth', ['FURNACE_OPERATOR']);

      const res = await request(app)
        .post('/api/v1/quality-inspections')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .send({ jobId: 'job_001' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should block unauthorized user lacking QUALITY_COC_APPROVE from approving inspection', async () => {
      const inspectorToken = generateToken('usr_inspector', ['QC_INSPECTOR']);

      const res = await request(app)
        .post('/api/v1/quality-inspections/insp_001/approve')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({ disposition: 'CONFORMING' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
