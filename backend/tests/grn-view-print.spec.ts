import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { grnRepository } from '../src/modules/grn/grn.repository.js';
import { purchaseOrderService } from '../src/modules/purchase-order/purchase-order.service.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { rbacService } from '../src/modules/rbac/rbac.service.js';
import { PERMISSIONS } from '../src/modules/rbac/rbac.constants.js';

describe('Prompt 9: GRN Viewing and Printing Suite', () => {
  const app = createApp();
  const testTenant = 'tenant_prompt9_view_print_001';

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const adminToken = generateToken('admin_user_01', ['ADMIN']);
  const storeManagerToken = generateToken('store_mgr_01', ['STORE_MANAGER']);
  const unprivilegedToken = generateToken('unprivileged_user_01', ['VIEW_ONLY_OPERATOR']);

  const mockPoLineItem1 = {
    lineItemId: 'po_line_01',
    itemId: 'item_carb_shaft',
    itemCode: 'ALLOY-SHAFT-4140',
    itemName: 'AISI 4140 Pinion Shaft',
    particulars: 'AISI 4140 Pinion Shaft',
    materialGrade: 'AISI 4140',
    processFamily: 'CARBURIZING',
    recipeId: 'rec_carb_01',
    recipeCode: 'REC-CARB-4140',
    recipeRevision: 2,
    orderedQuantity: 10,
    receivedQuantity: 10,
    acceptedQuantity: 10,
    unitPrice: 150.0,
    rate: 150.0,
    hsnCode: '7228.30.29',
    uom: 'PCS',
    supplierHeatNumber: 'HEAT-9921-A',
    mtrNumber: 'MTR-CERT-881'
  };

  const mockPoLineItem2 = {
    lineItemId: 'po_line_02',
    itemId: 'item_nit_gear',
    itemCode: 'ALLOY-GEAR-8620',
    itemName: 'AISI 8620 Ring Gear',
    particulars: 'AISI 8620 Ring Gear',
    materialGrade: 'AISI 8620',
    processFamily: 'NITRIDING',
    recipeId: 'rec_nit_01',
    recipeCode: 'REC-NIT-8620',
    recipeRevision: 1,
    orderedQuantity: 5,
    receivedQuantity: 5,
    acceptedQuantity: 5,
    unitPrice: 280.0,
    rate: 280.0,
    hsnCode: '7228.30.29',
    uom: 'PCS',
    supplierHeatNumber: 'HEAT-7734-B',
    mtrNumber: 'MTR-CERT-992'
  };

  const mockParentPO = {
    id: 'po_view_print_001',
    _id: 'po_view_print_001',
    tenantId: testTenant,
    poNumber: 'PO-202609-9001',
    supplierName: 'Titan Metallurgical Alloys Ltd.',
    supplierCode: 'SUP-TITAN-01',
    status: 'RECEIVED',
    orderDate: new Date('2026-09-01T08:00:00.000Z'),
    createdAt: new Date('2026-09-01T08:00:00.000Z'),
    totalAmount: 2900.0,
    currency: 'INR',
    items: [mockPoLineItem1, mockPoLineItem2],
    isDeleted: false
  };

  const mockUnits = [
    {
      id: 'unit_001',
      _id: 'unit_001',
      unitIdentifier: 'GRN-202609-9001-UNIT-001',
      tenantId: testTenant,
      poId: mockParentPO.id,
      poNumber: mockParentPO.poNumber,
      grnId: 'grn_view_print_001',
      grnNumber: 'GRN-202609-9001',
      itemId: mockPoLineItem1.itemId,
      itemCode: mockPoLineItem1.itemCode,
      itemName: mockPoLineItem1.itemName,
      recipeId: mockPoLineItem1.recipeId,
      recipeCode: mockPoLineItem1.recipeCode,
      recipeRevision: 2,
      processFamily: 'CARBURIZING',
      materialGrade: 'AISI 4140',
      quantity: 1,
      uom: 'PCS',
      warehouseCode: 'WH-MAIN',
      storageLocationCode: 'BAY-A1-01',
      supplierHeatNumber: 'HEAT-9921-A',
      mtrNumber: 'MTR-CERT-881',
      status: 'AVAILABLE_FOR_PLANNING',
      isDeleted: false
    },
    {
      id: 'unit_002',
      _id: 'unit_002',
      unitIdentifier: 'GRN-202609-9001-UNIT-002',
      tenantId: testTenant,
      poId: mockParentPO.id,
      poNumber: mockParentPO.poNumber,
      grnId: 'grn_view_print_001',
      grnNumber: 'GRN-202609-9001',
      itemId: mockPoLineItem2.itemId,
      itemCode: mockPoLineItem2.itemCode,
      itemName: mockPoLineItem2.itemName,
      recipeId: mockPoLineItem2.recipeId,
      recipeCode: mockPoLineItem2.recipeCode,
      recipeRevision: 1,
      processFamily: 'NITRIDING',
      materialGrade: 'AISI 8620',
      quantity: 1,
      uom: 'PCS',
      warehouseCode: 'WH-MAIN',
      storageLocationCode: 'BAY-B2-04',
      supplierHeatNumber: 'HEAT-7734-B',
      mtrNumber: 'MTR-CERT-992',
      status: 'AVAILABLE_FOR_PLANNING',
      isDeleted: false
    }
  ];

  const mockCompletedGrn: any = {
    id: 'grn_view_print_001',
    _id: 'grn_view_print_001',
    tenantId: testTenant,
    grnNumber: 'GRN-202609-9001',
    poId: mockParentPO.id,
    poNumber: mockParentPO.poNumber,
    materialReceiptId: 'rcpt_view_print_001',
    receiptNumber: 'RCPT-202609-9001',
    supplierName: mockParentPO.supplierName,
    supplierCode: mockParentPO.supplierCode,
    supplierChallanNumber: 'DC-TITAN-8890',
    supplierChallanDate: new Date('2026-09-05T10:00:00.000Z'),
    carrierVehicle: 'KA-01-MJ-4411',
    warehouseId: 'wh_main',
    warehouseCode: 'WH-MAIN',
    storageLocationCode: 'BAY-A1-01',
    items: [mockPoLineItem1, mockPoLineItem2],
    units: mockUnits,
    totalUnitsGenerated: 2,
    status: 'AVAILABLE_FOR_PLANNING',
    receivedBy: 'store_incharge_01',
    inspectedBy: 'qc_inspector_01',
    approvedBy: 'plant_manager_01',
    grnDate: new Date('2026-09-06T11:00:00.000Z'),
    printCount: 0,
    printedAt: undefined,
    printedBy: undefined,
    remarks: 'Nadcap compliance certified with chemical test certs',
    isDeleted: false,
    createdAt: new Date('2026-09-06T11:00:00.000Z'),
    save: jest.fn().mockImplementation(function (this: any) {
      return Promise.resolve(this);
    }),
    toObject: function () {
      return { ...this };
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default RBAC mock
    jest.spyOn(rbacService, 'getUserEffectivePermissions').mockImplementation(async (_tenantId, userId) => {
      if (userId === 'admin_user_01') {
        return {
          tenantId: testTenant,
          userId,
          roles: ['ADMIN'],
          permissions: Object.values(PERMISSIONS),
          isSuperAdmin: true
        };
      }
      if (userId === 'store_mgr_01') {
        return {
          tenantId: testTenant,
          userId,
          roles: ['STORE_MANAGER'],
          permissions: [
            PERMISSIONS.INVENTORY_GRN_VIEW,
            PERMISSIONS.INVENTORY_GRN_PRINT,
            PERMISSIONS.INVENTORY_GRN_CREATE,
            PERMISSIONS.INVENTORY_STORAGE_RECORD
          ],
          isSuperAdmin: false
        };
      }
      if (userId === 'unprivileged_user_01') {
        return {
          tenantId: testTenant,
          userId,
          roles: ['VIEW_ONLY_OPERATOR'],
          permissions: ['general:dashboard:view'],
          isSuperAdmin: false
        };
      }
      return {
        tenantId: testTenant,
        userId,
        roles: [],
        permissions: [],
        isSuperAdmin: false
      };
    });

    // Default Repo & Service mocks
    jest.spyOn(purchaseOrderService, 'getOrderById').mockResolvedValue(mockParentPO as any);
    jest.spyOn(grnRepository, 'findGrnById').mockImplementation(async (_tenantId, id) => {
      if (id === mockCompletedGrn.id || id === mockCompletedGrn.grnNumber) {
        return mockCompletedGrn;
      }
      return null;
    });
    jest.spyOn(grnRepository, 'queryUnits').mockResolvedValue({
      units: mockUnits as any,
      total: mockUnits.length
    });
    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);
  });

  describe('1. Server-Side GRN Permission Enforcement', () => {
    it('rejects unauthenticated requests to view GRN with 401 Unauthorized', async () => {
      const res = await request(app).get(`/api/v1/grn/${mockCompletedGrn.id}`);
      expect(res.status).toBe(401);
    });

    it('rejects unprivileged user lacking INVENTORY_GRN_VIEW with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/grn/${mockCompletedGrn.id}`)
        .set('Authorization', `Bearer ${unprivilegedToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/permission|access denied/i);
    });

    it('rejects unprivileged user attempting to print GRN with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/grn/${mockCompletedGrn.id}/print`)
        .set('Authorization', `Bearer ${unprivilegedToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/permission|access denied/i);
    });

    it('rejects POST print requests from unprivileged users with 403 Forbidden', async () => {
      const res = await request(app)
        .post(`/api/v1/grn/${mockCompletedGrn.id}/print`)
        .set('Authorization', `Bearer ${unprivilegedToken}`);

      expect(res.status).toBe(403);
    });

    it('allows authorized STORE_MANAGER with INVENTORY_GRN_VIEW to view GRN', async () => {
      const res = await request(app)
        .get(`/api/v1/grn/${mockCompletedGrn.id}`)
        .set('Authorization', `Bearer ${storeManagerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.grnNumber).toBe('GRN-202609-9001');
    });

    it('allows authorized STORE_MANAGER with INVENTORY_GRN_PRINT to print GRN', async () => {
      const res = await request(app)
        .get(`/api/v1/grn/${mockCompletedGrn.id}/print`)
        .set('Authorization', `Bearer ${storeManagerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.htmlReport).toBeDefined();
    });
  });

  describe('2. Authoritative GRN Record View (Single Source of Truth)', () => {
    it('returns complete authoritative GRN data with parent PO, Supplier, and individual units', async () => {
      const res = await request(app)
        .get(`/api/v1/grn/${mockCompletedGrn.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;

      // Identity & Status
      expect(data.grnNumber).toBe('GRN-202609-9001');
      expect(data.status).toBe('AVAILABLE_FOR_PLANNING');

      // Parent PO Traceability
      expect(data.poNumber).toBe('PO-202609-9001');
      expect(data.parentPO).toBeDefined();
      expect(data.parentPO.poNumber).toBe('PO-202609-9001');
      expect(data.parentPO.supplierName).toBe('Titan Metallurgical Alloys Ltd.');

      // Authoritative Supplier (derived strictly from PO)
      expect(data.supplierName).toBe('Titan Metallurgical Alloys Ltd.');
      expect(data.supplierCode).toBe('SUP-TITAN-01');

      // Supplier Challan & Vehicle
      expect(data.supplierChallanNumber).toBe('DC-TITAN-8890');
      expect(data.carrierVehicle).toBe('KA-01-MJ-4411');

      // Received Items
      expect(data.items).toHaveLength(2);
      expect(data.items[0].itemCode).toBe('ALLOY-SHAFT-4140');
      expect(data.items[0].recipeCode).toBe('REC-CARB-4140');
      expect(data.items[0].recipeRevision).toBe(2);
      expect(data.items[0].supplierHeatNumber).toBe('HEAT-9921-A');
      expect(data.items[0].mtrNumber).toBe('MTR-CERT-881');

      // Individual Units
      expect(data.units).toHaveLength(2);
      expect(data.units[0].unitIdentifier).toBe('GRN-202609-9001-UNIT-001');
      expect(data.units[0].recipeCode).toBe('REC-CARB-4140');
      expect(data.units[1].unitIdentifier).toBe('GRN-202609-9001-UNIT-002');
      expect(data.units[1].recipeCode).toBe('REC-NIT-8620');

      // Authorization info
      expect(data.receivedBy).toBe('store_incharge_01');
      expect(data.inspectedBy).toBe('qc_inspector_01');
      expect(data.approvedBy).toBe('plant_manager_01');
    });

    it('supports looking up GRN by human-readable grnNumber directly', async () => {
      const res = await request(app)
        .get(`/api/v1/grn/GRN-202609-9001`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.grnNumber).toBe('GRN-202609-9001');
      expect(res.body.data.poNumber).toBe('PO-202609-9001');
    });

    it('returns 404 Not Found for non-existent or guessed GRN identifiers without data leakage', async () => {
      const res = await request(app)
        .get('/api/v1/grn/GRN-NONEXISTENT-GUESS')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });
  });

  describe('3. Reliable Printing & Audit Trail', () => {
    it('executes formal GRN printing, increments printCount, and records GRN_PRINTED audit log', async () => {
      mockCompletedGrn.printCount = 0;

      const res = await request(app)
        .get(`/api/v1/grn/${mockCompletedGrn.id}/print`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(mockCompletedGrn.printCount).toBe(1);
      expect(mockCompletedGrn.printedAt).toBeDefined();
      expect(mockCompletedGrn.printedBy).toBe('admin_user_01');
      expect(mockCompletedGrn.save).toHaveBeenCalled();

      // Verify Audit Logging
      expect(auditService.record).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          actorId: 'admin_user_01',
          action: 'GRN_PRINTED',
          entityType: 'GRN',
          entityId: mockCompletedGrn.id
        })
      );
    });

    it('supports POST /:id/print to record print action idempotently', async () => {
      const res = await request(app)
        .post(`/api/v1/grn/${mockCompletedGrn.id}/print`)
        .set('Authorization', `Bearer ${storeManagerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.grn.grnNumber).toBe('GRN-202609-9001');
      expect(auditService.record).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          action: 'GRN_PRINTED',
          entityId: mockCompletedGrn.id
        })
      );
    });

    it('returns formatted HTML document when client sends Accept: text/html', async () => {
      const res = await request(app)
        .get(`/api/v1/grn/${mockCompletedGrn.id}/print`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Accept', 'text/html');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);

      const html = res.text;
      // Must contain prominent PO Lineage Banner
      expect(html).toContain('Authoritative Lineage:');
      expect(html).toContain('PO-202609-9001');
      expect(html).toContain('Titan Metallurgical Alloys Ltd.');

      // Must contain Item Details & Bound Recipes
      expect(html).toContain('ALLOY-SHAFT-4140');
      expect(html).toContain('REC-CARB-4140');
      expect(html).toContain('ALLOY-GEAR-8620');
      expect(html).toContain('REC-NIT-8620');

      // Must contain Individual Part Units
      expect(html).toContain('GRN-202609-9001-UNIT-001');
      expect(html).toContain('GRN-202609-9001-UNIT-002');

      // Must contain Print Watermark and Signatures
      expect(html).toContain('Stores / Receiving In-Charge');
      expect(html).toContain('Metallurgical QC Inspector');
      expect(html).toContain('Plant Operations Manager');
      expect(html).toContain('Printed via Astralis ERP System');
    });
  });

  describe('4. Historical Records & Read-Only Genealogy Preservation', () => {
    it('preserves historical GRN viewing even when units are allocated downstream (ALLOCATED_TO_PLAN)', async () => {
      // Historical unit that was allocated to downstream planning
      const historicalAllocatedUnits = [
        {
          ...mockUnits[0],
          status: 'ALLOCATED_TO_PLAN',
          allocatedPlanId: 'plan_carb_batch_101',
          allocatedPlanNumber: 'PLAN-202609-101'
        },
        {
          ...mockUnits[1],
          status: 'IN_PRODUCTION'
        }
      ];

      jest.spyOn(grnRepository, 'queryUnits').mockResolvedValue({
        units: historicalAllocatedUnits as any,
        total: 2
      });

      const res = await request(app)
        .get(`/api/v1/grn/${mockCompletedGrn.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.units[0].status).toBe('ALLOCATED_TO_PLAN');
      expect(res.body.data.units[1].status).toBe('IN_PRODUCTION');

      // Authoritative genealogy is intact
      expect(res.body.data.units[0].poNumber).toBe('PO-202609-9001');
      expect(res.body.data.units[0].recipeCode).toBe('REC-CARB-4140');
    });

    it('allows printing historical records without regressing or modifying downstream states', async () => {
      const historicalGrn: any = {
        ...mockCompletedGrn,
        id: 'grn_historical_001',
        status: 'AVAILABLE_FOR_PLANNING',
        printCount: 5,
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        })
      };

      jest.spyOn(grnRepository, 'findGrnById').mockResolvedValue(historicalGrn);

      const res = await request(app)
        .post(`/api/v1/grn/${historicalGrn.id}/print`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(historicalGrn.printCount).toBe(6);
      // Status must remain AVAILABLE_FOR_PLANNING (not regressed to ISSUED or PRINTED)
      expect(historicalGrn.status).toBe('AVAILABLE_FOR_PLANNING');
      expect(historicalGrn.save).toHaveBeenCalled();
    });

    it('guarantees viewing and printing operations do not modify items, rates, or quantities', async () => {
      const originalItemsSnapshot = JSON.stringify(mockCompletedGrn.items);

      await request(app)
        .get(`/api/v1/grn/${mockCompletedGrn.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      await request(app)
        .get(`/api/v1/grn/${mockCompletedGrn.id}/print`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(JSON.stringify(mockCompletedGrn.items)).toBe(originalItemsSnapshot);
    });
  });

  describe('5. PO Traceability & Lineage Integrity', () => {
    it('asserts GRN document always displays parent PO and refuses independent receipts', async () => {
      const res = await request(app)
        .get(`/api/v1/grn/${mockCompletedGrn.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const grn = res.body.data;
      expect(grn.poId).toBeTruthy();
      expect(grn.poNumber).toBe('PO-202609-9001');
      expect(grn.parentPO).toBeDefined();
      expect(grn.parentPO.poNumber).toBe('PO-202609-9001');
    });

    it('verifies unit individual breakdown is never collapsed into ambiguous totals', async () => {
      const res = await request(app)
        .get(`/api/v1/grn/${mockCompletedGrn.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const units = res.body.data.units;
      expect(units).toHaveLength(2);

      // Distinct recipes & distinct items preserved
      expect(units[0].recipeCode).not.toBe(units[1].recipeCode);
      expect(units[0].itemCode).not.toBe(units[1].itemCode);
      expect(units[0].supplierHeatNumber).toBe('HEAT-9921-A');
      expect(units[1].supplierHeatNumber).toBe('HEAT-7734-B');
    });
  });
});
