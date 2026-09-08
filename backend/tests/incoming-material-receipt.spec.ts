import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { grnService } from '../src/modules/grn/grn.service.js';
import { grnRepository } from '../src/modules/grn/grn.repository.js';
import { purchaseOrderService } from '../src/modules/purchase-order/purchase-order.service.js';
import { purchaseOrderRepository } from '../src/modules/purchase-order/purchase-order.repository.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { PERMISSIONS, DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { NotFoundError } from '../src/core/errors/app-error.js';

describe('Prompt 4: Authoritative Incoming Material Receipt Suite (Creation Phase)', () => {
  const app = createApp();
  const testTenant = 'tenant_precision_receiving_001';

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
    id: 'po_active_001',
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

  beforeEach(() => {
    jest.spyOn(roleRepository, 'seedDefaultRolesForTenant').mockResolvedValue([] as any);
    jest.spyOn(roleRepository, 'findRolesByCodes').mockImplementation(async (_tenantId, codes) => {
      const defaultMatches = DEFAULT_FACTORY_ROLES.filter((r) => codes.includes(r.code)).map((r) => ({
        ...r,
        id: `role_${r.code}`,
        status: 'active'
      }));

      const customMatches = codes
        .filter((c) => !DEFAULT_FACTORY_ROLES.some((r) => r.code === c))
        .map((c) => ({
          id: `custom_${c}`,
          tenantId: testTenant,
          code: c,
          name: `Custom Role ${c}`,
          permissions: c.includes('RECEIVING_OFFICER')
            ? [PERMISSIONS.INVENTORY_STORAGE_RECORD, PERMISSIONS.PURCHASE_ORDER_VIEW]
            : [],
          status: 'active'
        }));

      return [...defaultMatches, ...customMatches] as any;
    });

    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Authoritative PO as Mandatory Starting Point & PO Status Validation', () => {
    it('should successfully record material receipt against an existing, active PO', async () => {
      const token = generateToken('clerk_01', ['INVENTORY_CLERK']);

      jest.spyOn(purchaseOrderService, 'getOrderById').mockResolvedValue({ ...mockActivePo } as any);
      jest.spyOn(grnRepository, 'generateNextReceiptNumber').mockResolvedValue('RCPT-202609-0001');

      let savedReceiptData: any = null;
      jest.spyOn(grnRepository, 'createReceipt').mockImplementation(async (_t, data) => {
        savedReceiptData = {
          ...data,
          id: 'rcpt_001',
          save: jest.fn().mockResolvedValue(true),
          toJSON: () => data
        };
        return savedReceiptData;
      });

      jest.spyOn(purchaseOrderService, 'recordReceiptProgression').mockResolvedValue({
        ...mockActivePo,
        totalReceivedQuantity: 50,
        status: 'PARTIALLY_RECEIVED'
      } as any);

      const res = await request(app)
        .post('/api/v1/grn/receipts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockActivePo.id,
          supplierChallanNumber: 'CH-2026-9901',
          supplierChallanDate: '2026-09-08',
          carrierVehicle: 'TRUCK-991',
          items: [
            {
              poLineItemId: mockPoLineItem.lineItemId,
              itemId: mockPoLineItem.itemId,
              receivedQuantity: 50,
              supplierHeatNumber: 'HEAT-4140-A99',
              mtrNumber: 'MTR-CERT-881'
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.receiptNumber).toBe('RCPT-202609-0001');
      expect(res.body.data.poNumber).toBe(mockActivePo.poNumber);
      expect(res.body.data.supplierName).toBe(mockActivePo.supplierName);
      expect(res.body.data.status).toBe('RECEIVED');
      expect(res.body.data.items[0].receivedQuantity).toBe(50);
      expect(res.body.data.items[0].supplierHeatNumber).toBe('HEAT-4140-A99');
      expect(res.body.data.items[0].recipeId).toBe(mockPoLineItem.recipeId);
      expect(res.body.data.items[0].recipeRevision).toBe(1);
    });

    it('should reject material receipt when PO ID does not exist', async () => {
      const token = generateToken('clerk_01', ['INVENTORY_CLERK']);
      jest.spyOn(purchaseOrderService, 'getOrderById').mockRejectedValue(
        new NotFoundError("Purchase Order with ID 'po_not_found_001' not found")
      );

      const res = await request(app)
        .post('/api/v1/grn/receipts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: 'po_not_found_001',
          supplierChallanNumber: 'CH-2026-9901',
          supplierChallanDate: '2026-09-08',
          items: [
            {
              itemId: mockPoLineItem.itemId,
              receivedQuantity: 10,
              supplierHeatNumber: 'HEAT-99'
            }
          ]
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('not found');
    });

    it('should reject material receipt when PO is in DRAFT status', async () => {
      const token = generateToken('clerk_01', ['INVENTORY_CLERK']);

      jest.spyOn(purchaseOrderService, 'getOrderById').mockResolvedValue({
        ...mockActivePo,
        status: 'DRAFT'
      } as any);

      const res = await request(app)
        .post('/api/v1/grn/receipts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockActivePo.id,
          supplierChallanNumber: 'CH-2026-9901',
          supplierChallanDate: '2026-09-08',
          items: [
            {
              itemId: mockPoLineItem.itemId,
              receivedQuantity: 10,
              supplierHeatNumber: 'HEAT-99'
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Cannot record material receipt against Purchase Order in 'DRAFT' status");
    });

    it('should reject material receipt when PO is in CLOSED or CANCELLED status', async () => {
      const token = generateToken('clerk_01', ['INVENTORY_CLERK']);

      jest.spyOn(purchaseOrderService, 'getOrderById').mockResolvedValue({
        ...mockActivePo,
        status: 'CANCELLED'
      } as any);

      const res = await request(app)
        .post('/api/v1/grn/receipts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockActivePo.id,
          supplierChallanNumber: 'CH-2026-9901',
          supplierChallanDate: '2026-09-08',
          items: [
            {
              itemId: mockPoLineItem.itemId,
              receivedQuantity: 10,
              supplierHeatNumber: 'HEAT-99'
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Cannot record material receipt against Purchase Order in 'CANCELLED' status");
    });
  });

  describe('2. Server-side Storage Permission Enforcement', () => {
    it('should reject material receipt if user lacks INVENTORY_STORAGE_RECORD permission', async () => {
      // FURNACE_OPERATOR lacks INVENTORY_STORAGE_RECORD
      const token = generateToken('operator_01', ['FURNACE_OPERATOR']);

      const res = await request(app)
        .post('/api/v1/grn/receipts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockActivePo.id,
          supplierChallanNumber: 'CH-2026-9901',
          supplierChallanDate: '2026-09-08',
          items: [
            {
              itemId: mockPoLineItem.itemId,
              receivedQuantity: 10,
              supplierHeatNumber: 'HEAT-99'
            }
          ]
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain(PERMISSIONS.INVENTORY_STORAGE_RECORD);
    });

    it('should allow user with custom role granting INVENTORY_STORAGE_RECORD', async () => {
      const token = generateToken('receiving_officer_01', ['RECEIVING_OFFICER']);

      jest.spyOn(purchaseOrderService, 'getOrderById').mockResolvedValue({ ...mockActivePo } as any);
      jest.spyOn(grnRepository, 'generateNextReceiptNumber').mockResolvedValue('RCPT-202609-0002');
      jest.spyOn(grnRepository, 'createReceipt').mockResolvedValue({
        id: 'rcpt_002',
        receiptNumber: 'RCPT-202609-0002',
        status: 'RECEIVED',
        items: []
      } as any);
      jest.spyOn(purchaseOrderService, 'recordReceiptProgression').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/grn/receipts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockActivePo.id,
          supplierChallanNumber: 'CH-2026-9902',
          supplierChallanDate: '2026-09-08',
          items: [
            {
              poLineItemId: mockPoLineItem.lineItemId,
              itemId: mockPoLineItem.itemId,
              receivedQuantity: 20,
              supplierHeatNumber: 'HEAT-4140-CUSTOM'
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe('3. Supplier Challan & Material Traceability Information', () => {
    it('should reject material receipt when supplierChallanNumber is missing or empty', async () => {
      const token = generateToken('clerk_01', ['INVENTORY_CLERK']);
      jest.spyOn(purchaseOrderService, 'getOrderById').mockResolvedValue({ ...mockActivePo } as any);

      const res = await request(app)
        .post('/api/v1/grn/receipts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockActivePo.id,
          supplierChallanNumber: '   ',
          supplierChallanDate: '2026-09-08',
          items: [
            {
              itemId: mockPoLineItem.itemId,
              receivedQuantity: 10,
              supplierHeatNumber: 'HEAT-99'
            }
          ]
        });

      expect(res.status).toBe(422);

      // Service-level enforcement check
      await expect(
        grnService.recordMaterialReceipt(
          testTenant,
          {
            poId: mockActivePo.id,
            supplierChallanNumber: '   ',
            supplierChallanDate: '2026-09-08',
            items: [{ itemId: mockPoLineItem.itemId, receivedQuantity: 10, supplierHeatNumber: 'HEAT-99' }]
          },
          { userId: 'clerk_01', role: 'INVENTORY_CLERK' }
        )
      ).rejects.toThrow(/Supplier Delivery Challan Number is required/i);
    });

    it('should reject material receipt when supplierHeatNumber is missing on line item', async () => {
      const token = generateToken('clerk_01', ['INVENTORY_CLERK']);
      jest.spyOn(purchaseOrderService, 'getOrderById').mockResolvedValue({ ...mockActivePo } as any);

      const res = await request(app)
        .post('/api/v1/grn/receipts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockActivePo.id,
          supplierChallanNumber: 'CH-2026-9903',
          supplierChallanDate: '2026-09-08',
          items: [
            {
              poLineItemId: mockPoLineItem.lineItemId,
              itemId: mockPoLineItem.itemId,
              receivedQuantity: 10,
              supplierHeatNumber: ''
            }
          ]
        });

      expect(res.status).toBe(422);

      // Service-level enforcement check
      await expect(
        grnService.recordMaterialReceipt(
          testTenant,
          {
            poId: mockActivePo.id,
            supplierChallanNumber: 'CH-2026-9903',
            supplierChallanDate: '2026-09-08',
            items: [{ poLineItemId: mockPoLineItem.lineItemId, itemId: mockPoLineItem.itemId, receivedQuantity: 10, supplierHeatNumber: '' }]
          },
          { userId: 'clerk_01', role: 'INVENTORY_CLERK' }
        )
      ).rejects.toThrow(/Supplier Heat Number is required/i);
    });
  });

  describe('4. PO Reconciliation & Over-delivery Protection', () => {
    it('should reject material receipt for an arbitrary item not present on the PO', async () => {
      const token = generateToken('clerk_01', ['INVENTORY_CLERK']);
      jest.spyOn(purchaseOrderService, 'getOrderById').mockResolvedValue({ ...mockActivePo } as any);

      const res = await request(app)
        .post('/api/v1/grn/receipts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockActivePo.id,
          supplierChallanNumber: 'CH-2026-9904',
          supplierChallanDate: '2026-09-08',
          items: [
            {
              itemId: 'arbitrary_unrelated_item_888',
              receivedQuantity: 10,
              supplierHeatNumber: 'HEAT-99'
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('does not match any line item on Purchase Order');
    });

    it('should reject received quantity exceeding remaining ordered quantity beyond 10% tolerance', async () => {
      const token = generateToken('clerk_01', ['INVENTORY_CLERK']);
      jest.spyOn(purchaseOrderService, 'getOrderById').mockResolvedValue({ ...mockActivePo } as any);

      // Remaining is 100, 10% tolerance is 110. Attempting 120 should fail.
      const res = await request(app)
        .post('/api/v1/grn/receipts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockActivePo.id,
          supplierChallanNumber: 'CH-2026-9905',
          supplierChallanDate: '2026-09-08',
          items: [
            {
              poLineItemId: mockPoLineItem.lineItemId,
              itemId: mockPoLineItem.itemId,
              receivedQuantity: 120,
              supplierHeatNumber: 'HEAT-OVER-01'
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('exceeds remaining ordered quantity');
    });
  });

  describe('5. Multiple / Partial Deliveries Against a PO', () => {
    it('should support multiple partial deliveries and update PO balance without overwriting original PO data', async () => {
      const token = generateToken('clerk_01', ['INVENTORY_CLERK']);

      let currentPo: any = {
        ...mockActivePo,
        items: [{ ...mockPoLineItem, orderedQuantity: 100, receivedQuantity: 0, balanceQuantity: 100 }]
      };

      jest.spyOn(purchaseOrderService, 'getOrderById').mockImplementation(async () => currentPo);
      jest.spyOn(purchaseOrderService, 'recordReceiptProgression').mockImplementation(async (_t, _poId, updates) => {
        const u = Array.isArray(updates) ? updates[0] : { quantity: 0 };
        currentPo.items[0].receivedQuantity += u.quantity;
        currentPo.items[0].balanceQuantity = Math.max(0, currentPo.items[0].orderedQuantity - currentPo.items[0].receivedQuantity);
        currentPo.totalReceivedQuantity += u.quantity;
        currentPo.status = currentPo.totalReceivedQuantity >= currentPo.totalOrderedQuantity ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
        return currentPo;
      });

      // Delivery 1: Receive 40 units
      jest.spyOn(grnRepository, 'generateNextReceiptNumber').mockResolvedValueOnce('RCPT-202609-0010');
      jest.spyOn(grnRepository, 'createReceipt').mockResolvedValueOnce({
        id: 'rcpt_part_01',
        receiptNumber: 'RCPT-202609-0010',
        poId: currentPo.id,
        items: [{ ...mockPoLineItem, receivedQuantity: 40 }]
      } as any);

      const res1 = await request(app)
        .post('/api/v1/grn/receipts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: currentPo.id,
          supplierChallanNumber: 'CH-DELIV-1',
          supplierChallanDate: '2026-09-08',
          items: [{ poLineItemId: mockPoLineItem.lineItemId, itemId: mockPoLineItem.itemId, receivedQuantity: 40, supplierHeatNumber: 'HEAT-PART-1' }]
        });

      expect(res1.status).toBe(201);
      expect(currentPo.items[0].receivedQuantity).toBe(40);
      expect(currentPo.items[0].balanceQuantity).toBe(60);
      expect(currentPo.status).toBe('PARTIALLY_RECEIVED');
      expect(currentPo.items[0].orderedQuantity).toBe(100); // Original data never overwritten!

      // Delivery 2: Receive 60 units (completing the PO)
      jest.spyOn(grnRepository, 'generateNextReceiptNumber').mockResolvedValueOnce('RCPT-202609-0011');
      jest.spyOn(grnRepository, 'createReceipt').mockResolvedValueOnce({
        id: 'rcpt_part_02',
        receiptNumber: 'RCPT-202609-0011',
        poId: currentPo.id,
        items: [{ ...mockPoLineItem, receivedQuantity: 60 }]
      } as any);

      const res2 = await request(app)
        .post('/api/v1/grn/receipts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: currentPo.id,
          supplierChallanNumber: 'CH-DELIV-2',
          supplierChallanDate: '2026-09-09',
          items: [{ poLineItemId: mockPoLineItem.lineItemId, itemId: mockPoLineItem.itemId, receivedQuantity: 60, supplierHeatNumber: 'HEAT-PART-2' }]
        });

      expect(res2.status).toBe(201);
      expect(currentPo.items[0].receivedQuantity).toBe(100);
      expect(currentPo.items[0].balanceQuantity).toBe(0);
      expect(currentPo.status).toBe('RECEIVED');

      // Delivery 3: Attempting any additional delivery exceeding balance should now fail!
      const res3 = await request(app)
        .post('/api/v1/grn/receipts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: currentPo.id,
          supplierChallanNumber: 'CH-DELIV-3',
          supplierChallanDate: '2026-09-10',
          items: [{ poLineItemId: mockPoLineItem.lineItemId, itemId: mockPoLineItem.itemId, receivedQuantity: 10, supplierHeatNumber: 'HEAT-PART-3' }]
        });

      expect(res3.status).toBe(400);
      expect(res3.body.message).toContain('exceeds remaining ordered quantity');
    });
  });

  describe('6. Duplicate Submission & Idempotency Protection', () => {
    it('should return existing receipt without creating duplicate on repeated submission with same idempotencyKey', async () => {
      const token = generateToken('clerk_01', ['INVENTORY_CLERK']);
      const idempotencyKey = 'IDEMP-RCPT-202609-KEY-9999';

      const existingReceipt = {
        id: 'rcpt_idemp_existing',
        receiptNumber: 'RCPT-202609-0099',
        idempotencyKey,
        poId: mockActivePo.id,
        poNumber: mockActivePo.poNumber,
        status: 'RECEIVED',
        items: [{ ...mockPoLineItem, receivedQuantity: 50 }]
      };

      jest.spyOn(purchaseOrderService, 'getOrderById').mockResolvedValue({ ...mockActivePo } as any);
      jest.spyOn(grnRepository, 'findReceiptByIdempotencyKey').mockResolvedValue(existingReceipt as any);
      const createReceiptSpy = jest.spyOn(grnRepository, 'createReceipt');

      const res = await request(app)
        .post('/api/v1/grn/receipts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockActivePo.id,
          idempotencyKey,
          supplierChallanNumber: 'CH-IDEMP-01',
          supplierChallanDate: '2026-09-08',
          items: [{ poLineItemId: mockPoLineItem.lineItemId, itemId: mockPoLineItem.itemId, receivedQuantity: 50, supplierHeatNumber: 'HEAT-IDEMP' }]
        });

      expect(res.status).toBe(201);
      expect(res.body.data.receiptNumber).toBe('RCPT-202609-0099');
      // Verify createReceipt was NOT called again!
      expect(createReceiptSpy).not.toHaveBeenCalled();
    });
  });

  describe('7. Backend Authority: Defense against Client-Supplied Overrides', () => {
    it('should discard client-supplied supplierName, itemCode, and recipe data and derive them authoritatively from the PO', async () => {
      const token = generateToken('clerk_01', ['INVENTORY_CLERK']);

      jest.spyOn(purchaseOrderService, 'getOrderById').mockResolvedValue({ ...mockActivePo } as any);
      jest.spyOn(grnRepository, 'generateNextReceiptNumber').mockResolvedValue('RCPT-202609-0033');

      let savedData: any = null;
      jest.spyOn(grnRepository, 'createReceipt').mockImplementation(async (_t, data) => {
        savedData = {
          ...data,
          id: 'rcpt_auth_01',
          save: jest.fn().mockResolvedValue(true),
          toJSON: () => data
        };
        return savedData;
      });
      jest.spyOn(purchaseOrderService, 'recordReceiptProgression').mockResolvedValue({} as any);

      // Malicious client tries to spoof supplierName and bind a fake recipeCode
      const res = await request(app)
        .post('/api/v1/grn/receipts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockActivePo.id,
          supplierName: 'Malicious Fake Supplier LLC',
          supplierChallanNumber: 'CH-SPOOF-01',
          supplierChallanDate: '2026-09-08',
          items: [
            {
              poLineItemId: mockPoLineItem.lineItemId,
              itemId: mockPoLineItem.itemId,
              receivedQuantity: 30,
              supplierHeatNumber: 'HEAT-SPOOF-99',
              recipeCode: 'FAKER-RECIPE-999',
              recipeRevision: 99
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(savedData.supplierName).toBe('Precision Steel Works Inc.'); // Authoritative from PO!
      expect(savedData.items[0].recipeCode).toBe('REC-CARB-4140'); // Authoritative from PO line!
      expect(savedData.items[0].recipeRevision).toBe(1); // Authoritative from PO line!
    });
  });

  describe('8. Concurrent Receipt Simulation', () => {
    it('should allocate distinct monotonic receipt numbers without collision during concurrent receipts', async () => {
      let counter = 100;
      jest.spyOn(grnRepository, 'generateNextReceiptNumber').mockImplementation(async () => {
        counter += 1;
        return `RCPT-202609-${String(counter).padStart(4, '0')}`;
      });
      jest.spyOn(purchaseOrderService, 'getOrderById').mockResolvedValue({ ...mockActivePo } as any);
      jest.spyOn(grnRepository, 'createReceipt').mockImplementation(async (_t, data) => ({
        ...data,
        id: `rcpt_${data.receiptNumber}`,
        save: jest.fn().mockResolvedValue(true),
        toJSON: () => data
      } as any));
      jest.spyOn(purchaseOrderService, 'recordReceiptProgression').mockResolvedValue({} as any);

      const actor = { userId: 'clerk_01', role: 'INVENTORY_CLERK' };

      const [receipt1, receipt2, receipt3] = await Promise.all([
        grnService.recordMaterialReceipt(
          testTenant,
          {
            poId: mockActivePo.id,
            supplierChallanNumber: 'CH-CONC-1',
            supplierChallanDate: '2026-09-08',
            items: [{ poLineItemId: mockPoLineItem.lineItemId, itemId: mockPoLineItem.itemId, receivedQuantity: 10, supplierHeatNumber: 'HEAT-C1' }]
          },
          actor
        ),
        grnService.recordMaterialReceipt(
          testTenant,
          {
            poId: mockActivePo.id,
            supplierChallanNumber: 'CH-CONC-2',
            supplierChallanDate: '2026-09-08',
            items: [{ poLineItemId: mockPoLineItem.lineItemId, itemId: mockPoLineItem.itemId, receivedQuantity: 15, supplierHeatNumber: 'HEAT-C2' }]
          },
          actor
        ),
        grnService.recordMaterialReceipt(
          testTenant,
          {
            poId: mockActivePo.id,
            supplierChallanNumber: 'CH-CONC-3',
            supplierChallanDate: '2026-09-08',
            items: [{ poLineItemId: mockPoLineItem.lineItemId, itemId: mockPoLineItem.itemId, receivedQuantity: 20, supplierHeatNumber: 'HEAT-C3' }]
          },
          actor
        )
      ]);

      const receiptNumbers = [receipt1.receiptNumber, receipt2.receiptNumber, receipt3.receiptNumber];
      const uniqueNumbers = new Set(receiptNumbers);
      expect(uniqueNumbers.size).toBe(3);
    });
  });
});
