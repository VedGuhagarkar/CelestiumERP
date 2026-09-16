import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { purchaseOrderRepository } from '../src/modules/purchase-order/purchase-order.repository.js';
import { grnRepository } from '../src/modules/grn/grn.repository.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { dispatchRepository } from '../src/modules/dispatch/dispatch.repository.js';
import { itemRepository } from '../src/modules/item/item.repository.js';
import { recipeRepository } from '../src/modules/recipe/recipe.repository.js';
import { customerRepository } from '../src/modules/customer/customer.repository.js';
import { itemService } from '../src/modules/item/item.service.js';
import { recipeService } from '../src/modules/recipe/recipe.service.js';
import { warehouseService } from '../src/modules/warehouse/warehouse.service.js';
import { rbacService } from '../src/modules/rbac/rbac.service.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { PERMISSIONS } from '../src/modules/rbac/rbac.constants.js';

describe('Comprehensive End-to-End ERP Functional & Architectural Verification (ITEM → RECIPE → PO → GRN → BO → INSPECTION → OC/DISPATCH)', () => {
  const app = createApp();
  const testTenant = 'tenant_aerospace_defense_alpha';
  const otherTenant = 'tenant_civilian_bravo';

  jest.setTimeout(30000);

  const generateToken = (userId: string, roleCodes: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@celestium.internal`, roles: roleCodes },
      config.auth.jwtSecret
    );
  };

  // Personas with strictly configured roles
  const adminToken = generateToken('usr_admin_e2e', ['ADMIN']);
  const procurementToken = generateToken('usr_buyer_e2e', ['PLANT_MANAGER']);
  const storekeeperToken = generateToken('usr_store_e2e', ['INVENTORY_CLERK']);
  const operatorToken = generateToken('usr_operator_e2e', ['FURNACE_OPERATOR']);
  const qcInspectorToken = generateToken('usr_qc_e2e', ['QC_INSPECTOR']);
  const dispatchOfficerToken = generateToken('usr_dispatch_e2e', ['DISPATCH_OFFICER']);
  const unprivilegedToken = generateToken('usr_viewer_e2e', ['VIEW_ONLY_OPERATOR']);
  const tenantBUserToken = generateToken('usr_foreign_tenant_e2e', ['ADMIN'], otherTenant);

  // Authoritative Test Fixtures
  const validSupplier = {
    id: 'cust_aerometals_01',
    _id: 'cust_aerometals_01',
    tenantId: testTenant,
    customerCode: 'SUP-AEROMETAL-01',
    companyName: 'AeroMetals Forge Global',
    status: 'active',
    isDeleted: false,
    address: '450 Aerospace Way, Seattle, WA',
    contactEmail: 'sales@aerometals.com',
    contactPhone: '+1-206-555-0188'
  };

  const inactiveSupplier = {
    id: 'cust_blacklisted_01',
    _id: 'cust_blacklisted_01',
    tenantId: testTenant,
    customerCode: 'SUP-SUSPENDED-01',
    companyName: 'Banned Alloy Scrap Co',
    status: 'blacklisted',
    isDeleted: false
  };

  const validItem = {
    id: 'item_ti_6al4v',
    _id: 'item_ti_6al4v',
    tenantId: testTenant,
    itemCode: 'MAT-TI-6AL4V-BAR',
    name: 'Titanium Grade 5 Ti-6Al-4V Solution Treated Bar',
    itemName: 'Titanium Grade 5 Ti-6Al-4V Solution Treated Bar',
    materialGrade: 'Ti-6Al-4V',
    category: 'RAW_MATERIAL',
    uom: 'KG',
    status: 'active',
    isDeleted: false
  };

  const inactiveItem = {
    id: 'item_obsolete_lead',
    _id: 'item_obsolete_lead',
    tenantId: testTenant,
    itemCode: 'MAT-OBSOLETE-LEAD',
    name: 'Obsolete Lead Base Alloy (Non-RoHS)',
    materialGrade: 'LEAD-BRONZE',
    category: 'RAW_MATERIAL',
    uom: 'KG',
    status: 'inactive',
    isDeleted: false
  };

  const validRecipe = {
    id: 'rec_solution_age_ti',
    _id: 'rec_solution_age_ti',
    tenantId: testTenant,
    recipeCode: 'REC-TI64-SOL-AGE-01',
    revision: 1,
    name: 'Solution Treatment & Aging Ti-6Al-4V',
    processFamily: 'SOLUTION_AND_AGE',
    itemId: 'item_ti_6al4v',
    materialGrade: 'Ti-6Al-4V',
    applicableMaterialGrades: ['Ti-6Al-4V'],
    status: 'ACTIVE',
    isDeleted: false,
    specifications: {
      temperatureTargetC: 960,
      soakDurationMinutes: 120,
      quenchMedium: 'WATER',
      targetHardnessMin: 36,
      targetHardnessMax: 42,
      hardnessScale: 'HRC'
    }
  };

  const recipeAnotherItem = {
    id: 'rec_steel_carburizing',
    _id: 'rec_steel_carburizing',
    tenantId: testTenant,
    recipeCode: 'REC-CARB-8620-V1',
    revision: 1,
    name: 'Carburizing & Tempering AISI 8620',
    processFamily: 'CARBURIZING',
    itemId: 'item_different_steel',
    materialGrade: 'AISI 8620',
    applicableMaterialGrades: ['AISI 8620'],
    status: 'ACTIVE',
    isDeleted: false
  };

  const mockWarehouse = {
    id: 'wh_main_stores',
    code: 'WH-MAIN',
    name: 'Main Aerospace Stores'
  };

  const mockLocation = {
    locationCode: 'BAY-A1-BIN-04',
    name: 'Titanium Storage Bay'
  };

  let auditEntries: any[] = [];
  let persistentPo: any = null;
  let persistentGrn: any = null;
  let persistentBo: any = null;
  let persistentOc: any = null;

  beforeEach(() => {
    auditEntries = [];

    jest.spyOn(auditService, 'record').mockImplementation(async (tenantId: string, entry: any) => {
      auditEntries.push({ tenantId, ...entry });
      return {} as any;
    });

    // RBAC Permissions Mock
    jest.spyOn(rbacService, 'getUserEffectivePermissions').mockImplementation(async (_tenant, _userId, roles) => {
      const perms = new Set<string>();
      if (roles.includes('ADMIN') || roles.includes('SUPERADMIN')) {
        perms.add('*');
        Object.values(PERMISSIONS).forEach((p) => perms.add(p));
      }
      if (roles.includes('PLANT_MANAGER')) {
        perms.add(PERMISSIONS.PURCHASE_ORDER_CREATE);
        perms.add(PERMISSIONS.PURCHASE_ORDER_VIEW);
        perms.add(PERMISSIONS.PURCHASE_ORDER_UPDATE);
        perms.add(PERMISSIONS.BATCH_ORDER_CREATE);
        perms.add(PERMISSIONS.BATCH_ORDER_VIEW);
        perms.add(PERMISSIONS.PRODUCTION_JOB_CREATE);
        perms.add(PERMISSIONS.PRODUCTION_JOB_VIEW);
        perms.add(PERMISSIONS.DISPATCH_PASS_GENERATE);
        perms.add(PERMISSIONS.DISPATCH_DELIVERY_DISPATCH);
      }
      if (roles.includes('INVENTORY_CLERK')) {
        perms.add(PERMISSIONS.INVENTORY_GRN_CREATE);
        perms.add(PERMISSIONS.INVENTORY_GRN_VIEW);
        perms.add(PERMISSIONS.INVENTORY_GRN_PRINT);
        perms.add(PERMISSIONS.PURCHASE_ORDER_VIEW);
        perms.add(PERMISSIONS.INVENTORY_STORAGE_RECORD);
        perms.add(PERMISSIONS.INVENTORY_HEAT_LOT_INWARD);
      }
      if (roles.includes('FURNACE_OPERATOR')) {
        perms.add(PERMISSIONS.PRODUCTION_JOB_START);
        perms.add(PERMISSIONS.PRODUCTION_JOB_TRANSITION);
        perms.add(PERMISSIONS.PRODUCTION_JOB_UPDATE);
        perms.add(PERMISSIONS.MACHINES_FURNACE_OPERATE);
        perms.add(PERMISSIONS.PRODUCTION_JOB_VIEW);
        perms.add(PERMISSIONS.BATCH_ORDER_VIEW);
      }
      if (roles.includes('QC_INSPECTOR')) {
        perms.add(PERMISSIONS.QUALITY_INSPECTION_RECORD);
        perms.add(PERMISSIONS.QUALITY_INSPECTION_VERIFY);
        perms.add(PERMISSIONS.QUALITY_DISPOSITION_MANAGE);
        perms.add(PERMISSIONS.QUALITY_INSPECTION_VIEW);
        perms.add(PERMISSIONS.PRODUCTION_JOB_VIEW);
        perms.add(PERMISSIONS.BATCH_ORDER_VIEW);
      }
      if (roles.includes('DISPATCH_OFFICER')) {
        perms.add(PERMISSIONS.DISPATCH_DELIVERY_CREATE);
        perms.add(PERMISSIONS.DISPATCH_DELIVERY_DISPATCH);
        perms.add(PERMISSIONS.DISPATCH_DELIVERY_VIEW);
        perms.add(PERMISSIONS.DISPATCH_CHALLAN_PRINT);
        perms.add(PERMISSIONS.DISPATCH_PASS_GENERATE);
        perms.add(PERMISSIONS.PRODUCTION_JOB_VIEW);
        perms.add(PERMISSIONS.BATCH_ORDER_VIEW);
      }
      return {
        roles,
        permissions: Array.from(perms),
        effectivePermissions: Array.from(perms),
        isSuperAdmin: roles.includes('ADMIN') || roles.includes('SUPERADMIN')
      } as any;
    });

    // Mock Customer / Supplier Repository
    jest.spyOn(customerRepository, 'findById').mockImplementation(async (id: string) => {
      if (id === validSupplier.id) return validSupplier as any;
      if (id === inactiveSupplier.id) return inactiveSupplier as any;
      return null;
    });

    jest.spyOn(customerRepository, 'findByCode').mockImplementation(async (tenant: string, code: string) => {
      if (code === validSupplier.customerCode) return validSupplier as any;
      if (code === inactiveSupplier.customerCode) return inactiveSupplier as any;
      return null;
    });

    // Mock Item & Recipe Services / Repositories
    jest.spyOn(itemRepository, 'findById').mockImplementation(async (id: string) => {
      if (id === validItem.id) return validItem as any;
      if (id === inactiveItem.id) return inactiveItem as any;
      return null;
    });
    jest.spyOn(itemService, 'getItemById').mockImplementation(async (_tenant: string, id: string) => {
      if (id === validItem.id) return validItem as any;
      if (id === inactiveItem.id) return inactiveItem as any;
      return null as any;
    });

    jest.spyOn(recipeRepository, 'findById').mockImplementation(async (id: string) => {
      if (id === validRecipe.id) return validRecipe as any;
      if (id === recipeAnotherItem.id) return recipeAnotherItem as any;
      return null;
    });
    jest.spyOn(recipeService, 'getRecipeById').mockImplementation(async (_tenant: string, id: string) => {
      if (id === validRecipe.id) return validRecipe as any;
      if (id === recipeAnotherItem.id) return recipeAnotherItem as any;
      return null as any;
    });

    // Mock Warehouse Service
    jest.spyOn(warehouseService, 'getWarehouseById').mockResolvedValue(mockWarehouse as any);
    jest.spyOn(warehouseService, 'getLocationByCode').mockResolvedValue(mockLocation as any);

    // Mock Purchase Order Repository
    jest.spyOn(purchaseOrderRepository, 'generateNextPoNumber').mockResolvedValue('PO-202609-0001');
    jest.spyOn(purchaseOrderRepository, 'create').mockImplementation(async (_tenant, poData: any) => {
      persistentPo = {
        id: 'po_e2e_live_01',
        _id: 'po_e2e_live_01',
        tenantId: testTenant,
        status: 'ISSUED',
        ...poData,
        createdAt: new Date().toISOString()
      };
      return persistentPo;
    });
    jest.spyOn(purchaseOrderRepository, 'findById').mockImplementation(async (_tenant, id) => {
      if (persistentPo && (persistentPo.id === id || persistentPo._id === id || persistentPo.poNumber === id)) {
        return persistentPo;
      }
      return null;
    });
    jest.spyOn(purchaseOrderRepository, 'findByPoNumber').mockImplementation(async (_tenant, poNum) => {
      if (persistentPo && persistentPo.poNumber === poNum) {
        return persistentPo;
      }
      return null;
    });
    jest.spyOn(purchaseOrderRepository, 'update').mockImplementation(async (_tenant, id, data) => {
      if (persistentPo && (persistentPo.id === id || persistentPo._id === id)) {
        persistentPo = { ...persistentPo, ...data };
        return persistentPo;
      }
      return null;
    });

    // Mock GRN Repository
    jest.spyOn(grnRepository, 'generateNextGrnNumber').mockResolvedValue('GRN-202609-0001');
    jest.spyOn(grnRepository, 'queryReceipts').mockResolvedValue([
      {
        id: 'rcpt_stored_01',
        warehouseId: mockWarehouse.id,
        warehouseCode: mockWarehouse.code,
        storageLocationCode: mockLocation.locationCode,
        status: 'STORED'
      } as any
    ]);
    jest.spyOn(grnRepository, 'createGrn').mockImplementation(async (_tenant, grnData: any) => {
      persistentGrn = {
        id: 'grn_e2e_live_01',
        _id: 'grn_e2e_live_01',
        tenantId: testTenant,
        status: 'AVAILABLE_FOR_PLANNING',
        grnDate: new Date('2026-09-16T09:00:00Z'),
        customerName: validSupplier.companyName,
        deliveryAddress: validSupplier.address,
        gstNumber: '29ABCDE1234F1Z5',
        contactPerson: 'Lead Procurement Eng',
        ...grnData
      };
      return persistentGrn;
    });
    jest.spyOn(grnRepository, 'findGrnById').mockImplementation(async (_tenant, id) => {
      if (persistentGrn && (persistentGrn.id === id || persistentGrn._id === id || persistentGrn.grnNumber === id)) {
        return persistentGrn;
      }
      return null;
    });
    jest.spyOn(grnRepository, 'createGrnUnits').mockResolvedValue([]);

    // Mock Production Job Repository
    jest.spyOn(productionJobRepository, 'generateNextBatchOrderNumber').mockResolvedValue('BO-202609-0001');
    jest.spyOn(productionJobRepository, 'create').mockImplementation(async (_tenant, boData: any) => {
      persistentBo = {
        id: 'bo_e2e_live_01',
        _id: 'bo_e2e_live_01',
        tenantId: testTenant,
        jobNumber: 'BO-202609-0001',
        status: 'WAITING_FOR_PRODUCTION',
        stage: 'CREATED',
        item: {
          itemName: validItem.name,
          description: validItem.name,
          itemCode: validItem.itemCode,
          materialGrade: validItem.materialGrade
        },
        recipeSnapshot: {
          name: validRecipe.name
        },
        heatLotNumber: 'HEAT-TI-AERO-2026',
        execution: {
          inspectionData: {
            furnaceEquipment: 'Vacuum Furnace VF-01',
            hardnessSpecification: '36 - 42 HRC',
            actualHardness: '39.5 HRC',
            caseDepth: '1.2 mm'
          }
        },
        ...boData
      };
      return persistentBo;
    });
    jest.spyOn(productionJobRepository, 'findById').mockImplementation(async (_tenant, id) => {
      if (persistentBo && (persistentBo.id === id || persistentBo._id === id || persistentBo.jobNumber === id)) {
        return persistentBo;
      }
      return null;
    });
    jest.spyOn(productionJobRepository, 'updateById').mockImplementation(async (_tenant, id, updateData) => {
      if (persistentBo && (persistentBo.id === id || persistentBo._id === id)) {
        persistentBo = { ...persistentBo, ...updateData };
        return persistentBo;
      }
      return null;
    });
    jest.spyOn(productionJobRepository, 'atomicTakeForProduction').mockImplementation(async (_tenant, id, updateData) => {
      if (persistentBo && (persistentBo.id === id || persistentBo._id === id)) {
        persistentBo = { ...persistentBo, status: 'IN_PRODUCTION', ...updateData };
        return persistentBo;
      }
      return null;
    });
    jest.spyOn(productionJobRepository, 'atomicApproveForDispatch').mockImplementation(async (_tenant, id, updateData) => {
      if (persistentBo && (persistentBo.id === id || persistentBo._id === id)) {
        persistentBo = { ...persistentBo, status: 'WAITING_FOR_DISPATCH', ...updateData };
        return persistentBo;
      }
      return null;
    });

    // Mock Dispatch Repository
    jest.spyOn(dispatchRepository, 'generateNextOutwardChallanNumber').mockResolvedValue('OC-202609-0001');
    jest.spyOn(dispatchRepository, 'generateNextDispatchNumber').mockResolvedValue('DSP-202609-0001');
    jest.spyOn(dispatchRepository, 'generateNextDeliveryChallanNumber').mockResolvedValue('DC-2026-0001');
    jest.spyOn(dispatchRepository, 'generateNextGatePassNumber').mockResolvedValue('GP-2026-0001');
    jest.spyOn(dispatchRepository, 'findByBatchOrderId').mockImplementation(async () => persistentOc);
    jest.spyOn(dispatchRepository, 'findById').mockImplementation(async (_tenant, id) => {
      if (persistentOc && (persistentOc.id === id || persistentOc._id === id || persistentOc.outwardChallanNumber === id)) {
        return persistentOc;
      }
      return null;
    });
    jest.spyOn(dispatchRepository, 'findByOutwardChallanNumber').mockImplementation(async (_tenant, num) => {
      if (persistentOc && persistentOc.outwardChallanNumber === num) {
        return persistentOc;
      }
      return null;
    });
    jest.spyOn(dispatchRepository, 'create').mockImplementation(async (_tenant, ocData: any) => {
      persistentOc = {
        id: 'dsp_e2e_live_01',
        _id: 'dsp_e2e_live_01',
        tenantId: testTenant,
        outwardChallanNumber: 'OC-202609-0001',
        status: 'PENDING_AUTHORIZATION',
        hierarchy: {
          poId: ocData.hierarchy?.poId || persistentPo?.id,
          grnId: ocData.hierarchy?.grnId || persistentGrn?.id,
          batchOrderId: ocData.hierarchy?.batchOrderId || persistentBo?.id
        },
        deliveryInformation: {
          customerName: persistentGrn?.customerName || validSupplier.companyName,
          deliveryAddress: persistentGrn?.deliveryAddress || validSupplier.address
        },
        items: [
          {
            serialNumber: 1,
            partName: validItem.name,
            partNumber: validItem.itemCode,
            materialGrade: validItem.materialGrade,
            quantity: 200,
            unitOfMeasure: 'KG'
          }
        ],
        ...ocData
      };
      return persistentOc;
    });
    jest.spyOn(dispatchRepository, 'update').mockImplementation(async (_tenant, id, updateData) => {
      if (persistentOc && (persistentOc.id === id || persistentOc._id === id)) {
        persistentOc = { ...persistentOc, ...updateData };
        return persistentOc;
      }
      return null;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // 1. INCONSISTENCY INVARIANT CHECKS (Defect & Integrity Prevention)
  // =========================================================================
  describe('Cross-Module Integrity Invariant Enforcements', () => {
    it('Invariant 1: Rejects Purchase Order referencing an inactive or blacklisted supplier', async () => {
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${procurementToken}`)
        .send({
          supplierCode: inactiveSupplier.customerCode,
          supplierName: inactiveSupplier.companyName,
          expectedDeliveryDate: '2026-10-15',
          items: [
            {
              itemId: validItem.id,
              recipeId: validRecipe.id,
              orderedQuantity: 100,
              unitPrice: 50
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.message || res.body.error).toMatch(/supplier.*(not active|inactive|suspended|blacklisted)/i);
    });

    it('Invariant 2: Rejects Purchase Order referencing an inactive item master', async () => {
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${procurementToken}`)
        .send({
          supplierCode: validSupplier.customerCode,
          supplierName: validSupplier.companyName,
          expectedDeliveryDate: '2026-10-15',
          items: [
            {
              itemId: inactiveItem.id,
              recipeId: validRecipe.id,
              orderedQuantity: 100,
              unitPrice: 50
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.message || res.body.error).toMatch(/item.*(not active|inactive|deleted)/i);
    });

    it('Invariant 3: Rejects GRN containing an Item that is NOT part of its PO line items', async () => {
      persistentPo = {
        id: 'po_test_inv_3',
        _id: 'po_test_inv_3',
        tenantId: testTenant,
        poNumber: 'PO-2026-INV-0003',
        supplierName: validSupplier.companyName,
        supplierCode: validSupplier.customerCode,
        status: 'ISSUED',
        items: [
          {
            lineItemId: 'po_line_valid',
            itemId: validItem.id,
            itemCode: validItem.itemCode,
            orderedQuantity: 100,
            receivedQuantity: 0,
            uom: 'KG'
          }
        ],
        isDeleted: false
      };

      const res = await request(app)
        .post('/api/v1/grns')
        .set('Authorization', `Bearer ${storekeeperToken}`)
        .send({
          poId: persistentPo.id,
          supplierChallanNumber: 'DC-VEND-9988',
          items: [
            {
              itemId: 'item_completely_alien_999',
              receivedQuantity: 50,
              acceptedQuantity: 50,
              supplierHeatNumber: 'HEAT-99881'
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.message || res.body.error).toMatch(/item.*not part of.*po|does not match po/i);
    });

    it('Invariant 4: Rejects BO referencing a GRN belonging to a different PO', async () => {
      const poAlpha = {
        id: 'po_alpha_11',
        _id: 'po_alpha_11',
        tenantId: testTenant,
        poNumber: 'PO-ALPHA-11',
        status: 'RECEIVED',
        isDeleted: false
      };
      const grnBeta = {
        id: 'grn_beta_22',
        _id: 'grn_beta_22',
        tenantId: testTenant,
        grnNumber: 'GRN-BETA-22',
        poId: 'po_completely_different_99',
        poNumber: 'PO-BETA-DIFFERENT-99',
        status: 'COMPLETED',
        isDeleted: false
      };

      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValue(poAlpha as any);
      jest.spyOn(grnRepository, 'findGrnById').mockResolvedValue(grnBeta as any);

      const res = await request(app)
        .post('/api/v1/production-jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          poId: poAlpha.id,
          grnId: grnBeta.id,
          itemId: validItem.id,
          recipeId: validRecipe.id,
          quantity: 50
        });

      expect(res.status).toBe(400);
      expect(res.body.message || res.body.error).toMatch(/grn.*does not belong to.*po|po mismatch|inconsistent/i);
    });

    it('Invariant 5: Rejects BO referencing a Recipe belonging to an incompatible Item or Material Grade', async () => {
      persistentPo = {
        id: 'po_gamma_33',
        tenantId: testTenant,
        poNumber: 'PO-GAMMA-33',
        items: [{ itemId: validItem.id, itemCode: validItem.itemCode }],
        isDeleted: false
      };
      persistentGrn = {
        id: 'grn_gamma_33',
        tenantId: testTenant,
        grnNumber: 'GRN-GAMMA-33',
        poId: persistentPo.id,
        poNumber: persistentPo.poNumber,
        status: 'COMPLETED',
        items: [{ itemId: validItem.id, heatLotNumber: 'HEAT-TI-33' }],
        isDeleted: false
      };

      // Attempting to use recipeAnotherItem (which is for AISI 8620 Carburizing) on Titanium Ti-6Al-4V
      const res = await request(app)
        .post('/api/v1/production-jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          poId: persistentPo.id,
          grnId: persistentGrn.id,
          itemId: validItem.id,
          recipeId: recipeAnotherItem.id,
          quantity: 50
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.message || res.body.error).toMatch(/recipe.*(not applicable|item mismatch|grade mismatch|incompatible)/i);
    });

    it('Invariant 6: Rejects Outward Challan (OC) referencing mismatched or unrelated GRN and BO records', async () => {
      const mockBoUnrelated = {
        id: 'bo_unrelated_88',
        tenantId: testTenant,
        jobNumber: 'BO-UNRELATED-88',
        poId: 'po_unrelated_88',
        grnId: 'grn_unrelated_88',
        status: 'WAITING_FOR_DISPATCH',
        isDeleted: false
      };

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockBoUnrelated as any);

      const res = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .send({
          batchOrderId: mockBoUnrelated.id,
          poId: 'po_different_99',
          grnId: 'grn_different_99',
          carrierName: 'Expedited Air Freight',
          vehicleNumber: 'WA-776-TRK'
        });

      expect(res.status).toBe(400);
      expect(res.body.message || res.body.error).toMatch(/bo\/grn mismatch|po.*grn.*mismatch|does not match batch order/i);
    });
  });

  // =========================================================================
  // 2. FULL AUTHORITATIVE ERP LIFECYCLE (ITEM → RECIPE → PO → GRN → BO → INSPECTION → OC)
  // =========================================================================
  describe('Full Business Lifecycle E2E Workflow', () => {
    it('Step 1: Creates and validates Purchase Order with active Supplier and Item', async () => {
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${procurementToken}`)
        .send({
          supplierCode: validSupplier.customerCode,
          supplierName: validSupplier.companyName,
          expectedDeliveryDate: '2026-10-15',
          items: [
            {
              itemId: validItem.id,
              recipeId: validRecipe.id,
              orderedQuantity: 200,
              unitPrice: 120
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.poNumber).toBe('PO-202609-0001');

      // Verify immutable snapshot: Supplier details captured into PO
      expect(res.body.data.supplierCode).toBe(validSupplier.customerCode);
    });

    it('Step 2: Receives Material and issues official GRN with Heat-Lot traceability', async () => {
      expect(persistentPo).toBeDefined();

      const res = await request(app)
        .post('/api/v1/grns')
        .set('Authorization', `Bearer ${storekeeperToken}`)
        .send({
          poId: persistentPo.id,
          supplierChallanNumber: 'DC-AERO-5501',
          items: [
            {
              itemId: validItem.id,
              receivedQuantity: 200,
              acceptedQuantity: 200,
              supplierHeatNumber: 'HEAT-TI-AERO-2026'
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.grnNumber).toBe('GRN-202609-0001');
    });

    it('Step 3: Creates Batch Order (BO) derived from GRN and Recipe', async () => {
      expect(persistentPo).toBeDefined();
      expect(persistentGrn).toBeDefined();

      const res = await request(app)
        .post('/api/v1/production-jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          poId: persistentPo.id,
          grnId: persistentGrn.id,
          itemId: validItem.id,
          recipeId: validRecipe.id,
          quantity: 200
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jobNumber).toBe('BO-202609-0001');
    });

    it('Step 4: Executes Production Handoff into IN_PRODUCTION', async () => {
      expect(persistentBo).toBeDefined();

      const res = await request(app)
        .post(`/api/v1/production-jobs/${persistentBo.id}/take-for-production`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          notes: 'Thermal cycle soak initialized at 960C; vacuum level conforming'
        });

      expect([200, 201]).toContain(res.status);
      expect(persistentBo.status).toBe('IN_PRODUCTION');
    });

    it('Step 5: Approves Inspection for Dispatch staging into WAITING_FOR_DISPATCH', async () => {
      expect(persistentBo).toBeDefined();

      const res = await request(app)
        .post(`/api/v1/production-jobs/${persistentBo.id}/approve-for-dispatch`)
        .set('Authorization', `Bearer ${qcInspectorToken}`)
        .send({
          measuredAverage: 39.5,
          scale: 'HRC',
          effectiveCaseDepthMm: 1.2,
          quantityDelivered: 200,
          remarks: 'Conforming test results to AMS 4928 aerospace standard'
        });

      expect([200, 201]).toContain(res.status);
      expect(persistentBo.status).toBe('WAITING_FOR_DISPATCH');
    });

    it('Step 6: Creates Outward Challan (OC) consignment derived from BO & GRN', async () => {
      expect(persistentBo).toBeDefined();

      const res = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .send({
          batchOrderId: persistentBo.id,
          carrierName: 'Aero Logistics Express',
          vehicleNumber: 'US-DEF-8821',
          driverName: 'John Mercer'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.outwardChallanNumber).toBe('OC-202609-0001');
    });

    it('Step 7: Performs Authorization (Signatory Approval)', async () => {
      expect(persistentOc).toBeDefined();

      const res = await request(app)
        .post(`/api/v1/dispatches/${persistentOc.id}/authorize`)
        .set('Authorization', `Bearer ${procurementToken}`)
        .send({
          approvalNotes: 'Conforming metallurgical and mechanical test reports verified.'
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
    });

    it('Step 8: Executes Physical Consignment Dispatch through Security Gate', async () => {
      expect(persistentOc).toBeDefined();
      persistentOc.status = 'AUTHORIZED';

      const res = await request(app)
        .post(`/api/v1/dispatches/${persistentOc.id}/dispatch`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .send({
          carrierName: 'Aero Logistics Express',
          vehicleNumber: 'US-DEF-8821',
          dispatchDate: new Date().toISOString(),
          securityOfficerName: 'Sergeant Thomas Wayne'
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      expect(persistentOc.status).toBe('DISPATCHED');
    });

    it('Step 9: Customer Acknowledges Delivery', async () => {
      expect(persistentOc).toBeDefined();
      persistentOc.status = 'DISPATCHED';

      const res = await request(app)
        .post(`/api/v1/dispatches/${persistentOc.id}/acknowledge`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .send({
          receivedBy: 'Commander Sarah Jenkins',
          remarks: 'Received in full without transit damage.'
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
    });
  });

  // =========================================================================
  // 3. SECURITY, PERMISSIONS & MULTI-TENANT ISOLATION
  // =========================================================================
  describe('RBAC & Multi-Tenant Isolation Strict Enforcement', () => {
    it('Rejects unprivileged user from issuing Purchase Orders', async () => {
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${unprivilegedToken}`)
        .send({
          supplierCode: validSupplier.customerCode,
          supplierName: validSupplier.companyName,
          expectedDeliveryDate: '2026-10-15',
          items: [{ itemId: validItem.id, recipeId: validRecipe.id, orderedQuantity: 10 }]
        });

      expect([401, 403]).toContain(res.status);
    });

    it('Rejects unprivileged user from performing physical dispatch', async () => {
      const res = await request(app)
        .post('/api/v1/dispatches/dsp_test/dispatch')
        .set('Authorization', `Bearer ${unprivilegedToken}`)
        .send({
          carrierName: 'Aero Express',
          vehicleNumber: 'WA-1234',
          dispatchDate: new Date().toISOString()
        });

      expect([401, 403]).toContain(res.status);
    });

    it('Enforces strict Tenant Isolation: Tenant B cannot access Tenant A records', async () => {
      const tenantADispatch = {
        id: 'dsp_tenant_a_secret',
        _id: 'dsp_tenant_a_secret',
        tenantId: testTenant,
        outwardChallanNumber: 'OC-SECRET-A',
        isDeleted: false
      };

      jest.spyOn(dispatchRepository, 'findById').mockImplementation(async (tenantId?: string) => {
        if (tenantId && tenantId !== testTenant) return null;
        return tenantADispatch as any;
      });

      const res = await request(app)
        .get(`/api/v1/dispatches/${tenantADispatch.id}`)
        .set('Authorization', `Bearer ${tenantBUserToken}`);

      expect([403, 404]).toContain(res.status);
    });

    it('Enforces double-dispatch prevention (Idempotency / Guarded transitions)', async () => {
      const mockAlreadyDispatched = {
        id: 'dsp_already_gone',
        _id: 'dsp_already_gone',
        tenantId: testTenant,
        status: 'DISPATCHED',
        isDeleted: false
      };

      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(mockAlreadyDispatched as any);

      const res = await request(app)
        .post(`/api/v1/dispatches/${mockAlreadyDispatched.id}/dispatch`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .send({
          carrierName: 'Aero Express',
          vehicleNumber: 'WA-9921',
          dispatchDate: new Date().toISOString()
        });

      expect(res.status).toBe(400);
      expect(res.body.message || res.body.error).toMatch(/already.*dispatched|invalid state|not in authorized status/i);
    });
  });
});
