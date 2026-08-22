import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { recipeRepository } from '../src/modules/recipe/recipe.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';

describe('Heat-Treatment Recipe Master Subsystem', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_001';

  const generateToken = (userId: string, roles: string[]) => {
    return jwt.sign(
      { userId, tenantId: testTenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const mockRecipePayload: any = {
    recipeCode: 'REC-4140-CARB-01',
    name: 'Standard Gas Carburize & Direct Quench for 4140 Pinions',
    description: 'High-fatigue case hardening recipe with carbon potential control',
    processFamily: 'CARBURIZING',
    applicableMaterialGrades: ['AISI 4140', 'EN19', 'DIN 1.7225'],
    stages: [
      {
        sequence: 1,
        stageName: 'Equalize & Preheating',
        targetTemperatureC: 750,
        temperatureToleranceMinusC: 5,
        temperatureTolerancePlusC: 5,
        rampRateCPerMin: 10,
        soakTimeMinutes: 45,
        soakCriteria: 'FURNACE_ZONE_REACHED'
      },
      {
        sequence: 2,
        stageName: 'Carburizing Boost Cycle',
        targetTemperatureC: 930,
        temperatureToleranceMinusC: 3,
        temperatureTolerancePlusC: 3,
        soakTimeMinutes: 180,
        soakCriteria: 'LOAD_THERMOCOUPLE_REACHED',
        atmosphereControl: {
          type: 'CARBON_POTENTIAL',
          setpoint: 0.95,
          tolerance: 0.03
        }
      },
      {
        sequence: 3,
        stageName: 'Carburizing Diffuse Cycle',
        targetTemperatureC: 930,
        temperatureToleranceMinusC: 3,
        temperatureTolerancePlusC: 3,
        soakTimeMinutes: 60,
        soakCriteria: 'LOAD_THERMOCOUPLE_REACHED',
        atmosphereControl: {
          type: 'CARBON_POTENTIAL',
          setpoint: 0.75,
          tolerance: 0.03
        }
      },
      {
        sequence: 4,
        stageName: 'Direct Oil Quench',
        targetTemperatureC: 850,
        temperatureToleranceMinusC: 5,
        temperatureTolerancePlusC: 5,
        soakTimeMinutes: 30,
        soakCriteria: 'FIXED_TIME',
        quenchParameters: {
          medium: 'FAST_QUENCH_OIL',
          targetTemperatureC: 60,
          agitationSpeedPercent: 80,
          quenchDurationSeconds: 900
        }
      }
    ],
    metallurgicalTargets: {
      targetHardnessMin: 58,
      targetHardnessMax: 62,
      hardnessScale: 'HRC',
      effectiveCaseDepthMinMm: 0.8,
      effectiveCaseDepthMaxMm: 1.2,
      caseDepthCutoffHRC: 50,
      coreHardnessMin: 32,
      coreHardnessMax: 38,
      coreHardnessScale: 'HRC',
      microstructureRequirements: 'Tempered Martensite, Retained Austenite < 7%'
    },
    machineRequirements: {
      compatibleFurnaceTypes: ['SEALED_QUENCH', 'PIT_CARBURIZER'],
      minimumFurnaceClass: 'CLASS_2',
      maxOperatingTempRequiredC: 1000
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

  describe('POST /api/v1/recipes (Creation in DRAFT)', () => {
    it('should create a new recipe in DRAFT status with revision 1', async () => {
      const metToken = generateToken('usr_met', ['METALLURGIST']);

      jest.spyOn(recipeRepository, 'findByCodeAndRevision').mockResolvedValue(null);
      jest.spyOn(recipeRepository, 'create').mockResolvedValue({
        ...mockRecipePayload,
        id: 'rec_mock_001',
        tenantId: testTenant,
        revision: 1,
        status: 'DRAFT',
        referencedJobCount: 0,
        toJSON: () => ({ ...mockRecipePayload, id: 'rec_mock_001', tenantId: testTenant, revision: 1, status: 'DRAFT' })
      } as any);

      const auditSpy = jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/recipes')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`)
        .send(mockRecipePayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.recipeCode).toBe('REC-4140-CARB-01');
      expect(res.body.data.status).toBe('DRAFT');
      expect(auditSpy).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          action: 'RECIPE_CREATED',
          entityType: 'Recipe'
        })
      );
    });

    it('should reject creation with duplicate recipeCode revision 1', async () => {
      const metToken = generateToken('usr_met', ['METALLURGIST']);

      jest.spyOn(recipeRepository, 'findByCodeAndRevision').mockResolvedValue({
        id: 'rec_existing_001',
        recipeCode: 'REC-4140-CARB-01',
        revision: 1
      } as any);

      const res = await request(app)
        .post('/api/v1/recipes')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`)
        .send(mockRecipePayload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });
  });

  describe('Recipe Approval Lifecycle', () => {
    it('should submit DRAFT recipe for approval (DRAFT -> PENDING_APPROVAL)', async () => {
      const metToken = generateToken('usr_met', ['METALLURGIST']);

      const mockDraftRecipe: any = {
        id: 'rec_001',
        tenantId: testTenant,
        recipeCode: 'REC-4140-CARB-01',
        revision: 1,
        status: 'DRAFT',
        save: jest.fn().mockResolvedValue({
          id: 'rec_001',
          recipeCode: 'REC-4140-CARB-01',
          revision: 1,
          status: 'PENDING_APPROVAL'
        })
      };

      jest.spyOn(recipeRepository, 'findById').mockResolvedValue(mockDraftRecipe);
      jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/recipes/rec_001/submit-approval')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PENDING_APPROVAL');
    });

    it('should approve recipe by Metallurgist and transition to ACTIVE (auto-superseding older revs)', async () => {
      const metToken = generateToken('usr_met', ['METALLURGIST']);

      const mockPendingRecipe: any = {
        id: 'rec_001',
        tenantId: testTenant,
        recipeCode: 'REC-4140-CARB-01',
        revision: 2,
        status: 'PENDING_APPROVAL',
        save: jest.fn().mockResolvedValue({
          id: 'rec_001',
          recipeCode: 'REC-4140-CARB-01',
          revision: 2,
          status: 'ACTIVE',
          toJSON: () => ({ id: 'rec_001', recipeCode: 'REC-4140-CARB-01', revision: 2, status: 'ACTIVE' })
        })
      };

      jest.spyOn(recipeRepository, 'findById').mockResolvedValue(mockPendingRecipe);
      const supersedeSpy = jest.spyOn(recipeRepository, 'supersedePreviousRevisions').mockResolvedValue();
      jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/recipes/rec_001/approve')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`)
        .send({ comments: 'AMS 2750G pyrometry calibration and microstructure limits verified' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ACTIVE');
      expect(supersedeSpy).toHaveBeenCalledWith(testTenant, 'REC-4140-CARB-01', 2);
    });

    it('should reject recipe and transition back to DRAFT with rejection reason', async () => {
      const metToken = generateToken('usr_met', ['METALLURGIST']);

      const mockPendingRecipe: any = {
        id: 'rec_001',
        tenantId: testTenant,
        recipeCode: 'REC-4140-CARB-01',
        revision: 1,
        status: 'PENDING_APPROVAL',
        save: jest.fn().mockResolvedValue({
          id: 'rec_001',
          recipeCode: 'REC-4140-CARB-01',
          revision: 1,
          status: 'DRAFT',
          rejectionReason: 'Quench agitation too low for 4140 bar diameter'
        })
      };

      jest.spyOn(recipeRepository, 'findById').mockResolvedValue(mockPendingRecipe);
      jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/recipes/rec_001/reject')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`)
        .send({ rejectionReason: 'Quench agitation too low for 4140 bar diameter' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('DRAFT');
    });
  });

  describe('Strict Immutability & Revision Control', () => {
    it('should strictly reject direct modifications to ACTIVE or APPROVED recipes', async () => {
      const metToken = generateToken('usr_met', ['METALLURGIST']);

      jest.spyOn(recipeRepository, 'findById').mockResolvedValue({
        id: 'rec_active_001',
        tenantId: testTenant,
        recipeCode: 'REC-4140-CARB-01',
        revision: 1,
        status: 'ACTIVE', // ACTIVE REVISION!
        toJSON: () => ({ recipeCode: 'REC-4140-CARB-01', revision: 1, status: 'ACTIVE' })
      } as any);

      const res = await request(app)
        .put('/api/v1/recipes/rec_active_001')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`)
        .send({ name: 'Attempted alteration of active recipe' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('strictly immutable');
    });

    it('should clone existing recipe into a new DRAFT revision (v1 -> v2)', async () => {
      const metToken = generateToken('usr_met', ['METALLURGIST']);

      jest.spyOn(recipeRepository, 'findById').mockResolvedValue({
        id: 'rec_active_001',
        tenantId: testTenant,
        ...mockRecipePayload,
        revision: 1,
        status: 'ACTIVE'
      } as any);

      jest.spyOn(recipeRepository, 'findHighestRevision').mockResolvedValue({
        revision: 1
      } as any);

      jest.spyOn(recipeRepository, 'create').mockResolvedValue({
        ...mockRecipePayload,
        id: 'rec_v2_001',
        tenantId: testTenant,
        revision: 2,
        status: 'DRAFT',
        toJSON: () => ({ ...mockRecipePayload, id: 'rec_v2_001', revision: 2, status: 'DRAFT' })
      } as any);

      jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/recipes/rec_active_001/new-revision')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.revision).toBe(2);
      expect(res.body.data.status).toBe('DRAFT');
    });
  });

  describe('Search & Latest Active Retrieval', () => {
    it('should retrieve latest active recipe revision by code', async () => {
      const opToken = generateToken('usr_op', ['FURNACE_OPERATOR']);

      jest.spyOn(recipeRepository, 'findLatestActiveRevision').mockResolvedValue({
        id: 'rec_002',
        tenantId: testTenant,
        recipeCode: 'REC-4140-CARB-01',
        revision: 2,
        status: 'ACTIVE'
      } as any);

      const res = await request(app)
        .get('/api/v1/recipes/latest/REC-4140-CARB-01')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${opToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.revision).toBe(2);
    });

    it('should perform paginated search across recipe catalog', async () => {
      const metToken = generateToken('usr_met', ['METALLURGIST']);

      jest.spyOn(recipeRepository, 'searchRecipes').mockResolvedValue({
        items: [{ id: 'rec_001', tenantId: testTenant, ...mockRecipePayload, status: 'ACTIVE' } as any],
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1
      });

      const res = await request(app)
        .get('/api/v1/recipes?processFamily=CARBURIZING&search=4140')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
    });
  });

  describe('RBAC Permission Gates', () => {
    it('should block unauthorized user from approving recipe', async () => {
      const opToken = generateToken('usr_op', ['FURNACE_OPERATOR']);

      const res = await request(app)
        .post('/api/v1/recipes/rec_001/approve')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${opToken}`)
        .send({ comments: 'Unauthorized attempt' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access Denied');
    });
  });
});
