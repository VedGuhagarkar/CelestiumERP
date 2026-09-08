import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { purchaseOrderService } from '../src/modules/purchase-order/purchase-order.service.js';
import { grnService } from '../src/modules/grn/grn.service.js';
import { purchaseOrderRepository } from '../src/modules/purchase-order/purchase-order.repository.js';
import { grnRepository } from '../src/modules/grn/grn.repository.js';
import { itemService } from '../src/modules/item/item.service.js';
import { recipeService } from '../src/modules/recipe/recipe.service.js';
import { warehouseService } from '../src/modules/warehouse/warehouse.service.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';

describe('Creation Phase Reconstruction: PO -> Receipt -> Storage -> GRN -> Units -> Planning', () => {
  const app = createApp();
  const testTenant = 'tenant_aerospace_forge_001';

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const mockItem = {
    id: 'item_pinion_001',
    tenantId: testTenant,
    itemCode: 'GEAR-PIN-4140',
    name: 'Helical Pinion Gear 4140',
    materialGrade: 'AISI 4140',
    category: 'RAW_MATERIAL',
    uom: 'PCS',
    status: 'active'
  };

  const mockRecipe = {
    id: 'rec_carb_4140',
    tenantId: testTenant,
    recipeCode: 'REC-CARB-4140-A',
    revision: 1,
    processFamily: 'CARBURIZING',
    applicableMaterialGrades: ['AISI 4140', 'EN19'],
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    machineRequirements: {
      compatibleFurnaceTypes: ['SEALED_QUENCH_FURNACE']
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
    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Purchase Order Creation (Initial Step of Creation Phase)', () => {
    it('should forbid unauthorized users from creating Purchase Orders', async () => {
      const token = generateToken('user_operator', ['FURNACE_OPERATOR']);

      const response = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          supplierName: 'Precision Steel Mills Ltd',
          expectedDeliveryDate: '2026-10-01',
          items: [{ itemId: mockItem.id, recipeId: mockRecipe.id, orderedQuantity: 50 }]
        });

      expect(response.status).toBe(403);
    });

    it('should reject PO creation if referenced Recipe is not compatible with Item material grade', async () => {
      jest.spyOn(itemService, 'getItemById').mockResolvedValue(mockItem as any);
      jest.spyOn(recipeService, 'getRecipeById').mockResolvedValue({
        ...mockRecipe,
        applicableMaterialGrades: ['STAINLESS_316'] // Incompatible with AISI 4140
      } as any);

      await expect(
        purchaseOrderService.createOrder(
          testTenant,
          {
            supplierName: 'Precision Steel Mills Ltd',
            expectedDeliveryDate: '2026-10-01',
            items: [{ itemId: mockItem.id, recipeId: mockRecipe.id, orderedQuantity: 50 }]
          },
          { userId: 'mgr_001', role: 'PLANT_MANAGER' }
        )
      ).rejects.toThrow(/not compatible with Recipe/i);
    });

    it('should create PO with authoritative monotonic ID, items, and bound Recipe', async () => {
      const token = generateToken('mgr_001', ['PLANT_MANAGER']);

      const mockCreatedPO = {
        id: 'po_test_001',
        tenantId: testTenant,
        poNumber: 'PO-202609-0001',
        supplierName: 'Precision Steel Mills Ltd',
        status: 'ISSUED',
        items: [{
          lineItemId: 'line_1_123',
          itemId: mockItem.id,
          itemCode: mockItem.itemCode,
          itemName: mockItem.name,
          recipeId: mockRecipe.id,
          recipeCode: mockRecipe.recipeCode,
          processFamily: mockRecipe.processFamily,
          orderedQuantity: 50,
          receivedQuantity: 0,
          uom: 'PCS'
        }],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      jest.spyOn(purchaseOrderService, 'createOrder').mockResolvedValue(mockCreatedPO as any);

      const response = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          supplierName: 'Precision Steel Mills Ltd',
          supplierCode: 'SUP-PREC-01',
          expectedDeliveryDate: '2026-10-01',
          items: [{
            itemId: mockItem.id,
            recipeId: mockRecipe.id,
            orderedQuantity: 50,
            unitPrice: 150
          }]
        });

      expect(response.status).toBe(201);
      expect(response.body.data.poNumber).toBe('PO-202609-0001');
      expect(response.body.data.items[0].recipeId).toBe(mockRecipe.id);
      expect(response.body.data.items[0].itemCode).toBe('GEAR-PIN-4140');
    });
  });

  describe('2. Material Receipt & Warehouse Storage', () => {
    const mockPO = {
      id: 'po_test_001',
      tenantId: testTenant,
      poNumber: 'PO-202609-0001',
      supplierName: 'Precision Steel Mills Ltd',
      status: 'ISSUED',
      items: [{
        lineItemId: 'line_1_123',
        itemId: mockItem.id,
        itemCode: mockItem.itemCode,
        itemName: mockItem.name,
        recipeId: mockRecipe.id,
        recipeCode: mockRecipe.recipeCode,
        processFamily: mockRecipe.processFamily,
        orderedQuantity: 50,
        receivedQuantity: 0,
        uom: 'PCS'
      }]
    };

    it('should reject material receipt without STORAGE_RECORD permission', async () => {
      const token = generateToken('user_operator', ['FURNACE_OPERATOR']);

      const response = await request(app)
        .post('/api/v1/grn/receipts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockPO.id,
          supplierChallanNumber: 'CH-88219',
          items: [{
            poLineItemId: 'line_1_123',
            itemId: mockItem.id,
            receivedQuantity: 50,
            supplierHeatNumber: 'HEAT-9921'
          }]
        });

      expect(response.status).toBe(403);
    });

    it('should record incoming material receipt strictly tied to valid PO', async () => {
      const token = generateToken('clerk_001', ['INVENTORY_CLERK']);

      const mockReceipt = {
        id: 'mr_001',
        tenantId: testTenant,
        receiptNumber: 'REC-202609-0001',
        poId: mockPO.id,
        poNumber: mockPO.poNumber,
        supplierChallanNumber: 'CH-88219',
        supplierInvoiceNumber: 'INV-4412',
        carrierVehicle: 'MH-12-AB-1234',
        status: 'RECEIVED',
        items: [{
          poLineItemId: 'line_1_123',
          itemId: mockItem.id,
          itemCode: mockItem.itemCode,
          itemName: mockItem.name,
          recipeId: mockRecipe.id,
          recipeCode: mockRecipe.recipeCode,
          receivedQuantity: 50,
          uom: 'PCS',
          supplierHeatNumber: 'HEAT-9921',
          mtrNumber: 'MTR-CERT-019'
        }],
        receivedBy: 'clerk_001',
        createdAt: new Date()
      };

      jest.spyOn(grnService, 'recordMaterialReceipt').mockResolvedValue(mockReceipt as any);

      const response = await request(app)
        .post('/api/v1/grn/receipts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockPO.id,
          supplierChallanNumber: 'CH-88219',
          supplierInvoiceNumber: 'INV-4412',
          carrierVehicle: 'MH-12-AB-1234',
          items: [{
            poLineItemId: 'line_1_123',
            itemId: mockItem.id,
            receivedQuantity: 50,
            supplierHeatNumber: 'HEAT-9921',
            mtrNumber: 'MTR-CERT-019'
          }]
        });

      expect(response.status).toBe(201);
      expect(response.body.data.receiptNumber).toBe('REC-202609-0001');
      expect(response.body.data.poNumber).toBe('PO-202609-0001');
      expect(response.body.data.items[0].recipeId).toBe(mockRecipe.id);
    });

    it('should assign warehouse storage location to received material', async () => {
      const token = generateToken('clerk_001', ['INVENTORY_CLERK']);
      const storedReceipt = {
        id: 'mr_001',
        tenantId: testTenant,
        receiptNumber: 'REC-202609-0001',
        status: 'STORED',
        warehouseId: 'wh_001',
        warehouseCode: 'WH-MAIN',
        storageLocationCode: 'WH-BAY-03-BIN-A2'
      };

      jest.spyOn(grnService, 'storeMaterialInWarehouse').mockResolvedValue(storedReceipt as any);

      const response = await request(app)
        .post('/api/v1/grn/receipts/mr_001/store')
        .set('Authorization', `Bearer ${token}`)
        .send({
          warehouseId: 'wh_001',
          storageLocationCode: 'WH-BAY-03-BIN-A2',
          storageNotes: 'Stored in Rack A2'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('STORED');
      expect(response.body.data.storageLocationCode).toBe('WH-BAY-03-BIN-A2');
    });
  });

  describe('3. Goods Receipt Note (GRN) & Identifiable Units Generation', () => {
    const mockStoredReceipt = {
      id: 'mr_001',
      tenantId: testTenant,
      receiptNumber: 'REC-202609-0001',
      poId: 'po_test_001',
      poNumber: 'PO-202609-0001',
      status: 'STORED',
      warehouseId: 'wh_001',
      warehouseCode: 'WH-MAIN',
      storageLocationCode: 'WH-BAY-03-BIN-A2',
      items: [{
        poLineItemId: 'line_1_123',
        itemId: mockItem.id,
        itemCode: mockItem.itemCode,
        itemName: mockItem.name,
        materialGrade: mockItem.materialGrade,
        processFamily: mockRecipe.processFamily,
        recipeId: mockRecipe.id,
        recipeCode: mockRecipe.recipeCode,
        recipeRevision: 1,
        receivedQuantity: 50,
        uom: 'PCS',
        supplierHeatNumber: 'HEAT-9921',
        mtrNumber: 'MTR-CERT-019',
        storageLocationCode: 'WH-BAY-03-BIN-A2'
      }]
    };

    it('should reject GRN creation if material is not stored in warehouse yet', async () => {
      jest.spyOn(grnRepository, 'findReceiptById').mockResolvedValue({
        ...mockStoredReceipt,
        status: 'RECEIVED' // Not STORED
      } as any);

      await expect(
        grnService.createGRN(
          testTenant,
          { materialReceiptId: mockStoredReceipt.id },
          { userId: 'qc_001', role: 'QC_INSPECTOR' }
        )
      ).rejects.toThrow(/Material must be stored in the warehouse first/i);
    });

    it('should create GRN strictly tied 1:1 to PO and generate individual identifiable units', async () => {
      const token = generateToken('qc_001', ['QC_INSPECTOR']);

      const mockSavedGRN = {
        id: 'grn_001',
        tenantId: testTenant,
        grnNumber: 'GRN-202609-0001',
        poId: mockStoredReceipt.poId,
        poNumber: mockStoredReceipt.poNumber,
        materialReceiptId: mockStoredReceipt.id,
        materialReceiptNumber: mockStoredReceipt.receiptNumber,
        items: [{
          ...mockStoredReceipt.items[0],
          unitIdentifiers: Array.from({ length: 50 }, (_, i) => `UNIT-GRN-202609-0001-${String(i + 1).padStart(3, '0')}`)
        }],
        status: 'ISSUED',
        createdAt: new Date()
      };

      jest.spyOn(grnService, 'createGRN').mockResolvedValue(mockSavedGRN as any);

      const response = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send({
          materialReceiptId: mockStoredReceipt.id,
          remarks: 'Visual and spectro chemistry verified 100%'
        });

      expect(response.status).toBe(201);
      expect(response.body.data.grnNumber).toBe('GRN-202609-0001');
      expect(response.body.data.poId).toBe('po_test_001');
      expect(response.body.data.items[0].unitIdentifiers.length).toBe(50);
    });

    it('should generate printable GRN payload with complete lineage for authorized users', async () => {
      const token = generateToken('qc_001', ['QC_INSPECTOR']);

      const mockPrintPayload = {
        grn: {
          id: 'grn_001',
          grnNumber: 'GRN-202609-0001',
          poNumber: 'PO-202609-0001',
          supplierName: 'Precision Steel Mills Ltd',
          grnDate: new Date(),
          status: 'ISSUED',
          warehouseCode: 'WH-MAIN',
          storageLocationCode: 'WH-BAY-03-BIN-A2',
          lineageStatus: 'VERIFIED_100_PERCENT'
        },
        htmlReport: '<html><body>ASTRALIS ERP — OFFICIAL GOODS RECEIPT NOTE (GRN)</body></html>'
      };

      jest.spyOn(grnService, 'generatePrintableGRN').mockResolvedValue(mockPrintPayload as any);

      const response = await request(app)
        .get('/api/v1/grn/grn_001/print')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.grn.grnNumber).toBe('GRN-202609-0001');
      expect(response.body.data.grn.poNumber).toBe('PO-202609-0001');
      expect(response.body.data.grn.supplierName).toBe('Precision Steel Mills Ltd');
      expect(response.body.data.htmlReport).toContain('GOODS RECEIPT NOTE');
    });
  });

  describe('4. Available for Planning Gate & Lineage Verification', () => {
    it('should query available units for planning filtered by Item and Recipe', async () => {
      const mockUnits = [
        {
          id: 'u_01',
          tenantId: testTenant,
          unitIdentifier: 'UNIT-GRN-202609-0001-001',
          poId: 'po_test_001',
          poNumber: 'PO-202609-0001',
          grnId: 'grn_001',
          grnNumber: 'GRN-202609-0001',
          itemId: mockItem.id,
          itemCode: mockItem.itemCode,
          recipeId: mockRecipe.id,
          recipeCode: mockRecipe.recipeCode,
          status: 'AVAILABLE_FOR_PLANNING',
          quantity: 1,
          uom: 'PCS'
        }
      ];

      jest.spyOn(grnService, 'getAvailableUnitsForPlanning').mockResolvedValue(mockUnits as any);

      const available = await grnService.getAvailableUnitsForPlanning(testTenant, mockItem.id, mockRecipe.id);
      expect(available.length).toBe(1);
      expect(available[0].poNumber).toBe('PO-202609-0001');
      expect(available[0].grnNumber).toBe('GRN-202609-0001');
      expect(available[0].recipeId).toBe(mockRecipe.id);
      expect(available[0].status).toBe('AVAILABLE_FOR_PLANNING');
    });
  });
});
