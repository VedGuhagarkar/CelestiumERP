import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { purchaseOrderService } from '../src/modules/purchase-order/purchase-order.service.js';
import { purchaseOrderRepository } from '../src/modules/purchase-order/purchase-order.repository.js';
import { itemService } from '../src/modules/item/item.service.js';
import { recipeService } from '../src/modules/recipe/recipe.service.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { PERMISSIONS, DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { grnService } from '../src/modules/grn/grn.service.js';
import { grnRepository } from '../src/modules/grn/grn.repository.js';

describe('Authoritative Purchase Order Creation Suite (Creation Phase)', () => {
  const app = createApp();
  const testTenant = 'tenant_precision_aerospace_001';

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
    machineRequirements: {
      compatibleFurnaceTypes: ['SEALED_QUENCH_FURNACE']
    }
  };

  beforeEach(() => {
    jest.spyOn(roleRepository, 'seedDefaultRolesForTenant').mockResolvedValue([] as any);
    jest.spyOn(roleRepository, 'findRolesByCodes').mockImplementation(async (_tenantId, codes) => {
      // Support custom dynamic roles as well as default factory roles
      const defaultMatches = DEFAULT_FACTORY_ROLES.filter((r) => codes.includes(r.code)).map((r) => ({
        ...r,
        id: `role_${r.code}`,
        status: 'active'
      }));

      // If custom role is queried, dynamically grant permissions based on code name
      const customMatches = codes
        .filter((c) => !DEFAULT_FACTORY_ROLES.some((r) => r.code === c))
        .map((c) => ({
          id: `custom_${c}`,
          tenantId: testTenant,
          code: c,
          name: `Custom Role ${c}`,
          permissions: c.includes('PO_CREATOR') ? [PERMISSIONS.PURCHASE_ORDER_CREATE, PERMISSIONS.PURCHASE_ORDER_VIEW] : [],
          status: 'active'
        }));

      return [...defaultMatches, ...customMatches] as any;
    });

    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Dynamic RBAC Authorization Gates', () => {
    it('should allow authorized user with dynamic PURCHASE_ORDER_CREATE permission to create a PO', async () => {
      jest.spyOn(itemService, 'getItemById').mockResolvedValue(mockItem as any);
      jest.spyOn(recipeService, 'getRecipeById').mockResolvedValue(mockRecipe as any);

      const inMemoryPoStore: any[] = [];
      jest.spyOn(purchaseOrderRepository, 'generateNextPoNumber').mockImplementation(async () => 'PO-202609-0001');
      jest.spyOn(purchaseOrderRepository, 'create').mockImplementation(async (_tenantId: string, data: any) => {
        const doc = { ...data, _id: 'po_doc_101', id: 'po_doc_101', createdAt: new Date(), updatedAt: new Date() };
        inMemoryPoStore.push(doc);
        return doc;
      });

      // Token with custom dynamic role that contains PURCHASE_ORDER_CREATE
      const token = generateToken('user_procurement_agent', ['CUSTOM_PO_CREATOR']);

      const response = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          supplierName: 'Precision Steel Mills Ltd',
          currency: 'USD',
          paymentTerms: 'NET_30',
          deliveryTerms: 'FOB Destination',
          expectedDeliveryDate: '2026-10-15',
          items: [
            {
              itemId: mockItem.id,
              recipeId: mockRecipe.id,
              orderedQuantity: 100,
              unitPrice: 24.50,
              processingRequirement: 'Pre-annealed and carburized per AMS 2759'
            }
          ]
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.poNumber).toBe('PO-202609-0001');
      expect(response.body.data.currency).toBe('USD');
      expect(response.body.data.subtotalAmount).toBe(2450); // 100 * 24.50
      expect(response.body.data.items[0].processingRequirement).toBe('Pre-annealed and carburized per AMS 2759');
    });

    it('should reject unauthorized user lacking PURCHASE_ORDER_CREATE with 403 Forbidden', async () => {
      // User with FURNACE_OPERATOR role lacking PURCHASE_ORDER_CREATE
      const token = generateToken('user_operator_9', ['FURNACE_OPERATOR']);

      const response = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          supplierName: 'Precision Steel Mills Ltd',
          expectedDeliveryDate: '2026-10-15',
          items: [{ itemId: mockItem.id, recipeId: mockRecipe.id, orderedQuantity: 50 }]
        });

      expect(response.status).toBe(403);
    });

    it('should reject user with no assigned roles with 403 Forbidden at the service level', async () => {
      await expect(
        purchaseOrderService.createOrder(
          testTenant,
          {
            supplierName: 'Precision Steel Mills Ltd',
            expectedDeliveryDate: '2026-10-15',
            items: [{ itemId: mockItem.id, recipeId: mockRecipe.id, orderedQuantity: 50 }]
          },
          { userId: 'user_anonymous', roles: [] }
        )
      ).rejects.toThrow(/Access Denied/);
    });
  });

  describe('2. Authoritative Item Master & Recipe Binding', () => {
    it('should reject PO creation if referenced Item does not exist in Item Master', async () => {
      jest.spyOn(itemService, 'getItemById').mockResolvedValue(null);

      await expect(
        purchaseOrderService.createOrder(
          testTenant,
          {
            supplierName: 'Precision Steel Mills Ltd',
            expectedDeliveryDate: '2026-10-15',
            items: [{ itemId: 'item_non_existent', recipeId: mockRecipe.id, orderedQuantity: 50 }]
          },
          { userId: 'user_mgr', roles: ['PLANT_MANAGER'] }
        )
      ).rejects.toThrow(/not found in Item Master/);
    });

    it('should reject PO creation if referenced Item is inactive', async () => {
      jest.spyOn(itemService, 'getItemById').mockResolvedValue({
        ...mockItem,
        status: 'obsolete'
      } as any);

      await expect(
        purchaseOrderService.createOrder(
          testTenant,
          {
            supplierName: 'Precision Steel Mills Ltd',
            expectedDeliveryDate: '2026-10-15',
            items: [{ itemId: mockItem.id, recipeId: mockRecipe.id, orderedQuantity: 50 }]
          },
          { userId: 'user_mgr', roles: ['PLANT_MANAGER'] }
        )
      ).rejects.toThrow(/Only active items are permitted/);
    });

    it('should reject PO creation if referenced Recipe does not exist', async () => {
      jest.spyOn(itemService, 'getItemById').mockResolvedValue(mockItem as any);
      jest.spyOn(recipeService, 'getRecipeById').mockResolvedValue(null);

      await expect(
        purchaseOrderService.createOrder(
          testTenant,
          {
            supplierName: 'Precision Steel Mills Ltd',
            expectedDeliveryDate: '2026-10-15',
            items: [{ itemId: mockItem.id, recipeId: 'recipe_phantom', orderedQuantity: 50 }]
          },
          { userId: 'user_mgr', roles: ['PLANT_MANAGER'] }
        )
      ).rejects.toThrow(/not found in Recipe Master/);
    });

    it('should reject PO creation if Recipe is not approved', async () => {
      jest.spyOn(itemService, 'getItemById').mockResolvedValue(mockItem as any);
      jest.spyOn(recipeService, 'getRecipeById').mockResolvedValue({
        ...mockRecipe,
        status: 'PENDING_APPROVAL'
      } as any);

      await expect(
        purchaseOrderService.createOrder(
          testTenant,
          {
            supplierName: 'Precision Steel Mills Ltd',
            expectedDeliveryDate: '2026-10-15',
            items: [{ itemId: mockItem.id, recipeId: mockRecipe.id, orderedQuantity: 50 }]
          },
          { userId: 'user_mgr', roles: ['PLANT_MANAGER'] }
        )
      ).rejects.toThrow(/Only APPROVED or ACTIVE recipes are permitted/);
    });

    it('should reject PO creation if Recipe is metallurgically incompatible with Item material grade', async () => {
      jest.spyOn(itemService, 'getItemById').mockResolvedValue(mockItem as any); // AISI 4140
      jest.spyOn(recipeService, 'getRecipeById').mockResolvedValue({
        ...mockRecipe,
        applicableMaterialGrades: ['INCONEL_718', 'TITANIUM_6AL4V'] // Mismatch
      } as any);

      await expect(
        purchaseOrderService.createOrder(
          testTenant,
          {
            supplierName: 'Precision Steel Mills Ltd',
            expectedDeliveryDate: '2026-10-15',
            items: [{ itemId: mockItem.id, recipeId: mockRecipe.id, orderedQuantity: 50 }]
          },
          { userId: 'user_mgr', roles: ['PLANT_MANAGER'] }
        )
      ).rejects.toThrow(/is not compatible with Recipe/);
    });
  });

  describe('3. Validation of Mandatory Fields & Commercial Quantities', () => {
    it('should reject PO with expected delivery date earlier than order date', async () => {
      jest.spyOn(itemService, 'getItemById').mockResolvedValue(mockItem as any);
      jest.spyOn(recipeService, 'getRecipeById').mockResolvedValue(mockRecipe as any);

      await expect(
        purchaseOrderService.createOrder(
          testTenant,
          {
            supplierName: 'Precision Steel Mills Ltd',
            orderDate: '2026-10-20',
            expectedDeliveryDate: '2026-10-10', // Before orderDate!
            items: [{ itemId: mockItem.id, recipeId: mockRecipe.id, orderedQuantity: 50 }]
          },
          { userId: 'user_mgr', roles: ['PLANT_MANAGER'] }
        )
      ).rejects.toThrow(/Expected delivery date cannot precede order date/);
    });

    it('should reject PO with empty line items array', async () => {
      await expect(
        purchaseOrderService.createOrder(
          testTenant,
          {
            supplierName: 'Precision Steel Mills Ltd',
            expectedDeliveryDate: '2026-10-15',
            items: []
          },
          { userId: 'user_mgr', roles: ['PLANT_MANAGER'] }
        )
      ).rejects.toThrow(/At least one item must be included/);
    });

    it('should reject PO with non-positive ordered quantity', async () => {
      jest.spyOn(itemService, 'getItemById').mockResolvedValue(mockItem as any);
      jest.spyOn(recipeService, 'getRecipeById').mockResolvedValue(mockRecipe as any);

      await expect(
        purchaseOrderService.createOrder(
          testTenant,
          {
            supplierName: 'Precision Steel Mills Ltd',
            expectedDeliveryDate: '2026-10-15',
            items: [{ itemId: mockItem.id, recipeId: mockRecipe.id, orderedQuantity: 0 }]
          },
          { userId: 'user_mgr', roles: ['PLANT_MANAGER'] }
        )
      ).rejects.toThrow(/must be greater than zero/);
    });

    it('should reject PO with negative unit price', async () => {
      jest.spyOn(itemService, 'getItemById').mockResolvedValue(mockItem as any);
      jest.spyOn(recipeService, 'getRecipeById').mockResolvedValue(mockRecipe as any);

      await expect(
        purchaseOrderService.createOrder(
          testTenant,
          {
            supplierName: 'Precision Steel Mills Ltd',
            expectedDeliveryDate: '2026-10-15',
            items: [{ itemId: mockItem.id, recipeId: mockRecipe.id, orderedQuantity: 10, unitPrice: -5 }]
          },
          { userId: 'user_mgr', roles: ['PLANT_MANAGER'] }
        )
      ).rejects.toThrow(/cannot be negative/);
    });
  });

  describe('4. Idempotency & Duplicate Submission Prevention', () => {
    it('should return existing PO without re-creating when same idempotencyKey is submitted', async () => {
      jest.spyOn(itemService, 'getItemById').mockResolvedValue(mockItem as any);
      jest.spyOn(recipeService, 'getRecipeById').mockResolvedValue(mockRecipe as any);

      let creationCount = 0;
      const idempotencyMap = new Map<string, any>();

      jest.spyOn(purchaseOrderRepository, 'findByIdempotencyKey').mockImplementation(async (_t, key) => {
        return idempotencyMap.get(key) || null;
      });

      jest.spyOn(purchaseOrderRepository, 'generateNextPoNumber').mockResolvedValue('PO-202609-0099');
      jest.spyOn(purchaseOrderRepository, 'create').mockImplementation(async (_t: string, data: any) => {
        creationCount++;
        const doc = { ...data, _id: 'po_idemp_1', id: 'po_idemp_1', createdAt: new Date() };
        if (data.idempotencyKey) {
          idempotencyMap.set(data.idempotencyKey, doc);
        }
        return doc;
      });

      const poPayload = {
        supplierName: 'Precision Steel Mills Ltd',
        expectedDeliveryDate: '2026-10-15',
        idempotencyKey: 'idem_key_uuid_7777',
        items: [{ itemId: mockItem.id, recipeId: mockRecipe.id, orderedQuantity: 50, unitPrice: 30 }]
      };

      // First submission
      const firstResult = await purchaseOrderService.createOrder(testTenant, poPayload, {
        userId: 'user_mgr',
        roles: ['PLANT_MANAGER']
      });

      expect(creationCount).toBe(1);
      expect(firstResult.poNumber).toBe('PO-202609-0099');

      // Duplicate submission with same idempotencyKey
      const secondResult = await purchaseOrderService.createOrder(testTenant, poPayload, {
        userId: 'user_mgr',
        roles: ['PLANT_MANAGER']
      });

      // Assert that repository create was NOT called again
      expect(creationCount).toBe(1);
      expect(secondResult.id).toBe(firstResult.id);
      expect(secondResult.poNumber).toBe(firstResult.poNumber);
    });
  });

  describe('5. Concurrent Creation & Monotonic Collision-Free Numbering', () => {
    it('should generate monotonic sequential PO numbers concurrently without collision', async () => {
      jest.spyOn(itemService, 'getItemById').mockResolvedValue(mockItem as any);
      jest.spyOn(recipeService, 'getRecipeById').mockResolvedValue(mockRecipe as any);

      let atomicSequence = 0;
      jest.spyOn(purchaseOrderRepository, 'generateNextPoNumber').mockImplementation(async () => {
        atomicSequence++;
        return `PO-202609-${String(atomicSequence).padStart(4, '0')}`;
      });

      const savedPOs: any[] = [];
      jest.spyOn(purchaseOrderRepository, 'create').mockImplementation(async (_t: string, data: any) => {
        const doc = { ...data, _id: `po_${data.poNumber}`, id: `po_${data.poNumber}` };
        savedPOs.push(doc);
        return doc;
      });

      // Simulate 5 concurrent PO creation requests triggered simultaneously
      const concurrentRequests = Array.from({ length: 5 }, (_, i) =>
        purchaseOrderService.createOrder(
          testTenant,
          {
            supplierName: `Supplier ${i + 1}`,
            expectedDeliveryDate: '2026-10-20',
            items: [{ itemId: mockItem.id, recipeId: mockRecipe.id, orderedQuantity: 10 * (i + 1) }]
          },
          { userId: `mgr_${i}`, roles: ['PLANT_MANAGER'] }
        )
      );

      const results = await Promise.all(concurrentRequests);

      // Verify all 5 PO numbers are unique and strictly monotonic
      const poNumbers = results.map((r) => r.poNumber);
      const uniquePoNumbers = new Set(poNumbers);
      expect(uniquePoNumbers.size).toBe(5);
      expect(poNumbers).toEqual([
        'PO-202609-0001',
        'PO-202609-0002',
        'PO-202609-0003',
        'PO-202609-0004',
        'PO-202609-0005'
      ]);
    });
  });

  describe('6. Downstream Integration: Material Receipt & GRN Compatibility', () => {
    it('should enable material receipt progression and serve as authoritative parent for GRN creation', async () => {
      jest.spyOn(itemService, 'getItemById').mockResolvedValue(mockItem as any);
      jest.spyOn(recipeService, 'getRecipeById').mockResolvedValue(mockRecipe as any);

      let storedPO: any = null;
      jest.spyOn(purchaseOrderRepository, 'generateNextPoNumber').mockResolvedValue('PO-202609-0010');
      jest.spyOn(purchaseOrderRepository, 'create').mockImplementation(async (_t: string, data: any) => {
        storedPO = {
          ...data,
          _id: 'po_downstream_01',
          id: 'po_downstream_01',
          status: 'ISSUED',
          items: data.items.map((it: any) => ({ ...it, receivedQuantity: 0, balanceQuantity: it.orderedQuantity }))
        };
        return storedPO;
      });

      jest.spyOn(purchaseOrderRepository, 'findById').mockImplementation(async () => storedPO);
      jest.spyOn(purchaseOrderRepository, 'update').mockImplementation(async (_t, _id, update) => {
        Object.assign(storedPO, update);
        return storedPO;
      });
      jest.spyOn(purchaseOrderRepository, 'updateById').mockImplementation(async (_t, _id, update) => {
        Object.assign(storedPO, update);
        return storedPO;
      });

      // 1. Create PO for 100 units
      const po = await purchaseOrderService.createOrder(
        testTenant,
        {
          supplierName: 'Precision Steel Mills Ltd',
          expectedDeliveryDate: '2026-10-15',
          items: [{ itemId: mockItem.id, recipeId: mockRecipe.id, orderedQuantity: 100 }]
        },
        { userId: 'user_mgr', roles: ['PLANT_MANAGER'] }
      );

      expect(po.poNumber).toBe('PO-202609-0010');

      // 2. Downstream Material Receipt partial progression (50 / 100)
      const updatedPo = await purchaseOrderService.recordReceiptProgression(
        testTenant,
        po.id,
        mockItem.id,
        50
      );

      expect(updatedPo.status).toBe('PARTIALLY_RECEIVED');
      expect(updatedPo.items[0].receivedQuantity).toBe(50);
      expect(updatedPo.items[0].balanceQuantity).toBe(50);

      // 3. Downstream Material Receipt creation referencing this PO
      jest.spyOn(grnRepository, 'generateNextReceiptNumber').mockResolvedValue('REC-202609-0001');
      const mockReceipt = {
        id: 'mr_101',
        tenantId: testTenant,
        receiptNumber: 'REC-202609-0001',
        poId: po.id,
        poNumber: po.poNumber,
        status: 'RECEIVED',
        items: [{
          poLineItemId: po.items[0].lineItemId,
          itemId: mockItem.id,
          itemCode: mockItem.itemCode,
          itemName: mockItem.name,
          recipeId: mockRecipe.id,
          recipeCode: mockRecipe.recipeCode,
          receivedQuantity: 50,
          uom: mockItem.uom
        }]
      };
      jest.spyOn(grnRepository, 'createReceipt').mockResolvedValue(mockReceipt as any);

      const receipt = await grnService.recordMaterialReceipt(
        testTenant,
        {
          poId: po.id,
          supplierChallanNumber: 'CH-88219',
          items: [{
            poLineItemId: po.items[0].lineItemId,
            itemId: mockItem.id,
            receivedQuantity: 50,
            supplierHeatNumber: 'HEAT-9921',
            mtrNumber: 'MTR-CERT-019'
          }]
        },
        { userId: 'clerk_001', role: 'INVENTORY_CLERK' }
      );

      expect(receipt.poId).toBe(po.id);
      expect(receipt.poNumber).toBe(po.poNumber);
      expect(receipt.items[0].recipeId).toBe(mockRecipe.id);
    });
  });
});
