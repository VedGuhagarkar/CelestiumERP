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
});

