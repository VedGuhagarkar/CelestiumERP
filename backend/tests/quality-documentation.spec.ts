import request from 'supertest';
import { createApp } from '../src/app.js';
import { qualityDocumentationRepository } from '../src/modules/quality-documentation/quality-documentation.repository.js';
import { qualityInspectionRepository } from '../src/modules/quality-inspection/quality-inspection.repository.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { PERMISSIONS } from '../src/modules/rbac/rbac.constants.js';
import { rbacService } from '../src/modules/rbac/rbac.service.js';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/app.config.js';

function createAuthToken(
  userId: string,
  tenantId: string,
  roles: string[] = ['METALLURGIST']
): string {
  return jwt.sign(
    {
      userId,
      tenantId,
      email: `${userId.toLowerCase()}@astralis-testing.com`,
      roles
    },
    config.auth.jwtSecret,
    { expiresIn: '1h' }
  );
}

function createMockQualityDocument(overrides: Record<string, any> = {}) {
  const defaultDoc = {
    _id: 'doc_test_001',
    id: 'doc_test_001',
    tenantId: 'tenant_test_1',
    documentNumber: 'COC-202608-0001',
    reportType: 'CERTIFICATE_OF_CONFORMANCE',
    status: 'ISSUED',
    versionNumber: 1,
    revisionNumber: 0,
    previousDocumentId: null,

    inspectionId: 'insp_001',
    inspectionNumber: 'INSP-202608-0001',
    jobId: 'job_001',
    jobNumber: 'JOB-202608-0001',
    planId: 'plan_001',
    planNumber: 'PLAN-202608-0001',

    customer: {
      customerId: 'cust_001',
      customerCode: 'LOCKHEED',
      customerName: 'Lockheed Martin Aeronautics',
      purchaseOrderNumber: 'PO-AERO-99201',
      partNumber: 'LM-GEAR-9310',
      drawingNumber: 'DWG-9310-RevC',
      drawingRevision: 'C'
    },

    item: {
      itemId: 'item_9310',
      itemCode: 'MAT-9310-PINION',
      itemName: 'Sun Pinion Gear AISI 9310',
      materialGrade: 'AISI 9310',
      uom: 'PCS'
    },

    heatLots: [
      {
        heatLotId: 'hl_001',
        heatLotNumber: 'HL-202608-9310-A',
        millHeatNumber: 'MILL-HEAT-88210',
        quantity: 150,
        uom: 'PCS'
      }
    ],

    certifiedQuantity: {
      acceptedQuantity: 150,
      sampleQuantity: 8,
      totalLotQuantity: 150,
      uom: 'PCS'
    },

    recipe: {
      recipeId: 'rec_001',
      recipeCode: 'REC-CARB-9310',
      revisionNumber: 2,
      processFamily: 'CARBURIZING',
      name: 'Carburizing Cycle 930C Aerospace',
      stagesCount: 4
    },

    specification: {
      specificationId: 'spec_001',
      specCode: 'SPEC-AMS-2759-7',
      revisionNumber: 3,
      title: 'Carburizing and Heat Treatment of Aerospace Steel Parts',
      customerCode: 'LOCKHEED'
    },

    qualityPlan: {
      planId: 'qp_001',
      planCode: 'QP-CARB-9310-01',
      revisionNumber: 1,
      title: 'Carburizing Quality Inspection Plan for AISI 9310 Aerospace Gears'
    },

    hardnessSurveys: [
      {
        location: 'SURFACE',
        scale: 'HRC',
        targetMin: 60.0,
        targetMax: 64.0,
        targetRangeText: '60.0 - 64.0 HRC',
        measuredPoints: [62.0, 62.5, 61.8, 62.2],
        averageMeasured: 62.1,
        evaluation: 'CONFORMING',
        standardReference: 'ASTM E18 / ASTM E384'
      }
    ],

    caseDepth: {
      targetMinMm: 0.8,
      targetMaxMm: 1.2,
      targetRangeText: '0.8 - 1.2 mm',
      cutoffHardnessText: '550 HV0.5 Cutoff Hardness per ASTM E384',
      effectiveCaseDepthMm: 0.95,
      totalCaseDepthMm: 1.45,
      evaluation: 'CONFORMING',
      traverseCurvePoints: [
        { depthMm: 0.1, hardness: 62.5, scale: 'HRC' },
        { depthMm: 0.5, hardness: 60.0, scale: 'HRC' },
        { depthMm: 0.95, hardness: 50.0, scale: 'HRC' }
      ]
    },

    microstructure: [
      {
        characteristicName: 'Microstructure Matrix',
        targetRequirement: 'Tempered Martensite with fine carbides',
        actualObservation: 'Fine tempered martensite, uniform carbon distribution',
        evaluation: 'CONFORMING'
      }
    ],

    visualDimensional: [
      {
        inspectionItem: 'Visual Surface Inspection',
        acceptanceCriteria: 'Clean, scale-free',
        finding: 'Acceptable clean surface condition',
        isConforming: true
      }
    ],

    pyrometry: {
      furnaceCode: 'FURNACE-01',
      furnaceClass: 'CLASS_2 (+/- 6°C)',
      instrumentationType: 'TYPE_B',
      operatingRange: '300°C - 1050°C',
      satCompliant: true,
      tusCompliant: true,
      standardReference: 'AMS_2750G',
      pyrometryStatus: 'CONFORMING'
    },

    overallCompliance: {
      isConforming: true,
      disposition: 'CONFORMING',
      concessionReference: null,
      summaryStatement: 'All physical, metallurgical, and pyrometry parameters conform to specification limits.'
    },

    applicableStandards: [
      'AMS 2759 (Heat Treatment of Steel Parts)',
      'AMS 2750G (Pyrometry)',
      'ASTM E18 (Rockwell Hardness)',
      'ASTM E384 (Microindentation Hardness)',
      'ISO 9001:2015 / AS9100D'
    ],

    certificationStatement:
      'This is to certify that the components and materials listed herein have been processed, inspected, and tested in accordance with customer purchase order requirements, approved engineering drawings, and applicable process specifications. All recorded test results are authentic, verifiable, and conform in all respects to the specified criteria.',

    securityVerificationCode: 'SEC-93A1-77BC-44F2',
    tamperProofChecksum: 'a8f56b7c29e120f38491823901bcdaff38479218273948571625348271635482',
    verificationUrl: 'https://verify.astralis.internal/doc-verify?code=SEC-93A1-77BC-44F2&checksum=a8f56b7c29e120f3',

    certifiedBy: {
      userId: 'usr_metallurgist_01',
      email: 'qa@astralis.internal',
      role: 'METALLURGIST',
      fullName: 'Dr. Evelyn Vance',
      title: 'Chief QA Metallurgist',
      signedAt: new Date(),
      digitalSignatureHash: 'b482719283746152435465768798091a2b3c4d5e'
    },

    revocation: null,
    printableHtmlTemplate: '<html><body>Test Report</body></html>',
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn().mockImplementation(function () {
      return Promise.resolve(this);
    }),
    toJSON: jest.fn().mockImplementation(function () {
      const { save, toJSON, ...rest } = this;
      return rest;
    }),
    ...overrides
  };
  return defaultDoc;
}

describe('Quality Documentation: Test Reports & Certificates of Conformance (CoC)', () => {
  const app = createApp();
  const tenantId = 'tenant_test_1';
  const metallurgistId = 'usr_metallurgist_01';
  let metallurgistToken: string;

  const mockApprovedInspection = {
    _id: 'insp_001',
    id: 'insp_001',
    inspectionNumber: 'INSP-202608-0001',
    status: 'APPROVED',
    disposition: 'CONFORMING',
    jobId: 'job_001',
    jobNumber: 'JOB-202608-0001',
    tenantId,
    customer: {
      customerId: 'cust_001',
      customerCode: 'LOCKHEED',
      customerName: 'Lockheed Martin Aeronautics'
    },
    item: {
      itemId: 'item_9310',
      itemCode: 'MAT-9310-PINION',
      itemName: 'Sun Pinion Gear AISI 9310',
      materialGrade: 'AISI 9310',
      uom: 'PCS'
    },
    recipeSnapshot: {
      recipeId: 'rec_001',
      recipeCode: 'REC-CARB-9310',
      revisionNumber: 2,
      processFamily: 'CARBURIZING',
      name: 'Carburizing Cycle 930C Aerospace',
      stages: [{ stageName: 'Soak', targetTemperatureC: 930 }]
    },
    specificationSnapshot: {
      specificationId: 'spec_001',
      specCode: 'SPEC-AMS-2759-7',
      revisionNumber: 3,
      title: 'Carburizing and Heat Treatment of Aerospace Steel Parts',
      customerCode: 'LOCKHEED',
      surfaceHardness: { min: 60.0, max: 64.0, scale: 'HRC' },
      coreHardness: { min: 32.0, max: 38.0, scale: 'HRC' },
      caseDepth: { effectiveCaseDepthMinMm: 0.8, effectiveCaseDepthMaxMm: 1.2 },
      microstructure: { requiredStructure: 'Tempered Martensite with fine carbides' }
    },
    inspectionQuantity: {
      sampleSize: 8,
      totalLotQuantity: 150,
      unitOfMeasure: 'PCS'
    },
    testResults: {
      hardnessTests: [
        { pointIdentifier: 'P1', location: 'SURFACE', measuredValue: 62.0, scale: 'HRC', passed: true },
        { pointIdentifier: 'P2', location: 'SURFACE', measuredValue: 62.5, scale: 'HRC', passed: true }
      ],
      caseDepth: {
        effectiveCaseDepthMm: 0.95,
        totalCaseDepthMm: 1.45,
        targetMinMm: 0.8,
        targetMaxMm: 1.2,
        passed: true
      },
      microstructure: {
        observedStructure: 'Fine tempered martensite, uniform carbon distribution',
        retainedAustenitePercent: 6,
        grainSizeAstm: 8,
        decarburizationDepthMm: 0.01,
        passed: true
      },
      visualDimensional: {
        surfaceOxidationAcceptable: true,
        quenchCracksPresent: false,
        dimensionsWithinTolerance: true
      },
      pyrometryVerification: {
        furnaceCode: 'FURNACE-01',
        satPassed: true,
        tusPassed: true
      },
      overallTestPassed: true
    },
    qualityPlanSnapshot: {
      planId: 'qp_001',
      planCode: 'QP-CARB-9310-01',
      revisionNumber: 1,
      title: 'Carburizing Quality Inspection Plan for AISI 9310 Aerospace Gears'
    },
    isDeleted: false
  };

  const mockJob = {
    _id: 'job_001',
    id: 'job_001',
    jobNumber: 'JOB-202608-0001',
    planId: 'plan_001',
    planNumber: 'PLAN-202608-0001',
    tenantId,
    customer: {
      customerId: 'cust_001',
      customerCode: 'LOCKHEED',
      customerName: 'Lockheed Martin Aeronautics'
    },
    item: {
      itemId: 'item_9310',
      itemCode: 'MAT-9310-PINION',
      itemName: 'Sun Pinion Gear AISI 9310',
      materialGrade: 'AISI 9310',
      uom: 'PCS'
    },
    quantity: {
      targetQuantity: 150,
      completedQuantity: 150
    },
    recipeSnapshot: {
      recipeId: 'rec_001',
      recipeCode: 'REC-CARB-9310',
      revisionNumber: 2,
      processFamily: 'CARBURIZING',
      name: 'Carburizing Cycle 930C Aerospace',
      stages: [{ stageName: 'Soak', targetTemperatureC: 930 }]
    },
    specificationSnapshot: {
      specificationId: 'spec_001',
      specCode: 'SPEC-AMS-2759-7',
      revisionNumber: 3,
      title: 'Carburizing and Heat Treatment of Aerospace Steel Parts'
    },
    materialAllocations: [
      {
        heatLotId: 'hl_001',
        heatLotNumber: 'HL-202608-9310-A',
        allocatedQuantity: 150,
        uom: 'PCS'
      }
    ],
    isDeleted: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
    metallurgistToken = createAuthToken(metallurgistId, tenantId, ['METALLURGIST', 'QA_LEAD']);

    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

    jest.spyOn(rbacService, 'getUserEffectivePermissions').mockResolvedValue({
      tenantId,
      userId: metallurgistId,
      roles: ['METALLURGIST'],
      permissions: [
        PERMISSIONS.QUALITY_COC_GENERATE,
        PERMISSIONS.QUALITY_COC_APPROVE,
        PERMISSIONS.QUALITY_COC_REVOKE,
        PERMISSIONS.QUALITY_INSPECTION_RECORD,
        PERMISSIONS.QUALITY_INSPECTION_VIEW
      ],
      isSuperAdmin: false
    });
  });

  describe('POST /api/v1/quality-documents (Document Generation)', () => {
    it('should generate a Certificate of Conformance (CoC) compiled from approved inspection and recipe/spec snapshots', async () => {
      jest.spyOn(qualityInspectionRepository, 'findById').mockResolvedValue(mockApprovedInspection as any);
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob as any);
      jest.spyOn(qualityDocumentationRepository, 'generateNextDocumentNumber').mockResolvedValue('COC-202608-0001');

      const mockDoc = createMockQualityDocument();
      jest.spyOn(qualityDocumentationRepository, 'create').mockResolvedValue(mockDoc as any);

      const res = await request(app)
        .post('/api/v1/quality-documents')
        .set('Authorization', `Bearer ${metallurgistToken}`)
        .send({
          inspectionId: 'insp_001',
          reportType: 'CERTIFICATE_OF_CONFORMANCE',
          purchaseOrderNumber: 'PO-AERO-99201',
          partNumber: 'LM-GEAR-9310',
          drawingNumber: 'DWG-9310-RevC',
          drawingRevision: 'C'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.documentNumber).toBe('COC-202608-0001');
      expect(res.body.data.reportType).toBe('CERTIFICATE_OF_CONFORMANCE');
      expect(res.body.data.recipe.recipeCode).toBe('REC-CARB-9310');
      expect(res.body.data.recipe.revisionNumber).toBe(2);
      expect(res.body.data.specification.specCode).toBe('SPEC-AMS-2759-7');
      expect(res.body.data.specification.revisionNumber).toBe(3);
      expect(res.body.data.securityVerificationCode).toBe('SEC-93A1-77BC-44F2');
      expect(res.body.data.tamperProofChecksum).toBeDefined();
    });

    it('should generate a Test Report compiling target-vs-actual tables and printable template', async () => {
      jest.spyOn(qualityInspectionRepository, 'findById').mockResolvedValue(mockApprovedInspection as any);
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob as any);
      jest.spyOn(qualityDocumentationRepository, 'generateNextDocumentNumber').mockResolvedValue('TR-202608-0001');

      const mockDoc = createMockQualityDocument({
        documentNumber: 'TR-202608-0001',
        reportType: 'TEST_REPORT'
      });
      jest.spyOn(qualityDocumentationRepository, 'create').mockResolvedValue(mockDoc as any);

      const res = await request(app)
        .post('/api/v1/quality-documents')
        .set('Authorization', `Bearer ${metallurgistToken}`)
        .send({
          inspectionId: 'insp_001',
          reportType: 'TEST_REPORT'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.documentNumber).toBe('TR-202608-0001');
      expect(res.body.data.reportType).toBe('TEST_REPORT');
      expect(res.body.data.hardnessSurveys.length).toBeGreaterThan(0);
      expect(res.body.data.hardnessSurveys[0].evaluation).toBe('CONFORMING');
      expect(res.body.data.caseDepth.evaluation).toBe('CONFORMING');
    });

    it('should reject document generation from an unapproved inspection (PENDING/IN_REVIEW/REJECTED)', async () => {
      const unapprovedInspection = { ...mockApprovedInspection, status: 'IN_REVIEW' };
      jest.spyOn(qualityInspectionRepository, 'findById').mockResolvedValue(unapprovedInspection as any);

      const res = await request(app)
        .post('/api/v1/quality-documents')
        .set('Authorization', `Bearer ${metallurgistToken}`)
        .send({
          inspectionId: 'insp_001',
          reportType: 'CERTIFICATE_OF_CONFORMANCE'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Only APPROVED inspections can generate official quality documentation');
    });
  });

  describe('POST /api/v1/quality-documents/:id/revoke (Document Revocation)', () => {
    it('should revoke an issued quality document recording justification and QA signoff', async () => {
      const mockDoc = createMockQualityDocument({ status: 'ISSUED' });
      jest.spyOn(qualityDocumentationRepository, 'findById').mockResolvedValue(mockDoc as any);

      const res = await request(app)
        .post('/api/v1/quality-documents/doc_test_001/revoke')
        .set('Authorization', `Bearer ${metallurgistToken}`)
        .send({
          reason: 'Customer requested engineering revision bump from Rev B to Rev C'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockDoc.status).toBe('REVOKED');
      expect(mockDoc.revocation.isRevoked).toBe(true);
      expect(mockDoc.revocation.reason).toBe(
        'Customer requested engineering revision bump from Rev B to Rev C'
      );
      expect(mockDoc.save).toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/quality-documents/verify/:code (Document Authenticity Verification)', () => {
    it('should verify document authenticity by security verification token', async () => {
      const mockDoc = createMockQualityDocument();
      jest.spyOn(qualityDocumentationRepository, 'findByVerificationCode').mockResolvedValue(mockDoc as any);

      const res = await request(app).get('/api/v1/quality-documents/verify/SEC-93A1-77BC-44F2');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.documentNumber).toBe('COC-202608-0001');
      expect(res.body.data.tamperProofChecksum).toBeDefined();
    });

    it('should return 404 for invalid verification token', async () => {
      jest.spyOn(qualityDocumentationRepository, 'findByVerificationCode').mockResolvedValue(null);

      const res = await request(app).get('/api/v1/quality-documents/verify/INVALID_TOKEN');

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('No authentic quality document found');
    });
  });

  describe('RBAC Permission Gates', () => {
    it('should block unauthorized furnace operators from generating CoC', async () => {
      const operatorToken = createAuthToken('usr_operator_01', tenantId, ['FURNACE_OPERATOR']);

      jest.spyOn(rbacService, 'getUserEffectivePermissions').mockResolvedValue({
        tenantId,
        userId: 'usr_operator_01',
        roles: ['FURNACE_OPERATOR'],
        permissions: ['PRODUCTION_EXECUTE'],
        isSuperAdmin: false
      });

      const res = await request(app)
        .post('/api/v1/quality-documents')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          inspectionId: 'insp_001',
          reportType: 'CERTIFICATE_OF_CONFORMANCE'
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Access Denied');
    });
  });
});
