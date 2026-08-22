import request from 'supertest';
import { createApp } from '../src/app.js';
import { specificationRepository } from '../src/modules/specification/specification.repository.js';
import { qualityPlanningRepository } from '../src/modules/quality-planning/quality-planning.repository.js';
import { qualityInspectionRepository } from '../src/modules/quality-inspection/quality-inspection.repository.js';
import { qualityInspectionService } from '../src/modules/quality-inspection/quality-inspection.service.js';
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

function createMockQualityPlanDocument(overrides: Record<string, any> = {}) {
  const defaultDoc = {
    _id: 'qp_test_001',
    id: 'qp_test_001',
    tenantId: 'tenant_test_1',
    planCode: 'QP-CARB-9310-01',
    revisionNumber: 1,
    title: 'Carburizing Quality Inspection Plan for AISI 9310 Aerospace Gears',
    description: 'Mandatory metallurgical inspection characteristics for AMS 2759/7 carburizing',
    status: 'DRAFT',
    processFamily: 'CARBURIZING',
    specificationId: 'spec_test_001',
    specCode: 'SPEC-CARB-9310',
    specRevisionNumber: 1,
    applicableCustomerCodes: ['BOEING', 'LOCKHEED'],
    applicableItemCategories: ['AERO_GEARS'],
    characteristics: [
      {
        itemCode: 'CHAR-01',
        name: 'Surface Hardness Survey',
        characteristicType: 'SURFACE_HARDNESS',
        measurementType: 'HARDNESS',
        isMandatory: true,
        specLocations: ['SURFACE', 'PITCH_LINE'],
        sampleCount: 3,
        readingsPerSample: 4,
        samplingFrequency: 'PER_CHARGE',
        acceptanceCriteria: {
          targetMin: 60.0,
          targetMax: 64.0,
          scale: 'HRC',
          testStandardReference: 'ASTM E18'
        }
      },
      {
        itemCode: 'CHAR-02',
        name: 'Effective Case Depth Traverse',
        characteristicType: 'EFFECTIVE_CASE_DEPTH',
        measurementType: 'CASE_DEPTH_TRAVERSE',
        isMandatory: true,
        specLocations: ['PITCH_LINE', 'ROOT'],
        sampleCount: 1,
        readingsPerSample: 1,
        samplingFrequency: 'PER_CHARGE',
        acceptanceCriteria: {
          targetMin: 0.75,
          targetMax: 1.00,
          scale: 'HV',
          unit: 'mm',
          description: 'Cutoff at 550 HV0.5',
          testStandardReference: 'ASTM E384'
        }
      },
      {
        itemCode: 'CHAR-03',
        name: 'Retained Austenite Quantification',
        characteristicType: 'RETAINED_AUSTENITE',
        measurementType: 'MICROSTRUCTURE',
        isMandatory: false,
        specLocations: ['CASE'],
        sampleCount: 1,
        readingsPerSample: 1,
        samplingFrequency: 'ONE_PER_LOT',
        acceptanceCriteria: {
          targetMax: 10.0,
          unit: '%',
          description: 'Max 10% Retained Austenite via XRD',
          testStandardReference: 'ASTM E975'
        }
      }
    ],
    authorId: 'usr_quality_eng_01',
    approvedBy: null,
    revisionHistory: [
      {
        revision: 1,
        changedBy: { userId: 'usr_quality_eng_01', email: 'qe@astralis.internal' },
        changedAt: new Date(),
        changeDescription: 'Initial Quality Plan draft creation'
      }
    ],
    notes: null,
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

describe('Quality Planning & Controlled Inspection Checklists', () => {
  const app = createApp();
  const tenantId = 'tenant_test_1';
  const qualityEngId = 'usr_quality_eng_01';
  let qualityEngToken: string;

  beforeEach(() => {
    jest.clearAllMocks();
    qualityEngToken = createAuthToken(qualityEngId, tenantId, ['METALLURGIST', 'QUALITY_ENGINEER']);

    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

    jest.spyOn(rbacService, 'getUserEffectivePermissions').mockResolvedValue({
      tenantId,
      userId: qualityEngId,
      roles: ['METALLURGIST'],
      permissions: [
        PERMISSIONS.QUALITY_SPEC_MANAGE,
        PERMISSIONS.QUALITY_INSPECTION_RECORD,
        PERMISSIONS.QUALITY_INSPECTION_VIEW,
        PERMISSIONS.QUALITY_COC_APPROVE,
        PERMISSIONS.QUALITY_DISPOSITION_MANAGE
      ],
      isSuperAdmin: false
    });
  });

  describe('POST /api/v1/quality-plans (Plan Draft Creation)', () => {
    it('should create a quality plan draft linking to authoritative master specification', async () => {
      jest.spyOn(specificationRepository, 'findById').mockResolvedValue({
        id: 'spec_test_001',
        specCode: 'SPEC-CARB-9310',
        revision: 1,
        status: 'APPROVED'
      } as any);

      const mockDoc = createMockQualityPlanDocument();
      jest.spyOn(qualityPlanningRepository, 'findByPlanCodeAndRevision').mockResolvedValue(null);
      jest.spyOn(qualityPlanningRepository, 'create').mockResolvedValue(mockDoc as any);

      const res = await request(app)
        .post('/api/v1/quality-plans')
        .set('Authorization', `Bearer ${qualityEngToken}`)
        .send({
          planCode: 'QP-CARB-9310-01',
          title: 'Carburizing Quality Inspection Plan for AISI 9310 Aerospace Gears',
          processFamily: 'CARBURIZING',
          specificationId: 'spec_test_001',
          applicableCustomerCodes: ['BOEING', 'LOCKHEED'],
          characteristics: mockDoc.characteristics
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.planCode).toBe('QP-CARB-9310-01');
      expect(res.body.data.revisionNumber).toBe(1);
      expect(res.body.data.status).toBe('DRAFT');
    });

    it('should reject plan creation if referenced Master Specification does not exist', async () => {
      jest.spyOn(specificationRepository, 'findById').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/quality-plans')
        .set('Authorization', `Bearer ${qualityEngToken}`)
        .send({
          title: 'Invalid Plan',
          processFamily: 'CARBURIZING',
          specificationId: 'spec_non_existent',
          characteristics: [
            {
              itemCode: 'CHAR-01',
              name: 'Hardness',
              characteristicType: 'SURFACE_HARDNESS',
              measurementType: 'HARDNESS',
              isMandatory: true,
              specLocations: ['SURFACE'],
              sampleCount: 1,
              readingsPerSample: 1,
              samplingFrequency: 'PER_CHARGE',
              acceptanceCriteria: { targetMin: 60, targetMax: 62, scale: 'HRC' }
            }
          ]
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('not found in Master Data');
    });

    it('should reject plan creation with contradictory acceptance criteria (targetMin > targetMax)', async () => {
      const res = await request(app)
        .post('/api/v1/quality-plans')
        .set('Authorization', `Bearer ${qualityEngToken}`)
        .send({
          title: 'Contradictory Plan',
          processFamily: 'CARBURIZING',
          specificationId: 'spec_test_001',
          characteristics: [
            {
              itemCode: 'CHAR-01',
              name: 'Contradictory Hardness',
              characteristicType: 'SURFACE_HARDNESS',
              measurementType: 'HARDNESS',
              isMandatory: true,
              specLocations: ['SURFACE'],
              sampleCount: 1,
              readingsPerSample: 1,
              samplingFrequency: 'PER_CHARGE',
              acceptanceCriteria: {
                targetMin: 65.0,
                targetMax: 60.0 // Contradiction: 65 > 60!
              }
            }
          ]
        });

      expect(res.status).toBe(422);
      expect(JSON.stringify(res.body)).toContain('targetMin cannot exceed targetMax');
    });
  });

  describe('PUT /api/v1/quality-plans/:id (Draft Modification)', () => {
    it('should update quality plan draft characteristics and title', async () => {
      const mockDoc = createMockQualityPlanDocument();
      jest.spyOn(qualityPlanningRepository, 'findById').mockResolvedValue(mockDoc as any);

      const res = await request(app)
        .put('/api/v1/quality-plans/qp_test_001')
        .set('Authorization', `Bearer ${qualityEngToken}`)
        .send({
          title: 'Updated Carburizing Inspection Plan for AISI 9310 Gears',
          description: 'Updated test parameters'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockDoc.title).toBe('Updated Carburizing Inspection Plan for AISI 9310 Gears');
      expect(mockDoc.save).toHaveBeenCalled();
    });

    it('should prevent modifying an already APPROVED quality plan', async () => {
      const mockDoc = createMockQualityPlanDocument({ status: 'APPROVED' });
      jest.spyOn(qualityPlanningRepository, 'findById').mockResolvedValue(mockDoc as any);

      const res = await request(app)
        .put('/api/v1/quality-plans/qp_test_001')
        .set('Authorization', `Bearer ${qualityEngToken}`)
        .send({
          title: 'Attempted Uncontrolled Modification'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Approved criteria are strictly locked; create a new revision instead');
    });
  });

  describe('POST /api/v1/quality-plans/:id/approve (Approval Lifecycle)', () => {
    it('should approve draft plan, record signoff, and mark prior revisions obsolete', async () => {
      const mockDoc = createMockQualityPlanDocument();
      jest.spyOn(qualityPlanningRepository, 'findById').mockResolvedValue(mockDoc as any);
      jest.spyOn(qualityPlanningRepository, 'markPreviousRevisionsObsolete').mockResolvedValue(undefined);

      const res = await request(app)
        .post('/api/v1/quality-plans/qp_test_001/approve')
        .set('Authorization', `Bearer ${qualityEngToken}`)
        .send({
          remarks: 'Reviewed against customer specification Revision C'
        });

      expect(res.status).toBe(200);
      expect(mockDoc.status).toBe('APPROVED');
      expect(mockDoc.approvedBy.remarks).toBe('Reviewed against customer specification Revision C');
      expect(qualityPlanningRepository.markPreviousRevisionsObsolete).toHaveBeenCalledWith(
        tenantId,
        'QP-CARB-9310-01',
        1
      );
      expect(mockDoc.save).toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/quality-plans/:id/revise (Independent Revision Control)', () => {
    it('should create Revision 2 in DRAFT status with updated characteristics and revision history', async () => {
      const approvedDoc = createMockQualityPlanDocument({ status: 'APPROVED', revisionNumber: 1 });
      const rev2Doc = createMockQualityPlanDocument({
        _id: 'qp_test_002',
        id: 'qp_test_002',
        revisionNumber: 2,
        status: 'DRAFT'
      });

      jest.spyOn(qualityPlanningRepository, 'findById').mockResolvedValue(approvedDoc as any);
      jest.spyOn(qualityPlanningRepository, 'create').mockResolvedValue(rev2Doc as any);

      const res = await request(app)
        .post('/api/v1/quality-plans/qp_test_001/revise')
        .set('Authorization', `Bearer ${qualityEngToken}`)
        .send({
          changeDescription: 'Added mandatory core hardness requirement per Customer Engineering Change Order ECO-402'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.revisionNumber).toBe(2);
      expect(res.body.data.status).toBe('DRAFT');
    });

    it('should reject creating revision from a DRAFT plan', async () => {
      const draftDoc = createMockQualityPlanDocument({ status: 'DRAFT' });
      jest.spyOn(qualityPlanningRepository, 'findById').mockResolvedValue(draftDoc as any);

      const res = await request(app)
        .post('/api/v1/quality-plans/qp_test_001/revise')
        .set('Authorization', `Bearer ${qualityEngToken}`)
        .send({
          changeDescription: 'Premature revision attempt'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Only APPROVED plans can be revised');
    });
  });

  describe('GET /api/v1/quality-plans/applicable (Plan Matching)', () => {
    it('should find applicable approved quality plan for customer/specification combination', async () => {
      const mockDoc = createMockQualityPlanDocument({ status: 'APPROVED' });
      jest.spyOn(qualityPlanningRepository, 'findApplicablePlan').mockResolvedValue(mockDoc as any);

      const res = await request(app)
        .get('/api/v1/quality-plans/applicable?processFamily=CARBURIZING&specCode=SPEC-CARB-9310&customerCode=BOEING')
        .set('Authorization', `Bearer ${qualityEngToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.planCode).toBe('QP-CARB-9310-01');
    });
  });

  describe('Gating Rules: Inspection Approval Enforcement via Quality Plan Checklists', () => {
    it('should block inspection approval when mandatory characteristics from Quality Plan are missing', async () => {
      const planDoc = createMockQualityPlanDocument({ status: 'APPROVED' });

      // Inspection has only surface hardness, but is missing mandatory Effective Case Depth (CHAR-02)
      const mockInspection = {
        id: 'insp_gating_test',
        inspectionNumber: 'INSP-202608-0099',
        status: 'IN_REVIEW',
        disposition: 'PENDING',
        qualityPlanSnapshot: {
          planId: planDoc.id,
          planCode: planDoc.planCode,
          revisionNumber: 1,
          title: planDoc.title,
          processFamily: planDoc.processFamily,
          specCode: planDoc.specCode,
          specRevisionNumber: 1,
          characteristics: planDoc.characteristics, // CHAR-01 (Mandatory), CHAR-02 (Mandatory)
          snapshottedAt: new Date()
        },
        testResults: {
          hardnessTests: [
            { pointIdentifier: 'P1', location: 'SURFACE', measuredValue: 62.0, scale: 'HRC', passed: true }
          ],
          overallTestPassed: true
          // Missing caseDepth traverse test results!
        },
        save: jest.fn().mockResolvedValue(true),
        transitionHistory: []
      };

      jest.spyOn(qualityInspectionRepository, 'findById').mockResolvedValue(mockInspection as any);

      await expect(
        qualityInspectionService.approveInspection(
          tenantId,
          { userId: qualityEngId, email: 'qe@astralis.internal', role: 'METALLURGIST' },
          'insp_gating_test',
          { disposition: 'CONFORMING' }
        )
      ).rejects.toThrow('Missing mandatory inspection checks: CHAR-02 (Effective Case Depth Traverse)');
    });
  });

  describe('RBAC Permission Checks', () => {
    it('should block unauthorized user lacking QUALITY_SPEC_MANAGE from approving plans', async () => {
      const operatorToken = createAuthToken('usr_operator_01', tenantId, ['FURNACE_OPERATOR']);

      jest.spyOn(rbacService, 'getUserEffectivePermissions').mockResolvedValue({
        tenantId,
        userId: 'usr_operator_01',
        roles: ['FURNACE_OPERATOR'],
        permissions: ['PRODUCTION_EXECUTE'],
        isSuperAdmin: false
      });

      const res = await request(app)
        .post('/api/v1/quality-plans/qp_test_001/approve')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Access Denied');
    });
  });
});
