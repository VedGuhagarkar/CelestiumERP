import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { productionPlanRepository } from '../src/modules/production-planning/production-plan.repository.js';
import { recipeRepository } from '../src/modules/recipe/recipe.repository.js';
import { specificationRepository } from '../src/modules/specification/specification.repository.js';
import { itemRepository } from '../src/modules/item/item.repository.js';
import { heatLotRepository } from '../src/modules/traceability/heat-lot.repository.js';
import { quarantineRepository } from '../src/modules/quarantine/quarantine.repository.js';
import { furnaceCapacityRepository } from '../src/modules/furnace-capacity/furnace-capacity.repository.js';
import { workforceCapacityRepository } from '../src/modules/workforce-capacity/workforce-capacity.repository.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';

describe('Manufacturing Constraint Analysis Engine Domain', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_001';

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const mockBlockedPlan = {
    id: 'plan_multi_blocked_001',
    tenantId: testTenant,
    planNumber: 'PLAN-202608-0099',
    status: 'PLANNED',
    priority: 'HIGH',
    customer: { customerCode: 'CUST-AERO-001' },
    item: {
      itemId: 'item_4140',
      itemCode: 'MAT-4140-BAR',
      itemName: 'AISI 4140 Round Bar',
      materialGrade: 'AISI 4140',
      uom: 'KG'
    },
    quantityTargets: {
      plannedQuantity: 500,
      completedQuantity: 0
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
    timeline: {
      plannedStartDate: new Date('2026-09-01T08:00:00.000Z'),
      targetCompletionDate: new Date('2026-09-01T16:00:00.000Z')
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

  describe('POST /api/v1/constraint-analysis/evaluate-plan/:planId', () => {
    it('should identify multiple simultaneous independent constraints on a blocked plan', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);

      jest.spyOn(productionPlanRepository, 'findById').mockResolvedValue(mockBlockedPlan as any);

      // 1. Unapproved Recipe Revision (RECIPE_VALIDITY)
      jest.spyOn(recipeRepository, 'findById').mockResolvedValue({
        id: 'rec_001',
        recipeCode: 'REC-CARB-4140',
        revision: 1,
        status: 'DRAFT', // Not approved!
        applicableMaterialGrades: ['AISI 4140']
      } as any);

      // 2. Approved Spec (SPECIFICATION_VALIDITY - Clean)
      jest.spyOn(specificationRepository, 'findById').mockResolvedValue({
        id: 'spec_001',
        specCode: 'SPEC-AMS-2759',
        revision: 1,
        status: 'APPROVED'
      } as any);

      // 3. Material shortage (MATERIAL)
      jest.spyOn(itemRepository, 'findByCode').mockResolvedValue({
        itemCode: 'MAT-4140-BAR',
        uom: 'KG',
        currentStock: 100, // Shortage: 100 < 500
        allocatedStock: 0
      } as any);

      // 4. Quarantined Heat Lot (HEAT_LOT_AVAILABILITY)
      jest.spyOn(heatLotRepository, 'searchHeatLots').mockResolvedValue({
        items: [{ id: 'hl_01', heatLotNumber: 'HL-202608-0001', currentQuantity: 500, allocatedQuantity: 0 }]
      } as any);
      jest.spyOn(quarantineRepository, 'findActiveQuarantineForTarget').mockResolvedValue({
        quarantineNumber: 'QRN-2026-0001',
        status: 'ACTIVE_QUARANTINE'
      } as any);

      // 5. No operational furnace for CARBURIZING (FURNACE_CAPABILITY)
      jest.spyOn(furnaceCapacityRepository, 'findFurnaces').mockResolvedValue([]);
      jest.spyOn(furnaceCapacityRepository, 'findOverlappingAllocations').mockResolvedValue([]);

      // 6. Operator lacking certification (OPERATOR_QUALIFICATION)
      jest.spyOn(workforceCapacityRepository, 'findEmployees').mockResolvedValue([
        {
          id: 'emp_op_01',
          employeeCode: 'EMP-OP-01',
          fullName: 'Novice Operator',
          status: 'ACTIVE',
          approvedLeaves: [],
          skills: [] // Missing CARBURIZING_OPERATION skill!
        } as any
      ]);

      const res = await request(app)
        .post(`/api/v1/constraint-analysis/evaluate-plan/${mockBlockedPlan.id}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const report = res.body.data;
      expect(report.isBlocked).toBe(true);
      expect(report.isFeasible).toBe(false);
      expect(report.status).toBe('BLOCKED');
      expect(report.blockingViolationsCount).toBeGreaterThanOrEqual(4);

      const categories = report.violations.map((v: any) => v.category);
      expect(categories).toContain('RECIPE_VALIDITY');
      expect(categories).toContain('MATERIAL');
      expect(categories).toContain('HEAT_LOT_AVAILABILITY');
      expect(categories).toContain('FURNACE_CAPABILITY');
      expect(categories).toContain('OPERATOR_QUALIFICATION');
    });

    it('should return FULLY_FEASIBLE when all 9 constraint categories are satisfied', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);

      jest.spyOn(productionPlanRepository, 'findById').mockResolvedValue(mockBlockedPlan as any);

      jest.spyOn(recipeRepository, 'findById').mockResolvedValue({
        id: 'rec_001',
        recipeCode: 'REC-CARB-4140',
        revision: 1,
        status: 'APPROVED',
        applicableMaterialGrades: ['AISI 4140']
      } as any);

      jest.spyOn(specificationRepository, 'findById').mockResolvedValue({
        id: 'spec_001',
        specCode: 'SPEC-AMS-2759',
        revision: 1,
        status: 'APPROVED'
      } as any);

      jest.spyOn(itemRepository, 'findByCode').mockResolvedValue({
        itemCode: 'MAT-4140-BAR',
        uom: 'KG',
        currentStock: 1000,
        allocatedStock: 0
      } as any);

      jest.spyOn(heatLotRepository, 'searchHeatLots').mockResolvedValue({
        items: [{ id: 'hl_01', heatLotNumber: 'HL-202608-0001', currentQuantity: 1000, allocatedQuantity: 0 }]
      } as any);
      jest.spyOn(quarantineRepository, 'findActiveQuarantineForTarget').mockResolvedValue(null);

      jest.spyOn(furnaceCapacityRepository, 'findFurnaces').mockResolvedValue([
        {
          id: 'furnace_sqf_01',
          furnaceCode: 'FURNACE-SQF-01',
          status: 'OPERATIONAL',
          thermalCapabilities: { minOperatingTempC: 750, maxOperatingTempC: 1050 },
          processCapabilities: { supportedProcessFamilies: ['CARBURIZING'] }
        } as any
      ]);
      jest.spyOn(furnaceCapacityRepository, 'findOverlappingAllocations').mockResolvedValue([]);

      jest.spyOn(workforceCapacityRepository, 'findEmployees').mockResolvedValue([
        {
          id: 'emp_op_01',
          employeeCode: 'EMP-OP-01',
          fullName: 'Marcus Vance',
          status: 'ACTIVE',
          approvedLeaves: [],
          skills: [{ skillCode: 'CARBURIZING_OPERATION', isCertified: true }]
        } as any
      ]);

      const res = await request(app)
        .post(`/api/v1/constraint-analysis/evaluate-plan/${mockBlockedPlan.id}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const report = res.body.data;
      expect(report.isBlocked).toBe(false);
      expect(report.isFeasible).toBe(true);
      expect(report.status).toBe('FULLY_FEASIBLE');
      expect(report.violations).toHaveLength(0);
    });
  });

  describe('GET /api/v1/constraint-analysis/factory-audit (Factory-Wide Bottleneck Engine)', () => {
    it('should aggregate constraint analysis across active plans and compute bottleneck rankings', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);

      jest.spyOn(productionPlanRepository, 'queryPlans').mockResolvedValue({
        plans: [mockBlockedPlan] as any,
        total: 1
      });

      jest.spyOn(productionPlanRepository, 'findById').mockResolvedValue(mockBlockedPlan as any);
      jest.spyOn(recipeRepository, 'findById').mockResolvedValue({
        revision: 1,
        status: 'APPROVED',
        applicableMaterialGrades: ['AISI 4140']
      } as any);
      jest.spyOn(specificationRepository, 'findById').mockResolvedValue({
        revision: 1,
        status: 'APPROVED'
      } as any);
      jest.spyOn(itemRepository, 'findByCode').mockResolvedValue({
        itemCode: 'MAT-4140-BAR',
        uom: 'KG',
        currentStock: 0, // Shortage!
        allocatedStock: 0
      } as any);
      jest.spyOn(heatLotRepository, 'searchHeatLots').mockResolvedValue({ items: [] } as any);
      jest.spyOn(furnaceCapacityRepository, 'findFurnaces').mockResolvedValue([
        {
          furnaceCode: 'FURNACE-SQF-01',
          status: 'OPERATIONAL',
          thermalCapabilities: { minOperatingTempC: 750, maxOperatingTempC: 1050 },
          processCapabilities: { supportedProcessFamilies: ['CARBURIZING'] }
        } as any
      ]);
      jest.spyOn(furnaceCapacityRepository, 'findOverlappingAllocations').mockResolvedValue([]);
      jest.spyOn(workforceCapacityRepository, 'findEmployees').mockResolvedValue([
        {
          skills: [{ skillCode: 'CARBURIZING_OPERATION', isCertified: true }],
          approvedLeaves: []
        } as any
      ]);

      const res = await request(app)
        .get('/api/v1/constraint-analysis/factory-audit')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const audit = res.body.data;
      expect(audit.totalPlansEvaluated).toBe(1);
      expect(audit.blockedPlansCount).toBe(1);
      expect(audit.topBottlenecks.length).toBeGreaterThan(0);
      expect(audit.topBottlenecks[0].category).toBe('MATERIAL');
    });
  });

  describe('RBAC Permission Gates', () => {
    it('should block unauthorized user lacking PRODUCTION_SCHEDULE_VIEW from auditing constraints', async () => {
      const qcToken = generateToken('usr_qc', ['QC_INSPECTOR']);

      const res = await request(app)
        .get('/api/v1/constraint-analysis/factory-audit')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send();

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access Denied');
    });
  });
});
