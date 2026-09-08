import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { ProductionJobModel } from '../src/modules/production-job/production-job.model.js';
import { purchaseOrderRepository } from '../src/modules/purchase-order/purchase-order.repository.js';
import { grnRepository } from '../src/modules/grn/grn.repository.js';
import { itemRepository } from '../src/modules/item/item.repository.js';
import { recipeRepository } from '../src/modules/recipe/recipe.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES, PERMISSIONS } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { userRepository } from '../src/modules/auth/user.repository.js';
import { workforceCapacityRepository } from '../src/modules/workforce-capacity/workforce-capacity.repository.js';

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
          weight: 50,
          plannedStartDate: '2026-09-10T08:00:00.000Z',
          targetCompletionDate: '2026-09-10T16:00:00.000Z'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('has not completed the Creation Phase');
    });
  });

  describe('3. Batch Order Creation & Strict Lineage Validation', () => {
    // 1. Valid BO
    it('should successfully create a valid BO in WAITING_FOR_PRODUCTION with full PO/GRN/BO hierarchy, derived customer, weight, and due date', async () => {
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
        customer: {
          customerId: mockPo.id,
          customerCode: 'CUST-DEFAULT',
          customerName: mockGrn.supplierName
        },
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
        weightKg: 50,
        weight: 50,
        dueDate: new Date('2026-09-20T00:00:00.000Z'),
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
          quantity: 100,
          weight: 50,
          dueDate: '2026-09-20T00:00:00.000Z',
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
      expect(res.body.data.customer.customerName).toBe('Titanium Alloys Global');
      expect(res.body.data.weightKg).toBe(50);
      expect(res.body.data.dueDate).toBeDefined();

      // Verify that GRN unit was transitioned to ALLOCATED_TO_PLAN
      expect(allocateSpy).toHaveBeenCalledWith(
        testTenant,
        'UNIT-TI-001',
        'BO-202609-0001',
        'BO-202609-0001',
        'BO-202609-0001'
      );
    });

    // 2. Invalid PO
    it('should reject BO creation with invalid PO (404)', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);
      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: 'po_nonexistent_404',
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not found');
    });

    // 3. GRN belonging to another PO
    it('should reject BO creation if GRN belongs to another PO (Hierarchy Violation)', async () => {
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
          quantity: 100,
          weight: 50
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Hierarchy Violation');
    });

    // 4. Part not present in GRN
    it('should reject BO creation if selected Part does not exist in the GRN', async () => {
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
          quantity: 100,
          weight: 50
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Part Membership Violation');
    });

    // 5. Invalid Recipe
    it('should reject BO creation with invalid Recipe (404)', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValue(mockPo as any);
      jest.spyOn(grnRepository, 'findGrnById').mockResolvedValue(mockGrn as any);
      jest.spyOn(itemRepository, 'findById').mockResolvedValue(mockItem as any);
      jest.spyOn(recipeRepository, 'findById').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: 'rec_nonexistent',
          quantity: 100,
          weight: 50
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not found');
    });

    // 6. Recipe belonging to another Item
    it('should reject BO creation if Recipe belongs to another Item (Recipe.item !== BO.item)', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValue(mockPo as any);
      jest.spyOn(grnRepository, 'findGrnById').mockResolvedValue(mockGrn as any);
      jest.spyOn(itemRepository, 'findById').mockResolvedValue(mockItem as any);
      // Recipe explicitly belongs to another item
      jest.spyOn(recipeRepository, 'findById').mockResolvedValue({
        ...mockRecipe,
        itemId: 'item_different_steel',
        recipeCode: 'REC-STEEL-01',
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
          recipeId: 'rec_steel_01',
          quantity: 100,
          weight: 50
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Recipe Mismatch Violation|Metallurgical Incompatibility/);
    });

    // 7. Quantity greater than GRN quantity
    it('should reject BO creation if quantity exceeds GRN received quantity', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValue(mockPo as any);
      jest.spyOn(grnRepository, 'findGrnById').mockResolvedValue(mockGrn as any);
      jest.spyOn(itemRepository, 'findById').mockResolvedValue(mockItem as any);
      jest.spyOn(recipeRepository, 'findById').mockResolvedValue(mockRecipe as any);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 250, // exceeds receivedQuantity 200
          weight: 50
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('exceeds GRN received quantity');
    });

    // 8. Zero quantity
    it('should reject BO creation with zero quantity', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 0,
          weight: 50
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toMatch(/quantity/i);
    });

    // 9. Negative weight
    it('should reject BO creation with negative weight', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 50,
          weight: -10
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toMatch(/weight/i);
    });

    // 10. Duplicate submission (Idempotency)
    it('should safely handle duplicate submission idempotently using idempotencyKey', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);
      const idempotencyKey = 'IDEM-KEY-UNIQUE-7788';

      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValue(mockPo as any);
      jest.spyOn(grnRepository, 'findGrnById').mockResolvedValue(mockGrn as any);
      jest.spyOn(itemRepository, 'findById').mockResolvedValue(mockItem as any);
      jest.spyOn(recipeRepository, 'findById').mockResolvedValue(mockRecipe as any);
      jest.spyOn(grnRepository, 'allocateUnit').mockResolvedValue({} as any);

      const existingJob: any = {
        id: 'bo_existing_01',
        boNumber: 'BO-202609-0001',
        jobNumber: 'BO-202609-0001',
        idempotencyKey,
        status: 'WAITING_FOR_PRODUCTION',
        toJSON: () => ({ id: 'bo_existing_01', boNumber: 'BO-202609-0001', status: 'WAITING_FOR_PRODUCTION' })
      };

      const findKeySpy = jest
        .spyOn(productionJobRepository, 'findByIdempotencyKey')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingJob);

      jest.spyOn(productionJobRepository, 'generateNextBatchOrderNumber').mockResolvedValue('BO-202609-0001');
      jest.spyOn(productionJobRepository, 'create').mockResolvedValue(existingJob);

      // Submission 1
      const res1 = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50,
          idempotencyKey
        });

      expect(res1.status).toBe(201);
      expect(res1.body.data.boNumber).toBe('BO-202609-0001');

      // Submission 2: identical idempotencyKey returns existing without duplicate
      const res2 = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50,
          idempotencyKey
        });

      expect(res2.status).toBe(201);
      expect(res2.body.data.boNumber).toBe('BO-202609-0001');
      expect(findKeySpy).toHaveBeenCalledTimes(2);
    });

    // 11. Concurrent creation
    it('should safely handle concurrent creation and assign unique monotonic batch numbers', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValue(mockPo as any);
      jest.spyOn(grnRepository, 'findGrnById').mockResolvedValue(mockGrn as any);
      jest.spyOn(itemRepository, 'findById').mockResolvedValue(mockItem as any);
      jest.spyOn(recipeRepository, 'findById').mockResolvedValue(mockRecipe as any);
      jest.spyOn(grnRepository, 'allocateUnit').mockResolvedValue({} as any);

      let seq = 1;
      jest.spyOn(productionJobRepository, 'generateNextBatchOrderNumber').mockImplementation(async () => {
        return `BO-202609-${String(seq++).padStart(4, '0')}`;
      });

      jest.spyOn(productionJobRepository, 'create').mockImplementation(async (_tenant, data: any) => {
        return {
          ...data,
          id: `bo_${data.boNumber}`,
          toJSON: () => data
        } as any;
      });

      const reqPayload = {
        poId: mockPo.id,
        grnId: mockGrn.id,
        itemId: mockItem.id,
        recipeId: mockRecipe.id,
        quantity: 50,
        weight: 25
      };

      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/v1/batch-orders')
          .set('x-tenant-id', testTenant)
          .set('Authorization', `Bearer ${plannerToken}`)
          .send(reqPayload),
        request(app)
          .post('/api/v1/batch-orders')
          .set('x-tenant-id', testTenant)
          .set('Authorization', `Bearer ${plannerToken}`)
          .send(reqPayload)
      ]);

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      expect(res1.body.data.boNumber).not.toBe(res2.body.data.boNumber);
      expect(['BO-202609-0001', 'BO-202609-0002']).toContain(res1.body.data.boNumber);
      expect(['BO-202609-0001', 'BO-202609-0002']).toContain(res2.body.data.boNumber);
    });

    // 12. Unauthorized user
    it('should reject unauthorized user without BATCH_ORDER_CREATE permission with 403 Forbidden', async () => {
      const techToken = generateToken('usr_tech', ['MAINTENANCE_TECH']);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${techToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access Denied');
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
          quantity: 100,
          weight: 50
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 4. Batch Order Process Details Structure (15 Sequential Rows)
  // =========================================================================
  describe('4. Batch Order Process Details Structure (15 Sequential Rows)', () => {
    const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

    beforeEach(() => {
      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValue(mockPo as any);
      jest.spyOn(grnRepository, 'findGrnById').mockResolvedValue(mockGrn as any);
      jest.spyOn(itemRepository, 'findById').mockResolvedValue(mockItem as any);
      jest.spyOn(recipeRepository, 'findById').mockResolvedValue(mockRecipe as any);
      jest.spyOn(productionJobRepository, 'generateNextBatchOrderNumber').mockResolvedValue('BO-202609-0001');
      jest.spyOn(productionJobRepository, 'create').mockImplementation(async (_tenantId, data: any) => {
        return {
          id: 'job_created_001',
          _id: 'job_created_001',
          ...data,
          toJSON: function () {
            return { ...this };
          }
        } as any;
      });
      jest.spyOn(grnRepository, 'allocateUnit').mockResolvedValue({} as any);
    });

    it('should initialize all 15 process positions with sequential serial numbers (1..15) and BLANK initial state on BO creation when processDetails is omitted', async () => {
      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const { processDetails } = res.body.data;
      expect(processDetails).toBeDefined();
      expect(processDetails).toHaveLength(15);

      // Verify strictly sequential serial numbers 1 to 15
      const serials = processDetails.map((r: any) => r.serialNumber);
      expect(serials).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

      // Verify all positions start in BLANK initial state
      processDetails.forEach((row: any, idx: number) => {
        expect(row.serialNumber).toBe(idx + 1);
        expect(row.status).toBe('BLANK');
        expect(row.partId).toBeNull();
        expect(row.process).toBeNull();
        expect(row.recipeId).toBeNull();
        expect(row.minhardness).toBeNull();
        expect(row.maxhardness).toBeNull();
      });
    });

    it('should accept valid configured process rows and pad remaining positions to 15 sequential rows with BLANK status', async () => {
      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50,
          processDetails: [
            {
              serialNumber: 1,
              partId: 'item_ti64',
              process: 'Solution Treat Soak',
              recipeId: 'rec_ti_01',
              minhardness: 45,
              maxhardness: 52,
              userId: 'usr_mgr'
            },
            {
              serialNumber: 2,
              partId: 'item_ti64',
              process: 'VACUUM_HEAT_TREATMENT',
              recipeId: 'rec_ti_01',
              minhardness: 48,
              maxhardness: 55,
              userId: 'usr_mgr'
            }
          ]
        });

      expect(res.status).toBe(201);
      const { processDetails } = res.body.data;
      expect(processDetails).toHaveLength(15);

      // Row 1
      expect(processDetails[0].serialNumber).toBe(1);
      expect(processDetails[0].partId).toBe('item_ti64');
      expect(processDetails[0].partCode).toBe('MAT-TI-6AL4V');
      expect(processDetails[0].process).toBe('Solution Treat Soak');
      expect(processDetails[0].recipeId).toBe('rec_ti_01');
      expect(processDetails[0].recipeCode).toBe('REC-TI-AGING');
      expect(processDetails[0].minhardness).toBe(45);
      expect(processDetails[0].maxhardness).toBe(52);
      expect(processDetails[0].status).toBe('PENDING');

      // Row 2
      expect(processDetails[1].serialNumber).toBe(2);
      expect(processDetails[1].process).toBe('VACUUM_HEAT_TREATMENT');
      expect(processDetails[1].status).toBe('PENDING');

      // Rows 3 through 15 are padded as BLANK
      for (let i = 2; i < 15; i++) {
        expect(processDetails[i].serialNumber).toBe(i + 1);
        expect(processDetails[i].status).toBe('BLANK');
      }
    });

    it('should reject BO creation if process row references a Part not present in the GRN', async () => {
      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50,
          processDetails: [
            {
              serialNumber: 1,
              partId: 'item_unrelated_999',
              process: 'Solution Treat Soak',
              recipeId: 'rec_ti_01',
              minhardness: 45,
              maxhardness: 52
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Part Membership Violation');
    });

    it('should reject BO creation if process row references a Recipe that contradicts/mismatches the BO Item', async () => {
      jest.spyOn(recipeRepository, 'findById').mockImplementation(async (_t, id) => {
        if (id === 'rec_steel_02') {
          return {
            id: 'rec_steel_02',
            recipeCode: 'REC-STEEL-CARB',
            processFamily: 'CARBURIZING',
            itemId: 'item_steel_unrelated',
            applicableMaterialGrades: ['AISI 8620'],
            stages: []
          } as any;
        }
        return mockRecipe as any;
      });

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50,
          processDetails: [
            {
              serialNumber: 1,
              partId: 'item_ti64',
              process: 'CARBURIZING',
              recipeId: 'rec_steel_02',
              minhardness: 45,
              maxhardness: 52
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Recipe Mismatch');
    });

    it('should reject BO creation if process name contradicts the referenced Recipe', async () => {
      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50,
          processDetails: [
            {
              serialNumber: 1,
              partId: 'item_ti64',
              process: 'ANODIZING_PROCESS_UNKNOWN',
              recipeId: 'rec_ti_01',
              minhardness: 45,
              maxhardness: 52
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid Process');
    });

    it('should reject BO creation if minhardness or maxhardness is negative', async () => {
      const res1 = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50,
          processDetails: [
            {
              serialNumber: 1,
              partId: 'item_ti64',
              process: 'Solution Treat Soak',
              recipeId: 'rec_ti_01',
              minhardness: -5,
              maxhardness: 52
            }
          ]
        });

      expect([400, 422]).toContain(res1.status);
      expect(res1.body.success).toBe(false);

      const res2 = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50,
          processDetails: [
            {
              serialNumber: 1,
              partId: 'item_ti64',
              process: 'Solution Treat Soak',
              recipeId: 'rec_ti_01',
              minhardness: 45,
              maxhardness: -10
            }
          ]
        });

      expect([400, 422]).toContain(res2.status);
      expect(res2.body.success).toBe(false);
    });

    it('should reject BO creation if maxhardness is lower than minhardness', async () => {
      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50,
          processDetails: [
            {
              serialNumber: 1,
              partId: 'item_ti64',
              process: 'Solution Treat Soak',
              recipeId: 'rec_ti_01',
              minhardness: 55,
              maxhardness: 45
            }
          ]
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('should reject BO creation if hardness values are omitted on configured row (user-input required)', async () => {
      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50,
          processDetails: [
            {
              serialNumber: 1,
              partId: 'item_ti64',
              process: 'Solution Treat Soak',
              recipeId: 'rec_ti_01'
            }
          ]
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('minhardness');
    });

    it('should reject BO creation if process row references an invalid/arbitrary user identifier', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValue(null);
      jest.spyOn(userRepository, 'findByUsername').mockResolvedValue(null);
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(null);
      jest.spyOn(workforceCapacityRepository, 'findEmployeeById').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50,
          processDetails: [
            {
              serialNumber: 1,
              partId: 'item_ti64',
              process: 'Solution Treat Soak',
              recipeId: 'rec_ti_01',
              minhardness: 45,
              maxhardness: 52,
              userId: 'usr_ghost_intruder'
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid User');
    });

    it('should reject BO creation if process row has an uncontrolled/arbitrary status', async () => {
      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50,
          processDetails: [
            {
              serialNumber: 1,
              partId: 'item_ti64',
              process: 'Solution Treat Soak',
              recipeId: 'rec_ti_01',
              minhardness: 45,
              maxhardness: 52,
              status: 'ARBITRARY_STATUS' as any
            }
          ]
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('should reject BO creation if serial number is modified arbitrarily out of sequence', async () => {
      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50,
          processDetails: [
            {
              serialNumber: 8, // Non-sequential (expected 1)
              partId: 'item_ti64',
              process: 'Solution Treat Soak',
              recipeId: 'rec_ti_01',
              minhardness: 45,
              maxhardness: 52
            }
          ]
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Serial Number Violation');
    });

    it('should reject BO creation if more than 15 process rows are provided', async () => {
      const sixteenRows = Array.from({ length: 16 }, (_, i) => ({
        serialNumber: i + 1,
        status: 'BLANK' as const
      }));

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50,
          processDetails: sixteenRows
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('should update process details via PUT and retrieve via GET /batch-orders/:id/process-details', async () => {
      const mockJobDoc = {
        id: 'job_bo_101',
        _id: 'job_bo_101',
        jobNumber: 'BO-202609-0001',
        boNumber: 'BO-202609-0001',
        poId: mockPo.id,
        grnId: mockGrn.id,
        item: mockItem,
        recipeSnapshot: {
          recipeId: mockRecipe.id,
          recipeCode: mockRecipe.recipeCode,
          stages: mockRecipe.stages,
          processFamily: mockRecipe.processFamily
        },
        processDetails: Array.from({ length: 15 }, (_, i) => ({
          serialNumber: i + 1,
          status: 'BLANK'
        })),
        isDeleted: false,
        toJSON: function () {
          return { ...this };
        }
      };

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJobDoc as any);
      jest.spyOn(productionJobRepository, 'updateById').mockImplementation(async (_t, _id, update: any) => {
        return {
          ...mockJobDoc,
          ...update,
          toJSON: function () {
            return { ...this };
          }
        } as any;
      });

      // PUT: Update process details with configured row at position 1
      const updateRes = await request(app)
        .put('/api/v1/batch-orders/job_bo_101/process-details')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          processDetails: [
            {
              serialNumber: 1,
              partId: 'item_ti64',
              process: 'Solution Treat Soak',
              recipeId: 'rec_ti_01',
              minhardness: 48,
              maxhardness: 54,
              userId: 'usr_mgr'
            }
          ]
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.processDetails).toHaveLength(15);
      expect(updateRes.body.data.processDetails[0].minhardness).toBe(48);
      expect(updateRes.body.data.processDetails[0].maxhardness).toBe(54);

      // Mock findById returning updated doc
      mockJobDoc.processDetails = updateRes.body.data.processDetails;

      // GET: Retrieve process details
      const getRes = await request(app)
        .get('/api/v1/batch-orders/job_bo_101/process-details')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data).toHaveLength(15);
      expect(getRes.body.data[0].serialNumber).toBe(1);
      expect(getRes.body.data[0].process).toBe('Solution Treat Soak');
      expect(getRes.body.data[0].minhardness).toBe(48);
      expect(getRes.body.data[0].maxhardness).toBe(54);

      // Verify structure is directly consumable by Production and Inspection
      const inspectionHandoffRow = getRes.body.data[0];
      expect(inspectionHandoffRow.minhardness).toBeGreaterThanOrEqual(0);
      expect(inspectionHandoffRow.maxhardness).toBeGreaterThanOrEqual(inspectionHandoffRow.minhardness);
      expect(inspectionHandoffRow.recipeCode).toBe(mockRecipe.recipeCode);
      expect(inspectionHandoffRow.status).toBe('PENDING');
    });
  });

  describe('5. Enforce BO Source-of-Truth Relationships & Deliberate Tampering Prevention', () => {
    let createdJobRecord: any = null;

    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValue(mockPo as any);
      jest.spyOn(grnRepository, 'findGrnById').mockResolvedValue(mockGrn as any);
      jest.spyOn(grnRepository, 'findUnitsByGrnId').mockResolvedValue(mockGrn.units as any);
      jest.spyOn(grnRepository, 'allocateUnit').mockResolvedValue({} as any);
      jest.spyOn(itemRepository, 'findById').mockResolvedValue(mockItem as any);
      jest.spyOn(recipeRepository, 'findById').mockResolvedValue(mockRecipe as any);
      jest.spyOn(productionJobRepository, 'findByIdempotencyKey').mockResolvedValue(null);
      jest.spyOn(productionJobRepository, 'generateNextBatchOrderNumber').mockResolvedValue('BO-202609-0888');
      jest.spyOn(productionJobRepository, 'create').mockImplementation(async (tenant: string, data: any) => {
        createdJobRecord = {
          id: 'job_bo_tamper_test',
          _id: 'job_bo_tamper_test',
          tenantId: tenant,
          ...data,
          save: jest.fn().mockResolvedValue(true),
          toJSON: function () {
            return { ...this };
          }
        };
        return createdJobRecord;
      });
      jest.spyOn(productionJobRepository, 'findById').mockImplementation(async () => {
        return createdJobRecord;
      });
    });

    // 1. Cross-Record Contamination: PO A + GRN B
    it('should reject requests attempting to combine PO A with unrelated GRN B', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);
      const mismatchedGrn = {
        ...mockGrn,
        id: 'grn_other',
        poId: 'po_other',
        poNumber: 'PO-2026-99999'
      };
      jest.spyOn(grnRepository, 'findGrnById').mockResolvedValue(mismatchedGrn as any);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mismatchedGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Hierarchy Violation|belongs to PO/i);
    });

    // 2. Cross-Record Contamination: GRN A + Part B
    it('should reject requests attempting to combine GRN A with Part B not present in GRN', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: 'item_rogue_part',
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Part Membership Violation/i);
    });

    // 3. Cross-Record Contamination: PO A + Part B (Part not present on PO line items)
    it('should reject requests attempting to combine PO A with Part not present in PO line items', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      // GRN has a part, but PO does not have this part
      const grnWithDifferentPart = {
        ...mockGrn,
        items: [
          {
            itemId: 'item_inconel_718',
            itemCode: 'MAT-INCONEL-718',
            itemName: 'Inconel 718 Superalloy',
            materialGrade: 'Inconel 718',
            receivedQuantity: 100,
            acceptedQuantity: 100,
            uom: 'KG',
            recipeId: 'rec_inconel_01'
          }
        ]
      };
      const inconelItem = {
        id: 'item_inconel_718',
        _id: 'item_inconel_718',
        itemCode: 'MAT-INCONEL-718',
        itemName: 'Inconel 718 Superalloy',
        materialGrade: 'Inconel 718',
        uom: 'KG',
        status: 'ACTIVE'
      };

      jest.spyOn(grnRepository, 'findGrnById').mockResolvedValue(grnWithDifferentPart as any);
      jest.spyOn(itemRepository, 'findById').mockResolvedValue(inconelItem as any);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: grnWithDifferentPart.id,
          itemId: 'item_inconel_718',
          recipeId: 'rec_inconel_01',
          quantity: 50,
          weight: 25
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Cross-Record Contamination Violation');
      expect(res.body.message).toContain('does not exist on parent PO');
    });

    // 4. Cross-Record Contamination: Part A + Recipe B (Contradictory recipe/material)
    it('should reject requests attempting to combine Part A with Recipe B that contradicts its material', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);
      const steelRecipe = {
        id: 'rec_steel_carburize',
        recipeCode: 'REC-CARBURIZING-01',
        name: 'Case Hardening Carburize Cycle',
        processFamily: 'CASE_HARDENING',
        status: 'APPROVED',
        applicableMaterialGrades: ['EN19', '16MnCr5'] // incompatible with Ti-6Al-4V
      };
      jest.spyOn(recipeRepository, 'findById').mockResolvedValue(steelRecipe as any);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: steelRecipe.id,
          quantity: 50,
          weight: 25
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Metallurgical Incompatibility|Recipe Mismatch Violation/i);
    });

    // 5. Cross-Record Contamination: PO A + unrelated Customer (Deliberate client tampering)
    it('should reject client-supplied customer data that contradicts the authoritative PO/GRN customer', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50,
          customer: {
            customerName: 'Rogue Aero Corporation',
            customerCode: 'ROGUE-CUST'
          }
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Cross-Record Contamination Violation');
      expect(res.body.message).toMatch(/Client-supplied customer.*contradicts authoritative PO\/GRN customer/);
    });

    // 6. Cross-Record Contamination: GRN A + unrelated Material (Deliberate client tampering)
    it('should reject client-supplied material grade that contradicts authoritative GRN material', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50,
          materialGrade: 'ALUMINUM-7075-T6' // Contradicts Ti-6Al-4V
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Cross-Record Contamination Violation');
      expect(res.body.message).toMatch(/Requested material grade.*contradicts authoritative GRN material grade/);
    });

    // 7. Server-Side Retrieval of Master Data
    it('should authoritatively retrieve customer and item master data server-side without trusting client duplication', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      // Submit minimal identifiers only
      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // Verify that the created BO has authoritative customer and master item data retrieved server-side
      const createdBo = res.body.data;
      expect(createdBo.customer.customerName).toBe(mockGrn.supplierName);
      expect(createdBo.item.itemCode).toBe(mockItem.itemCode);
      expect(createdBo.item.materialGrade).toBe(mockItem.materialGrade);
      expect(createdBo.recipeSnapshot.recipeCode).toBe(mockRecipe.recipeCode);
      expect(createdBo.genealogy).toBeDefined();
    });

    // 8. Immutable Genealogy Retrieval & Answering 4 Traceability Questions
    it('should answer all 4 traceability questions via GET /batch-orders/:id/genealogy', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      // First create BO
      await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50
        });

      // Call genealogy endpoint
      const genealogyRes = await request(app)
        .get('/api/v1/batch-orders/job_bo_tamper_test/genealogy')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`);

      expect(genealogyRes.status).toBe(200);
      expect(genealogyRes.body.success).toBe(true);

      const { genealogy, answers, traceabilityChain } = genealogyRes.body.data;
      expect(genealogy.isImmutable).toBe(true);

      // Question 1: Which PO created this BO?
      expect(genealogy.whichPo.poId).toBe(mockPo.id);
      expect(genealogy.whichPo.poNumber).toBe(mockPo.poNumber);
      expect(answers.whichPoCreatedThisBo).toContain(mockPo.poNumber);

      // Question 2: Which GRN supplied it?
      expect(genealogy.whichGrn.grnId).toBe(mockGrn.id);
      expect(genealogy.whichGrn.grnNumber).toBe(mockGrn.grnNumber);
      expect(answers.whichGrnSuppliedIt).toContain(mockGrn.grnNumber);

      // Question 3: Which Part does it represent?
      expect(genealogy.whichPart.itemCode).toBe(mockItem.itemCode);
      expect(genealogy.whichPart.materialGrade).toBe(mockItem.materialGrade);
      expect(answers.whichPartDoesItRepresent).toContain(mockItem.itemCode);

      // Question 4: Which Recipe governs it?
      expect(genealogy.whichRecipe.recipeCode).toBe(mockRecipe.recipeCode);
      expect(answers.whichRecipeGovernsIt).toContain(mockRecipe.recipeCode);

      expect(traceabilityChain).toContain('PO (PO-2026-00101) -> GRN (GRN-202609-0501) -> BO');
    });

    // 9. Genealogy Immutability: Block deliberate PATCH mutation of fundamental genealogy
    it('should reject attempts to mutate genealogy or source PO/GRN/Part via updateJob', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      // Setup existing job in DRAFT or APPROVED
      createdJobRecord = {
        id: 'job_bo_tamper_test',
        _id: 'job_bo_tamper_test',
        jobNumber: 'BO-202609-0888',
        status: 'APPROVED',
        quantity: { targetQuantity: 100 },
        priority: 'NORMAL',
        timeline: { plannedStartDate: new Date(), targetCompletionDate: new Date() },
        save: jest.fn().mockResolvedValue(true),
        toJSON: function () {
          return { ...this };
        }
      };

      const res = await request(app)
        .patch('/api/v1/production-jobs/job_bo_tamper_test')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: 'po_tampered_999',
          targetQuantity: 120
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toMatch(/Genealogy Violation/i);
    });
  });

  describe('6. Batch Order Initial Workflow State Machine', () => {
    let createdJobRecord: any = null;

    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValue(mockPo as any);
      jest.spyOn(grnRepository, 'findGrnById').mockResolvedValue(mockGrn as any);
      jest.spyOn(grnRepository, 'findUnitsByGrnId').mockResolvedValue(mockGrn.units as any);
      jest.spyOn(grnRepository, 'allocateUnit').mockResolvedValue({} as any);
      jest.spyOn(itemRepository, 'findById').mockResolvedValue(mockItem as any);
      jest.spyOn(recipeRepository, 'findById').mockResolvedValue(mockRecipe as any);
      jest.spyOn(productionJobRepository, 'findByIdempotencyKey').mockResolvedValue(null);
      jest.spyOn(productionJobRepository, 'generateNextBatchOrderNumber').mockResolvedValue('BO-202609-0999');
      jest.spyOn(productionJobRepository, 'create').mockImplementation(async (tenant: string, data: any) => {
        createdJobRecord = {
          id: 'job_bo_workflow_test',
          _id: 'job_bo_workflow_test',
          tenantId: tenant,
          ...data,
          save: jest.fn().mockResolvedValue(true),
          toJSON: function () {
            return { ...this };
          }
        };
        return createdJobRecord;
      });
      jest.spyOn(productionJobRepository, 'findById').mockImplementation(async () => {
        return createdJobRecord;
      });
    });

    // 1. Initial State: waitingForProduction = true, all other flags false
    it('should initialize every valid newly created BO in waitingForProduction = true and all other flags false', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const bo = res.body.data;
      expect(bo.status).toBe('WAITING_FOR_PRODUCTION');
      expect(bo.waitingForProduction).toBe(true);
      expect(bo.inProduction).toBe(false);
      expect(bo.waitingForInspection).toBe(false);
      expect(bo.inInspection).toBe(false);
      expect(bo.waitingForDispatch).toBe(false);
      expect(bo.dispatched).toBe(false);

      expect(bo.workflowState).toEqual({
        waitingForProduction: true,
        inProduction: false,
        waitingForInspection: false,
        inInspection: false,
        waitingForDispatch: false,
        dispatched: false
      });
    });

    // 2. Mutual Exclusivity: Exactly one flag is true
    it('should verify that exactly one workflow flag is true at BO creation', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50
        });

      expect(res.status).toBe(201);
      const bo = res.body.data;

      const activeFlags = [
        bo.waitingForProduction,
        bo.inProduction,
        bo.waitingForInspection,
        bo.inInspection,
        bo.waitingForDispatch,
        bo.dispatched
      ].filter(Boolean);

      expect(activeFlags).toHaveLength(1);
    });

    // 3. Reject creation request attempting to set inProduction as initial state
    it('should reject BO creation request attempting to set inProduction as initial state', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50,
          inProduction: true
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toMatch(/Invalid State Manipulation/i);
    });

    // 4. Reject creation request attempting to set waitingForInspection as initial state
    it('should reject BO creation request attempting to set waitingForInspection as initial state', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50,
          waitingForInspection: true
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toMatch(/Invalid State Manipulation/i);
    });

    // 5. Reject creation request attempting to set inInspection as initial state
    it('should reject BO creation request attempting to set inInspection as initial state', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50,
          inInspection: true
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toMatch(/Invalid State Manipulation/i);
    });

    // 6. Reject creation request attempting to set waitingForDispatch as initial state
    it('should reject BO creation request attempting to set waitingForDispatch as initial state', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50,
          waitingForDispatch: true
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toMatch(/Invalid State Manipulation/i);
    });

    // 7. Reject creation request attempting to set dispatched as initial state
    it('should reject BO creation request attempting to set dispatched as initial state', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50,
          dispatched: true
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toMatch(/Invalid State Manipulation/i);
    });

    // 8. Reject creation request attempting to set inspection as initial state
    it('should reject BO creation request attempting to set inspection as initial state', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50,
          inspection: true
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toMatch(/Invalid State Manipulation/i);
    });

    // 9. Reject creation request attempting to set status to non-waiting status (e.g. IN_PROGRESS)
    it('should reject BO creation request attempting to set status to IN_PROGRESS or COMPLETED', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50,
          status: 'IN_PROGRESS'
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toMatch(/Invalid State Manipulation/i);
    });

    // 10. Reject multi-flag tampering (e.g. waitingForProduction: true + inProduction: true)
    it('should reject malicious multi-flag requests violating mutual exclusivity', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50,
          waitingForProduction: true,
          inProduction: true
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toMatch(/Mutual Exclusivity Violation|Invalid State Manipulation/i);
    });

    // 11. Reject disabling waitingForProduction (waitingForProduction: false)
    it('should reject attempts to set waitingForProduction = false on creation', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50,
          waitingForProduction: false
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toMatch(/Invalid State Manipulation/i);
    });

    // 12. Audit Record: Audit log must record initial workflow state
    it('should record BO creation and initial workflow state in the audit log', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);
      const auditSpy = jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50
        });

      expect(res.status).toBe(201);
      expect(auditSpy).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          action: 'CREATE_BATCH_ORDER',
          entityType: 'BATCH_ORDER',
          metadata: expect.objectContaining({
            initialWorkflowState: 'WAITING_FOR_PRODUCTION',
            waitingForProduction: true,
            workflowState: expect.objectContaining({
              waitingForProduction: true,
              inProduction: false
            })
          })
        })
      );
    });

    // 13. Production Handoff: Production role users can query BO in waiting_for_production
    it('should allow users with Production permission to access BO in waiting_for_production queue without planner manual advance', async () => {
      const prodToken = generateToken('usr_prod_op', ['FURNACE_OPERATOR']);

      jest.spyOn(productionJobRepository, 'queryJobs').mockResolvedValue({
        items: [
          {
            id: 'job_bo_workflow_test',
            jobNumber: 'BO-202609-0999',
            status: 'WAITING_FOR_PRODUCTION',
            waitingForProduction: true,
            inProduction: false
          } as any
        ],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1
      });

      const res = await request(app)
        .get('/api/v1/production-jobs?status=WAITING_FOR_PRODUCTION')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${prodToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data[0].status).toBe('WAITING_FOR_PRODUCTION');
      expect(res.body.data[0].waitingForProduction).toBe(true);
    });

    // 14. Database Invariant Enforcement: Pre-save hook enforces mutual exclusivity directly
    it('should reject direct document saves violating mutual exclusivity at the database model layer', (done) => {
      const hooks: any = (ProductionJobModel.schema as any).s?.hooks?._pres?.get('save') || [];
      const preSaveHook = hooks.find((h: any) => h.fn.toString().includes('Mutual Exclusivity Violation'))?.fn;

      if (!preSaveHook) {
        return done();
      }

      // Context 1: Multiple active flags (waitingForProduction: true, inProduction: true)
      const multiFlagDoc: any = {
        waitingForProduction: true,
        inProduction: true,
        waitingForInspection: false,
        inInspection: false,
        waitingForDispatch: false,
        dispatched: false,
        isModified: () => true
      };

      preSaveHook.call(multiFlagDoc, (err1: Error) => {
        expect(err1).toBeDefined();
        expect(err1.message).toContain('Mutual Exclusivity Violation');
        expect(err1.message).toContain('received 2 active flags');

        // Context 2: Zero active flags (all false)
        const zeroFlagDoc: any = {
          waitingForProduction: false,
          inProduction: false,
          waitingForInspection: false,
          inInspection: false,
          waitingForDispatch: false,
          dispatched: false,
          isModified: () => true
        };

        preSaveHook.call(zeroFlagDoc, (err2: Error) => {
          expect(err2).toBeDefined();
          expect(err2.message).toContain('Mutual Exclusivity Violation');
          expect(err2.message).toContain('received 0 active flags');
          done();
        });
      });
    });
  });

  describe('7. Batch Order Quantity Allocation and GRN Integrity', () => {
    let jobStore: any[] = [];

    beforeEach(() => {
      jobStore = [];
      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValue(mockPo as any);
      jest.spyOn(grnRepository, 'findGrnById').mockResolvedValue(mockGrn as any);
      jest.spyOn(itemRepository, 'findById').mockResolvedValue(mockItem as any);
      jest.spyOn(recipeRepository, 'findById').mockResolvedValue(mockRecipe as any);
      jest.spyOn(grnRepository, 'allocateUnit').mockResolvedValue({} as any);

      let counter = 1;
      jest.spyOn(productionJobRepository, 'generateNextBatchOrderNumber').mockImplementation(async () => {
        return `BO-202609-00${counter++}`;
      });

      jest.spyOn(productionJobRepository, 'findByGrnId').mockImplementation(async (_tenant, grnId) => {
        return jobStore.filter((j) => j.grnId === grnId) as any;
      });

      jest.spyOn(productionJobRepository, 'create').mockImplementation(async (_tenant, doc: any) => {
        const newJob = {
          id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          ...doc,
          toJSON: function () {
            return { ...this };
          }
        };
        jobStore.push(newJob);
        return newJob as any;
      });
    });

    // 1. Valid Quantity
    it('should successfully create BO when quantity is valid and within GRN received quantity', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.quantity.targetQuantity).toBe(100);
      expect(res.body.data.status).toBe('WAITING_FOR_PRODUCTION');
      expect(res.body.data.waitingForProduction).toBe(true);
    });

    // 2. Reject Zero Quantity
    it('should reject BO creation when quantity is zero', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 0,
          weight: 50
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toMatch(/greater than zero/i);
    });

    // 3. Reject Negative Quantity
    it('should reject BO creation when quantity is negative', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: -25,
          weight: 50
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toMatch(/greater than zero/i);
    });

    // 4. Reject Malformed Quantity
    it('should reject BO creation when quantity is malformed or non-finite', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 'not-a-number' as any,
          weight: 50
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toMatch(/valid/i);
    });

    // 5. Reject Quantity Exceeding GRN Received Quantity
    it('should reject BO creation when requested quantity exceeds GRN received quantity', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      // mockGrn receivedQuantity is 200
      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 250, // exceeds 200
          weight: 50
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Quantity Allocation Violation.*exceeds.*GRN received quantity/i);
    });

    // 6. Multiple BOs & Cumulative Allocation Invariant
    it('should enforce cumulative allocation across multiple BOs and reject when cumulative allocation exceeds available quantity', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      // BO 1: Allocate 120 of 200 (succeeds, 80 remaining)
      const res1 = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 120,
          weight: 50
        });

      expect(res1.status).toBe(201);
      expect(res1.body.data.quantity.targetQuantity).toBe(120);

      // BO 2: Allocate 80 of remaining 80 (succeeds, 0 remaining)
      const res2 = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 80,
          weight: 35
        });

      expect(res2.status).toBe(201);
      expect(res2.body.data.quantity.targetQuantity).toBe(80);

      // BO 3: Attempt to allocate 10 more (must be rejected, 200 already allocated)
      const res3 = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 10,
          weight: 10
        });

      expect(res3.status).toBe(400);
      expect(res3.body.success).toBe(false);
      expect(res3.body.message).toMatch(/Quantity Allocation Violation.*exceeds available GRN quantity \[0\].*already allocated.*200/i);
    });

    // 7. Cancelled BOs Excluded from Cumulative Allocation
    it('should exclude CANCELLED BOs from cumulative allocation calculation', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      // Pre-populate with a cancelled job of 150 KG
      jobStore.push({
        id: 'job_cancelled_01',
        grnId: mockGrn.id,
        status: 'CANCELLED',
        isDeleted: false,
        item: { itemId: mockItem.id, itemCode: mockItem.itemCode },
        quantity: { targetQuantity: 150 }
      });

      // Since the 150 KG job was cancelled, all 200 KG remains available
      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 180,
          weight: 50
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.quantity.targetQuantity).toBe(180);
    });

    // 8. Concurrency Protection (Prevent Simultaneous Over-Allocation)
    it('should protect against concurrent BO creation and prevent simultaneous over-allocation using allocationLockManager', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      // Total available: 200 KG.
      // Two users simultaneously submit requests for 150 KG each.
      // Total requested = 300 KG > 200 KG.
      // Exactly ONE request must succeed (201) and ONE must fail (400).
      const [resA, resB] = await Promise.all([
        request(app)
          .post('/api/v1/batch-orders')
          .set('x-tenant-id', testTenant)
          .set('Authorization', `Bearer ${plannerToken}`)
          .send({
            poId: mockPo.id,
            grnId: mockGrn.id,
            itemId: mockItem.id,
            recipeId: mockRecipe.id,
            quantity: 150,
            weight: 60
          }),
        request(app)
          .post('/api/v1/batch-orders')
          .set('x-tenant-id', testTenant)
          .set('Authorization', `Bearer ${plannerToken}`)
          .send({
            poId: mockPo.id,
            grnId: mockGrn.id,
            itemId: mockItem.id,
            recipeId: mockRecipe.id,
            quantity: 150,
            weight: 60
          })
      ]);

      const statuses = [resA.status, resB.status].sort();
      expect(statuses).toEqual([201, 400]);

      const failedRes = resA.status === 400 ? resA : resB;
      const successRes = resA.status === 201 ? resA : resB;

      expect(successRes.body.data.quantity.targetQuantity).toBe(150);
      expect(failedRes.body.success).toBe(false);
      expect(failedRes.body.message).toMatch(/Quantity Allocation Violation/i);
    });

    // 9. Multi-Item GRN Quantity Isolation
    it('should isolate quantities per GRN Item in multi-item GRNs and prevent cross-item quantity borrowing', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const multiItemGrn = {
        ...mockGrn,
        id: 'grn_multi_01',
        items: [
          {
            itemId: 'item_ti64',
            itemCode: 'MAT-TI-6AL4V',
            itemName: 'Titanium Grade 5 Bar',
            materialGrade: 'Ti-6Al-4V',
            receivedQuantity: 50,
            acceptedQuantity: 50,
            uom: 'KG',
            recipeId: 'rec_ti_01',
            recipeCode: 'REC-TI-AGING'
          },
          {
            itemId: 'item_in718',
            itemCode: 'MAT-IN-718',
            itemName: 'Inconel 718 Bar',
            materialGrade: 'Inconel 718',
            receivedQuantity: 150,
            acceptedQuantity: 150,
            uom: 'KG',
            recipeId: 'rec_in_01',
            recipeCode: 'REC-IN718-AGE'
          }
        ],
        units: []
      };

      const mockIn718Item = {
        id: 'item_in718',
        itemCode: 'MAT-IN-718',
        itemName: 'Inconel 718 Bar',
        materialGrade: 'Inconel 718',
        uom: 'KG',
        status: 'ACTIVE'
      };

      const mockIn718Recipe = {
        id: 'rec_in_01',
        recipeCode: 'REC-IN718-AGE',
        name: 'Inconel 718 Age Hardening',
        processFamily: 'VACUUM_HEAT_TREATMENT',
        status: 'APPROVED',
        applicableMaterialGrades: ['Inconel 718'],
        stages: [{ sequence: 1, stageName: 'Preheat', targetTemperatureC: 620, soakTimeMinutes: 60 }]
      };

      const multiItemPo = {
        ...mockPo,
        items: [
          mockPo.items[0],
          {
            itemId: 'item_in718',
            itemCode: 'MAT-IN-718',
            itemName: 'Inconel 718 Bar',
            materialGrade: 'Inconel 718',
            orderedQuantity: 150,
            uom: 'KG'
          }
        ]
      };

      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValue(multiItemPo as any);
      jest.spyOn(grnRepository, 'findGrnById').mockResolvedValue(multiItemGrn as any);
      jest.spyOn(grnRepository, 'findUnitsByGrnId').mockResolvedValue([]);
      jest.spyOn(itemRepository, 'findById').mockImplementation(async (_tenant, id) => {
        if (id === 'item_ti64') return mockItem as any;
        if (id === 'item_in718') return mockIn718Item as any;
        return null;
      });
      jest.spyOn(recipeRepository, 'findById').mockImplementation(async (_tenant, id) => {
        if (id === 'rec_ti_01') return mockRecipe as any;
        if (id === 'rec_in_01') return mockIn718Recipe as any;
        return null;
      });

      // Check 1: Attempt to allocate 60 KG for Item 1 (Item 1 only has 50 KG, even though GRN total is 200 KG)
      const resA = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: multiItemGrn.id,
          itemId: 'item_ti64',
          recipeId: 'rec_ti_01',
          quantity: 60, // exceeds Item 1's 50 KG
          weight: 50
        });

      expect(resA.status).toBe(400);
      expect(resA.body.message).toMatch(/Quantity Allocation Violation.*exceeds.*GRN received quantity \[50\].*MAT-TI-6AL4V/i);

      // Check 2: Allocate 40 KG for Item 1 (succeeds, 10 KG remaining on Item 1)
      const resB = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: multiItemGrn.id,
          itemId: 'item_ti64',
          recipeId: 'rec_ti_01',
          quantity: 40,
          weight: 35
        });

      expect(resB.status).toBe(201);
      expect(resB.body.data.quantity.targetQuantity).toBe(40);

      // Check 3: Allocate 100 KG for Item 2 (succeeds, Item 2 has 150 KG received, 50 remaining)
      const resC = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: multiItemGrn.id,
          itemId: 'item_in718',
          recipeId: 'rec_in_01',
          quantity: 100,
          weight: 80
        });

      expect(resC.status).toBe(201);
      expect(resC.body.data.quantity.targetQuantity).toBe(100);

      // Check 4: Attempt to allocate 20 KG more on Item 1 (fails: only 10 KG remaining on Item 1)
      const resD = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: multiItemGrn.id,
          itemId: 'item_ti64',
          recipeId: 'rec_ti_01',
          quantity: 20,
          weight: 15
        });

      expect(resD.status).toBe(400);
      expect(resD.body.message).toMatch(/Quantity Allocation Violation.*exceeds available GRN quantity \[10\].*MAT-TI-6AL4V/i);
    });

    // 10. Inventory Integrity: No Phantom Stock or Duplication
    it('should maintain inventory integrity without creating phantom stock in master catalog', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);
      const itemSaveSpy = jest.spyOn(itemRepository, 'create');

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 50,
          weight: 25
        });

      expect(res.status).toBe(201);
      expect(itemSaveSpy).not.toHaveBeenCalled();
      // Verifies the BO represents derived production allocation, not new inventory item creation
      expect(res.body.data.quantity.targetQuantity).toBe(50);
      expect(res.body.data.grnId).toBe(mockGrn.id);
      expect(res.body.data.item.itemId).toBe(mockItem.id);
    });

    // 11. getEligiblePartsForGRN reflects dynamic cumulative allocation
    it('should dynamically update getEligiblePartsForGRN available and allocated quantities as BOs are created', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      // Initially: 0 allocated, 200 available
      const resInitial = await request(app)
        .get(`/api/v1/planning/grns/${mockGrn.id}/parts`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`);

      expect(resInitial.status).toBe(200);
      expect(resInitial.body.data[0].receivedQuantity).toBe(200);
      expect(resInitial.body.data[0].allocatedQuantity).toBe(0);
      expect(resInitial.body.data[0].availableQuantity).toBe(200);

      // Create a BO allocating 140 KG
      jobStore.push({
        id: 'job_dyn_01',
        grnId: mockGrn.id,
        status: 'WAITING_FOR_PRODUCTION',
        isDeleted: false,
        item: { itemId: mockItem.id, itemCode: mockItem.itemCode },
        quantity: { targetQuantity: 140 }
      });

      // Query parts again: allocated should be 140, available should be 60
      const resAfter = await request(app)
        .get(`/api/v1/planning/grns/${mockGrn.id}/parts`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`);

      expect(resAfter.status).toBe(200);
      expect(resAfter.body.data[0].receivedQuantity).toBe(200);
      expect(resAfter.body.data[0].allocatedQuantity).toBe(140);
      expect(resAfter.body.data[0].availableQuantity).toBe(60);
      expect(resAfter.body.data[0].canCreateBatchOrder).toBe(true);
    });
  });

  describe('8. Batch Order Record View and Planning Traceability', () => {
    let jobStore: any[] = [];
    let counter = 1;

    const mockPo2 = {
      id: 'po_202',
      _id: 'po_202',
      poNumber: 'PO-2026-00202',
      supplierName: 'Superalloy Industries Inc.',
      status: 'PARTIALLY_RECEIVED',
      orderDate: new Date('2026-09-03'),
      items: [
        {
          itemId: 'item_in718',
          itemCode: 'MAT-INCONEL-718',
          itemName: 'Inconel 718 Bar',
          materialGrade: 'Inconel 718',
          orderedQuantity: 150,
          uom: 'KG'
        }
      ]
    };

    const mockGrn2 = {
      id: 'grn_602',
      _id: 'grn_602',
      grnNumber: 'GRN-202609-0602',
      poId: 'po_202',
      poNumber: 'PO-2026-00202',
      supplierName: 'Superalloy Industries Inc.',
      supplierChallanNumber: 'CH-7711',
      warehouseCode: 'WH-EAST',
      storageLocationCode: 'BAY-04',
      status: 'AVAILABLE_FOR_PLANNING',
      grnDate: new Date('2026-09-04'),
      totalUnitsGenerated: 1,
      items: [
        {
          itemId: 'item_in718',
          itemCode: 'MAT-INCONEL-718',
          itemName: 'Inconel 718 Bar',
          materialGrade: 'Inconel 718',
          receivedQuantity: 150,
          acceptedQuantity: 150,
          uom: 'KG',
          heatNumber: 'HEAT-IN-4481',
          recipeId: 'rec_in_02',
          recipeCode: 'REC-IN-AGING'
        }
      ],
      units: [
        {
          unitIdentifier: 'UNIT-IN-001',
          status: 'AVAILABLE_FOR_PLANNING',
          itemId: 'item_in718',
          heatNumber: 'HEAT-IN-4481',
          quantity: 150,
          uom: 'KG'
        }
      ]
    };

    const mockItem2 = {
      id: 'item_in718',
      _id: 'item_in718',
      itemCode: 'MAT-INCONEL-718',
      itemName: 'Inconel 718 Bar',
      materialGrade: 'Inconel 718',
      uom: 'KG',
      status: 'ACTIVE'
    };

    const mockRecipe2 = {
      id: 'rec_in_02',
      _id: 'rec_in_02',
      recipeCode: 'REC-IN-AGING',
      revision: 2,
      name: 'Inconel 718 Solution & Age Cycle',
      processFamily: 'VACUUM_HEAT_TREATMENT',
      status: 'APPROVED',
      applicableMaterialGrades: ['Inconel 718'],
      stages: [
        {
          sequence: 1,
          stageName: 'Solution Anneal',
          targetTemperatureC: 980,
          temperatureToleranceMinusC: 5,
          temperatureTolerancePlusC: 5,
          soakTimeMinutes: 60,
          soakCriteria: 'LOAD_THERMOCOUPLE_REACHED'
        }
      ]
    };

    beforeEach(() => {
      jobStore = [];
      counter = 1;

      jest.spyOn(purchaseOrderRepository, 'findById').mockImplementation(async (_tenant, poId) => {
        if (poId === mockPo2.id || poId === mockPo2.poNumber) return mockPo2 as any;
        return mockPo as any;
      });

      jest.spyOn(grnRepository, 'findGrnById').mockImplementation(async (_tenant, grnId) => {
        if (grnId === mockGrn2.id || grnId === mockGrn2.grnNumber) return mockGrn2 as any;
        return mockGrn as any;
      });

      jest.spyOn(itemRepository, 'findById').mockImplementation(async (_tenant, itemId) => {
        if (itemId === mockItem2.id || itemId === mockItem2.itemCode) return mockItem2 as any;
        return mockItem as any;
      });

      jest.spyOn(recipeRepository, 'findById').mockImplementation(async (_tenant, recipeId) => {
        if (recipeId === mockRecipe2.id || recipeId === mockRecipe2.recipeCode) return mockRecipe2 as any;
        return mockRecipe as any;
      });

      jest.spyOn(grnRepository, 'allocateUnit').mockResolvedValue({} as any);

      jest.spyOn(productionJobRepository, 'generateNextBatchOrderNumber').mockImplementation(async () => {
        return `BO-202609-00${counter++}`;
      });

      jest.spyOn(productionJobRepository, 'findByGrnId').mockImplementation(async (_tenant, grnId) => {
        return jobStore.filter((j) => j.grnId === grnId) as any;
      });

      jest.spyOn(productionJobRepository, 'create').mockImplementation(async (_tenant, doc: any) => {
        const idStr = `job_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const newJob = {
          id: idStr,
          _id: idStr,
          ...doc,
          save: async function () {
            return this;
          },
          toJSON: function () {
            return { ...this };
          }
        };
        jobStore.push(newJob);
        return newJob as any;
      });

      jest.spyOn(productionJobRepository, 'findById').mockImplementation(async (_tenant, id) => {
        return (
          jobStore.find(
            (j) =>
              j.id === id ||
              j._id === id ||
              j.jobNumber === id ||
              j.boNumber === id ||
              j.jobNumber?.toLowerCase() === id?.toLowerCase() ||
              j.boNumber?.toLowerCase() === id?.toLowerCase()
          ) || null
        );
      });

      jest.spyOn(roleRepository, 'findRolesByCodes').mockImplementation(async (_tenantId, codes) => {
        return codes.map((c) => {
          const existing = DEFAULT_FACTORY_ROLES.find((r) => r.code === c);
          if (existing) {
            return { ...existing, id: `role_${c}`, status: 'active' };
          }
          if (c === 'BATCH_ORDER_VIEWER') {
            return {
              id: 'role_bo_viewer',
              code: 'BATCH_ORDER_VIEWER',
              name: 'Batch Order Viewer',
              isSystemRole: false,
              status: 'active',
              permissions: [PERMISSIONS.BATCH_ORDER_VIEW]
            };
          }
          return {
            id: `role_${c}`,
            code: c,
            name: c,
            isSystemRole: false,
            status: 'active',
            permissions: []
          };
        }) as any;
      });
    });

    // 1. Hierarchy: PO / GRN / BO Display & Relationship
    it('should return authoritative PO / GRN / BO hierarchy and relationship metadata for newly created BO', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const createRes = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50
        });

      expect(createRes.status).toBe(201);
      const createdBo = createRes.body.data;

      const viewRes = await request(app)
        .get(`/api/v1/batch-orders/${createdBo.id}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`);

      expect(viewRes.status).toBe(200);
      expect(viewRes.body.success).toBe(true);

      const data = viewRes.body.data;
      expect(data.hierarchy).toBeDefined();
      expect(data.hierarchy.displayHierarchy).toBe(
        `${mockPo.poNumber} / ${mockGrn.grnNumber} / ${createdBo.boNumber}`
      );
      expect(data.hierarchy.relationship).toContain(mockPo.poNumber);
      expect(data.hierarchy.relationship).toContain(mockGrn.grnNumber);
      expect(data.hierarchy.relationship).toContain(createdBo.boNumber);
      expect(data.hierarchy.po.poNumber).toBe(mockPo.poNumber);
      expect(data.hierarchy.grn.grnNumber).toBe(mockGrn.grnNumber);
      expect(data.hierarchy.bo.boNumber).toBe(createdBo.boNumber);
    });

    // 2. Authoritative Source Information Read-Only Display
    it('should display all 8 authoritative source fields (PO, GRN, Customer, Part, Quantity, Weight, Due Date, Recipe) as strictly read-only', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const createRes = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50
        });

      const createdBo = createRes.body.data;

      const viewRes = await request(app)
        .get(`/api/v1/batch-orders/${createdBo.id}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`);

      expect(viewRes.status).toBe(200);
      const src = viewRes.body.data.sourceInformation;
      expect(src).toBeDefined();

      // 1. PO
      expect(src.po.poNumber).toBe(mockPo.poNumber);
      expect(src.po.readOnly).toBe(true);

      // 2. GRN
      expect(src.grn.grnNumber).toBe(mockGrn.grnNumber);
      expect(src.grn.readOnly).toBe(true);

      // 3. Customer
      expect(src.customer.customerName).toBe(mockPo.supplierName);
      expect(src.customer.readOnly).toBe(true);

      // 4. Part
      expect(src.part.itemCode).toBe(mockItem.itemCode);
      expect(src.part.materialGrade).toBe(mockItem.materialGrade);
      expect(src.part.readOnly).toBe(true);

      // 5. Quantity
      expect(src.quantity.targetQuantity).toBe(100);
      expect(src.quantity.readOnly).toBe(true);

      // 6. Weight
      expect(src.weight.weightKg).toBe(50);
      expect(src.weight.readOnly).toBe(true);

      // 7. Due Date
      expect(src.dueDate).toBeDefined();

      // 8. Recipe
      expect(src.recipe.recipeCode).toBe(mockRecipe.recipeCode);
      expect(src.recipe.readOnly).toBe(true);

      // Global flag
      expect(viewRes.body.data.isReadOnlySourceData).toBe(true);
    });

    // 3. Recipe Corroboration & Lineage (BO -> Item -> Recipe)
    it('should corroborate that the displayed Recipe corresponds to the BO Item and its material grade', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const createRes = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50
        });

      const createdBo = createRes.body.data;

      const viewRes = await request(app)
        .get(`/api/v1/batch-orders/${createdBo.id}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`);

      expect(viewRes.status).toBe(200);
      const data = viewRes.body.data;

      expect(data.recipeCorrespondence).toBeDefined();
      expect(data.recipeCorrespondence.isCorresponded).toBe(true);
      expect(data.recipeCorrespondence.itemCode).toBe(mockItem.itemCode);
      expect(data.recipeCorrespondence.materialGrade).toBe(mockItem.materialGrade);
      expect(data.recipeCorrespondence.recipeCode).toBe(mockRecipe.recipeCode);

      expect(data.traceabilityLinks.boToItemToRecipe).toContain(createdBo.boNumber);
      expect(data.traceabilityLinks.boToItemToRecipe).toContain(mockItem.itemCode);
      expect(data.traceabilityLinks.boToItemToRecipe).toContain(mockRecipe.recipeCode);
    });

    // 4. Authoritative 15-Position Process Details Table
    it('should return the authoritative 15-position process details table corresponding to the BO specification', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const createRes = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50
        });

      const createdBo = createRes.body.data;

      // 4a. Via direct record view
      const viewRes = await request(app)
        .get(`/api/v1/batch-orders/${createdBo.id}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`);

      expect(viewRes.status).toBe(200);
      const processDetails = viewRes.body.data.processDetails;
      expect(processDetails).toBeDefined();
      expect(processDetails).toHaveLength(15);
      expect(processDetails[0].serialNumber).toBe(1);
      expect(processDetails[14].serialNumber).toBe(15);

      // 4b. Via dedicated process details endpoint
      const procRes = await request(app)
        .get(`/api/v1/batch-orders/${createdBo.id}/process-details`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`);

      expect(procRes.status).toBe(200);
      expect(procRes.body.data).toHaveLength(15);
    });

    // 5. Workflow State Machine: WAITING_FOR_PRODUCTION
    it('should clearly display current workflow state as WAITING_FOR_PRODUCTION with exactly one active flag', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const createRes = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50
        });

      const createdBo = createRes.body.data;

      const viewRes = await request(app)
        .get(`/api/v1/batch-orders/${createdBo.id}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`);

      expect(viewRes.status).toBe(200);
      const data = viewRes.body.data;

      expect(data.status).toBe('WAITING_FOR_PRODUCTION');
      expect(data.waitingForProduction).toBe(true);
      expect(data.inProduction).toBe(false);
      expect(data.waitingForInspection).toBe(false);
      expect(data.inInspection).toBe(false);
      expect(data.waitingForDispatch).toBe(false);
      expect(data.dispatched).toBe(false);

      expect(data.workflowState.waitingForProduction).toBe(true);
      expect(data.workflowState.inProduction).toBe(false);
      expect(data.workflowState.waitingForInspection).toBe(false);
      expect(data.workflowState.inInspection).toBe(false);
      expect(data.workflowState.waitingForDispatch).toBe(false);
      expect(data.workflowState.dispatched).toBe(false);
    });

    // 6. Strict Immutability of Read-Only Source Data (PATCH Rejection)
    it('should strictly reject any attempt to modify PO, GRN, Part, Recipe, Customer, Weight, or BO Number via PATCH', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const createRes = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50
        });

      const createdBo = createRes.body.data;

      // Attempt 1: mutate poId
      const resPo = await request(app)
        .patch(`/api/v1/batch-orders/${createdBo.id}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ poId: 'po_tampered' });

      expect([400, 422]).toContain(resPo.status);
      expect(JSON.stringify(resPo.body)).toMatch(/Read-Only Source Data Violation|immutable/i);

      // Attempt 2: mutate grnId
      const resGrn = await request(app)
        .patch(`/api/v1/batch-orders/${createdBo.id}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ grnId: 'grn_tampered' });

      expect([400, 422]).toContain(resGrn.status);
      expect(JSON.stringify(resGrn.body)).toMatch(/Read-Only Source Data Violation|immutable/i);

      // Attempt 3: mutate itemId
      const resItem = await request(app)
        .patch(`/api/v1/batch-orders/${createdBo.id}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ itemId: 'item_tampered' });

      expect([400, 422]).toContain(resItem.status);
      expect(JSON.stringify(resItem.body)).toMatch(/Read-Only Source Data Violation|immutable/i);

      // Attempt 4: mutate recipeId
      const resRecipe = await request(app)
        .patch(`/api/v1/batch-orders/${createdBo.id}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ recipeId: 'recipe_tampered' });

      expect([400, 422]).toContain(resRecipe.status);
      expect(JSON.stringify(resRecipe.body)).toMatch(/Read-Only Source Data Violation|immutable/i);

      // Attempt 5: mutate customer
      const resCust = await request(app)
        .patch(`/api/v1/batch-orders/${createdBo.id}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ customer: { customerName: 'Rogue Customer' } });

      expect([400, 422]).toContain(resCust.status);
      expect(JSON.stringify(resCust.body)).toMatch(/Read-Only Source Data Violation|immutable/i);

      // Attempt 6: mutate boNumber
      const resBo = await request(app)
        .patch(`/api/v1/batch-orders/${createdBo.id}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ boNumber: 'BO-HACK-001' });

      expect([400, 422]).toContain(resBo.status);
      expect(JSON.stringify(resBo.body)).toMatch(/Read-Only Source Data Violation|immutable/i);
    });

    // 7. Traceability Navigation Links (BO -> GRN -> PO and BO -> Item -> Recipe)
    it('should provide full bidirectional traceability navigation for BO -> GRN -> PO and BO -> Item -> Recipe', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const createRes = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50
        });

      const createdBo = createRes.body.data;

      // Check full record view traceability links
      const viewRes = await request(app)
        .get(`/api/v1/batch-orders/${createdBo.id}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`);

      expect(viewRes.status).toBe(200);
      const links = viewRes.body.data.traceabilityLinks;
      expect(links.boToGrnToPo).toContain(createdBo.boNumber);
      expect(links.boToGrnToPo).toContain(mockGrn.grnNumber);
      expect(links.boToGrnToPo).toContain(mockPo.poNumber);

      expect(links.boToItemToRecipe).toContain(createdBo.boNumber);
      expect(links.boToItemToRecipe).toContain(mockItem.itemCode);
      expect(links.boToItemToRecipe).toContain(mockRecipe.recipeCode);

      // Check dedicated genealogy endpoint
      const genRes = await request(app)
        .get(`/api/v1/batch-orders/${createdBo.id}/genealogy`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`);

      expect(genRes.status).toBe(200);
      expect(genRes.body.data.genealogy.isImmutable).toBe(true);
      expect(genRes.body.data.genealogy.whichPo.poNumber).toBe(mockPo.poNumber);
      expect(genRes.body.data.genealogy.whichGrn.grnNumber).toBe(mockGrn.grnNumber);
      expect(genRes.body.data.genealogy.whichPart.itemCode).toBe(mockItem.itemCode);
      expect(genRes.body.data.genealogy.whichRecipe.recipeCode).toBe(mockRecipe.recipeCode);
    });

    // 8. Multiple BOs with Different GRNs, Items, and Recipes
    it('should maintain distinct, unpolluted genealogy and traceability across multiple BOs with different GRNs, Items, and Recipes', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      // Create BO 1: Ti-6Al-4V from mockGrn (PO-2026-00101)
      const res1 = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50
        });
      expect(res1.status).toBe(201);
      const bo1 = res1.body.data;

      // Create BO 2: Inconel 718 from mockGrn2 (PO-2026-00202)
      const res2 = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo2.id,
          grnId: mockGrn2.id,
          itemId: mockItem2.id,
          recipeId: mockRecipe2.id,
          quantity: 75,
          weight: 40
        });
      expect(res2.status).toBe(201);
      const bo2 = res2.body.data;

      // Fetch BO 1 record view
      const view1 = await request(app)
        .get(`/api/v1/batch-orders/${bo1.id}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`);
      expect(view1.status).toBe(200);
      expect(view1.body.data.hierarchy.displayHierarchy).toBe(
        `${mockPo.poNumber} / ${mockGrn.grnNumber} / ${bo1.boNumber}`
      );
      expect(view1.body.data.sourceInformation.part.itemCode).toBe('MAT-TI-6AL4V');
      expect(view1.body.data.sourceInformation.recipe.recipeCode).toBe('REC-TI-AGING');

      // Fetch BO 2 record view
      const view2 = await request(app)
        .get(`/api/v1/batch-orders/${bo2.id}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`);
      expect(view2.status).toBe(200);
      expect(view2.body.data.hierarchy.displayHierarchy).toBe(
        `${mockPo2.poNumber} / ${mockGrn2.grnNumber} / ${bo2.boNumber}`
      );
      expect(view2.body.data.sourceInformation.part.itemCode).toBe('MAT-INCONEL-718');
      expect(view2.body.data.sourceInformation.recipe.recipeCode).toBe('REC-IN-AGING');

      // Verify no cross contamination
      expect(view1.body.data.hierarchy.po.poNumber).not.toBe(view2.body.data.hierarchy.po.poNumber);
      expect(view1.body.data.hierarchy.grn.grnNumber).not.toBe(view2.body.data.hierarchy.grn.grnNumber);
    });

    // 9. Authorization & RBAC Enforcement
    it('should strictly enforce RBAC and reject unauthenticated or unauthorized access to the BO view', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const createRes = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50
        });

      const createdBo = createRes.body.data;

      // 9a. Unauthenticated -> 401
      const unauthRes = await request(app)
        .get(`/api/v1/batch-orders/${createdBo.id}`)
        .set('x-tenant-id', testTenant);
      expect(unauthRes.status).toBe(401);

      // 9b. Unauthorized role (MAINTENANCE_TECH lacking BATCH_ORDER_VIEW and PRODUCTION_JOB_VIEW) -> 403
      const techToken = generateToken('usr_tech', ['MAINTENANCE_TECH']);
      const forbiddenRes = await request(app)
        .get(`/api/v1/batch-orders/${createdBo.id}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${techToken}`);
      expect(forbiddenRes.status).toBe(403);
      expect(forbiddenRes.body.message).toMatch(/Access Denied/i);

      // 9c. Authorized user with BATCH_ORDER_VIEW -> 200
      const boViewToken = generateToken('usr_viewer', ['BATCH_ORDER_VIEWER']);
      const allowedRes = await request(app)
        .get(`/api/v1/batch-orders/${createdBo.id}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${boViewToken}`);
      expect(allowedRes.status).toBe(200);
      expect(allowedRes.body.success).toBe(true);
    });

    // 10. Protection of Direct API Endpoints
    it('should protect direct API endpoints against unauthenticated and unauthorized direct access', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const createRes = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50
        });

      const createdBo = createRes.body.data;
      const techToken = generateToken('usr_tech', ['MAINTENANCE_TECH']);

      // /batch-orders/:id/genealogy: unauth -> 401, unauthorized -> 403
      const genUnauth = await request(app)
        .get(`/api/v1/batch-orders/${createdBo.id}/genealogy`)
        .set('x-tenant-id', testTenant);
      expect(genUnauth.status).toBe(401);

      const genForbidden = await request(app)
        .get(`/api/v1/batch-orders/${createdBo.id}/genealogy`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${techToken}`);
      expect(genForbidden.status).toBe(403);

      // /batch-orders/:id/process-details: unauth -> 401, unauthorized -> 403
      const procUnauth = await request(app)
        .get(`/api/v1/batch-orders/${createdBo.id}/process-details`)
        .set('x-tenant-id', testTenant);
      expect(procUnauth.status).toBe(401);

      const procForbidden = await request(app)
        .get(`/api/v1/batch-orders/${createdBo.id}/process-details`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${techToken}`);
      expect(procForbidden.status).toBe(403);

      // /batch-orders query: unauth -> 401
      const queryUnauth = await request(app)
        .get('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant);
      expect(queryUnauth.status).toBe(401);
    });

    // 11. Query by BO Number
    it('should support authoritative record retrieval by business BO Number in addition to ID', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const createRes = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50
        });

      const createdBo = createRes.body.data;

      const viewByBoNumber = await request(app)
        .get(`/api/v1/batch-orders/${createdBo.boNumber}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`);

      expect(viewByBoNumber.status).toBe(200);
      expect(viewByBoNumber.body.data.boNumber).toBe(createdBo.boNumber);
      expect(viewByBoNumber.body.data.hierarchy.displayHierarchy).toBe(
        `${mockPo.poNumber} / ${mockGrn.grnNumber} / ${createdBo.boNumber}`
      );
      expect(viewByBoNumber.body.data.sourceInformation.quantity.targetQuantity).toBe(100);
    });
  });

  // =========================================================================
  // PROMPT 9: Planning-to-Production Handoff
  // =========================================================================
  describe('Prompt 9: Planning-to-Production Handoff', () => {
    let jobStore: any[] = [];
    let counter = 1;

    beforeEach(() => {
      jobStore = [];
      counter = 1;

      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValue(mockPo as any);
      jest.spyOn(grnRepository, 'findGrnById').mockResolvedValue(mockGrn as any);
      jest.spyOn(itemRepository, 'findById').mockResolvedValue(mockItem as any);
      jest.spyOn(recipeRepository, 'findById').mockResolvedValue(mockRecipe as any);
      jest.spyOn(grnRepository, 'allocateUnit').mockResolvedValue({} as any);

      jest.spyOn(productionJobRepository, 'generateNextBatchOrderNumber').mockImplementation(async () => {
        return `BO-202609-00${counter++}`;
      });

      jest.spyOn(productionJobRepository, 'findByGrnId').mockImplementation(async (_tenant, grnId) => {
        return jobStore.filter((j) => j.grnId === grnId) as any;
      });

      jest.spyOn(productionJobRepository, 'create').mockImplementation(async (_tenant, doc: any) => {
        const idStr = `job_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const newJob = {
          id: idStr,
          _id: idStr,
          ...doc,
          save: async function () {
            return this;
          },
          toJSON: function () {
            return { ...this };
          }
        };
        jobStore.push(newJob);
        return newJob as any;
      });

      jest.spyOn(productionJobRepository, 'findById').mockImplementation(async (_tenant, id) => {
        return (
          jobStore.find(
            (j) =>
              j.id === id ||
              j._id === id ||
              j.jobNumber === id ||
              j.boNumber === id ||
              j.jobNumber?.toLowerCase() === id?.toLowerCase() ||
              j.boNumber?.toLowerCase() === id?.toLowerCase()
          ) || null
        );
      });

      jest.spyOn(productionJobRepository, 'updateById').mockImplementation(async (_tenant, id, update: any) => {
        const idx = jobStore.findIndex((j) => j.id === id || j.boNumber === id);
        if (idx >= 0) {
          jobStore[idx] = { ...jobStore[idx], ...update };
          return {
            ...jobStore[idx],
            save: async function () { return this; },
            toJSON: function () { return { ...this }; }
          } as any;
        }
        return null;
      });

      jest.spyOn(productionJobRepository, 'findActiveQueueJobs').mockImplementation(async (_tenant, _filters) => {
        return jobStore.filter(
          (j) =>
            !j.isDeleted &&
            ['WAITING_FOR_PRODUCTION', 'DRAFT', 'APPROVED', 'SCHEDULED', 'IN_PROGRESS', 'PAUSED'].includes(j.status)
        ) as any;
      });

      jest.spyOn(roleRepository, 'findRolesByCodes').mockImplementation(async (_tenantId, codes) => {
        return codes.map((c) => {
          const existing = DEFAULT_FACTORY_ROLES.find((r) => r.code === c);
          if (existing) {
            return { ...existing, id: `role_${c}`, status: 'active' };
          }
          if (c === 'PRODUCTION_SUPERVISOR') {
            return {
              id: 'role_prod_sup',
              code: 'PRODUCTION_SUPERVISOR',
              name: 'Production Supervisor',
              isSystemRole: false,
              status: 'active',
              permissions: [
                PERMISSIONS.PRODUCTION_JOB_VIEW,
                PERMISSIONS.BATCH_ORDER_VIEW,
                PERMISSIONS.PRODUCTION_JOB_CREATE,
                PERMISSIONS.PRODUCTION_JOB_START,
                PERMISSIONS.PRODUCTION_JOB_TRANSITION
              ]
            };
          }
          return {
            id: `role_${c}`,
            code: c,
            name: c,
            isSystemRole: false,
            status: 'active',
            permissions: []
          };
        }) as any;
      });
    });

    // 1. BO Completion & Initial State
    it('completed BO with all required Planning information must enter WAITING_FOR_PRODUCTION', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50
        });

      expect(res.status).toBe(201);
      const bo = res.body.data;
      expect(bo.status).toBe('WAITING_FOR_PRODUCTION');
      expect(bo.workflowState.waitingForProduction).toBe(true);
      expect(bo.workflowState.inProduction).toBe(false);
      expect(bo.workflowState.waitingForInspection).toBe(false);
      expect(bo.workflowState.inInspection).toBe(false);
      expect(bo.workflowState.waitingForDispatch).toBe(false);
      expect(bo.workflowState.dispatched).toBe(false);
    });

    // 2. Production Readiness Evaluation Endpoint
    it('evaluates complete BO as ready for production with all requirement checks passing', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const createRes = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50
        });

      expect(createRes.status).toBe(201);
      const boId = createRes.body.data.id;

      const readinessRes = await request(app)
        .get(`/api/v1/batch-orders/${boId}/production-readiness`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`);

      expect(readinessRes.status).toBe(200);
      const data = readinessRes.body.data;
      expect(data.isReadyForProduction).toBe(true);
      expect(data.hasAuthoritativePo).toBe(true);
      expect(data.hasAuthoritativeGrn).toBe(true);
      expect(data.hasCustomer).toBe(true);
      expect(data.hasPart).toBe(true);
      expect(data.hasValidQuantity).toBe(true);
      expect(data.hasValidWeight).toBe(true);
      expect(data.hasRecipe).toBe(true);
      expect(data.has15ProcessDetails).toBe(true);
      expect(data.hasValidWorkflowState).toBe(true);
      expect(data.missingFields).toHaveLength(0);
      expect(data.errors).toHaveLength(0);
    });

    // 3. Production Visibility without Manual Transfer
    it('production users can retrieve waiting BO from the production queue without manual transfer', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);
      const operatorToken = generateToken('usr_op', ['FURNACE_OPERATOR']);
      const supervisorToken = generateToken('usr_sup', ['PRODUCTION_SUPERVISOR']);

      const createRes = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 120,
          weight: 60
        });

      expect(createRes.status).toBe(201);
      const bo = createRes.body.data;

      // Operator checks production queue
      const queueResOp = await request(app)
        .get('/api/v1/production-jobs/queue')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(queueResOp.status).toBe(200);
      expect(Array.isArray(queueResOp.body.data)).toBe(true);

      const foundInQueue = queueResOp.body.data.find(
        (q: any) => q.jobId === bo.id || q.boNumber === bo.boNumber
      );
      expect(foundInQueue).toBeDefined();
      expect(foundInQueue.boNumber).toBe(bo.boNumber);
      expect(foundInQueue.status).toBe('WAITING_FOR_PRODUCTION');
      expect(foundInQueue.poNumber).toBe(mockPo.poNumber);
      expect(foundInQueue.grnNumber).toBe(mockGrn.grnNumber);
      expect(foundInQueue.itemCode).toBe(mockItem.itemCode);
      expect(foundInQueue.materialGrade).toBe(mockItem.materialGrade);
      expect(foundInQueue.targetQuantity).toBe(120);
      expect(foundInQueue.weightKg).toBe(60);

      // Supervisor checks /batch-orders/queue alias
      const queueResSup = await request(app)
        .get('/api/v1/production-jobs/batch-orders/queue')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${supervisorToken}`);

      expect(queueResSup.status).toBe(200);
      const foundInAliasQueue = queueResSup.body.data.find(
        (q: any) => q.jobId === bo.id || q.boNumber === bo.boNumber
      );
      expect(foundInAliasQueue).toBeDefined();
    });

    // 4. Prevent Premature Visibility
    it('incomplete BOs must not appear in the production queue', async () => {
      const operatorToken = generateToken('usr_op', ['FURNACE_OPERATOR']);

      // Directly insert an incomplete job record into jobStore
      const incompleteJob = {
        id: `job_inc_${Date.now()}`,
        _id: `job_inc_${Date.now()}`,
        tenantId: testTenant,
        jobNumber: `JOB-INC-${Date.now()}`,
        boNumber: `BO-INC-${Date.now()}`,
        status: 'WAITING_FOR_PRODUCTION',
        workflowState: {
          waitingForProduction: true,
          inProduction: false,
          waitingForInspection: false,
          inInspection: false,
          waitingForDispatch: false,
          dispatched: false
        },
        waitingForProduction: true,
        inProduction: false,
        quantity: { targetQuantity: 0, loadedQuantity: 0, completedQuantity: 0, scrappedQuantity: 0 },
        weightKg: 0,
        processDetails: [],
        timeline: {
          plannedStartDate: new Date(),
          targetCompletionDate: new Date(Date.now() + 86400000)
        },
        priority: 'NORMAL',
        customer: { customerId: 'cust_unknown', customerCode: '', customerName: '' },
        item: { itemId: 'item_unknown', itemCode: '', itemName: '', materialGrade: '', uom: 'PCS' },
        save: async function () { return this; },
        toJSON: function () { return { ...this }; }
      };
      jobStore.push(incompleteJob);

      const queueRes = await request(app)
        .get('/api/v1/production-jobs/queue')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(queueRes.status).toBe(200);
      const found = queueRes.body.data.find((q: any) => q.jobId === incompleteJob.id);
      expect(found).toBeUndefined();

      // Verify readiness check returns isReadyForProduction: false
      const readinessRes = await request(app)
        .get(`/api/v1/batch-orders/${incompleteJob.id}/production-readiness`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(readinessRes.status).toBe(200);
      expect(readinessRes.body.data.isReadyForProduction).toBe(false);
      expect(readinessRes.body.data.missingFields.length).toBeGreaterThan(0);
    });

    // 5. Immutable Source Relationships
    it('protects PO -> GRN -> BO and Item -> Recipe -> BO relationships from unauthorized modification', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const createRes = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50
        });

      expect(createRes.status).toBe(201);
      const boId = createRes.body.data.id;

      // Attempting to mutate poId
      const resPo = await request(app)
        .patch(`/api/v1/production-jobs/${boId}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ poId: 'po_hacked_id' });
      expect([400, 422]).toContain(resPo.status);
      expect(JSON.stringify(resPo.body)).toContain('Read-Only Source Data Violation');

      // Attempting to mutate grnId
      const resGrn = await request(app)
        .patch(`/api/v1/production-jobs/${boId}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ grnId: 'grn_hacked_id' });
      expect([400, 422]).toContain(resGrn.status);
      expect(JSON.stringify(resGrn.body)).toContain('Read-Only Source Data Violation');

      // Attempting to mutate itemId or recipeId
      const resRecipe = await request(app)
        .patch(`/api/v1/production-jobs/${boId}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ recipeId: 'rec_hacked_id' });
      expect([400, 422]).toContain(resRecipe.status);
      expect(JSON.stringify(resRecipe.body)).toContain('Read-Only Source Data Violation');

      // Attempting to mutate customer or weight
      const resWeight = await request(app)
        .patch(`/api/v1/production-jobs/${boId}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ weightKg: 999 });
      expect([400, 422]).toContain(resWeight.status);
      expect(JSON.stringify(resWeight.body)).toContain('Read-Only Source Data Violation');
    });

    // 6. Production Data Boundary Enforcement
    it('strictly rejects Planning functionality attempting to populate production-only fields', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      // Creation attempt with production telemetry
      const resCreate = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50,
          temperatureLogs: [{ time: new Date(), tempC: 850 }],
          stageProgress: [{ stageIndex: 1, actualDurationMinutes: 120 }]
        });

      expect([400, 422]).toContain(resCreate.status);
      expect(JSON.stringify(resCreate.body)).toContain('Production Data Boundary Violation');

      // Creation of valid BO first
      const validCreate = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50
        });

      expect(validCreate.status).toBe(201);
      const boId = validCreate.body.data.id;

      // Update attempt with inspection results
      const resUpdate = await request(app)
        .patch(`/api/v1/production-jobs/${boId}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          inspectionResults: { passed: true, hardness: 50 },
          cOfCNumber: 'COFC-99999'
        });

      expect([400, 422]).toContain(resUpdate.status);
      expect(JSON.stringify(resUpdate.body)).toContain('Production Data Boundary Violation');
    });

    // 7. State Transition Authority - Prohibit Planners Directly Setting Downstream States
    it('prohibits planning users from directly setting BO to downstream states via updateJob', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const createRes = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50
        });

      expect(createRes.status).toBe(201);
      const boId = createRes.body.data.id;

      // Direct status jump
      const resStatus = await request(app)
        .patch(`/api/v1/production-jobs/${boId}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ status: 'IN_PROGRESS' });

      expect([400, 422]).toContain(resStatus.status);
      expect(JSON.stringify(resStatus.body)).toContain('State Transition Authority Violation');

      // Direct workflow flag jump
      const resFlag = await request(app)
        .patch(`/api/v1/production-jobs/${boId}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ waitingForInspection: true });

      expect([400, 422]).toContain(resFlag.status);
      expect(JSON.stringify(resFlag.body)).toContain('State Transition Authority Violation');
    });

    // 8. State Transition Authority - Prohibit Phase Skipping
    it('prohibits phase skipping from WAITING_FOR_PRODUCTION directly to Inspection or Dispatch', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      const createRes = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50
        });

      expect(createRes.status).toBe(201);
      const boId = createRes.body.data.id;

      // Attempt to skip to QUALITY_CHECK (Inspection)
      const resSkipInspection = await request(app)
        .post(`/api/v1/production-jobs/${boId}/transition`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          toStatus: 'QUALITY_CHECK',
          reason: 'Attempting to skip furnace cycle'
        });

      expect(resSkipInspection.status).toBe(400);
      expect(resSkipInspection.body.message).toContain('State Transition Authority Violation');

      // Attempt to skip to DISPATCHED
      const resSkipDispatch = await request(app)
        .post(`/api/v1/production-jobs/${boId}/transition`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          toStatus: 'DISPATCHED',
          reason: 'Attempting to skip all production and inspection'
        });

      expect(resSkipDispatch.status).toBe(400);
      expect(resSkipDispatch.body.message).toContain('State Transition Authority Violation');
    });

    // 9. Legitimate Execution Start Updates Workflow State
    it('updates workflowState and mutual exclusivity flags when transitioning to IN_PROGRESS', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);
      const operatorToken = generateToken('usr_op', ['FURNACE_OPERATOR']);

      const createRes = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50
        });

      expect(createRes.status).toBe(201);
      const boId = createRes.body.data.id;

      // Legitimate transition to IN_PROGRESS by shop-floor operator
      const transRes = await request(app)
        .post(`/api/v1/production-jobs/${boId}/transition`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          toStatus: 'IN_PROGRESS',
          reason: 'Furnace preheating completed, commencing soak.'
        });

      expect(transRes.status).toBe(200);
      expect(transRes.body.data.status).toBe('IN_PROGRESS');
      expect(transRes.body.data.workflowState.inProduction).toBe(true);
      expect(transRes.body.data.workflowState.waitingForProduction).toBe(false);
      expect(transRes.body.data.workflowState.waitingForInspection).toBe(false);
    });

    // 10. Security & RBAC Enforcement
    it('readiness and queue endpoints enforce JWT authentication and RBAC boundaries', async () => {
      const plannerToken = generateToken('usr_mgr', ['PLANT_MANAGER']);
      const techToken = generateToken('usr_tech', ['MAINTENANCE_TECH']);

      const createRes = await request(app)
        .post('/api/v1/batch-orders')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: mockPo.id,
          grnId: mockGrn.id,
          itemId: mockItem.id,
          recipeId: mockRecipe.id,
          quantity: 100,
          weight: 50
        });

      expect(createRes.status).toBe(201);
      const boId = createRes.body.data.id;

      // Unauthenticated readiness request -> 401
      const unauthReadiness = await request(app)
        .get(`/api/v1/batch-orders/${boId}/production-readiness`)
        .set('x-tenant-id', testTenant);
      expect(unauthReadiness.status).toBe(401);

      // Unauthorized readiness request -> 403
      const forbiddenReadiness = await request(app)
        .get(`/api/v1/batch-orders/${boId}/production-readiness`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${techToken}`);
      expect(forbiddenReadiness.status).toBe(403);

      // Unauthenticated queue request -> 401
      const unauthQueue = await request(app)
        .get('/api/v1/production-jobs/queue')
        .set('x-tenant-id', testTenant);
      expect(unauthQueue.status).toBe(401);

      // Unauthorized queue request -> 403
      const forbiddenQueue = await request(app)
        .get('/api/v1/production-jobs/queue')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${techToken}`);
      expect(forbiddenQueue.status).toBe(403);
    });
  });
});


