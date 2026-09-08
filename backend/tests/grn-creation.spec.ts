import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { grnService } from '../src/modules/grn/grn.service.js';
import { grnRepository } from '../src/modules/grn/grn.repository.js';
import { purchaseOrderService } from '../src/modules/purchase-order/purchase-order.service.js';
import { warehouseService } from '../src/modules/warehouse/warehouse.service.js';
import { itemService } from '../src/modules/item/item.service.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { PERMISSIONS, DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { NotFoundError } from '../src/core/errors/app-error.js';

describe('Prompt 6: Rebuild GRN Creation Suite (Authoritative PO -> GRN Workflow)', () => {
  const app = createApp();
  const testTenant = 'tenant_grn_rebuild_001';

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const mockPoLineItem1 = {
    lineItemId: 'po_line_001',
    itemId: 'item_alloy_4140',
    itemCode: 'ALLOY-4140-BAR',
    itemName: 'AISI 4140 Round Bar 50mm',
    materialGrade: 'AISI 4140',
    processFamily: 'CARBURIZING',
    recipeId: 'rec_carb_4140',
    recipeCode: 'REC-CARB-4140',
    recipeRevision: 2,
    orderedQuantity: 100,
    receivedQuantity: 0,
    balanceQuantity: 100,
    unitPrice: 85.5,
    lineTotal: 8550.0,
    uom: 'PCS'
  };

  const mockPoLineItem2 = {
    lineItemId: 'po_line_002',
    itemId: 'item_alloy_8620',
    itemCode: 'ALLOY-8620-ROD',
    itemName: 'AISI 8620 Rod 30mm',
    materialGrade: 'AISI 8620',
    processFamily: 'NITRIDING',
    recipeId: 'rec_nit_8620',
    recipeCode: 'REC-NIT-8620',
    recipeRevision: 1,
    orderedQuantity: 50,
    receivedQuantity: 0,
    balanceQuantity: 50,
    unitPrice: 120.0,
    lineTotal: 6000.0,
    uom: 'PCS'
  };

  const mockValidPo = {
    id: 'po_grn_valid_001',
    tenantId: testTenant,
    poNumber: 'PO-202609-0010',
    supplierName: 'Apex Metallurgical Supplies Ltd.',
    supplierCode: 'SUP-APEX-01',
    status: 'ISSUED',
    orderDate: new Date('2026-09-01'),
    expectedDeliveryDate: new Date('2026-09-30'),
    items: [{ ...mockPoLineItem1 }, { ...mockPoLineItem2 }],
    totalOrderedQuantity: 150,
    totalReceivedQuantity: 0,
    currency: 'INR',
    subtotalAmount: 14550,
    taxAmount: 0,
    totalAmount: 14550,
    isDeleted: false,
    toJSON: function () {
      return { ...this };
    }
  };

  const mockStoredReceipt = {
    id: 'rcpt_stored_001',
    tenantId: testTenant,
    receiptNumber: 'RCPT-202609-0001',
    poId: mockValidPo.id,
    poNumber: mockValidPo.poNumber,
    supplierName: mockValidPo.supplierName,
    supplierChallanNumber: 'CH-2026-888',
    supplierChallanDate: new Date('2026-09-05'),
    warehouseId: 'wh_main_01',
    warehouseCode: 'WH-MAIN',
    storageLocationCode: 'BAY-01-A',
    status: 'STORED',
    items: [
      {
        poLineItemId: 'po_line_001',
        itemId: 'item_alloy_4140',
        itemCode: 'ALLOY-4140-BAR',
        itemName: 'AISI 4140 Round Bar 50mm',
        materialGrade: 'AISI 4140',
        processFamily: 'CARBURIZING',
        recipeId: 'rec_carb_4140',
        recipeCode: 'REC-CARB-4140',
        recipeRevision: 2,
        receivedQuantity: 40,
        storedQuantity: 40,
        remainingQuantity: 0,
        uom: 'PCS',
        supplierHeatNumber: 'HEAT-APEX-9921',
        mtrNumber: 'MTR-APEX-001'
      }
    ],
    save: jest.fn().mockResolvedValue(true),
    toJSON: function () {
      return { ...this };
    }
  };

  beforeEach(() => {
    jest.restoreAllMocks();

    // Default RBAC Setup: Store officer role has INVENTORY_GRN_CREATE
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
              PERMISSIONS.INVENTORY_STORAGE_RECORD
            ]
          } as any;
        }
        return { code, permissions: [] } as any;
      });
    });

    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

    // Default PO Service Mock
    jest.spyOn(purchaseOrderService, 'getOrderById').mockImplementation(async (_t, id) => {
      if (id === mockValidPo.id) {
        return JSON.parse(JSON.stringify(mockValidPo)) as any;
      }
      throw new NotFoundError(`Purchase Order with ID '${id}' not found`);
    });

    jest.spyOn(purchaseOrderService, 'recordReceivedMaterial').mockImplementation(async (_t, id, updates) => {
      return {
        ...mockValidPo,
        id,
        totalReceivedQuantity: updates.reduce((sum, u) => sum + u.receivedQuantity, 0),
        status: 'PARTIALLY_RECEIVED'
      } as any;
    });

    // Default Item Master Mock
    jest.spyOn(itemService, 'getItemById').mockImplementation(async (_t, id) => {
      if (id === 'item_alloy_4140') {
        return {
          id: 'item_alloy_4140',
          itemCode: 'ALLOY-4140-BAR',
          name: 'AISI 4140 Round Bar 50mm',
          hsnCode: '722830',
          uom: 'PCS',
          materialGrade: 'AISI 4140'
        } as any;
      }
      if (id === 'item_alloy_8620') {
        return {
          id: 'item_alloy_8620',
          itemCode: 'ALLOY-8620-ROD',
          name: 'AISI 8620 Rod 30mm',
          hsnCode: '722840',
          uom: 'PCS',
          materialGrade: 'AISI 8620'
        } as any;
      }
      throw new NotFoundError(`Item '${id}' not found`);
    });

    // Default Repository Mocks
    jest.spyOn(grnRepository, 'generateNextGrnNumber').mockResolvedValue('GRN-202609-0001');
    jest.spyOn(grnRepository, 'findGrnByIdempotencyKey').mockResolvedValue(null);

    jest.spyOn(grnRepository, 'createGrn').mockImplementation(async (_t, data) => {
      return {
        id: 'grn_saved_001',
        ...data,
        createdAt: new Date(),
        toJSON: function () {
          return { ...this };
        }
      } as any;
    });

    jest.spyOn(grnRepository, 'createGrnUnits').mockImplementation(async (_t, units) => {
      return units.map((u, i) => ({
        id: `unit_doc_${i + 1}`,
        ...u,
        createdAt: new Date()
      })) as any;
    });

    jest.spyOn(grnRepository, 'queryReceipts').mockResolvedValue([mockStoredReceipt as any]);
    jest.spyOn(grnRepository, 'findReceiptById').mockImplementation(async (_t, id) => {
      if (id === mockStoredReceipt.id) return mockStoredReceipt as any;
      return null;
    });
  });

  describe('1. Select PO First (PO Existence & Eligibility)', () => {
    it('should reject GRN creation when no PO is provided', async () => {
      const token = generateToken('stores_001', ['STORE_OFFICER']);

      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toMatch(/Either Purchase Order ID \(poId\) or Material Receipt ID/i);
    });

    it('should reject GRN creation if referenced PO does not exist', async () => {
      const token = generateToken('stores_001', ['STORE_OFFICER']);

      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: 'po_non_existent_999',
          supplierChallanNumber: 'DC-999',
          items: [
            {
              itemId: 'item_alloy_4140',
              challanQuantity: 10,
              receivedQuantity: 10
            }
          ]
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Purchase Order with ID 'po_non_existent_999' not found/i);
    });

    it('should reject GRN creation if PO is in DRAFT status', async () => {
      const token = generateToken('stores_001', ['STORE_OFFICER']);

      jest.spyOn(purchaseOrderService, 'getOrderById').mockResolvedValueOnce({
        ...mockValidPo,
        status: 'DRAFT'
      } as any);

      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockValidPo.id,
          supplierChallanNumber: 'DC-100',
          items: [
            {
              itemId: 'item_alloy_4140',
              challanQuantity: 20,
              receivedQuantity: 20
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/is in 'DRAFT' status and is not eligible for GRN creation/i);
    });

    it('should reject GRN creation if PO is in CLOSED or CANCELLED status', async () => {
      const token = generateToken('stores_001', ['STORE_OFFICER']);

      jest.spyOn(purchaseOrderService, 'getOrderById').mockResolvedValueOnce({
        ...mockValidPo,
        status: 'CANCELLED'
      } as any);

      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockValidPo.id,
          supplierChallanNumber: 'DC-100',
          items: [
            {
              itemId: 'item_alloy_4140',
              challanQuantity: 20,
              receivedQuantity: 20
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/is in 'CANCELLED' status and is not eligible for GRN creation/i);
    });
  });

  describe('2. Authoritative Supplier Derivation (PO -> Supplier -> GRN)', () => {
    it('should derive supplier strictly from PO and ignore any client-supplied supplier override', async () => {
      const token = generateToken('stores_001', ['STORE_OFFICER']);

      const createGrnSpy = jest.spyOn(grnRepository, 'createGrn');

      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockValidPo.id,
          supplierName: 'FRAUDULENT SUPPLIER OVERRIDE INC.', // Client attempting to supply different supplier
          supplierCode: 'SUP-FAKE-99',
          supplierChallanNumber: 'DC-GENUINE-001',
          supplierChallanDate: '2026-09-08',
          items: [
            {
              itemId: 'item_alloy_4140',
              challanQuantity: 25,
              receivedQuantity: 25,
              supplierHeatNumber: 'HEAT-AUTH-77'
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // Verify that createGrn received the authoritative supplier from mockValidPo
      expect(createGrnSpy).toHaveBeenCalled();
      const savedPayload = createGrnSpy.mock.calls[0][1];
      expect(savedPayload.supplierName).toBe('Apex Metallurgical Supplies Ltd.');
      expect(savedPayload.supplierCode).toBe('SUP-APEX-01');
      expect(savedPayload.supplierName).not.toBe('FRAUDULENT SUPPLIER OVERRIDE INC.');
    });
  });

  describe('3. PO Items as GRN Selection Source', () => {
    it('should allow selecting items that belong to the PO', async () => {
      const token = generateToken('stores_001', ['STORE_OFFICER']);

      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockValidPo.id,
          supplierChallanNumber: 'DC-AUTH-001',
          items: [
            {
              itemId: 'item_alloy_4140',
              challanQuantity: 30,
              receivedQuantity: 30,
              supplierHeatNumber: 'HEAT-992'
            },
            {
              itemId: 'item_alloy_8620',
              challanQuantity: 15,
              receivedQuantity: 15,
              supplierHeatNumber: 'HEAT-881'
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(2);
    });

    it('should strictly reject arbitrary Item Master items that do not belong to the selected PO', async () => {
      const token = generateToken('stores_001', ['STORE_OFFICER']);

      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockValidPo.id,
          supplierChallanNumber: 'DC-ARBITRARY-001',
          items: [
            {
              itemId: 'item_unrelated_copper_pipe', // Arbitrary item not on PO
              challanQuantity: 10,
              receivedQuantity: 10
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(
        /does not belong to Purchase Order.*Arbitrary Item Master selection is prohibited/i
      );
    });
  });

  describe('4. Automatically Populate Item Information (HSN, Rate, UOM, Recipe, Grade)', () => {
    it('should authoritatively populate Item Code, Description, HSN Code, Rate, UOM, and Recipe from PO and Item Master', async () => {
      const token = generateToken('stores_001', ['STORE_OFFICER']);
      const createGrnSpy = jest.spyOn(grnRepository, 'createGrn');

      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockValidPo.id,
          supplierChallanNumber: 'DC-AUTO-POP-001',
          items: [
            {
              itemId: 'item_alloy_4140',
              challanQuantity: 20,
              receivedQuantity: 20,
              rate: 999999, // Client tampering with unit price/rate
              hsnCode: 'TAMPERED', // Client tampering with HSN code
              itemCode: 'TAMPERED-CODE',
              uom: 'LTR'
            }
          ]
        });

      expect(res.status).toBe(201);
      const savedPayload = createGrnSpy.mock.calls[0][1];
      const savedItem = savedPayload.items![0];

      // Authoritative fields must come from PO and Item Master, NOT client
      expect(savedItem.itemCode).toBe('ALLOY-4140-BAR');
      expect(savedItem.itemName).toBe('AISI 4140 Round Bar 50mm');
      expect(savedItem.uom).toBe('PCS');
      expect(savedItem.rate).toBe(85.5); // Authoritative rate from PO
      expect(savedItem.hsnCode).toBe('722830'); // Authoritative HSN from Item Master
      expect(savedItem.materialGrade).toBe('AISI 4140');
      expect(savedItem.recipeCode).toBe('REC-CARB-4140');
      expect(savedItem.recipeRevision).toBe(2);
      expect(savedItem.processFamily).toBe('CARBURIZING');
    });
  });

  describe('5. User-Entered Receipt Information & Quantity Validation', () => {
    it('should correctly capture supplier challan number, challan date, challan qty, and received qty', async () => {
      const token = generateToken('stores_001', ['STORE_OFFICER']);
      const createGrnSpy = jest.spyOn(grnRepository, 'createGrn');

      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockValidPo.id,
          supplierChallanNumber: 'CHALLAN-MET-2026-09',
          supplierChallanDate: '2026-09-08',
          items: [
            {
              itemId: 'item_alloy_4140',
              challanQuantity: 40,
              receivedQuantity: 38,
              acceptedQuantity: 38,
              supplierHeatNumber: 'HEAT-7711-A',
              mtrNumber: 'MTR-7711-A'
            }
          ]
        });

      expect(res.status).toBe(201);
      const savedPayload = createGrnSpy.mock.calls[0][1];
      expect(savedPayload.supplierChallanNumber).toBe('CHALLAN-MET-2026-09');
      expect(savedPayload.items![0].challanQuantity).toBe(40);
      expect(savedPayload.items![0].receivedQuantity).toBe(38);
      expect(savedPayload.items![0].acceptedQuantity).toBe(38);
      expect(savedPayload.items![0].supplierHeatNumber).toBe('HEAT-7711-A');
      expect(savedPayload.items![0].mtrNumber).toBe('MTR-7711-A');
    });

    it('should reject receipt when challan quantity is zero or negative', async () => {
      const token = generateToken('stores_001', ['STORE_OFFICER']);

      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockValidPo.id,
          supplierChallanNumber: 'DC-ZERO-001',
          items: [
            {
              itemId: 'item_alloy_4140',
              challanQuantity: 0,
              receivedQuantity: 10
            }
          ]
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toMatch(/Challan quantity must be greater than zero/i);
    });

    it('should reject receipt when received quantity is zero or negative', async () => {
      const token = generateToken('stores_001', ['STORE_OFFICER']);

      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockValidPo.id,
          supplierChallanNumber: 'DC-NEG-001',
          items: [
            {
              itemId: 'item_alloy_4140',
              challanQuantity: 10,
              receivedQuantity: -5
            }
          ]
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toMatch(/Received quantity must be greater than zero/i);
    });
  });

  describe('6. Automatic GRN Number Generation & Immutable Sequential Format', () => {
    it('should automatically generate a system-controlled monotonic sequential GRN number', async () => {
      const token = generateToken('stores_001', ['STORE_OFFICER']);
      jest.spyOn(grnRepository, 'generateNextGrnNumber').mockResolvedValueOnce('GRN-202609-0042');

      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockValidPo.id,
          supplierChallanNumber: 'DC-SEQ-001',
          items: [
            {
              itemId: 'item_alloy_4140',
              challanQuantity: 10,
              receivedQuantity: 10
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.data.grnNumber).toBe('GRN-202609-0042');
    });
  });

  describe('7. Server-Side Authorization Enforcement', () => {
    it('should reject GRN creation for users lacking INVENTORY_GRN_CREATE permission', async () => {
      // User with READONLY / OPERATOR role that lacks INVENTORY_GRN_CREATE
      const token = generateToken('operator_001', ['MACHINE_OPERATOR']);

      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockValidPo.id,
          supplierChallanNumber: 'DC-UNAUTH-001',
          items: [
            {
              itemId: 'item_alloy_4140',
              challanQuantity: 10,
              receivedQuantity: 10
            }
          ]
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/lack.*required permission.*inventory:grn:create/i);
    });

    it('should capture authorized receivedBy and inspectedBy without trusting client forgery', async () => {
      const token = generateToken('stores_officer_42', ['STORE_OFFICER']);
      const createGrnSpy = jest.spyOn(grnRepository, 'createGrn');

      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockValidPo.id,
          supplierChallanNumber: 'DC-AUTH-CAPTURE-001',
          receivedBy: 'FORGED_RECEIVER_99', // Client attempting to forge receiver
          inspectedBy: 'qc_inspector_12',
          approvedBy: 'plant_manager_01',
          items: [
            {
              itemId: 'item_alloy_4140',
              challanQuantity: 10,
              receivedQuantity: 10
            }
          ]
        });

      expect(res.status).toBe(201);
      const savedPayload = createGrnSpy.mock.calls[0][1];
      expect(savedPayload.receivedBy).toBe('stores_officer_42'); // Server authenticated actor ID
      expect(savedPayload.inspectedBy).toBe('qc_inspector_12');
      expect(savedPayload.approvedBy).toBe('plant_manager_01');
    });
  });

  describe('8. Multiple GRNs Against One PO (Partial & Progressive Deliveries)', () => {
    it('should support multiple independently identifiable GRNs against one PO and update PO progression', async () => {
      const token = generateToken('stores_001', ['STORE_OFFICER']);
      const recordReceivedSpy = jest.spyOn(purchaseOrderService, 'recordReceivedMaterial');

      // Delivery 1: 40 pcs of item 1
      jest.spyOn(grnRepository, 'generateNextGrnNumber').mockResolvedValueOnce('GRN-202609-0001');
      const res1 = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockValidPo.id,
          supplierChallanNumber: 'DC-DELIV-001',
          items: [
            {
              itemId: 'item_alloy_4140',
              challanQuantity: 40,
              receivedQuantity: 40
            }
          ]
        });

      expect(res1.status).toBe(201);
      expect(res1.body.data.grnNumber).toBe('GRN-202609-0001');
      expect(res1.body.data.poId).toBe(mockValidPo.id);
      expect(recordReceivedSpy).toHaveBeenCalledWith(
        testTenant,
        mockValidPo.id,
        expect.arrayContaining([expect.objectContaining({ receivedQuantity: 40 })])
      );

      // Delivery 2: 60 pcs of item 1 (completing ordered qty for item 1)
      jest.spyOn(grnRepository, 'generateNextGrnNumber').mockResolvedValueOnce('GRN-202609-0002');
      const res2 = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockValidPo.id,
          supplierChallanNumber: 'DC-DELIV-002',
          items: [
            {
              itemId: 'item_alloy_4140',
              challanQuantity: 60,
              receivedQuantity: 60
            }
          ]
        });

      expect(res2.status).toBe(201);
      expect(res2.body.data.grnNumber).toBe('GRN-202609-0002');
      expect(res2.body.data.poId).toBe(mockValidPo.id);

      // Both GRNs are independently identifiable and point to the same PO
      expect(res1.body.data.grnNumber).not.toBe(res2.body.data.grnNumber);
      expect(res1.body.data.poNumber).toBe(res2.body.data.poNumber);
    });
  });

  describe('9. Duplicate Submission & Idempotency Protection', () => {
    it('should return existing GRN without duplicate creation when submitted with identical idempotencyKey', async () => {
      const token = generateToken('stores_001', ['STORE_OFFICER']);
      const idempotencyKey = 'IDEMP-GRN-REQ-9921';

      const existingGrnMock = {
        id: 'grn_existing_99',
        tenantId: testTenant,
        grnNumber: 'GRN-202609-0099',
        idempotencyKey,
        poId: mockValidPo.id,
        poNumber: mockValidPo.poNumber,
        supplierName: mockValidPo.supplierName,
        totalUnitsGenerated: 20,
        status: 'AVAILABLE_FOR_PLANNING',
        items: []
      };

      // Mock that first call creates it, second call finds it
      jest.spyOn(grnRepository, 'findGrnByIdempotencyKey')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingGrnMock as any);

      // First submission
      const res1 = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockValidPo.id,
          idempotencyKey,
          supplierChallanNumber: 'DC-IDEMP-01',
          items: [
            {
              itemId: 'item_alloy_4140',
              challanQuantity: 20,
              receivedQuantity: 20
            }
          ]
        });

      expect(res1.status).toBe(201);

      // Second identical submission
      const res2 = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockValidPo.id,
          idempotencyKey,
          supplierChallanNumber: 'DC-IDEMP-01',
          items: [
            {
              itemId: 'item_alloy_4140',
              challanQuantity: 20,
              receivedQuantity: 20
            }
          ]
        });

      expect(res2.status).toBe(201);
      expect(res2.body.data.grnNumber).toBe('GRN-202609-0099');
    });
  });
});
