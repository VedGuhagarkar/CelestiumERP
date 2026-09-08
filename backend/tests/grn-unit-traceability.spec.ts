import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { grnService } from '../src/modules/grn/grn.service.js';
import { grnRepository } from '../src/modules/grn/grn.repository.js';
import { purchaseOrderService } from '../src/modules/purchase-order/purchase-order.service.js';
import { itemService } from '../src/modules/item/item.service.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { PERMISSIONS, DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { NotFoundError } from '../src/core/errors/app-error.js';

describe('Prompt 7: Individual GRN Material/Part Units and Recipe Traceability Suite', () => {
  const app = createApp();
  const testTenant = 'tenant_prompt7_traceability_001';

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const mockPoLineItemA = {
    lineItemId: 'po_line_alloy_4140',
    itemId: 'item_alloy_4140',
    itemCode: 'ALLOY-4140-BAR',
    itemName: 'AISI 4140 High-Strength Bar 50mm',
    materialGrade: 'AISI 4140',
    processFamily: 'CARBURIZING',
    recipeId: 'rec_carb_4140_v2',
    recipeCode: 'REC-CARB-4140',
    recipeRevision: 2,
    orderedQuantity: 10,
    receivedQuantity: 0,
    balanceQuantity: 10,
    unitPrice: 120.0,
    lineTotal: 1200.0,
    uom: 'PCS'
  };

  const mockPoLineItemB = {
    lineItemId: 'po_line_alloy_8620',
    itemId: 'item_alloy_8620',
    itemCode: 'ALLOY-8620-PIN',
    itemName: 'AISI 8620 Pinion Shaft Blank',
    materialGrade: 'AISI 8620',
    processFamily: 'NITRIDING',
    recipeId: 'rec_nit_8620_v1',
    recipeCode: 'REC-NIT-8620',
    recipeRevision: 1,
    orderedQuantity: 5,
    receivedQuantity: 0,
    balanceQuantity: 5,
    unitPrice: 250.0,
    lineTotal: 1250.0,
    uom: 'PCS'
  };

  const mockValidPo = {
    id: 'po_prompt7_001',
    tenantId: testTenant,
    poNumber: 'PO-202609-7777',
    supplierName: 'Stellar Aerospace Metallurgy Ltd.',
    supplierCode: 'SUP-STELLAR-09',
    status: 'ISSUED',
    orderDate: new Date('2026-09-02T10:00:00.000Z'),
    expectedDeliveryDate: new Date('2026-09-25T10:00:00.000Z'),
    items: [{ ...mockPoLineItemA }, { ...mockPoLineItemB }],
    totalOrderedQuantity: 15,
    totalReceivedQuantity: 0,
    currency: 'INR',
    subtotalAmount: 2450.0,
    taxAmount: 0,
    totalAmount: 2450.0,
    isDeleted: false,
    toJSON: function () {
      return { ...this };
    }
  };

  const mockStoredReceipt = {
    id: 'rcpt_prompt7_001',
    tenantId: testTenant,
    receiptNumber: 'RCPT-202609-7701',
    poId: mockValidPo.id,
    poNumber: mockValidPo.poNumber,
    supplierName: mockValidPo.supplierName,
    supplierChallanNumber: 'DC-STELLAR-4401',
    supplierChallanDate: new Date('2026-09-06T09:30:00.000Z'),
    supplierInvoiceNumber: 'INV-ST-991',
    carrierVehicle: 'MH-12-TR-9988',
    warehouseId: 'wh_main_01',
    warehouseCode: 'WH-MAIN',
    storageLocationCode: 'BAY-A3-01',
    status: 'STORED',
    items: [
      {
        poLineItemId: mockPoLineItemA.lineItemId,
        itemId: mockPoLineItemA.itemId,
        itemCode: mockPoLineItemA.itemCode,
        itemName: mockPoLineItemA.itemName,
        materialGrade: mockPoLineItemA.materialGrade,
        processFamily: mockPoLineItemA.processFamily,
        recipeId: mockPoLineItemA.recipeId,
        recipeCode: mockPoLineItemA.recipeCode,
        recipeRevision: mockPoLineItemA.recipeRevision,
        receivedQuantity: 10,
        storedQuantity: 10,
        remainingQuantity: 0,
        uom: 'PCS',
        supplierHeatNumber: 'HEAT-4140-XYZ',
        supplierLotNumber: 'LOT-9921',
        mtrNumber: 'MTR-CERT-4140'
      },
      {
        poLineItemId: mockPoLineItemB.lineItemId,
        itemId: mockPoLineItemB.itemId,
        itemCode: mockPoLineItemB.itemCode,
        itemName: mockPoLineItemB.itemName,
        materialGrade: mockPoLineItemB.materialGrade,
        processFamily: mockPoLineItemB.processFamily,
        recipeId: mockPoLineItemB.recipeId,
        recipeCode: mockPoLineItemB.recipeCode,
        recipeRevision: mockPoLineItemB.recipeRevision,
        receivedQuantity: 5,
        storedQuantity: 5,
        remainingQuantity: 0,
        uom: 'PCS',
        supplierHeatNumber: 'HEAT-8620-ABC',
        supplierLotNumber: 'LOT-8833',
        mtrNumber: 'MTR-CERT-8620'
      }
    ],
    save: jest.fn().mockResolvedValue(true),
    toJSON: function () {
      return { ...this };
    }
  };

  // In-memory mock databases for testing
  let inMemoryUnits: any[] = [];
  let inMemoryGrn: any = null;

  beforeEach(() => {
    jest.restoreAllMocks();
    inMemoryUnits = [];
    inMemoryGrn = null;
    mockStoredReceipt.status = 'STORED';

    // RBAC Mock
    jest.spyOn(roleRepository, 'seedDefaultRolesForTenant').mockResolvedValue(undefined as any);
    jest.spyOn(roleRepository, 'findRolesByCodes').mockImplementation(async (_t, codes) => {
      return codes.map((code) => {
        const found = DEFAULT_FACTORY_ROLES.find((r) => r.code === code);
        if (found) return { code, permissions: found.permissions } as any;
        if (code === 'STORE_OFFICER' || code === 'STORES_MANAGER') {
          return {
            code,
            permissions: [
              PERMISSIONS.INVENTORY_GRN_CREATE,
              PERMISSIONS.INVENTORY_GRN_VIEW,
              PERMISSIONS.INVENTORY_GRN_PRINT,
              PERMISSIONS.INVENTORY_STORAGE_RECORD,
              PERMISSIONS.PRODUCTION_JOB_CREATE
            ]
          } as any;
        }
        if (code === 'PLANNING_ENGINEER') {
          return {
            code,
            permissions: [
              PERMISSIONS.INVENTORY_GRN_VIEW,
              PERMISSIONS.PRODUCTION_JOB_CREATE
            ]
          } as any;
        }
        return { code, permissions: [] } as any;
      });
    });

    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

    // PO Service Mock
    jest.spyOn(purchaseOrderService, 'getOrderById').mockImplementation(async (_t, id) => {
      if (id === mockValidPo.id) {
        return JSON.parse(JSON.stringify(mockValidPo)) as any;
      }
      throw new NotFoundError(`Purchase Order with ID '${id}' not found`);
    });

    jest.spyOn(purchaseOrderService, 'recordReceivedMaterial').mockResolvedValue({ ...mockValidPo } as any);

    // Item Master Mock
    jest.spyOn(itemService, 'getItemById').mockImplementation(async (_t, id) => {
      if (id === 'item_alloy_4140') {
        return {
          id: 'item_alloy_4140',
          itemCode: 'ALLOY-4140-BAR',
          name: 'AISI 4140 High-Strength Bar 50mm',
          hsnCode: '722830',
          uom: 'PCS',
          materialGrade: 'AISI 4140'
        } as any;
      }
      if (id === 'item_alloy_8620') {
        return {
          id: 'item_alloy_8620',
          itemCode: 'ALLOY-8620-PIN',
          name: 'AISI 8620 Pinion Shaft Blank',
          hsnCode: '722840',
          uom: 'PCS',
          materialGrade: 'AISI 8620'
        } as any;
      }
      throw new NotFoundError(`Item '${id}' not found`);
    });

    // Repository Mocks
    jest.spyOn(grnRepository, 'generateNextGrnNumber').mockResolvedValue('GRN-202609-0099');
    jest.spyOn(grnRepository, 'findGrnByIdempotencyKey').mockResolvedValue(null);

    jest.spyOn(grnRepository, 'queryReceipts').mockResolvedValue([mockStoredReceipt as any]);

    jest.spyOn(grnRepository, 'findReceiptById').mockImplementation(async (_t, id) => {
      if (id === mockStoredReceipt.id) {
        return { ...mockStoredReceipt, save: jest.fn().mockResolvedValue(true) } as any;
      }
      return null;
    });

    jest.spyOn(grnRepository, 'createGrn').mockImplementation(async (_t, data) => {
      const doc = {
        id: 'grn_prompt7_saved_001',
        ...data,
        createdAt: new Date(),
        save: jest.fn().mockImplementation(async function () {
          inMemoryGrn = this;
          return this;
        }),
        toJSON: function () {
          return { ...this };
        }
      };
      inMemoryGrn = doc;
      return doc as any;
    });

    jest.spyOn(grnRepository, 'createGrnUnits').mockImplementation(async (_t, units) => {
      units.forEach((u) => {
        inMemoryUnits.push({
          id: `unit_doc_${inMemoryUnits.length + 1}`,
          ...u,
          save: jest.fn().mockResolvedValue(true),
          toJSON: function () {
            return { ...this };
          }
        });
      });
      return inMemoryUnits as any;
    });

    jest.spyOn(grnRepository, 'findUnitByIdentifier').mockImplementation(async (_t, unitIdentifier) => {
      const found = inMemoryUnits.find((u) => u.unitIdentifier === unitIdentifier.toUpperCase().trim());
      return found || null;
    });

    jest.spyOn(grnRepository, 'findUnitsByGrnId').mockImplementation(async (_t, grnId) => {
      return inMemoryUnits.filter((u) => u.grnId === grnId);
    });

    jest.spyOn(grnRepository, 'findUnitsByPoId').mockImplementation(async (_t, poId) => {
      return inMemoryUnits.filter((u) => u.poId === poId);
    });

    jest.spyOn(grnRepository, 'findGrnByNumber').mockImplementation(async (_t, grnNumber) => {
      if (inMemoryGrn && inMemoryGrn.grnNumber === grnNumber) {
        return inMemoryGrn;
      }
      return null;
    });

    jest.spyOn(grnRepository, 'queryAvailableUnitsForPlanning').mockImplementation(async (_t, itemId, recipeId, materialGrade) => {
      return inMemoryUnits.filter((u) => {
        if (u.status !== 'AVAILABLE_FOR_PLANNING') return false;
        if (itemId && u.itemId !== itemId) return false;
        if (recipeId && u.recipeId !== recipeId) return false;
        if (materialGrade && u.materialGrade !== materialGrade) return false;
        return true;
      });
    });

    jest.spyOn(grnRepository, 'allocateUnit').mockImplementation(async (_t, unitId, planId, planNumber, jobId) => {
      const unit = inMemoryUnits.find((u) => u.unitIdentifier === unitId.toUpperCase().trim());
      if (!unit || unit.status !== 'AVAILABLE_FOR_PLANNING') return null;
      unit.status = 'ALLOCATED_TO_PLAN';
      unit.allocatedPlanId = planId;
      unit.allocatedPlanNumber = planNumber;
      unit.allocatedJobId = jobId;

      // Synchronize embedded units in GRN
      if (inMemoryGrn && inMemoryGrn.units) {
        const embedded = inMemoryGrn.units.find((u: any) => u.unitIdentifier === unitId);
        if (embedded) {
          embedded.status = 'ALLOCATED_TO_PLAN';
          embedded.allocatedPlanId = planId;
          embedded.allocatedPlanNumber = planNumber;
          embedded.allocatedJobId = jobId;
        }
      }
      return unit;
    });
  });

  describe('1. Individual Unit Storage & Dual-Storage Inside GRN', () => {
    it('stores each part set as individual data units directly inside grn.units AND in collection', async () => {
      const token = generateToken('store_officer_01', ['STORE_OFFICER']);

      const payload = {
        materialReceiptId: mockStoredReceipt.id,
        remarks: 'Prompt 7 individual unit test'
      };

      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const grn = res.body.data;
      expect(grn.grnNumber).toBe('GRN-202609-0099');
      expect(grn.totalUnitsGenerated).toBe(15); // 10 for item A + 5 for item B

      // Verify that units are embedded inside the GRN document itself
      expect(grn.units).toBeDefined();
      expect(Array.isArray(grn.units)).toBe(true);
      expect(grn.units.length).toBe(15);

      // Verify that all embedded units have grnId and poId populated
      for (const unit of grn.units) {
        expect(unit.grnNumber).toBe('GRN-202609-0099');
        expect(unit.poId).toBe(mockValidPo.id);
        expect(unit.poNumber).toBe(mockValidPo.poNumber);
        expect(unit.status).toBe('AVAILABLE_FOR_PLANNING');
        expect(unit.unitIdentifier).toMatch(/^UNIT-GRN-202609-0099-\d{3}$/);
      }

      // Verify collection also received all 15 individual units
      expect(inMemoryUnits.length).toBe(15);
    });
  });

  describe('2. Recipe Context & Distinct Part Sets Isolation', () => {
    it('maintains strict Recipe context for each unit without cross-contamination', async () => {
      const token = generateToken('store_officer_01', ['STORE_OFFICER']);

      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send({ materialReceiptId: mockStoredReceipt.id });

      expect(res.status).toBe(201);
      const units: any[] = inMemoryUnits;

      // Separate units by item
      const unitsItemA = units.filter((u) => u.itemId === 'item_alloy_4140');
      const unitsItemB = units.filter((u) => u.itemId === 'item_alloy_8620');

      expect(unitsItemA.length).toBe(10);
      expect(unitsItemB.length).toBe(5);

      // Verify Item A units are strictly bound to CARBURIZING Recipe
      for (const u of unitsItemA) {
        expect(u.recipeId).toBe('rec_carb_4140_v2');
        expect(u.recipeCode).toBe('REC-CARB-4140');
        expect(u.recipeRevision).toBe(2);
        expect(u.processFamily).toBe('CARBURIZING');
        expect(u.materialGrade).toBe('AISI 4140');
        expect(u.supplierHeatNumber).toBe('HEAT-4140-XYZ');
      }

      // Verify Item B units are strictly bound to NITRIDING Recipe
      for (const u of unitsItemB) {
        expect(u.recipeId).toBe('rec_nit_8620_v1');
        expect(u.recipeCode).toBe('REC-NIT-8620');
        expect(u.recipeRevision).toBe(1);
        expect(u.processFamily).toBe('NITRIDING');
        expect(u.materialGrade).toBe('AISI 8620');
        expect(u.supplierHeatNumber).toBe('HEAT-8620-ABC');
      }
    });

    it('derives Recipe authoritatively from PO/Item and ignores client override attempts', async () => {
      const token = generateToken('store_officer_01', ['STORE_OFFICER']);

      // Client attempts to pass a forged or arbitrary recipe
      const maliciousPayload = {
        poId: mockValidPo.id,
        items: [
          {
            itemId: 'item_alloy_4140',
            receivedQuantity: 3,
            acceptedQuantity: 3,
            recipeId: 'FORGED_ANNEALING_RECIPE',
            recipeCode: 'FORGED-ANN-999'
          } as any
        ]
      };

      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send(maliciousPayload);

      expect(res.status).toBe(201);
      expect(inMemoryUnits.length).toBe(3);

      // Backend derives recipe strictly from PO line item
      for (const unit of inMemoryUnits) {
        expect(unit.recipeId).toBe('rec_carb_4140_v2');
        expect(unit.recipeCode).toBe('REC-CARB-4140');
        expect(unit.recipeRevision).toBe(2);
        expect(unit.processFamily).toBe('CARBURIZING');
      }
    });
  });

  describe('3. Item Master & PO Membership Authority', () => {
    it('rejects GRN creation if an item does not belong to the selected PO', async () => {
      const token = generateToken('store_officer_01', ['STORE_OFFICER']);

      const invalidPayload = {
        poId: mockValidPo.id,
        items: [
          {
            itemId: 'item_unrelated_titanium',
            receivedQuantity: 5,
            acceptedQuantity: 5
          }
        ]
      };

      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/does not belong to Purchase Order/i);
    });
  });

  describe('4. Complete 5-Tier Lineage Traceability Endpoint', () => {
    it('returns verified 5-tier lineage (PO -> GRN -> Unit -> Item -> Recipe) for an individual unit', async () => {
      const token = generateToken('store_officer_01', ['STORE_OFFICER']);

      // First create GRN
      await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send({ materialReceiptId: mockStoredReceipt.id });

      const targetUnit = inMemoryUnits[0];
      expect(targetUnit).toBeDefined();

      // Query complete traceability for the unit
      const traceRes = await request(app)
        .get(`/api/v1/grn/units/${targetUnit.unitIdentifier}/traceability`)
        .set('Authorization', `Bearer ${token}`);

      expect(traceRes.status).toBe(200);
      expect(traceRes.body.success).toBe(true);

      const trace = traceRes.body.data;
      expect(trace.unitIdentifier).toBe(targetUnit.unitIdentifier);
      expect(trace.status).toBe('AVAILABLE_FOR_PLANNING');
      expect(trace.quantity).toBe(1);
      expect(trace.uom).toBe('PCS');

      // 1. PO Tier
      expect(trace.po.poId).toBe(mockValidPo.id);
      expect(trace.po.poNumber).toBe(mockValidPo.poNumber);

      // 2. GRN Tier
      expect(trace.grn.grnNumber).toBe('GRN-202609-0099');
      expect(trace.grn.supplierName).toBe(mockValidPo.supplierName);
      expect(trace.grn.supplierChallanNumber).toBe('DC-STELLAR-4401');

      // 3. Item Master Tier
      expect(trace.item.itemId).toBe('item_alloy_4140');
      expect(trace.item.itemCode).toBe('ALLOY-4140-BAR');
      expect(trace.item.materialGrade).toBe('AISI 4140');

      // 4. Recipe Master Tier
      expect(trace.recipe.recipeId).toBe('rec_carb_4140_v2');
      expect(trace.recipe.recipeCode).toBe('REC-CARB-4140');
      expect(trace.recipe.recipeRevision).toBe(2);
      expect(trace.recipe.processFamily).toBe('CARBURIZING');

      // 5. Storage & Physical Lot Tier
      expect(trace.storage.warehouseCode).toBe('WH-MAIN');
      expect(trace.storage.storageLocationCode).toBe('BAY-A3-01');
      expect(trace.lot.supplierHeatNumber).toBe('HEAT-4140-XYZ');
      expect(trace.lot.mtrNumber).toBe('MTR-CERT-4140');
    });

    it('returns 404 when querying traceability for a non-existent unit identifier', async () => {
      const token = generateToken('store_officer_01', ['STORE_OFFICER']);

      const res = await request(app)
        .get('/api/v1/grn/units/UNIT-NON-EXISTENT-999/traceability')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });
  });

  describe('5. Downstream Planning Gate & Unit Allocation', () => {
    it('retrieves available units for planning filtered by itemId, recipeId, or materialGrade', async () => {
      const token = generateToken('planner_01', ['PLANNING_ENGINEER']);

      // Setup units in memory
      await grnService.createGRN(
        testTenant,
        { materialReceiptId: mockStoredReceipt.id },
        { userId: 'test_user', roles: ['ADMIN'] }
      );

      // Query all available planning units for AISI 4140
      const res = await request(app)
        .get('/api/v1/grn/units/available-for-planning?itemId=item_alloy_4140')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(10);
      for (const u of res.body.data) {
        expect(u.itemId).toBe('item_alloy_4140');
        expect(u.status).toBe('AVAILABLE_FOR_PLANNING');
      }

      // Query by recipeId
      const resRecipe = await request(app)
        .get('/api/v1/grn/units/available-for-planning?recipeId=rec_nit_8620_v1')
        .set('Authorization', `Bearer ${token}`);

      expect(resRecipe.status).toBe(200);
      expect(resRecipe.body.data.length).toBe(5);
      for (const u of resRecipe.body.data) {
        expect(u.recipeId).toBe('rec_nit_8620_v1');
      }
    });

    it('allocates unit to downstream production plan and locks unit against duplicate allocation', async () => {
      const plannerToken = generateToken('planner_01', ['PLANNING_ENGINEER']);

      // Create GRN to seed units
      await grnService.createGRN(
        testTenant,
        { materialReceiptId: mockStoredReceipt.id },
        { userId: 'test_user', roles: ['ADMIN'] }
      );

      const targetUnit = inMemoryUnits[0];
      expect(targetUnit.status).toBe('AVAILABLE_FOR_PLANNING');

      // Allocate unit to Batch Plan
      const allocPayload = {
        allocatedPlanId: 'plan_batch_202609_001',
        allocatedPlanNumber: 'PLAN-202609-001',
        allocatedJobId: 'job_batch_001'
      };

      const allocRes = await request(app)
        .post(`/api/v1/grn/units/${targetUnit.unitIdentifier}/allocate`)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send(allocPayload);

      expect(allocRes.status).toBe(200);
      expect(allocRes.body.success).toBe(true);
      expect(allocRes.body.data.status).toBe('ALLOCATED_TO_PLAN');
      expect(allocRes.body.data.allocatedPlanId).toBe('plan_batch_202609_001');

      // Verify unit is no longer returned in available-for-planning query
      const availRes = await request(app)
        .get(`/api/v1/grn/units/available-for-planning?itemId=${targetUnit.itemId}`)
        .set('Authorization', `Bearer ${plannerToken}`);

      expect(availRes.body.data.length).toBe(9); // 1 allocated, 9 remaining
      const existsInAvail = availRes.body.data.some((u: any) => u.unitIdentifier === targetUnit.unitIdentifier);
      expect(existsInAvail).toBe(false);

      // Verify second allocation attempt is rejected (Immutability / double allocation protection)
      const secondAllocRes = await request(app)
        .post(`/api/v1/grn/units/${targetUnit.unitIdentifier}/allocate`)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          allocatedPlanId: 'plan_batch_conflicting_002',
          allocatedPlanNumber: 'PLAN-202609-002'
        });

      expect(secondAllocRes.status).toBe(400);
      expect(secondAllocRes.body.success).toBe(false);
      expect(secondAllocRes.body.message).toMatch(/cannot be allocated.*current status is 'ALLOCATED_TO_PLAN'/i);
    });
  });

  describe('6. RBAC Authorization Enforcement', () => {
    it('denies unit allocation to users without planning or inventory permissions', async () => {
      // Guest or unauthorized role
      const guestToken = generateToken('viewer_user', ['QUALITY_VIEWER']);

      await grnService.createGRN(
        testTenant,
        { materialReceiptId: mockStoredReceipt.id },
        { userId: 'test_user', roles: ['ADMIN'] }
      );

      const targetUnit = inMemoryUnits[0];

      const res = await request(app)
        .post(`/api/v1/grn/units/${targetUnit.unitIdentifier}/allocate`)
        .set('Authorization', `Bearer ${guestToken}`)
        .send({
          allocatedPlanId: 'plan_test_01',
          allocatedPlanNumber: 'PLAN-TEST-01'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('denies unauthenticated requests to unit traceability and planning endpoints', async () => {
      const resTrace = await request(app).get('/api/v1/grn/units/UNIT-202609-0001-001/traceability');
      expect(resTrace.status).toBe(401);

      const resAvail = await request(app).get('/api/v1/grn/units/available-for-planning');
      expect(resAvail.status).toBe(401);

      const resAlloc = await request(app)
        .post('/api/v1/grn/units/UNIT-202609-0001-001/allocate')
        .send({ allocatedPlanId: 'plan_1', allocatedPlanNumber: 'P-1' });
      expect(resAlloc.status).toBe(401);
    });
  });
});
