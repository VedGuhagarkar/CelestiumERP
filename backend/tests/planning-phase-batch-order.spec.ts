import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { purchaseOrderRepository } from '../src/modules/purchase-order/purchase-order.repository.js';
import { grnRepository } from '../src/modules/grn/grn.repository.js';
import { itemRepository } from '../src/modules/item/item.repository.js';
import { recipeRepository } from '../src/modules/recipe/recipe.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';

describe('Planning Phase — Authoritative PO -> GRN -> BO Workflow', () => {
  const app = createApp();
  const testTenant = 'tenant_planning_phase_001';

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const mockPo = {
    id: 'po_101',
    _id: 'po_101',
    poNumber: 'PO-2026-00101',
    supplierName: 'Titanium Alloys Global',
    status: 'PARTIALLY_RECEIVED',
    orderDate: new Date('2026-09-01'),
    items: [
      {
        itemId: 'item_ti64',
        itemCode: 'MAT-TI-6AL4V',
        itemName: 'Titanium Grade 5 Bar',
        materialGrade: 'Ti-6Al-4V',
        orderedQuantity: 200,
        uom: 'KG'
      }
    ]
  };

  const mockGrn = {
    id: 'grn_501',
    _id: 'grn_501',
    grnNumber: 'GRN-202609-0501',
    poId: 'po_101',
    poNumber: 'PO-2026-00101',
    supplierName: 'Titanium Alloys Global',
    supplierChallanNumber: 'CH-9988',
    warehouseCode: 'WH-MAIN',
    storageLocationCode: 'BAY-01',
    status: 'AVAILABLE_FOR_PLANNING',
    grnDate: new Date('2026-09-02'),
    totalUnitsGenerated: 2,
    items: [
      {
        itemId: 'item_ti64',
        itemCode: 'MAT-TI-6AL4V',
        itemName: 'Titanium Grade 5 Bar',
        materialGrade: 'Ti-6Al-4V',
        receivedQuantity: 200,
        acceptedQuantity: 200,
        uom: 'KG',
        heatNumber: 'HEAT-TI-9912',
        recipeId: 'rec_ti_01',
        recipeCode: 'REC-TI-AGING'
      }
    ],
    units: [
      {
        unitIdentifier: 'UNIT-TI-001',
        status: 'AVAILABLE_FOR_PLANNING',
        itemId: 'item_ti64',
        heatNumber: 'HEAT-TI-9912',
        quantity: 100,
        uom: 'KG'
      },
      {
        unitIdentifier: 'UNIT-TI-002',
        status: 'AVAILABLE_FOR_PLANNING',
        itemId: 'item_ti64',
        heatNumber: 'HEAT-TI-9912',
        quantity: 100,
        uom: 'KG'
      }
    ]
  };

  const mockItem = {
    id: 'item_ti64',
    _id: 'item_ti64',
    itemCode: 'MAT-TI-6AL4V',
    itemName: 'Titanium Grade 5 Bar',
    materialGrade: 'Ti-6Al-4V',
    uom: 'KG',
    status: 'ACTIVE'
  };

  const mockRecipe = {
    id: 'rec_ti_01',
    _id: 'rec_ti_01',
    recipeCode: 'REC-TI-AGING',
    revision: 1,
    name: 'Titanium Solution & Age Cycle',
    processFamily: 'VACUUM_HEAT_TREATMENT',
    status: 'APPROVED',
    applicableMaterialGrades: ['Ti-6Al-4V'],
    stages: [
      {
        sequence: 1,
        stageName: 'Solution Treat Soak',
        targetTemperatureC: 950,
        temperatureToleranceMinusC: 5,
        temperatureTolerancePlusC: 5,
        soakTimeMinutes: 120,
        soakCriteria: 'LOAD_THERMOCOUPLE_REACHED'
      }
    ]
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

    jest.spyOn(grnRepository, 'findUnitsByGrnId').mockResolvedValue(mockGrn.units as any);
    jest.spyOn(productionJobRepository, 'findByGrnId').mockResolvedValue([] as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. RBAC and Permission Enforcement', () => {
    it('should grant access to users with PLANT_MANAGER (has BATCH_ORDER_CREATE)', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);
      jest.spyOn(grnRepository, 'queryGrns').mockResolvedValue({ grns: [mockGrn as any], total: 1 });
      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValue(mockPo as any);

      const res = await request(app)
        .get('/api/v1/planning/eligible-pos')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].poNumber).toBe('PO-2026-00101');
    });

    it('should reject users without Batch Order permissions with 403 Forbidden', async () => {
      const techToken = generateToken('usr_tech', ['MAINTENANCE_TECH']);

      const res = await request(app)
        .get('/api/v1/planning/eligible-pos')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${techToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access Denied');
    });
  });

  describe('2. Planning Availability Gate (PO -> GRN -> Parts)', () => {
    it('should return eligible POs that have completed GRNs ready for planning', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);
      jest.spyOn(grnRepository, 'queryGrns').mockResolvedValue({ grns: [mockGrn as any], total: 1 });
      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValue(mockPo as any);

      const res = await request(app)
        .get('/api/v1/planning/eligible-pos')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data[0].poNumber).toBe('PO-2026-00101');
      expect(res.body.data[0].completedGrnCount).toBe(1);
    });

    it('should return empty list when PO has no completed GRNs', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);
      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValue(mockPo as any);
      jest.spyOn(grnRepository, 'findGrnsByPoId').mockResolvedValue([]);

      const res = await request(app)
        .get(`/api/v1/planning/pos/${mockPo.id}/grns`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('should strictly return only completed GRNs belonging to the selected PO when PO has multiple GRNs', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);
      const secondGrn = {
        ...mockGrn,
        id: 'grn_502',
        _id: 'grn_502',
        grnNumber: 'GRN-202609-0502',
        supplierChallanNumber: 'CH-9989',
        status: 'AVAILABLE_FOR_PLANNING',
        units: []
      };

      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValue(mockPo as any);
      jest.spyOn(grnRepository, 'findGrnsByPoId').mockResolvedValue([
        mockGrn,
        secondGrn,
        { ...mockGrn, id: 'grn_draft', grnNumber: 'GRN-DRAFT-01', status: 'DRAFT', items: [] }
      ] as any);

      const res = await request(app)
        .get(`/api/v1/planning/pos/${mockPo.id}/grns`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Only the 2 completed GRNs belonging to this PO are returned (DRAFT is excluded)
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data.map((g: any) => g.grnNumber)).toEqual(['GRN-202609-0501', 'GRN-202609-0502']);
      expect(res.body.data.every((g: any) => g.poId === mockPo.id)).toBe(true);
      expect(res.body.data.every((g: any) => g.readOnly === true)).toBe(true);
    });

    it('should return eligible received parts with multiple materials and serialized units for a GRN', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);
      const multiPartGrn = {
        ...mockGrn,
        items: [
          mockGrn.items[0],
          {
            itemId: 'item_in718',
            itemCode: 'MAT-IN-718',
            itemName: 'Inconel 718 Bar',
            materialGrade: 'Inconel 718',
            receivedQuantity: 50,
            acceptedQuantity: 50,
            uom: 'KG',
            heatNumber: 'HEAT-IN-4455',
            recipeId: 'rec_in_01',
            recipeCode: 'REC-IN718-AGE'
          }
        ],
        units: [
          mockGrn.units[0],
          mockGrn.units[1],
          {
            unitIdentifier: 'UNIT-IN-001',
            status: 'AVAILABLE_FOR_PLANNING',
            itemId: 'item_in718',
            heatNumber: 'HEAT-IN-4455',
            quantity: 50,
            uom: 'KG'
          }
        ]
      };

      jest.spyOn(grnRepository, 'findGrnById').mockResolvedValue(multiPartGrn as any);
      jest.spyOn(grnRepository, 'findUnitsByGrnId').mockResolvedValue(multiPartGrn.units as any);
      jest.spyOn(recipeRepository, 'findById').mockImplementation(async (_tenant, id) => {
        if (id === 'rec_ti_01') return mockRecipe as any;
        return {
          id: 'rec_in_01',
          recipeCode: 'REC-IN718-AGE',
          name: 'Inconel 718 Age Hardening',
          processFamily: 'VACUUM_HEAT_TREATMENT',
          status: 'APPROVED',
          stages: [
            { sequence: 1, stageName: 'Preheat', targetTemperatureC: 620, soakTimeMinutes: 60 }
          ]
        } as any;
      });

      const res = await request(app)
        .get(`/api/v1/planning/grns/${mockGrn.id}/parts`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);

      // Part 1: Ti Grade 5
      expect(res.body.data[0].itemCode).toBe('MAT-TI-6AL4V');
      expect(res.body.data[0].availableUnitsCount).toBe(2);
      expect(res.body.data[0].boundRecipe.recipeCode).toBe('REC-TI-AGING');
      expect(res.body.data[0].boundRecipe.stages).toHaveLength(1);
      expect(res.body.data[0].canCreateBatchOrder).toBe(true);

      // Part 2: Inconel 718
      expect(res.body.data[1].itemCode).toBe('MAT-IN-718');
      expect(res.body.data[1].availableUnitsCount).toBe(1);
      expect(res.body.data[1].boundRecipe.recipeCode).toBe('REC-IN718-AGE');
      expect(res.body.data[1].canCreateBatchOrder).toBe(true);
    });

    it('should reject parts query if GRN is incomplete (e.g. IN_INSPECTION)', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);
      jest.spyOn(grnRepository, 'findGrnById').mockResolvedValue({
        ...mockGrn,
        id: 'grn_inspecting',
        status: 'IN_INSPECTION'
      } as any);

      const res = await request(app)
        .get(`/api/v1/planning/grns/grn_inspecting/parts`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('has not completed the Creation Phase');
    });

    it('should reject BO creation if GRN has not completed Creation Phase', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValue(mockPo as any);
      jest.spyOn(grnRepository, 'findGrnById').mockResolvedValue({
        ...mockGrn,
        status: 'IN_INSPECTION'
      } as any);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          targetQuantity: 100,
          plannedStartDate: '2026-09-10T08:00:00.000Z',
          targetCompletionDate: '2026-09-10T16:00:00.000Z'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('has not completed the Creation Phase');
    });
  });

  describe('3. Batch Order Creation & Strict Lineage Validation', () => {
    it('should successfully create a BO in WAITING_FOR_PRODUCTION with full PO/GRN/BO hierarchy', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValue(mockPo as any);
      jest.spyOn(grnRepository, 'findGrnById').mockResolvedValue(mockGrn as any);
      jest.spyOn(itemRepository, 'findById').mockResolvedValue(mockItem as any);
      jest.spyOn(recipeRepository, 'findById').mockResolvedValue(mockRecipe as any);
      jest.spyOn(productionJobRepository, 'generateNextBatchOrderNumber').mockResolvedValue('BO-202609-0001');

      const allocateSpy = jest.spyOn(grnRepository, 'allocateUnit').mockResolvedValue({} as any);

      const mockCreatedDoc: any = {
        id: 'bo_created_01',
        jobNumber: 'BO-202609-0001',
        boNumber: 'BO-202609-0001',
        poId: mockPo.id,
        poNumber: mockPo.poNumber,
        grnId: mockGrn.id,
        grnNumber: mockGrn.grnNumber,
        status: 'WAITING_FOR_PRODUCTION',
        priority: 'HIGH',
        item: {
          itemId: mockItem.id,
          itemCode: mockItem.itemCode,
          itemName: mockItem.itemName,
          materialGrade: mockItem.materialGrade,
          uom: 'KG'
        },
        recipeSnapshot: {
          recipeId: mockRecipe.id,
          recipeCode: mockRecipe.recipeCode,
          stages: mockRecipe.stages
        },
        quantity: { targetQuantity: 100 },
        toJSON: function () {
          return { ...this };
        }
      };

      jest.spyOn(productionJobRepository, 'create').mockResolvedValue(mockCreatedDoc);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          targetQuantity: 100,
          priority: 'HIGH',
          plannedStartDate: '2026-09-10T08:00:00.000Z',
          targetCompletionDate: '2026-09-10T16:00:00.000Z',
          unitIdentifiers: ['UNIT-TI-001']
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.boNumber).toBe('BO-202609-0001');
      expect(res.body.data.status).toBe('WAITING_FOR_PRODUCTION');
      expect(res.body.data.poNumber).toBe('PO-2026-00101');
      expect(res.body.data.grnNumber).toBe('GRN-202609-0501');

      // Verify that GRN unit was transitioned to ALLOCATED_TO_PLAN
      expect(allocateSpy).toHaveBeenCalledWith(
        testTenant,
        'UNIT-TI-001',
        'BO-202609-0001',
        'BO-202609-0001',
        'BO-202609-0001'
      );
    });

    it('should reject creation if GRN does not belong to the selected PO', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValue(mockPo as any);
      // GRN points to another PO
      jest.spyOn(grnRepository, 'findGrnById').mockResolvedValue({
        ...mockGrn,
        poId: 'po_different_999',
        poNumber: 'PO-DIFFERENT-999'
      } as any);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          targetQuantity: 100,
          plannedStartDate: '2026-09-10T08:00:00.000Z',
          targetCompletionDate: '2026-09-10T16:00:00.000Z'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Hierarchy Violation');
    });

    it('should reject creation if selected Part does not exist in the GRN', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValue(mockPo as any);
      jest.spyOn(grnRepository, 'findGrnById').mockResolvedValue(mockGrn as any);
      // Item is not in the GRN line items
      jest.spyOn(itemRepository, 'findById').mockResolvedValue({
        id: 'item_alien',
        itemCode: 'MAT-UNKNOWN',
        materialGrade: 'UNKNOWN'
      } as any);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: 'item_alien',
          recipeId: mockRecipe.id,
          targetQuantity: 100,
          plannedStartDate: '2026-09-10T08:00:00.000Z',
          targetCompletionDate: '2026-09-10T16:00:00.000Z'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Part Membership Violation');
    });

    it('should reject creation if Recipe is not approved or not compatible with Item material grade', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValue(mockPo as any);
      jest.spyOn(grnRepository, 'findGrnById').mockResolvedValue(mockGrn as any);
      jest.spyOn(itemRepository, 'findById').mockResolvedValue(mockItem as any);
      // Recipe only applies to steel, not Titanium
      jest.spyOn(recipeRepository, 'findById').mockResolvedValue({
        ...mockRecipe,
        id: 'rec_different',
        recipeCode: 'REC-DIFF',
        applicableMaterialGrades: ['AISI 4140']
      } as any);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: 'rec_different',
          targetQuantity: 100,
          plannedStartDate: '2026-09-10T08:00:00.000Z',
          targetCompletionDate: '2026-09-10T16:00:00.000Z'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Metallurgical Incompatibility');
    });

    it('should reject legacy unbacked direct creation missing poId or grnId', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          targetQuantity: 100,
          plannedStartDate: '2026-09-10T08:00:00.000Z',
          targetCompletionDate: '2026-09-10T16:00:00.000Z'
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });
});
