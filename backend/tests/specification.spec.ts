import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { specificationRepository } from '../src/modules/specification/specification.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';

describe('Metallurgical Specification Master Subsystem', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_001';

  const generateToken = (userId: string, roles: string[]) => {
    return jwt.sign(
      { userId, tenantId: testTenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const mockSpecPayload: any = {
    specCode: 'SPEC-AERO-4140-CARB',
    title: 'Boeing BAC5611 / AeroTurbine Spec for 4140 Carburized Pinions',
    description: 'Critical flight-gear case hardening specification with X-ray retained austenite limits',
    customerId: 'cust_001',
    customerCode: 'CUST-AERO-001',
    applicableMaterialGrades: ['AISI 4140', 'EN19', 'DIN 1.7225'],
    processFamily: 'CARBURIZING',
    surfaceHardness: {
      min: 58,
      max: 62,
      scale: 'HRC',
      testMethodReference: 'ASTM E18 / ISO 6508-1',
      testLocations: ['Pitch Line', 'Tooth Root', 'Bearing Journal']
    },
    coreHardness: {
      min: 32,
      max: 38,
      scale: 'HRC',
      testMethodReference: 'ASTM E18',
      testLocations: ['Core Mid-Radius']
    },
    caseDepth: {
      effectiveCaseDepthMinMm: 0.8,
      effectiveCaseDepthMaxMm: 1.2,
      caseDepthCutoffHRC: 50,
      totalCaseDepthMinMm: 1.4,
      totalCaseDepthMaxMm: 1.8,
      testMethodReference: 'SAE J423 / ISO 2639'
    },
    microstructure: {
      matrixStructure: 'Fine Tempered Martensite Grade 1-3 per ASTM E930',
      maxRetainedAustenitePercent: 7,
      maxCarbideNetworkRating: 'None (No continuous grain boundary network)',
      decarburizationLimitMm: 0.0,
      intergranularOxidationLimitMm: 0.013
    },
    customerAcceptance: {
      samplingPlan: 'Level II Normal Sampling per ANSI/ASQ Z1.4 + 1 sacrificial test bar per load',
      cocRequired: true,
      micrographRequired: true,
      destructiveCouponRequired: true,
      testStandardReferences: ['AMS 2759/7', 'BAC 5611', 'ASTM E18', 'SAE J423', 'ASTM E975']
    }
  };

  beforeEach(() => {
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

  describe('POST /api/v1/specifications (Creation in DRAFT)', () => {
    it('should create a new specification in DRAFT status with revision 1', async () => {
      const metToken = generateToken('usr_met', ['METALLURGIST']);

      jest.spyOn(specificationRepository, 'findByCodeAndRevision').mockResolvedValue(null);
      jest.spyOn(specificationRepository, 'create').mockResolvedValue({
        ...mockSpecPayload,
        id: 'spec_mock_001',
        tenantId: testTenant,
        revision: 1,
        status: 'DRAFT',
        referencedJobCount: 0,
        toJSON: () => ({ ...mockSpecPayload, id: 'spec_mock_001', tenantId: testTenant, revision: 1, status: 'DRAFT' })
      } as any);

      const auditSpy = jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/specifications')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`)
        .send(mockSpecPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.specCode).toBe('SPEC-AERO-4140-CARB');
      expect(res.body.data.status).toBe('DRAFT');
      expect(auditSpy).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          action: 'SPECIFICATION_CREATED',
          entityType: 'Specification'
        })
      );
    });

    it('should reject creation with duplicate specCode revision 1', async () => {
      const metToken = generateToken('usr_met', ['METALLURGIST']);

      jest.spyOn(specificationRepository, 'findByCodeAndRevision').mockResolvedValue({
        id: 'spec_existing_001',
        specCode: 'SPEC-AERO-4140-CARB',
        revision: 1
      } as any);

      const res = await request(app)
        .post('/api/v1/specifications')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`)
        .send(mockSpecPayload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });
  });

  describe('Specification Approval Lifecycle', () => {
    it('should submit DRAFT specification for approval (DRAFT -> PENDING_APPROVAL)', async () => {
      const metToken = generateToken('usr_met', ['METALLURGIST']);

      const mockDraftSpec: any = {
        id: 'spec_001',
        tenantId: testTenant,
        specCode: 'SPEC-AERO-4140-CARB',
        revision: 1,
        status: 'DRAFT',
        save: jest.fn().mockResolvedValue({
          id: 'spec_001',
          specCode: 'SPEC-AERO-4140-CARB',
          revision: 1,
          status: 'PENDING_APPROVAL'
        })
      };

      jest.spyOn(specificationRepository, 'findById').mockResolvedValue(mockDraftSpec);
      jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/specifications/spec_001/submit-approval')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PENDING_APPROVAL');
    });

    it('should approve specification by Metallurgist and transition to ACTIVE (auto-superseding older revs)', async () => {
      const metToken = generateToken('usr_met', ['METALLURGIST']);

      const mockPendingSpec: any = {
        id: 'spec_001',
        tenantId: testTenant,
        specCode: 'SPEC-AERO-4140-CARB',
        revision: 2,
        status: 'PENDING_APPROVAL',
        save: jest.fn().mockResolvedValue({
          id: 'spec_001',
          specCode: 'SPEC-AERO-4140-CARB',
          revision: 2,
          status: 'ACTIVE',
          toJSON: () => ({ id: 'spec_001', specCode: 'SPEC-AERO-4140-CARB', revision: 2, status: 'ACTIVE' })
        })
      };

      jest.spyOn(specificationRepository, 'findById').mockResolvedValue(mockPendingSpec);
      const supersedeSpy = jest.spyOn(specificationRepository, 'supersedePreviousRevisions').mockResolvedValue();
      jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/specifications/spec_001/approve')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`)
        .send({ comments: 'Aerospace customer requirements and ASTM E18 test methods approved' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ACTIVE');
      expect(supersedeSpy).toHaveBeenCalledWith(testTenant, 'SPEC-AERO-4140-CARB', 2);
    });

    it('should reject specification and transition back to DRAFT with rejection reason', async () => {
      const metToken = generateToken('usr_met', ['METALLURGIST']);

      const mockPendingSpec: any = {
        id: 'spec_001',
        tenantId: testTenant,
        specCode: 'SPEC-AERO-4140-CARB',
        revision: 1,
        status: 'PENDING_APPROVAL',
        save: jest.fn().mockResolvedValue({
          id: 'spec_001',
          specCode: 'SPEC-AERO-4140-CARB',
          revision: 1,
          status: 'DRAFT',
          rejectionReason: 'Cutoff hardness must be 50 HRC per SAE J423'
        })
      };

      jest.spyOn(specificationRepository, 'findById').mockResolvedValue(mockPendingSpec);
      jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/specifications/spec_001/reject')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`)
        .send({ rejectionReason: 'Cutoff hardness must be 50 HRC per SAE J423' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('DRAFT');
    });
  });

  describe('Strict Immutability & Revision Control', () => {
    it('should strictly reject direct modifications to ACTIVE or APPROVED specifications', async () => {
      const metToken = generateToken('usr_met', ['METALLURGIST']);

      jest.spyOn(specificationRepository, 'findById').mockResolvedValue({
        id: 'spec_active_001',
        tenantId: testTenant,
        specCode: 'SPEC-AERO-4140-CARB',
        revision: 1,
        status: 'ACTIVE', // ACTIVE REVISION!
        toJSON: () => ({ specCode: 'SPEC-AERO-4140-CARB', revision: 1, status: 'ACTIVE' })
      } as any);

      const res = await request(app)
        .put('/api/v1/specifications/spec_active_001')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`)
        .send({ title: 'Attempted modification of active spec' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('strictly immutable');
    });

    it('should clone existing specification into a new DRAFT revision (v1 -> v2)', async () => {
      const metToken = generateToken('usr_met', ['METALLURGIST']);

      jest.spyOn(specificationRepository, 'findById').mockResolvedValue({
        id: 'spec_active_001',
        tenantId: testTenant,
        ...mockSpecPayload,
        revision: 1,
        status: 'ACTIVE'
      } as any);

      jest.spyOn(specificationRepository, 'findHighestRevision').mockResolvedValue({
        revision: 1
      } as any);

      jest.spyOn(specificationRepository, 'create').mockResolvedValue({
        ...mockSpecPayload,
        id: 'spec_v2_001',
        tenantId: testTenant,
        revision: 2,
        status: 'DRAFT',
        toJSON: () => ({ ...mockSpecPayload, id: 'spec_v2_001', revision: 2, status: 'DRAFT' })
      } as any);

      jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/specifications/spec_active_001/new-revision')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.revision).toBe(2);
      expect(res.body.data.status).toBe('DRAFT');
    });
  });

  describe('Search & Latest Active Retrieval', () => {
    it('should retrieve latest active specification revision by code', async () => {
      const qcToken = generateToken('usr_qc', ['QC_INSPECTOR']);

      jest.spyOn(specificationRepository, 'findLatestActiveRevision').mockResolvedValue({
        id: 'spec_002',
        tenantId: testTenant,
        specCode: 'SPEC-AERO-4140-CARB',
        revision: 2,
        status: 'ACTIVE'
      } as any);

      const res = await request(app)
        .get('/api/v1/specifications/latest/SPEC-AERO-4140-CARB')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.revision).toBe(2);
    });

    it('should perform paginated search across specification catalog', async () => {
      const metToken = generateToken('usr_met', ['METALLURGIST']);

      jest.spyOn(specificationRepository, 'searchSpecifications').mockResolvedValue({
        items: [{ id: 'spec_001', tenantId: testTenant, ...mockSpecPayload, status: 'ACTIVE' } as any],
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1
      });

      const res = await request(app)
        .get('/api/v1/specifications?processFamily=CARBURIZING&search=Boeing')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
    });
  });

  describe('RBAC Permission Gates', () => {
    it('should block unauthorized user from approving specification', async () => {
      const opToken = generateToken('usr_op', ['FURNACE_OPERATOR']);

      const res = await request(app)
        .post('/api/v1/specifications/spec_001/approve')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${opToken}`)
        .send({ comments: 'Unauthorized attempt' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access Denied');
    });
  });
});
