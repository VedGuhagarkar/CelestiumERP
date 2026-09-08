import { createApp } from '../src/app.js';
import { purchaseOrderService } from '../src/modules/purchase-order/purchase-order.service.js';
import { grnService } from '../src/modules/grn/grn.service.js';
import { purchaseOrderRepository } from '../src/modules/purchase-order/purchase-order.repository.js';
import { grnRepository } from '../src/modules/grn/grn.repository.js';
import { itemService } from '../src/modules/item/item.service.js';
import { recipeService } from '../src/modules/recipe/recipe.service.js';
import { warehouseService } from '../src/modules/warehouse/warehouse.service.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';

describe('Prompt 3: Item-to-Recipe Traceability & Lineage Enforcement Suite', () => {
  const testTenant = 'tenant_heat_treat_master_001';

  // Authoritative Item Master Definitions
  const mockItem4140 = {
    id: 'item_gear_4140',
    tenantId: testTenant,
    itemCode: 'GEAR-PIN-4140',
    name: 'Helical Pinion Gear 4140',
    materialGrade: 'AISI 4140',
    category: 'RAW_MATERIAL',
    uom: 'PCS',
    status: 'active',
    isDeleted: false
  };

  const mockItemEN19 = {
    id: 'item_shaft_en19',
    tenantId: testTenant,
    itemCode: 'SHAFT-OUT-EN19',
    name: 'Output Transmission Shaft EN19',
    materialGrade: 'EN19',
    category: 'RAW_MATERIAL',
    uom: 'PCS',
    status: 'active',
    isDeleted: false
  };

  const mockItemInconel = {
    id: 'item_aero_718',
    tenantId: testTenant,
    itemCode: 'DISC-TURB-718',
    name: 'Turbine Rotor Disc 718',
    materialGrade: 'INCONEL 718',
    category: 'RAW_MATERIAL',
    uom: 'PCS',
    status: 'active',
    isDeleted: false
  };

  // Authoritative Recipe Master Definitions
  const mockCarburizingRecipeRev1 = {
    id: 'rec_carb_4140_v1',
    tenantId: testTenant,
    recipeCode: 'REC-CARB-4140',
    revision: 1,
    name: 'Standard Gas Carburizing 930C',
    processFamily: 'CARBURIZING',
    applicableMaterialGrades: ['AISI 4140', 'EN19', 'SCM440'],
    status: 'ACTIVE',
    isDeleted: false
  };

  const mockNitridingRecipeRev2 = {
    id: 'rec_nitr_en19_v2',
    tenantId: testTenant,
    recipeCode: 'REC-NITR-EN19',
    revision: 2,
    name: 'Plasma Nitriding 520C',
    processFamily: 'NITRIDING',
    applicableMaterialGrades: ['EN19', 'EN40B'],
    status: 'ACTIVE',
    isDeleted: false
  };

  const mockVacuumRecipeRev1 = {
    id: 'rec_vac_718_v1',
    tenantId: testTenant,
    recipeCode: 'REC-VAC-718',
    revision: 1,
    name: 'Vacuum Solution & Age 718',
    processFamily: 'SOLUTION_TREATING_AGING',
    applicableMaterialGrades: ['INCONEL 718'],
    status: 'ACTIVE',
    isDeleted: false
  };

  const authorizedActor = {
    userId: 'user_master_planner',
    email: 'planner@heattreat.com',
    roles: ['PLANT_MANAGER']
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

  describe('1. Authoritative Item Selection & Master Data Binding', () => {
    it('should successfully create PO when Item and Recipe are valid, active, and metallurgically compatible', async () => {
      jest.spyOn(itemService, 'getItemById').mockResolvedValue(mockItem4140 as any);
      jest.spyOn(recipeService, 'getRecipeById').mockResolvedValue(mockCarburizingRecipeRev1 as any);
      jest.spyOn(purchaseOrderRepository, 'generateNextPoNumber').mockResolvedValue('PO-202609-0010');
      jest.spyOn(purchaseOrderRepository, 'create').mockImplementation(async (_t, data) => ({
        ...data,
        id: 'po_test_001',
        toJSON: () => data
      } as any));

      const po = await purchaseOrderService.createOrder(
        testTenant,
        {
          supplierName: 'Apex Steel Forgings Ltd',
          expectedDeliveryDate: '2026-10-15',
          items: [
            {
              itemId: mockItem4140.id,
              recipeId: mockCarburizingRecipeRev1.id,
              orderedQuantity: 100,
              unitPrice: 12.5
            }
          ]
        },
        authorizedActor
      );

      expect(po.poNumber).toBe('PO-202609-0010');
      expect(po.items).toHaveLength(1);
      const line = po.items[0];
      expect(line.itemId).toBe(mockItem4140.id);
      expect(line.itemCode).toBe('GEAR-PIN-4140');
      expect(line.materialGrade).toBe('AISI 4140');
      expect(line.recipeId).toBe(mockCarburizingRecipeRev1.id);
      expect(line.recipeCode).toBe('REC-CARB-4140');
      expect(line.recipeRevision).toBe(1);
      expect(line.processFamily).toBe('CARBURIZING');
    });

    it('should reject PO creation if referenced Item does not exist in Item Master', async () => {
      jest.spyOn(itemService, 'getItemById').mockResolvedValue(null);

      await expect(
        purchaseOrderService.createOrder(
          testTenant,
          {
            supplierName: 'Apex Steel Forgings Ltd',
            expectedDeliveryDate: '2026-10-15',
            items: [
              {
                itemId: 'non_existent_item',
                recipeId: mockCarburizingRecipeRev1.id,
                orderedQuantity: 100
              }
            ]
          },
          authorizedActor
        )
      ).rejects.toThrow(/Item with ID 'non_existent_item' not found in Item Master/);
    });

    it('should reject PO creation if Item is inactive or deleted', async () => {
      jest.spyOn(itemService, 'getItemById').mockResolvedValue({
        ...mockItem4140,
        status: 'inactive'
      } as any);

      await expect(
        purchaseOrderService.createOrder(
          testTenant,
          {
            supplierName: 'Apex Steel Forgings Ltd',
            expectedDeliveryDate: '2026-10-15',
            items: [
              {
                itemId: mockItem4140.id,
                recipeId: mockCarburizingRecipeRev1.id,
                orderedQuantity: 100
              }
            ]
          },
          authorizedActor
        )
      ).rejects.toThrow(/Only active items are permitted/);

      // Test soft-deleted item
      jest.spyOn(itemService, 'getItemById').mockResolvedValue({
        ...mockItem4140,
        isDeleted: true
      } as any);

      await expect(
        purchaseOrderService.createOrder(
          testTenant,
          {
            supplierName: 'Apex Steel Forgings Ltd',
            expectedDeliveryDate: '2026-10-15',
            items: [
              {
                itemId: mockItem4140.id,
                recipeId: mockCarburizingRecipeRev1.id,
                orderedQuantity: 100
              }
            ]
          },
          authorizedActor
        )
      ).rejects.toThrow(/deleted/);
    });
  });

  describe('2. Recipe Association & Metallurgical Compatibility Gate', () => {
    it('should reject PO creation if referenced Recipe does not exist in Recipe Master', async () => {
      jest.spyOn(itemService, 'getItemById').mockResolvedValue(mockItem4140 as any);
      jest.spyOn(recipeService, 'getRecipeById').mockResolvedValue(null);

      await expect(
        purchaseOrderService.createOrder(
          testTenant,
          {
            supplierName: 'Apex Steel Forgings Ltd',
            expectedDeliveryDate: '2026-10-15',
            items: [
              {
                itemId: mockItem4140.id,
                recipeId: 'non_existent_recipe',
                orderedQuantity: 100
              }
            ]
          },
          authorizedActor
        )
      ).rejects.toThrow(/Recipe with ID 'non_existent_recipe' not found in Recipe Master/);
    });

    it('should reject PO creation if Recipe is in DRAFT, PENDING_APPROVAL, SUPERSEDED, or RETIRED status', async () => {
      jest.spyOn(itemService, 'getItemById').mockResolvedValue(mockItem4140 as any);

      const unapprovedStatuses = ['DRAFT', 'PENDING_APPROVAL', 'SUPERSEDED', 'RETIRED'];
      for (const st of unapprovedStatuses) {
        jest.spyOn(recipeService, 'getRecipeById').mockResolvedValue({
          ...mockCarburizingRecipeRev1,
          status: st
        } as any);

        await expect(
          purchaseOrderService.createOrder(
            testTenant,
            {
              supplierName: 'Apex Steel Forgings Ltd',
              expectedDeliveryDate: '2026-10-15',
              items: [
                {
                  itemId: mockItem4140.id,
                  recipeId: mockCarburizingRecipeRev1.id,
                  orderedQuantity: 100
                }
              ]
            },
            authorizedActor
          )
        ).rejects.toThrow(/Only APPROVED or ACTIVE recipes are permitted/);
      }
    });

    it('should reject PO creation if Item material grade is metallurgically incompatible with Recipe', async () => {
      jest.spyOn(itemService, 'getItemById').mockResolvedValue(mockItemInconel as any); // INCONEL 718
      jest.spyOn(recipeService, 'getRecipeById').mockResolvedValue(mockCarburizingRecipeRev1 as any); // Supports AISI 4140, EN19

      await expect(
        purchaseOrderService.createOrder(
          testTenant,
          {
            supplierName: 'Apex Steel Forgings Ltd',
            expectedDeliveryDate: '2026-10-15',
            items: [
              {
                itemId: mockItemInconel.id,
                recipeId: mockCarburizingRecipeRev1.id,
                orderedQuantity: 50
              }
            ]
          },
          authorizedActor
        )
      ).rejects.toThrow(/Material grade mismatch.*Item grade 'INCONEL 718' is not compatible with Recipe 'REC-CARB-4140'/);
    });
  });

  describe('3. Recipe Revision Immutability & Downstream Traceability', () => {
    it('should preserve historical Recipe revision even after Recipe Master is updated to a higher revision', async () => {
      // Step A: PO is created at Recipe revision 1
      jest.spyOn(itemService, 'getItemById').mockResolvedValue(mockItem4140 as any);
      jest.spyOn(recipeService, 'getRecipeById').mockResolvedValue(mockCarburizingRecipeRev1 as any); // rev 1
      jest.spyOn(purchaseOrderRepository, 'generateNextPoNumber').mockResolvedValue('PO-202609-0020');

      let savedPo: any = null;
      jest.spyOn(purchaseOrderRepository, 'create').mockImplementation(async (_t, data) => {
        savedPo = { ...data, id: 'po_rev_test_01', toJSON: () => data };
        return savedPo;
      });

      const po = await purchaseOrderService.createOrder(
        testTenant,
        {
          supplierName: 'Apex Steel Forgings Ltd',
          expectedDeliveryDate: '2026-10-15',
          items: [
            {
              itemId: mockItem4140.id,
              recipeId: mockCarburizingRecipeRev1.id,
              orderedQuantity: 20
            }
          ]
        },
        authorizedActor
      );

      expect(po.items[0].recipeRevision).toBe(1);
      expect(po.items[0].recipeCode).toBe('REC-CARB-4140');

      // Step B: Metallurgist creates Revision 2 of the Recipe in Recipe Master (v1 becomes SUPERSEDED)
      const recipeRev2 = {
        ...mockCarburizingRecipeRev1,
        id: 'rec_carb_4140_v2',
        revision: 2,
        status: 'ACTIVE'
      };
      // When recipeService is queried for latest active, it returns Rev 2
      jest.spyOn(recipeService, 'getRecipeById').mockResolvedValue(recipeRev2 as any);

      // Step C: Material Receipt arrives for the PO
      jest.spyOn(purchaseOrderService, 'getOrderById').mockResolvedValue(savedPo);
      jest.spyOn(grnRepository, 'generateNextReceiptNumber').mockResolvedValue('REC-202609-0020');

      let savedReceipt: any = null;
      jest.spyOn(grnRepository, 'createReceipt').mockImplementation(async (_t, data) => {
        savedReceipt = {
          ...data,
          id: 'rcpt_rev_test_01',
          save: jest.fn().mockResolvedValue(true),
          toJSON: () => data
        };
        return savedReceipt;
      });

      const receipt = await grnService.recordMaterialReceipt(
        testTenant,
        {
          poId: savedPo.id,
          supplierChallanNumber: 'CHALLAN-REV-001',
          items: [
            {
              poLineItemId: savedPo.items[0].lineItemId,
              itemId: mockItem4140.id,
              receivedQuantity: 20,
              supplierHeatNumber: 'HEAT-REV-4140-99'
            }
          ]
        },
        authorizedActor
      );

      // Verify Material Receipt strictly retained historical Revision 1 from PO line
      expect(receipt.items[0].recipeRevision).toBe(1);
      expect(receipt.items[0].recipeId).toBe(mockCarburizingRecipeRev1.id);
      expect(receipt.items[0].recipeCode).toBe('REC-CARB-4140');

      // Step D: Putaway material in warehouse
      jest.spyOn(grnRepository, 'findReceiptById').mockResolvedValue(savedReceipt);
      jest.spyOn(warehouseService, 'getWarehouseById').mockResolvedValue({
        id: 'wh_main',
        code: 'WH-MAIN-01',
        status: 'ACTIVE'
      } as any);
      jest.spyOn(warehouseService, 'getLocationByCode').mockResolvedValue({
        code: 'BAY-01-A',
        status: 'ACTIVE'
      } as any);

      await grnService.storeMaterialInWarehouse(
        testTenant,
        savedReceipt.id,
        { warehouseId: 'wh_main', storageLocationCode: 'BAY-01-A' },
        authorizedActor
      );

      // Step E: Issue GRN and generate certified units
      jest.spyOn(grnRepository, 'generateNextGrnNumber').mockResolvedValue('GRN-202609-0020');
      jest.spyOn(grnRepository, 'createGrn').mockImplementation(async (_t, data) => ({
        ...data,
        id: 'grn_rev_test_01',
        toJSON: () => data
      } as any));

      let insertedUnits: any[] = [];
      jest.spyOn(grnRepository, 'createGrnUnits').mockImplementation(async (_t, units) => {
        insertedUnits = units;
        return units as any;
      });
      jest.spyOn(purchaseOrderService, 'recordReceiptProgression').mockResolvedValue(savedPo);

      const grn = await grnService.createGRN(
        testTenant,
        { materialReceiptId: savedReceipt.id },
        authorizedActor
      );

      expect(grn.items[0].recipeRevision).toBe(1);
      expect(insertedUnits.length).toBeGreaterThan(0);
      insertedUnits.forEach((u) => {
        expect(u.recipeRevision).toBe(1);
        expect(u.recipeCode).toBe('REC-CARB-4140');
        expect(u.recipeId).toBe(mockCarburizingRecipeRev1.id);
      });
    });
  });

  describe('4. Multi-Recipe Context & 5-Tuple Unambiguous Unit Lineage', () => {
    it('should generate independently identifiable units for multiple distinct parts & recipes in a single PO and GRN', async () => {
      // Create PO with 2 distinct parts requiring 2 different metallurgical recipes
      jest.spyOn(itemService, 'getItemById').mockImplementation(async (_t, id) => {
        if (id === mockItem4140.id) return mockItem4140 as any;
        if (id === mockItemEN19.id) return mockItemEN19 as any;
        return null;
      });

      jest.spyOn(recipeService, 'getRecipeById').mockImplementation(async (_t, id) => {
        if (id === mockCarburizingRecipeRev1.id) return mockCarburizingRecipeRev1 as any;
        if (id === mockNitridingRecipeRev2.id) return mockNitridingRecipeRev2 as any;
        return null;
      });

      jest.spyOn(purchaseOrderRepository, 'generateNextPoNumber').mockResolvedValue('PO-202609-0030');

      let savedMultiPo: any = null;
      jest.spyOn(purchaseOrderRepository, 'create').mockImplementation(async (_t, data) => {
        savedMultiPo = { ...data, id: 'po_multi_001', toJSON: () => data };
        return savedMultiPo;
      });

      const multiPo = await purchaseOrderService.createOrder(
        testTenant,
        {
          supplierName: 'Dual Process Engineering Ltd',
          expectedDeliveryDate: '2026-10-30',
          items: [
            {
              itemId: mockItem4140.id,
              recipeId: mockCarburizingRecipeRev1.id,
              orderedQuantity: 2 // 2 PCS
            },
            {
              itemId: mockItemEN19.id,
              recipeId: mockNitridingRecipeRev2.id,
              orderedQuantity: 3 // 3 PCS
            }
          ]
        },
        authorizedActor
      );

      expect(multiPo.items).toHaveLength(2);
      expect(multiPo.items[0].recipeCode).toBe('REC-CARB-4140');
      expect(multiPo.items[0].recipeRevision).toBe(1);
      expect(multiPo.items[1].recipeCode).toBe('REC-NITR-EN19');
      expect(multiPo.items[1].recipeRevision).toBe(2);

      // Record receipt of both parts in a single physical delivery
      jest.spyOn(purchaseOrderService, 'getOrderById').mockResolvedValue(savedMultiPo);
      jest.spyOn(grnRepository, 'generateNextReceiptNumber').mockResolvedValue('REC-202609-0030');

      let savedMultiReceipt: any = null;
      jest.spyOn(grnRepository, 'createReceipt').mockImplementation(async (_t, data) => {
        savedMultiReceipt = {
          ...data,
          id: 'rcpt_multi_001',
          save: jest.fn().mockResolvedValue(true),
          toJSON: () => data
        };
        return savedMultiReceipt;
      });

      const multiReceipt = await grnService.recordMaterialReceipt(
        testTenant,
        {
          poId: savedMultiPo.id,
          supplierChallanNumber: 'DC-DUAL-8899',
          items: [
            {
              poLineItemId: savedMultiPo.items[0].lineItemId,
              itemId: mockItem4140.id,
              receivedQuantity: 2,
              supplierHeatNumber: 'HEAT-4140-PINION'
            },
            {
              poLineItemId: savedMultiPo.items[1].lineItemId,
              itemId: mockItemEN19.id,
              receivedQuantity: 3,
              supplierHeatNumber: 'HEAT-EN19-SHAFT'
            }
          ]
        },
        authorizedActor
      );

      expect(multiReceipt.items).toHaveLength(2);

      // Warehouse putaway
      jest.spyOn(grnRepository, 'findReceiptById').mockResolvedValue(savedMultiReceipt);
      jest.spyOn(warehouseService, 'getWarehouseById').mockResolvedValue({
        id: 'wh_main',
        code: 'WH-MAIN-01',
        status: 'ACTIVE'
      } as any);
      jest.spyOn(warehouseService, 'getLocationByCode').mockResolvedValue({
        code: 'BAY-02-B',
        status: 'ACTIVE'
      } as any);

      await grnService.storeMaterialInWarehouse(
        testTenant,
        savedMultiReceipt.id,
        { warehouseId: 'wh_main', storageLocationCode: 'BAY-02-B' },
        authorizedActor
      );

      // Generate GRN with segregated serialized units
      jest.spyOn(grnRepository, 'generateNextGrnNumber').mockResolvedValue('GRN-202609-0030');
      jest.spyOn(grnRepository, 'createGrn').mockImplementation(async (_t, data) => ({
        ...data,
        id: 'grn_multi_001',
        toJSON: () => data
      } as any));

      let generatedUnits: any[] = [];
      jest.spyOn(grnRepository, 'createGrnUnits').mockImplementation(async (_t, units) => {
        generatedUnits = units;
        return units as any;
      });
      jest.spyOn(purchaseOrderService, 'recordReceiptProgression').mockResolvedValue(savedMultiPo);

      const grn = await grnService.createGRN(
        testTenant,
        { materialReceiptId: savedMultiReceipt.id },
        authorizedActor
      );

      // Total units generated = 2 (Item 1) + 3 (Item 2) = 5 units
      expect(generatedUnits).toHaveLength(5);

      // Verify 5-tuple answers for every single unit:
      // Which PO? Which GRN? Which Item? Which material/unit? Which Recipe?
      const item1Units = generatedUnits.filter((u) => u.itemCode === 'GEAR-PIN-4140');
      const item2Units = generatedUnits.filter((u) => u.itemCode === 'SHAFT-OUT-EN19');

      expect(item1Units).toHaveLength(2);
      expect(item2Units).toHaveLength(3);

      item1Units.forEach((u) => {
        expect(u.poNumber).toBe('PO-202609-0030'); // Which PO?
        expect(u.grnNumber).toBe('GRN-202609-0030'); // Which GRN?
        expect(u.itemCode).toBe('GEAR-PIN-4140'); // Which Item?
        expect(u.materialGrade).toBe('AISI 4140');
        expect(u.unitIdentifier).toMatch(/^UNIT-GRN-202609-0030-\d{3}$/); // Which unit?
        expect(u.supplierHeatNumber).toBe('HEAT-4140-PINION');
        expect(u.recipeCode).toBe('REC-CARB-4140'); // Which Recipe?
        expect(u.recipeRevision).toBe(1);
        expect(u.processFamily).toBe('CARBURIZING');
      });

      item2Units.forEach((u) => {
        expect(u.poNumber).toBe('PO-202609-0030'); // Which PO?
        expect(u.grnNumber).toBe('GRN-202609-0030'); // Which GRN?
        expect(u.itemCode).toBe('SHAFT-OUT-EN19'); // Which Item?
        expect(u.materialGrade).toBe('EN19');
        expect(u.unitIdentifier).toMatch(/^UNIT-GRN-202609-0030-\d{3}$/); // Which unit?
        expect(u.supplierHeatNumber).toBe('HEAT-EN19-SHAFT');
        expect(u.recipeCode).toBe('REC-NITR-EN19'); // Which Recipe?
        expect(u.recipeRevision).toBe(2);
        expect(u.processFamily).toBe('NITRIDING');
      });
    });
  });

  describe('5. Client Manipulation Defense & Downstream Planning Integrity', () => {
    it('should ignore client-supplied recipeCode, recipeRevision, and materialGrade during PO creation', async () => {
      jest.spyOn(itemService, 'getItemById').mockResolvedValue(mockItem4140 as any);
      jest.spyOn(recipeService, 'getRecipeById').mockResolvedValue(mockCarburizingRecipeRev1 as any);
      jest.spyOn(purchaseOrderRepository, 'generateNextPoNumber').mockResolvedValue('PO-202609-0040');

      let savedData: any = null;
      jest.spyOn(purchaseOrderRepository, 'create').mockImplementation(async (_t, data) => {
        savedData = data;
        return { ...data, id: 'po_tamper_001', toJSON: () => data } as any;
      });

      // Malicious payload with fake properties injected into DTO
      const tamperedDto: any = {
        supplierName: 'Apex Steel Forgings Ltd',
        expectedDeliveryDate: '2026-10-15',
        items: [
          {
            itemId: mockItem4140.id,
            recipeId: mockCarburizingRecipeRev1.id,
            orderedQuantity: 50,
            recipeCode: 'MALICIOUS-RECIPE-999',
            recipeRevision: 999,
            materialGrade: 'TITANIUM-GRADE-5',
            processFamily: 'VACUUM_CHEAT'
          }
        ]
      };

      const po = await purchaseOrderService.createOrder(testTenant, tamperedDto, authorizedActor);

      const line = po.items[0];
      expect(line.recipeCode).toBe('REC-CARB-4140'); // Authoritative, not MALICIOUS
      expect(line.recipeRevision).toBe(1); // Authoritative, not 999
      expect(line.materialGrade).toBe('AISI 4140'); // Authoritative, not TITANIUM
      expect(line.processFamily).toBe('CARBURIZING');
    });

    it('should reject Material Receipt if poLineItemId and itemId do not match the same PO line', async () => {
      const mockPoWithTwoLines = {
        id: 'po_mismatch_001',
        poNumber: 'PO-202609-0050',
        status: 'ISSUED',
        items: [
          {
            lineItemId: 'line_1',
            itemId: mockItem4140.id,
            orderedQuantity: 10,
            receivedQuantity: 0
          },
          {
            lineItemId: 'line_2',
            itemId: mockItemEN19.id,
            orderedQuantity: 20,
            receivedQuantity: 0
          }
        ]
      };

      jest.spyOn(purchaseOrderService, 'getOrderById').mockResolvedValue(mockPoWithTwoLines as any);

      await expect(
        grnService.recordMaterialReceipt(
          testTenant,
          {
            poId: mockPoWithTwoLines.id,
            supplierChallanNumber: 'DC-TAMPER-001',
            items: [
              {
                poLineItemId: 'line_1', // Line 1 is for mockItem4140
                itemId: mockItemEN19.id, // Trying to pass itemId of Line 2!
                receivedQuantity: 5,
                supplierHeatNumber: 'HEAT-TAMPER'
              }
            ]
          },
          authorizedActor
        )
      ).rejects.toThrow(/Mismatched line item identifier/);
    });

    it('should query available units strictly filtered by Item and Recipe for downstream planning', async () => {
      const mockUnits = [
        {
          unitIdentifier: 'UNIT-GRN-202609-0030-001',
          itemId: mockItem4140.id,
          recipeId: mockCarburizingRecipeRev1.id,
          status: 'AVAILABLE_FOR_PLANNING',
          quantity: 10
        }
      ];

      jest.spyOn(grnRepository, 'queryAvailableUnitsForPlanning').mockResolvedValue(mockUnits as any);

      const availableUnits = await grnService.getAvailableUnitsForPlanning(
        testTenant,
        mockItem4140.id,
        mockCarburizingRecipeRev1.id
      );

      expect(grnRepository.queryAvailableUnitsForPlanning).toHaveBeenCalledWith(
        testTenant,
        mockItem4140.id,
        mockCarburizingRecipeRev1.id
      );
      expect(availableUnits).toHaveLength(1);
      expect(availableUnits[0].recipeId).toBe(mockCarburizingRecipeRev1.id);
    });
  });
});
