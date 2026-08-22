import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { productionPlanRepository } from '../src/modules/production-planning/production-plan.repository.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { recipeRepository } from '../src/modules/recipe/recipe.repository.js';
import { specificationRepository } from '../src/modules/specification/specification.repository.js';
import { materialRequirementsRepository } from '../src/modules/material-requirements/material-requirements.repository.js';
import { constraintAnalysisService } from '../src/modules/constraint-analysis/constraint-analysis.service.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';

describe('Manufacturing Execution Handoff & Plan-to-Job Conversion Domain', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_001';

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const mockPlan = {
    id: 'plan_ready_001',
    tenantId: testTenant,
    planNumber: 'PLAN-202608-0001',
    status: 'CONFIRMED',
    priority: 'HIGH',
    customer: {
      customerId: 'cust_001',
      customerCode: 'CUST-AERO-001',
      customerName: 'Aero Dynamics Corp'
    },
    item: {
      itemId: 'item_4140',
      itemCode: 'MAT-4140-BAR',
      itemName: 'AISI 4140 Round Bar Ø50mm',
      materialGrade: 'AISI 4140',
      uom: 'KG'
    },
    recipe: {
      recipeId: 'rec_001',
      recipeCode: 'REC-CARB-4140',
      recipeRevision: 1,
      processFamily: 'CARBURIZING'
    },
    specification: {
      specificationId: 'spec_001',
      specCode: 'SPEC-AMS-2759',
      specRevision: 1
    },
    quantityTargets: {
      plannedQuantity: 500,
      completedQuantity: 0
    },
    timeline: {
      plannedStartDate: new Date('2026-09-01T08:00:00.000Z'),
      targetCompletionDate: new Date('2026-09-01T16:00:00.000Z')
    },
    save: jest.fn().mockImplementation(function (this: any) {
      return Promise.resolve(this);
    })
  };

  const mockRecipe = {
    id: 'rec_001',
    recipeCode: 'REC-CARB-4140',
    revision: 1,
    name: 'Standard Carburizing Cycle 920C',
    processFamily: 'CARBURIZING',
    status: 'APPROVED',
    applicableMaterialGrades: ['AISI 4140'],
    stages: [
      {
        sequence: 1,
        stageName: 'Carburize Soak',
        targetTemperatureC: 920,
        temperatureToleranceMinusC: 5,
        temperatureTolerancePlusC: 5,
        soakTimeMinutes: 240,
        soakCriteria: 'LOAD_THERMOCOUPLE_REACHED'
      }
    ],
    metallurgicalTargets: {
      targetHardnessMin: 58,
      targetHardnessMax: 62,
      hardnessScale: 'HRC',
      effectiveCaseDepthMinMm: 0.8,
      effectiveCaseDepthMaxMm: 1.2
    },
    machineRequirements: {
      compatibleFurnaceTypes: ['SEALED_QUENCH_FURNACE'],
      minimumFurnaceClass: 'CLASS_2',
      maxOperatingTempRequiredC: 1000
    }
  };

  const mockSpecification = {
    id: 'spec_001',
    specCode: 'SPEC-AMS-2759',
    revision: 1,
    title: 'Aerospace Heat Treatment of Steel Parts',
    status: 'APPROVED',
    customerCode: 'CUST-AERO-001',
    surfaceHardness: { min: 58, max: 62, scale: 'HRC' },
    caseDepth: { effectiveCaseDepthMinMm: 0.8, effectiveCaseDepthMaxMm: 1.2 },
    customerAcceptance: { samplingPlan: 'LEVEL_II', cocRequired: true }
  };

  beforeEach(() => {
    mockPlan.status = 'CONFIRMED';
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

  describe('POST /api/v1/production-jobs/convert-plan/:planId', () => {
    it('should convert an approved production plan into a production job with immutable snapshots', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);
      const auditSpy = jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      jest.spyOn(productionJobRepository, 'findByIdempotencyKey').mockResolvedValue(null);
      jest.spyOn(productionPlanRepository, 'findById').mockResolvedValue(mockPlan as any);

      // Constraint analysis is clean
      jest.spyOn(constraintAnalysisService, 'evaluatePlanConstraints').mockResolvedValue({
        planId: 'plan_ready_001',
        isBlocked: false,
        isFeasible: true,
        violations: []
      } as any);

      jest.spyOn(recipeRepository, 'findById').mockResolvedValue(mockRecipe as any);
      jest.spyOn(specificationRepository, 'findById').mockResolvedValue(mockSpecification as any);
      jest.spyOn(materialRequirementsRepository, 'findActiveReservationsByPlan').mockResolvedValue([
        {
          id: 'res_001',
          targetType: 'HEAT_LOT',
          targetId: 'hl_001',
          targetIdentifier: 'HL-202608-0001',
          reservedQuantity: 500,
          uom: 'KG'
        } as any
      ]);

      jest.spyOn(productionJobRepository, 'generateNextJobNumber').mockResolvedValue('JOB-202608-0001');

      const mockCreatedJob = {
        id: 'job_001',
        jobNumber: 'JOB-202608-0001',
        planId: 'plan_ready_001',
        planNumber: 'PLAN-202608-0001',
        status: 'RELEASED',
        recipeSnapshot: {
          recipeCode: 'REC-CARB-4140',
          revisionNumber: 1,
          stages: mockRecipe.stages
        },
        specificationSnapshot: {
          specCode: 'SPEC-AMS-2759',
          revisionNumber: 1,
          surfaceHardness: mockSpecification.surfaceHardness
        },
        materialAllocations: [
          {
            reservationId: 'res_001',
            heatLotNumber: 'HL-202608-0001',
            allocatedQuantity: 500,
            uom: 'KG'
          }
        ],
        toJSON: () => ({
          jobNumber: 'JOB-202608-0001',
          status: 'RELEASED',
          planNumber: 'PLAN-202608-0001'
        })
      };

      jest.spyOn(productionJobRepository, 'create').mockResolvedValue(mockCreatedJob as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/convert-plan/${mockPlan.id}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          idempotencyKey: 'tx_convert_001',
          notes: 'Standard execution batch'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jobNumber).toBe('JOB-202608-0001');
      expect(res.body.data.status).toBe('RELEASED');
      expect(mockPlan.status).toBe('IN_PROGRESS');
      expect(auditSpy).toHaveBeenCalled();
    });

    it('should block conversion if plan has active blocking constraints', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);

      jest.spyOn(productionJobRepository, 'findByIdempotencyKey').mockResolvedValue(null);
      jest.spyOn(productionPlanRepository, 'findById').mockResolvedValue(mockPlan as any);

      // Constraint analysis flags blocker
      jest.spyOn(constraintAnalysisService, 'evaluatePlanConstraints').mockResolvedValue({
        planId: 'plan_ready_001',
        isBlocked: true,
        isFeasible: false,
        violations: [
          {
            category: 'HEAT_LOT_AVAILABILITY',
            severity: 'BLOCKING',
            message: 'Heat lot locked under active quarantine'
          }
        ]
      } as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/convert-plan/${mockPlan.id}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send();

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Blocked by active constraints');
    });

    it('should return existing job when conversion request with same idempotency key is repeated', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);

      const existingJob = {
        id: 'job_001',
        jobNumber: 'JOB-202608-0001',
        planId: 'plan_ready_001',
        status: 'RELEASED'
      };

      // Idempotency match found!
      jest.spyOn(productionJobRepository, 'findByIdempotencyKey').mockResolvedValue(existingJob as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/convert-plan/${mockPlan.id}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ idempotencyKey: 'tx_convert_001' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jobNumber).toBe('JOB-202608-0001');
    });
  });

  describe('RBAC Permission Gates', () => {
    it('should block unauthorized user lacking PRODUCTION_JOB_CREATE from converting plan', async () => {
      const qcToken = generateToken('usr_qc', ['QC_INSPECTOR']);

      const res = await request(app)
        .post(`/api/v1/production-jobs/convert-plan/${mockPlan.id}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send();

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access Denied');
    });
  });
});
