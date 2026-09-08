import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { grnService } from '../src/modules/grn/grn.service.js';
import { grnRepository } from '../src/modules/grn/grn.repository.js';
import { purchaseOrderService } from '../src/modules/purchase-order/purchase-order.service.js';
import { warehouseService } from '../src/modules/warehouse/warehouse.service.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { PERMISSIONS, DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { NotFoundError } from '../src/core/errors/app-error.js';

describe('Prompt 5: Authoritative Warehouse Storage and Putaway Suite (Creation Phase)', () => {
  const app = createApp();
  const testTenant = 'tenant_warehouse_putaway_001';

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const mockPoLineItem = {
    lineItemId: 'line_pinion_01',
    itemId: 'item_pinion_4140',
    itemCode: 'GEAR-PIN-4140',
    itemName: 'Helical Pinion Gear 4140',
    materialGrade: 'AISI 4140',
    processFamily: 'CARBURIZING',
    recipeId: 'rec_carb_4140',
    recipeCode: 'REC-CARB-4140',
    recipeRevision: 1,
    orderedQuantity: 100,
    receivedQuantity: 0,
    balanceQuantity: 100,
    unitPrice: 45.0,
    lineTotalAmount: 4500.0,
    uom: 'PCS'
  };

  const mockActivePo = {
    id: 'po_active_putaway_001',
    tenantId: testTenant,
    poNumber: 'PO-202609-0001',
    supplierName: 'Precision Steel Works Inc.',
    supplierCode: 'SUP-PREC-01',
    status: 'ISSUED',
    orderDate: new Date('2026-09-01'),
    expectedDeliveryDate: new Date('2026-09-30'),
    items: [{ ...mockPoLineItem }],
    totalOrderedQuantity: 100,
    totalReceivedQuantity: 0,
    currency: 'USD',
    subtotalAmount: 4500,
    taxAmount: 0,
    totalAmount: 4500,
    isDeleted: false,
    toJSON: function () {
      return { ...this };
    }
  };

  // Authoritative Warehouses
  const mockMainWarehouse = {
    id: 'wh_main_01',
    tenantId: testTenant,
    code: 'WH-MAIN-01',
    name: 'Main Plant Thermal Processing Facility',
    type: 'MAIN_PLANT',
    status: 'ACTIVE',
    toJSON: function () {
      return { ...this };
    }
  };

  const mockInactiveWarehouse = {
    id: 'wh_inactive_01',
    tenantId: testTenant,
    code: 'WH-INACT-01',
    name: 'Decommissioned Yard Warehouse',
    type: 'SCRAP_YARD',
    status: 'INACTIVE',
    toJSON: function () {
      return { ...this };
    }
  };

  // Authoritative Storage Locations
  const mockActiveLocationA = {
    id: 'loc_bay_01_a',
    tenantId: testTenant,
    warehouseId: 'wh_main_01',
    warehouseCode: 'WH-MAIN-01',
    locationCode: 'BAY-01-A',
    zone: 'Raw Material Yard',
    bay: 'Bay 1',
    rack: 'Rack A',
    status: 'ACTIVE',
    toJSON: function () {
      return { ...this };
    }
  };

  const mockActiveLocationB = {
    id: 'loc_bay_01_b',
    tenantId: testTenant,
    warehouseId: 'wh_main_01',
    warehouseCode: 'WH-MAIN-01',
    locationCode: 'BAY-01-B',
    zone: 'Raw Material Yard',
    bay: 'Bay 1',
    rack: 'Rack B',
    status: 'ACTIVE',
    toJSON: function () {
      return { ...this };
    }
  };

  const mockInactiveLocation = {
    id: 'loc_bay_inact',
    tenantId: testTenant,
    warehouseId: 'wh_main_01',
    warehouseCode: 'WH-MAIN-01',
    locationCode: 'BAY-INACT-01',
    zone: 'Quarantine Area',
    bay: 'Bay 99',
    status: 'INACTIVE',
    toJSON: function () {
      return { ...this };
    }
  };

  const mockMismatchedLocation = {
    id: 'loc_other_wh',
    tenantId: testTenant,
    warehouseId: 'wh_satellite_99',
    warehouseCode: 'WH-SAT-99',
    locationCode: 'BAY-SAT-01',
    zone: 'Satellite Storage',
    bay: 'Bay 1',
    status: 'ACTIVE',
    toJSON: function () {
      return { ...this };
    }
  };

  let inMemoryReceiptStore: Map<string, any>;

  beforeEach(() => {
    inMemoryReceiptStore = new Map();

    // Default RBAC Setup
    jest.spyOn(roleRepository, 'seedDefaultRolesForTenant').mockResolvedValue([] as any);
    jest.spyOn(roleRepository, 'findRolesByCodes').mockImplementation(async (_tenantId, codes) => {
      const roles = codes.map((c) => {
        let permissions: string[] = [];
        if (c === 'WAREHOUSE_OPERATOR') {
          permissions = [PERMISSIONS.INVENTORY_STORAGE_RECORD, PERMISSIONS.PURCHASE_ORDER_VIEW];
        } else if (c === 'PLANT_MANAGER') {
          permissions = [
            PERMISSIONS.INVENTORY_STORAGE_RECORD,
            PERMISSIONS.INVENTORY_GRN_CREATE,
            PERMISSIONS.INVENTORY_GRN_VIEW,
            PERMISSIONS.INVENTORY_GRN_PRINT,
            PERMISSIONS.PURCHASE_ORDER_VIEW
          ];
        }
        return {
          id: `role_${c}`,
          tenantId: testTenant,
          code: c,
          name: `Role ${c}`,
          permissions,
          status: 'active'
        };
      });
      return roles as any;
    });

    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);
    jest.spyOn(grnRepository, 'findReceiptByIdempotencyKey').mockResolvedValue(null);

    // PO Service Mocks
    jest.spyOn(purchaseOrderService, 'getOrderById').mockImplementation(async (_t, id) => {
      if (id === mockActivePo.id) return { ...mockActivePo } as any;
      throw new NotFoundError(`Purchase Order with ID '${id}' not found`);
    });

    jest.spyOn(purchaseOrderService, 'recordReceiptProgression').mockResolvedValue({} as any);

    // Warehouse Service Mocks
    jest.spyOn(warehouseService, 'getWarehouseById').mockImplementation(async (_t, id) => {
      if (id === mockMainWarehouse.id) return { ...mockMainWarehouse } as any;
      if (id === mockInactiveWarehouse.id) return { ...mockInactiveWarehouse } as any;
      throw new NotFoundError(`Warehouse with ID '${id}' not found`);
    });

    jest.spyOn(warehouseService, 'getLocationByCode').mockImplementation(async (_t, code) => {
      const upper = code.toUpperCase().trim();
      if (upper === 'BAY-01-A') return { ...mockActiveLocationA } as any;
      if (upper === 'BAY-01-B') return { ...mockActiveLocationB } as any;
      if (upper === 'BAY-INACT-01') return { ...mockInactiveLocation } as any;
      if (upper === 'BAY-SAT-01') return { ...mockMismatchedLocation } as any;
      throw new NotFoundError(`Storage location with code '${code}' not found`);
    });

    // GRN Repository Mocks
    jest.spyOn(grnRepository, 'generateNextReceiptNumber').mockResolvedValue('RCPT-202609-0001');
    jest.spyOn(grnRepository, 'generateNextGrnNumber').mockResolvedValue('GRN-202609-0001');

    jest.spyOn(grnRepository, 'createReceipt').mockImplementation(async (_t, data) => {
      const id = `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const doc: any = {
        ...data,
        _id: id,
        id,
        items: data.items?.map((it: any) => ({ ...it })),
        movementHistory: data.movementHistory ? [...data.movementHistory] : [],
        save: async function () {
          inMemoryReceiptStore.set(id, this);
          return this;
        },
        toJSON: function () {
          return { ...this };
        }
      };
      inMemoryReceiptStore.set(id, doc);
      return doc;
    });

    jest.spyOn(grnRepository, 'findReceiptById').mockImplementation(async (_t, id) => {
      const found = inMemoryReceiptStore.get(id);
      return found ? found : null;
    });

    jest.spyOn(grnRepository, 'atomicStoreReceipt').mockImplementation(
      async (_t, receiptId, expectedStatuses, updateData, newMovement, requiredQty) => {
        const doc = inMemoryReceiptStore.get(receiptId);
        if (!doc) return null;
        if (!expectedStatuses.includes(doc.status)) return null;

        if (requiredQty !== undefined && doc.remainingQuantityToStore !== undefined) {
          if (doc.remainingQuantityToStore < requiredQty) return null;
        }

        // Apply atomic changes
        Object.assign(doc, updateData);
        if (!doc.movementHistory) doc.movementHistory = [];
        doc.movementHistory.push(newMovement);
        inMemoryReceiptStore.set(receiptId, doc);
        return doc;
      }
    );

    jest.spyOn(grnRepository, 'createGrn').mockImplementation(async (_t, data) => {
      const doc: any = {
        ...data,
        id: 'grn_001',
        toJSON: function () {
          return { ...this };
        }
      };
      return doc;
    });

    jest.spyOn(grnRepository, 'createGrnUnits').mockImplementation(async (_t, units) => {
      return units.map((u, i) => ({ ...u, id: `unit_${i}` })) as any;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Helper to record a valid receipt with 100 units
  const recordTestReceipt = async (token: string, quantity = 100) => {
    const res = await request(app)
      .post('/api/v1/grn/receipts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        poId: mockActivePo.id,
        supplierChallanNumber: 'CHALLAN-PUTAWAY-01',
        supplierChallanDate: '2026-09-08',
        items: [
          {
            poLineItemId: mockPoLineItem.lineItemId,
            itemId: mockPoLineItem.itemId,
            receivedQuantity: quantity,
            supplierHeatNumber: 'HEAT-4140-PTWY-01',
            supplierLotNumber: 'LOT-PTWY-A',
            mtrNumber: 'MTR-PTWY-9988'
          }
        ]
      });

    expect(res.status).toBe(201);
    return res.body.data;
  };

  describe('1. Storage Permission & Dynamic RBAC Enforcement', () => {
    it('allows users with dynamic INVENTORY_STORAGE_RECORD permission to store material', async () => {
      const operatorToken = generateToken('usr_warehouse_op', ['WAREHOUSE_OPERATOR']);
      const receipt = await recordTestReceipt(operatorToken, 100);

      const res = await request(app)
        .post(`/api/v1/grn/receipts/${receipt.id}/store`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          warehouseId: mockMainWarehouse.id,
          storageLocationCode: 'BAY-01-A',
          quantity: 100,
          storageNotes: 'Stored in Rack A Bay 1'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('STORED');
      expect(res.body.data.warehouseCode).toBe('WH-MAIN-01');
      expect(res.body.data.storageLocationCode).toBe('BAY-01-A');
    });

    it('rejects users lacking INVENTORY_STORAGE_RECORD with HTTP 403', async () => {
      const operatorToken = generateToken('usr_warehouse_op', ['WAREHOUSE_OPERATOR']);
      const receipt = await recordTestReceipt(operatorToken, 100);

      const viewerToken = generateToken('usr_procurement_viewer', ['AUDITOR']);
      const res = await request(app)
        .post(`/api/v1/grn/receipts/${receipt.id}/store`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          warehouseId: mockMainWarehouse.id,
          storageLocationCode: 'BAY-01-A',
          quantity: 100
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/inventory:storage:record/i);
    });
  });

  describe('2. Authoritative Warehouse & Storage Location Validation', () => {
    it('rejects putaway if target warehouse is inactive with HTTP 400', async () => {
      const token = generateToken('usr_op', ['WAREHOUSE_OPERATOR']);
      const receipt = await recordTestReceipt(token, 100);

      const res = await request(app)
        .post(`/api/v1/grn/receipts/${receipt.id}/store`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          warehouseId: mockInactiveWarehouse.id,
          storageLocationCode: 'BAY-01-A',
          quantity: 100
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/inactive/i);
    });

    it('rejects putaway if warehouse ID does not exist with HTTP 404', async () => {
      const token = generateToken('usr_op', ['WAREHOUSE_OPERATOR']);
      const receipt = await recordTestReceipt(token, 100);

      const res = await request(app)
        .post(`/api/v1/grn/receipts/${receipt.id}/store`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          warehouseId: 'non_existent_wh',
          storageLocationCode: 'BAY-01-A',
          quantity: 100
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/non_existent_wh.*not found/i);
    });

    it('rejects putaway if storage location is inactive with HTTP 400', async () => {
      const token = generateToken('usr_op', ['WAREHOUSE_OPERATOR']);
      const receipt = await recordTestReceipt(token, 100);

      const res = await request(app)
        .post(`/api/v1/grn/receipts/${receipt.id}/store`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          warehouseId: mockMainWarehouse.id,
          storageLocationCode: 'BAY-INACT-01',
          quantity: 100
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cannot accept stock putaway/i);
    });

    it('rejects putaway if storage location does not exist with HTTP 404', async () => {
      const token = generateToken('usr_op', ['WAREHOUSE_OPERATOR']);
      const receipt = await recordTestReceipt(token, 100);

      const res = await request(app)
        .post(`/api/v1/grn/receipts/${receipt.id}/store`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          warehouseId: mockMainWarehouse.id,
          storageLocationCode: 'UNKNOWN-BAY-999',
          quantity: 100
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/UNKNOWN-BAY-999.*not found/i);
    });

    it('rejects putaway if storage location belongs to a different warehouse with HTTP 400', async () => {
      const token = generateToken('usr_op', ['WAREHOUSE_OPERATOR']);
      const receipt = await recordTestReceipt(token, 100);

      const res = await request(app)
        .post(`/api/v1/grn/receipts/${receipt.id}/store`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          warehouseId: mockMainWarehouse.id,
          storageLocationCode: 'BAY-SAT-01', // Belongs to WH-SAT-99
          quantity: 100
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/does not belong to warehouse/i);
    });
  });

  describe('3. Quantity Integrity & Partial Putaways', () => {
    it('rejects putaway quantity greater than received quantity with HTTP 400', async () => {
      const token = generateToken('usr_op', ['WAREHOUSE_OPERATOR']);
      const receipt = await recordTestReceipt(token, 100);

      const res = await request(app)
        .post(`/api/v1/grn/receipts/${receipt.id}/store`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          warehouseId: mockMainWarehouse.id,
          storageLocationCode: 'BAY-01-A',
          quantity: 150 // Exceeds 100
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/exceeds available received balance/i);
    });

    it('rejects non-positive putaway quantity (<= 0) with HTTP 400', async () => {
      const token = generateToken('usr_op', ['WAREHOUSE_OPERATOR']);
      const receipt = await recordTestReceipt(token, 100);

      const res = await request(app)
        .post(`/api/v1/grn/receipts/${receipt.id}/store`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          warehouseId: mockMainWarehouse.id,
          storageLocationCode: 'BAY-01-A',
          quantity: 0
        });

      expect([400, 422]).toContain(res.status);
    });

    it('supports partial storage and keeps remaining quantity identifiable in PARTIALLY_STORED status', async () => {
      const token = generateToken('usr_op', ['WAREHOUSE_OPERATOR']);
      const receipt = await recordTestReceipt(token, 100);

      // Store partial 40 KG
      const res1 = await request(app)
        .post(`/api/v1/grn/receipts/${receipt.id}/store`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          warehouseId: mockMainWarehouse.id,
          storageLocationCode: 'BAY-01-A',
          quantity: 40,
          storageNotes: 'First batch of 40 PCS into Bay 1-A'
        });

      expect(res1.status).toBe(200);
      expect(res1.body.data.status).toBe('PARTIALLY_STORED');
      expect(res1.body.data.totalStoredQuantity).toBe(40);
      expect(res1.body.data.remainingQuantityToStore).toBe(60);
      expect(res1.body.data.movementHistory).toHaveLength(1);
      expect(res1.body.data.movementHistory[0].quantity).toBe(40);
      expect(res1.body.data.movementHistory[0].sourceLocation).toBe('INWARD_RECEIVING_DOCK');
      expect(res1.body.data.movementHistory[0].destinationLocationCode).toBe('BAY-01-A');

      // Attempt to store 70 KG (exceeds remaining 60 KG) -> must reject
      const resOverflow = await request(app)
        .post(`/api/v1/grn/receipts/${receipt.id}/store`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          warehouseId: mockMainWarehouse.id,
          storageLocationCode: 'BAY-01-B',
          quantity: 70
        });

      expect(resOverflow.status).toBe(400);
      expect(resOverflow.body.message).toMatch(/exceeds available received balance/i);

      // Put away final 60 KG -> transitions to STORED
      const res2 = await request(app)
        .post(`/api/v1/grn/receipts/${receipt.id}/store`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          warehouseId: mockMainWarehouse.id,
          storageLocationCode: 'BAY-01-B',
          quantity: 60,
          storageNotes: 'Second batch of 60 PCS into Bay 1-B'
        });

      expect(res2.status).toBe(200);
      expect(res2.body.data.status).toBe('STORED');
      expect(res2.body.data.totalStoredQuantity).toBe(100);
      expect(res2.body.data.remainingQuantityToStore).toBe(0);
      expect(res2.body.data.movementHistory).toHaveLength(2);
      expect(res2.body.data.movementHistory[1].quantity).toBe(60);
      expect(res2.body.data.movementHistory[1].destinationLocationCode).toBe('BAY-01-B');
    });
  });

  describe('4. Duplicate Storage Prevention', () => {
    it('prevents duplicate storage once receipt is fully stored', async () => {
      const token = generateToken('usr_op', ['WAREHOUSE_OPERATOR']);
      const receipt = await recordTestReceipt(token, 100);

      // Store complete 100 KG
      const res1 = await request(app)
        .post(`/api/v1/grn/receipts/${receipt.id}/store`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          warehouseId: mockMainWarehouse.id,
          storageLocationCode: 'BAY-01-A',
          quantity: 100
        });

      expect(res1.status).toBe(200);
      expect(res1.body.data.status).toBe('STORED');

      // Second attempt to store must be rejected
      const res2 = await request(app)
        .post(`/api/v1/grn/receipts/${receipt.id}/store`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          warehouseId: mockMainWarehouse.id,
          storageLocationCode: 'BAY-01-A',
          quantity: 100
        });

      expect(res2.status).toBe(400);
      expect(res2.body.message).toMatch(/already been fully stored/i);
    });
  });

  describe('5. Concurrent Storage Protection', () => {
    it('protects against two users attempting to store the remaining balance simultaneously', async () => {
      const tokenA = generateToken('usr_op_a', ['WAREHOUSE_OPERATOR']);
      const tokenB = generateToken('usr_op_b', ['WAREHOUSE_OPERATOR']);
      const receipt = await recordTestReceipt(tokenA, 100);

      // Simulate User A storing 60 units
      const resA = await request(app)
        .post(`/api/v1/grn/receipts/${receipt.id}/store`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          warehouseId: mockMainWarehouse.id,
          storageLocationCode: 'BAY-01-A',
          quantity: 60
        });

      expect(resA.status).toBe(200);
      expect(resA.body.data.remainingQuantityToStore).toBe(40);

      // Simulate User B concurrently attempting to store 60 units (based on stale read of 100)
      const resB = await request(app)
        .post(`/api/v1/grn/receipts/${receipt.id}/store`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          warehouseId: mockMainWarehouse.id,
          storageLocationCode: 'BAY-01-B',
          quantity: 60
        });

      expect(resB.status).toBe(400);
      expect(resB.body.message).toMatch(/exceeds available received balance/i);
    });
  });

  describe('6. Traceability Retention Throughout Storage', () => {
    it('preserves PO -> Receipt -> Challan -> Heat/Lot -> Warehouse Bay unbroken lineage', async () => {
      const token = generateToken('usr_op', ['WAREHOUSE_OPERATOR']);
      const receipt = await recordTestReceipt(token, 100);

      const res = await request(app)
        .post(`/api/v1/grn/receipts/${receipt.id}/store`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          warehouseId: mockMainWarehouse.id,
          storageLocationCode: 'BAY-01-A',
          quantity: 100,
          storageNotes: 'Traceability validated upon putaway'
        });

      expect(res.status).toBe(200);
      const stored = res.body.data;

      // Verify unbroken chain
      expect(stored.poId).toBe(mockActivePo.id);
      expect(stored.poNumber).toBe('PO-202609-0001');
      expect(stored.supplierName).toBe('Precision Steel Works Inc.');
      expect(stored.supplierChallanNumber).toBe('CHALLAN-PUTAWAY-01');
      expect(stored.warehouseId).toBe('wh_main_01');
      expect(stored.warehouseCode).toBe('WH-MAIN-01');
      expect(stored.storageLocationCode).toBe('BAY-01-A');
      expect(stored.items[0].supplierHeatNumber).toBe('HEAT-4140-PTWY-01');
      expect(stored.items[0].recipeCode).toBe('REC-CARB-4140');
      expect(stored.items[0].recipeRevision).toBe(1);
      expect(stored.items[0].storedQuantity).toBe(100);
    });
  });

  describe('7. GRN Gating: Unstored Material Rejection', () => {
    it('strictly blocks GRN issuance if material is in RECEIVED status (not stored)', async () => {
      const token = generateToken('usr_op', ['WAREHOUSE_OPERATOR', 'PLANT_MANAGER']);
      const receipt = await recordTestReceipt(token, 100);

      // Attempt to issue GRN directly from RECEIVED state
      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send({
          materialReceiptId: receipt.id,
          inspectedBy: 'Chief Metallurgist'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Material must be stored in the warehouse first/i);
    });

    it('strictly blocks GRN issuance if material is in PARTIALLY_STORED status', async () => {
      const token = generateToken('usr_op', ['WAREHOUSE_OPERATOR', 'PLANT_MANAGER']);
      const receipt = await recordTestReceipt(token, 100);

      // Put away partial 50 KG
      await request(app)
        .post(`/api/v1/grn/receipts/${receipt.id}/store`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          warehouseId: mockMainWarehouse.id,
          storageLocationCode: 'BAY-01-A',
          quantity: 50
        });

      // Attempt to issue GRN from PARTIALLY_STORED state
      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send({
          materialReceiptId: receipt.id,
          inspectedBy: 'Chief Metallurgist'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Material must be stored in the warehouse first/i);
    });

    it('allows GRN issuance once material is fully STORED in the warehouse', async () => {
      const token = generateToken('usr_op', ['WAREHOUSE_OPERATOR', 'PLANT_MANAGER']);
      const receipt = await recordTestReceipt(token, 100);

      // Put away full 100 KG
      await request(app)
        .post(`/api/v1/grn/receipts/${receipt.id}/store`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          warehouseId: mockMainWarehouse.id,
          storageLocationCode: 'BAY-01-A',
          quantity: 100
        });

      // Issue GRN
      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send({
          materialReceiptId: receipt.id,
          inspectedBy: 'Chief Metallurgist'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.grnNumber).toBe('GRN-202609-0001');
      expect(res.body.data.warehouseCode).toBe('WH-MAIN-01');
      expect(res.body.data.storageLocationCode).toBe('BAY-01-A');
    });
  });
});
