import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { productionPlanRepository } from '../src/modules/production-planning/production-plan.repository.js';
import { customerRepository } from '../src/modules/customer/customer.repository.js';
import { itemRepository } from '../src/modules/item/item.repository.js';
import { recipeRepository } from '../src/modules/recipe/recipe.repository.js';
import { specificationRepository } from '../src/modules/specification/specification.repository.js';
import { heatLotRepository } from '../src/modules/traceability/heat-lot.repository.js';
import { quarantineRepository } from '../src/modules/quarantine/quarantine.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';

describe('Heat-Treatment Production Planning Domain', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_001';

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const mockCustomer = {
    id: 'cust_001',
    tenantId: testTenant,
    customerCode: 'CUST-AERO-001',
    companyName: 'Aero Dynamics Corp',
    status: 'active'
  };

  const mockItem = {
    id: 'item_001',
    tenantId: testTenant,
    itemCode: 'MAT-4140-RND-50',
    name: 'AISI 4140 Round Bar Ø50mm',
    materialGrade: 'AISI 4140',
    category: 'RAW_MATERIAL',
    uom: 'KG',
    status: 'active'
  };

  const mockRecipe = {
    id: 'rec_001',
    tenantId: testTenant,
    recipeCode: 'REC-CARB-4140-01',
    revision: 1,
    processFamily: 'CARBURIZING',
    applicableMaterialGrades: ['AISI 4140', 'EN19'],
    status: 'ACTIVE',
    machineRequirements: {
      compatibleFurnaceTypes: ['SEALED_QUENCH_FURNACE']
    }
  };

  const mockSpecification = {
    id: 'spec_001',
    tenantId: testTenant,
    specCode: 'SPEC-AERO-4140-01',
    revision: 1,
    status: 'ACTIVE'
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

  describe('POST /api/v1/production-plans (Plan Creation)', () => {
    it('should create a production plan when customer, item, recipe, and specification are valid and approved', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);
      const auditSpy = jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      jest.spyOn(customerRepository, 'findById').mockResolvedValue(mockCustomer as any);
      jest.spyOn(itemRepository, 'findById').mockResolvedValue(mockItem as any);
      jest.spyOn(recipeRepository, 'findById').mockResolvedValue(mockRecipe as any);
      jest.spyOn(specificationRepository, 'findById').mockResolvedValue(mockSpecification as any);
      jest.spyOn(heatLotRepository, 'searchHeatLots').mockResolvedValue({ items: [], total: 0, page: 1, limit: 50, totalPages: 0 } as any);
      jest.spyOn(productionPlanRepository, 'generateNextPlanNumber').mockResolvedValue('PLAN-202608-0001');

      const mockCreatedPlan = {
        id: 'plan_001',
        planNumber: 'PLAN-202608-0001',
        title: 'Aerospace Pinion Production Batch 1',
        status: 'PLANNED',
        priority: 'HIGH',
        customer: {
          customerId: 'cust_001',
          customerCode: 'CUST-AERO-001',
          customerName: 'Aero Dynamics Corp'
        },
        item: {
          itemId: 'item_001',
          itemCode: 'MAT-4140-RND-50',
          itemName: 'AISI 4140 Round Bar Ø50mm',
          materialGrade: 'AISI 4140',
          uom: 'KG'
        },
        recipe: {
          recipeId: 'rec_001',
          recipeCode: 'REC-CARB-4140-01',
          recipeRevision: 1,
          processFamily: 'CARBURIZING'
        },
        specification: {
          specificationId: 'spec_001',
          specCode: 'SPEC-AERO-4140-01',
          specRevision: 1
        },
        quantityTargets: {
          plannedQuantity: 500,
          scheduledQuantity: 0,
          inProgressQuantity: 0,
          completedQuantity: 0,
          scrappedQuantity: 0,
          completionPercentage: 0
        },
        timeline: {
          plannedStartDate: new Date('2026-09-01'),
          targetCompletionDate: new Date('2026-09-05')
        },
        constraints: {
          materialAvailability: 'PENDING_INWARD',
          availableStockQuantity: 0,
          compatibleFurnaceTypes: ['SEALED_QUENCH_FURNACE'],
          estimatedFurnaceHours: 12,
          operatorCertificationsRequired: ['NADCAP_APPROVED_OPERATOR']
        },
        toJSON: () => ({ planNumber: 'PLAN-202608-0001', status: 'PLANNED' })
      };

      jest.spyOn(productionPlanRepository, 'create').mockResolvedValue(mockCreatedPlan as any);

      const res = await request(app)
        .post('/api/v1/production-plans')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          title: 'Aerospace Pinion Production Batch 1',
          priority: 'HIGH',
          customerId: 'cust_001',
          itemId: 'item_001',
          recipeId: 'rec_001',
          specificationId: 'spec_001',
          plannedQuantity: 500,
          plannedStartDate: '2026-09-01T08:00:00.000Z',
          targetCompletionDate: '2026-09-05T18:00:00.000Z',
          estimatedFurnaceHours: 12,
          operatorCertificationsRequired: ['NADCAP_APPROVED_OPERATOR']
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.planNumber).toBe('PLAN-202608-0001');
      expect(auditSpy).toHaveBeenCalled();
    });

    it('should reject plan creation if recipe is in DRAFT or unapproved status', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);

      jest.spyOn(customerRepository, 'findById').mockResolvedValue(mockCustomer as any);
      jest.spyOn(itemRepository, 'findById').mockResolvedValue(mockItem as any);
      jest.spyOn(recipeRepository, 'findById').mockResolvedValue({
        ...mockRecipe,
        status: 'DRAFT'
      } as any);
      jest.spyOn(specificationRepository, 'findById').mockResolvedValue(mockSpecification as any);

      const res = await request(app)
        .post('/api/v1/production-plans')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          title: 'Unapproved Recipe Test',
          customerId: 'cust_001',
          itemId: 'item_001',
          recipeId: 'rec_001',
          specificationId: 'spec_001',
          plannedQuantity: 100,
          plannedStartDate: '2026-09-01T08:00:00.000Z',
          targetCompletionDate: '2026-09-05T18:00:00.000Z'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Only ACTIVE or APPROVED recipes are allowed');
    });

    it('should reject plan creation if item material grade is incompatible with recipe', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);

      jest.spyOn(customerRepository, 'findById').mockResolvedValue(mockCustomer as any);
      jest.spyOn(itemRepository, 'findById').mockResolvedValue({
        ...mockItem,
        materialGrade: 'INCONEL 718' // Incompatible with carburizing recipe
      } as any);
      jest.spyOn(recipeRepository, 'findById').mockResolvedValue(mockRecipe as any);
      jest.spyOn(specificationRepository, 'findById').mockResolvedValue(mockSpecification as any);

      const res = await request(app)
        .post('/api/v1/production-plans')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          title: 'Incompatible Material Test',
          customerId: 'cust_001',
          itemId: 'item_001',
          recipeId: 'rec_001',
          specificationId: 'spec_001',
          plannedQuantity: 100,
          plannedStartDate: '2026-09-01T08:00:00.000Z',
          targetCompletionDate: '2026-09-05T18:00:00.000Z'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Material grade mismatch');
    });
  });

  describe('PATCH /api/v1/production-plans/:id/status (Lifecycle Transitions)', () => {
    it('should block transition to CONFIRMED if required heat lot is under active quarantine', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);

      const mockPlan = {
        id: 'plan_001',
        tenantId: testTenant,
        planNumber: 'PLAN-202608-0001',
        status: 'PLANNED',
        item: { itemCode: 'MAT-4140-RND-50' },
        constraints: {
          requiredHeatLotNumber: 'HL-202608-0001',
          materialAvailability: 'PENDING_INWARD',
          availableStockQuantity: 0
        },
        quantityTargets: { plannedQuantity: 100 },
        timeline: {},
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
        toJSON: () => ({ status: 'PLANNED' })
      };

      jest.spyOn(productionPlanRepository, 'findById').mockResolvedValue(mockPlan as any);
      jest.spyOn(heatLotRepository, 'findByHeatLotNumber').mockResolvedValue({
        heatLotNumber: 'HL-202608-0001',
        currentQuantity: 500,
        allocatedQuantity: 0
      } as any);

      // Active quarantine hold!
      jest.spyOn(quarantineRepository, 'findActiveQuarantineForTarget').mockResolvedValue({
        quarantineNumber: 'QRN-2026-00001',
        status: 'ACTIVE_QUARANTINE'
      } as any);

      const res = await request(app)
        .patch('/api/v1/production-plans/plan_001/status')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ status: 'CONFIRMED' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('locked under active QUARANTINE');
    });

    it('should transition plan to IN_PROGRESS and stamp actualStartDate', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);

      const mockPlan = {
        id: 'plan_001',
        tenantId: testTenant,
        planNumber: 'PLAN-202608-0001',
        status: 'CONFIRMED',
        item: { itemCode: 'MAT-4140-RND-50' },
        constraints: {
          requiredHeatLotNumber: 'HL-202608-0001',
          materialAvailability: 'AVAILABLE',
          availableStockQuantity: 500
        },
        quantityTargets: { plannedQuantity: 100 },
        timeline: { actualStartDate: null },
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
        toJSON: () => ({ status: 'IN_PROGRESS' })
      };

      jest.spyOn(productionPlanRepository, 'findById').mockResolvedValue(mockPlan as any);
      jest.spyOn(heatLotRepository, 'findByHeatLotNumber').mockResolvedValue({
        heatLotNumber: 'HL-202608-0001',
        currentQuantity: 500,
        allocatedQuantity: 0
      } as any);
      jest.spyOn(quarantineRepository, 'findActiveQuarantineForTarget').mockResolvedValue(null);
      jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .patch('/api/v1/production-plans/plan_001/status')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ status: 'IN_PROGRESS' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockPlan.status).toBe('IN_PROGRESS');
      expect(mockPlan.timeline.actualStartDate).toBeInstanceOf(Date);
    });
  });

  describe('POST /api/v1/production-plans/:id/recalculate (Progress Recalculation)', () => {
    it('should recalculate completion percentage and auto-complete when completedQuantity matches plannedQuantity', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);

      const mockPlan = {
        id: 'plan_001',
        tenantId: testTenant,
        planNumber: 'PLAN-202608-0001',
        status: 'IN_PROGRESS',
        item: { itemCode: 'MAT-4140-RND-50' },
        constraints: {
          requiredHeatLotNumber: null,
          materialAvailability: 'AVAILABLE',
          availableStockQuantity: 1000
        },
        quantityTargets: {
          plannedQuantity: 200,
          completedQuantity: 200, // 100% completed
          completionPercentage: 0
        },
        timeline: { actualCompletionDate: null },
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
        toJSON: () => ({ status: 'COMPLETED', completionPercentage: 100 })
      };

      jest.spyOn(productionPlanRepository, 'findById').mockResolvedValue(mockPlan as any);
      jest.spyOn(heatLotRepository, 'searchHeatLots').mockResolvedValue({ items: [], total: 0, page: 1, limit: 50, totalPages: 0 } as any);
      jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/production-plans/plan_001/recalculate')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockPlan.quantityTargets.completionPercentage).toBe(100);
      expect(mockPlan.status).toBe('COMPLETED');
      expect(mockPlan.timeline.actualCompletionDate).toBeInstanceOf(Date);
    });
  });

  describe('RBAC Permission Gates', () => {
    it('should block unauthorized user lacking PRODUCTION_SCHEDULE_MANAGE from creating plans', async () => {
      const clerkToken = generateToken('usr_clerk', ['INVENTORY_CLERK']);

      const res = await request(app)
        .post('/api/v1/production-plans')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({
          title: 'Unauthorized Plan',
          customerId: 'cust_001',
          itemId: 'item_001',
          recipeId: 'rec_001',
          specificationId: 'spec_001',
          plannedQuantity: 100,
          plannedStartDate: '2026-09-01T08:00:00.000Z',
          targetCompletionDate: '2026-09-05T18:00:00.000Z'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access Denied');
    });
  });
});
