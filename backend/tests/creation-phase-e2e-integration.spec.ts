import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { purchaseOrderRepository } from '../src/modules/purchase-order/purchase-order.repository.js';
import { grnRepository } from '../src/modules/grn/grn.repository.js';
import { itemService } from '../src/modules/item/item.service.js';
import { recipeService } from '../src/modules/recipe/recipe.service.js';
import { warehouseService } from '../src/modules/warehouse/warehouse.service.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { rbacService } from '../src/modules/rbac/rbac.service.js';
import { PERMISSIONS } from '../src/modules/rbac/rbac.constants.js';

describe('Prompt 10: Creation Phase End-to-End Integration & Final Architecture Enforcement Suite', () => {
  const app = createApp();
  const testTenant = 'tenant_aerospace_mfg_001';

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@aeromfg.internal`, roles },
      config.auth.jwtSecret
    );
  };

  // Personas with strictly partitioned RBAC permissions
  const adminToken = generateToken('admin_01', ['ADMIN']);
  const procurementToken = generateToken('buyer_01', ['PURCHASING_AGENT']);
  const receiverToken = generateToken('receiver_01', ['INVENTORY_CLERK']);
  const storekeeperToken = generateToken('storekeeper_01', ['STORE_MANAGER']);
  const qcInspectorToken = generateToken('qc_inspector_01', ['QUALITY_INSPECTOR']);
  const plannerToken = generateToken('planner_01', ['PLANT_MANAGER']);
  const unprivilegedToken = generateToken('unprivileged_user_01', ['VIEW_ONLY_OPERATOR']);

  // Realistic aerospace manufacturing master records
  const mockItem = {
    id: 'item_aero_4340',
    itemCode: 'MAT-4340-RND-80',
    name: 'AISI 4340 Vacuum Arc Remelted Alloy Steel Round Bar Ø80mm',
    materialGrade: 'AISI 4340',
    category: 'RAW_MATERIAL',
    uom: 'KG',
    hsnCode: '7228.30.29',
    status: 'active',
    isDeleted: false
  };

  const mockRecipe = {
    id: 'rec_carb_4340',
    recipeCode: 'REC-CARB-4340-01',
    revision: 2,
    processFamily: 'CARBURIZING',
    applicableMaterialGrades: ['AISI 4340', '300M'],
    status: 'ACTIVE',
    isDeleted: false,
    specifications: {
      caseDepthTargetMm: 1.2,
      surfaceHardnessHrcTarget: 60
    }
  };

  const mockWarehouse = {
    id: 'wh_aero_01',
    code: 'WH-AERO-01',
    name: 'Aerospace Raw Bar Stock Facility',
    status: 'ACTIVE'
  };

  const mockLocation = {
    id: 'loc_bay_01',
    warehouseId: 'wh_aero_01',
    warehouseCode: 'WH-AERO-01',
    locationCode: 'BAY-AERO-01',
    zone: 'Aero Bar Yard',
    status: 'ACTIVE'
  };

  // State caches simulating database across the end-to-end chain
  let storedPo: any = null;
  let storedReceipt: any = null;
  let storedGrn: any = null;
  let storedUnits: any[] = [];
  const auditRecords: any[] = [];

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup RBAC mocks
    jest.spyOn(rbacService, 'getUserEffectivePermissions').mockImplementation(async (_tenant, _userId, roles) => {
      const perms = new Set<string>();
      if (roles.includes('ADMIN') || roles.includes('SUPERADMIN')) {
        perms.add('*');
        perms.add(PERMISSIONS.PURCHASE_ORDER_CREATE);
        perms.add(PERMISSIONS.INVENTORY_STORAGE_RECORD);
        perms.add(PERMISSIONS.INVENTORY_GRN_CREATE);
        perms.add(PERMISSIONS.INVENTORY_GRN_VIEW);
        perms.add(PERMISSIONS.INVENTORY_GRN_PRINT);
        perms.add(PERMISSIONS.PRODUCTION_JOB_CREATE);
      }
      if (roles.includes('PURCHASING_AGENT')) {
        perms.add(PERMISSIONS.PURCHASE_ORDER_CREATE);
        perms.add(PERMISSIONS.PURCHASE_ORDER_VIEW);
      }
      if (roles.includes('INVENTORY_CLERK')) {
        perms.add(PERMISSIONS.INVENTORY_STORAGE_RECORD);
        perms.add(PERMISSIONS.INVENTORY_GRN_VIEW);
      }
      if (roles.includes('STORE_MANAGER')) {
        perms.add(PERMISSIONS.INVENTORY_STORAGE_RECORD);
        perms.add(PERMISSIONS.INVENTORY_GRN_CREATE);
        perms.add(PERMISSIONS.INVENTORY_GRN_VIEW);
        perms.add(PERMISSIONS.INVENTORY_GRN_PRINT);
      }
      if (roles.includes('QUALITY_INSPECTOR')) {
        perms.add(PERMISSIONS.INVENTORY_GRN_CREATE);
        perms.add(PERMISSIONS.INVENTORY_GRN_VIEW);
        perms.add(PERMISSIONS.INVENTORY_GRN_PRINT);
      }
      if (roles.includes('PLANT_MANAGER')) {
        perms.add(PERMISSIONS.PRODUCTION_JOB_CREATE);
        perms.add(PERMISSIONS.INVENTORY_GRN_VIEW);
        perms.add(PERMISSIONS.INVENTORY_GRN_CREATE);
      }
      return {
        roles,
        permissions: Array.from(perms),
        effectivePermissions: Array.from(perms),
        isSuperAdmin: roles.includes('ADMIN') || roles.includes('SUPERADMIN')
      } as any;
    });

    // Mock Audit Service
    jest.spyOn(auditService, 'record').mockImplementation(async (_tenant, entry) => {
      auditRecords.push(entry);
      return entry as any;
    });

    // Mock Item & Recipe Services
    jest.spyOn(itemService, 'getItemById').mockResolvedValue(mockItem as any);
    jest.spyOn(recipeService, 'getRecipeById').mockResolvedValue(mockRecipe as any);

    // Mock Warehouse Service
    jest.spyOn(warehouseService, 'getWarehouseById').mockResolvedValue(mockWarehouse as any);
    jest.spyOn(warehouseService, 'getLocationByCode').mockResolvedValue(mockLocation as any);

    // Mock Purchase Order Repository
    jest.spyOn(purchaseOrderRepository, 'generateNextPoNumber').mockResolvedValue('PO-202609-0001');
    jest.spyOn(purchaseOrderRepository, 'create').mockImplementation(async (_tenant, poData) => {
      storedPo = {
        id: 'po_aero_001',
        _id: 'po_aero_001',
        ...poData,
        status: 'ISSUED',
        createdAt: new Date().toISOString()
      };
      return storedPo;
    });
    jest.spyOn(purchaseOrderRepository, 'findById').mockImplementation(async (_tenant, id) => {
      if (storedPo && (storedPo.id === id || storedPo._id === id || storedPo.poNumber === id)) {
        return storedPo;
      }
      return null;
    });
    jest.spyOn(purchaseOrderRepository, 'update').mockImplementation(async (_tenant, id, updates) => {
      if (storedPo && (storedPo.id === id || storedPo._id === id)) {
        Object.assign(storedPo, updates);
        return storedPo;
      }
      return null;
    });

    // Mock GRN Repository
    jest.spyOn(grnRepository, 'generateNextReceiptNumber').mockResolvedValue('MR-202609-0001');
    jest.spyOn(grnRepository, 'createReceipt').mockImplementation(async (_tenant, receiptData) => {
      storedReceipt = {
        id: 'rcpt_aero_001',
        _id: 'rcpt_aero_001',
        ...receiptData,
        status: 'RECEIVED',
        totalStoredQuantity: 0,
        remainingQuantityToStore: receiptData.totalReceivedQuantity,
        storageMovements: [],
        movementHistory: [],
        createdAt: new Date().toISOString(),
        save: jest.fn().mockImplementation(async function(this: any) { return this; }),
        toObject: function(this: any) { return { ...this }; },
        toJSON: function(this: any) { return { ...this }; }
      };
      return storedReceipt;
    });

    jest.spyOn(grnRepository, 'findReceiptById').mockImplementation(async (_tenant, id) => {
      if (storedReceipt && (storedReceipt.id === id || storedReceipt._id === id || storedReceipt.receiptNumber === id)) {
        return storedReceipt;
      }
      return null;
    });

    jest.spyOn(grnRepository, 'atomicStoreReceipt').mockImplementation(async (_tenant, id, _statuses, updates, movement, _qty) => {
      if (storedReceipt && (storedReceipt.id === id || storedReceipt._id === id)) {
        Object.assign(storedReceipt, updates);
        if (movement) {
          storedReceipt.storageMovements = storedReceipt.storageMovements || [];
          storedReceipt.storageMovements.push(movement);
          storedReceipt.movementHistory = storedReceipt.movementHistory || [];
          storedReceipt.movementHistory.push(movement);
        }
        return storedReceipt;
      }
      return null;
    });

    jest.spyOn(grnRepository, 'generateNextGrnNumber').mockResolvedValue('GRN-202609-0001');
    jest.spyOn(grnRepository, 'createGrn').mockImplementation(async (_tenant, grnData) => {
      storedGrn = {
        id: 'grn_aero_001',
        _id: 'grn_aero_001',
        ...grnData,
        printCount: 0,
        createdAt: new Date().toISOString(),
        save: jest.fn().mockImplementation(async function(this: any) { return this; }),
        toObject: function(this: any) { return { ...this }; },
        toJSON: function(this: any) { return { ...this }; }
      };
      return storedGrn;
    });

    jest.spyOn(grnRepository, 'createGrnUnits').mockImplementation(async (_tenant, units) => {
      storedUnits = units.map((u, idx) => ({
        id: `unit_aero_${idx + 1}`,
        _id: `unit_aero_${idx + 1}`,
        ...u,
        createdAt: new Date().toISOString(),
        save: jest.fn().mockImplementation(async function(this: any) { return this; }),
        toObject: function(this: any) { return { ...this }; },
        toJSON: function(this: any) { return { ...this }; }
      }));
      return storedUnits;
    });

    jest.spyOn(grnRepository, 'atomicTransitionReceiptToGrnCreated').mockImplementation(async (_tenant, receiptId) => {
      if (storedReceipt && (storedReceipt.id === receiptId || storedReceipt._id === receiptId)) {
        storedReceipt.status = 'GRN_CREATED';
        return storedReceipt;
      }
      return null;
    });

    jest.spyOn(grnRepository, 'findGrnById').mockImplementation(async (_tenant, id) => {
      if (storedGrn && (storedGrn.id === id || storedGrn._id === id || storedGrn.grnNumber === id)) {
        return storedGrn;
      }
      return null;
    });

    jest.spyOn(grnRepository, 'findGrnByNumber').mockImplementation(async (_tenant, grnNumber) => {
      if (storedGrn && (storedGrn.grnNumber === grnNumber || storedGrn.id === grnNumber)) {
        return storedGrn;
      }
      return null;
    });

    jest.spyOn(grnRepository, 'queryUnits').mockImplementation(async (_tenant, query: any) => {
      let filtered = [...storedUnits];
      if (query?.grnNumber) {
        filtered = filtered.filter((u) => u.grnNumber === query.grnNumber);
      }
      if (query?.status) {
        filtered = filtered.filter((u) => u.status === query.status);
      }
      return { units: filtered, total: filtered.length };
    });

    jest.spyOn(grnRepository, 'findUnitsByGrnId').mockImplementation(async (_tenant, grnId) => {
      return storedUnits.filter((u) => u.grnId === grnId || u.grnNumber === grnId);
    });

    jest.spyOn(grnRepository, 'findUnitByIdentifier').mockImplementation(async (_tenant, unitIdentifier) => {
      return storedUnits.find((u) => u.unitIdentifier === unitIdentifier) || null;
    });

    jest.spyOn(grnRepository, 'allocateUnit').mockImplementation(async (_tenant, unitIdentifier, planId, planNumber, jobId) => {
      const u = storedUnits.find((x) => x.unitIdentifier === unitIdentifier);
      if (u) {
        u.status = 'ALLOCATED_TO_PLAN';
        u.allocatedPlanId = planId;
        u.allocatedPlanNumber = planNumber;
        u.allocatedJobId = jobId;
        u.allocatedAt = new Date();
        return u;
      }
      return null;
    });

    jest.spyOn(grnRepository, 'updateUnitStatus').mockImplementation(async (_tenant, unitIdentifier, status, allocatedPlanId, allocatedPlanNumber) => {
      const u = storedUnits.find((x) => x.unitIdentifier === unitIdentifier);
      if (u) {
        u.status = status;
        u.allocatedPlanId = allocatedPlanId;
        u.allocatedPlanNumber = allocatedPlanNumber;
        u.allocatedAt = new Date();
        return u;
      }
      return null;
    });

    jest.spyOn(grnRepository, 'queryAvailableUnitsForPlanning').mockImplementation(async (_tenant, itemId, recipeId, materialGrade) => {
      return storedUnits.filter((u) => {
        if (u.status !== 'AVAILABLE_FOR_PLANNING') return false;
        if (itemId && u.itemId !== itemId) return false;
        if (recipeId && u.recipeId !== recipeId) return false;
        if (materialGrade && u.materialGrade !== materialGrade) return false;
        return true;
      });
    });
  });

  // =========================================================================
  // 1. FULL CREATION PHASE HAPPY PATH (END-TO-END EXECUTION)
  // =========================================================================
  describe('1. Full Authoritative Creation Phase Happy Path (E2E Chain)', () => {
    it('Step 1 (PO Creation): Authorized Buyer creates PO binding Item and Metallurgical Recipe', async () => {
      const poPayload = {
        supplierName: 'TimkenSteel Corporation',
        supplierCode: 'SUP-TIMKEN-01',
        orderDate: new Date().toISOString(),
        expectedDeliveryDate: new Date(Date.now() + 14 * 86400000).toISOString(),
        items: [
          {
            itemId: mockItem.id,
            recipeId: mockRecipe.id,
            orderedQuantity: 5000,
            unitPrice: 12.5,
            processingRequirement: 'Vacuum Carburize AMS 2759/7 to 1.2mm ECD and Oil Quench'
          }
        ]
      };

      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${procurementToken}`)
        .send(poPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.poNumber).toBe('PO-202609-0001');
      expect(res.body.data.status).toBe('ISSUED');
      expect(res.body.data.supplierName).toBe('TimkenSteel Corporation');
      expect(res.body.data.items[0].materialGrade).toBe('AISI 4340');
      expect(res.body.data.items[0].recipeCode).toBe('REC-CARB-4340-01');
      expect(res.body.data.items[0].recipeRevision).toBe(2);
      expect(res.body.data.items[0].orderedQuantity).toBe(5000);

      expect(storedPo).toBeDefined();
      expect(storedPo.poNumber).toBe('PO-202609-0001');
    });

    it('Step 2 (Physical Material Receipt): Receiver records physical delivery against PO at factory gate', async () => {
      const receiptPayload = {
        poId: storedPo.id,
        supplierChallanNumber: 'DC-TIMKEN-9941',
        supplierChallanDate: new Date().toISOString().slice(0, 10),
        supplierInvoiceNumber: 'INV-TK-2026-9941',
        carrierVehicle: 'MH-12-PQ-9001',
        items: [
          {
            poLineItemId: storedPo.items[0].lineItemId,
            itemId: mockItem.id,
            receivedQuantity: 5000,
            supplierHeatNumber: 'TK-HEAT-4340-901',
            mtrNumber: 'MTR-TK-2026-901'
          }
        ]
      };

      const res = await request(app)
        .post('/api/v1/grn/material-receipts')
        .set('Authorization', `Bearer ${receiverToken}`)
        .send(receiptPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.receiptNumber).toBe('MR-202609-0001');
      expect(res.body.data.status).toBe('RECEIVED');
      expect(res.body.data.supplierChallanNumber).toBe('DC-TIMKEN-9941');
      expect(res.body.data.items[0].supplierHeatNumber).toBe('TK-HEAT-4340-901');
      expect(res.body.data.items[0].receivedQuantity).toBe(5000);

      expect(storedReceipt).toBeDefined();
      expect(storedReceipt.status).toBe('RECEIVED');
      expect(storedReceipt.remainingQuantityToStore).toBe(5000);
    });

    it('Step 3 (Warehouse Storage Putaway): Storekeeper puts away received material into warehouse bay', async () => {
      const storagePayload = {
        warehouseId: mockWarehouse.id,
        storageLocationCode: mockLocation.locationCode,
        quantity: 5000,
        storageNotes: 'Put away into Aero Raw Bar stock yard Bay 1'
      };

      const res = await request(app)
        .post(`/api/v1/grn/receipts/${storedReceipt.id}/store`)
        .set('Authorization', `Bearer ${storekeeperToken}`)
        .send(storagePayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('STORED');
      expect(res.body.data.warehouseCode).toBe('WH-AERO-01');
      expect(res.body.data.storageLocationCode).toBe('BAY-AERO-01');
      expect(res.body.data.totalStoredQuantity).toBe(5000);
      expect(res.body.data.remainingQuantityToStore).toBe(0);
      expect(res.body.data.storageMovements.length).toBe(1);

      expect(storedReceipt.status).toBe('STORED');
    });

    it('Step 4 (GRN Creation): QC Inspector generates GRN under PO with bound recipe and heat lot', async () => {
      const grnPayload = {
        poId: storedPo.id,
        materialReceiptId: storedReceipt.id,
        unitGenerationMode: 'BY_LOT',
        remarks: 'Chemistry & dimensions verified 100% compliant with AISI 4340 AMS 2759/7',
        items: [
          {
            poLineItemId: storedPo.items[0].lineItemId,
            itemId: mockItem.id,
            receivedQuantity: 5000,
            acceptedQuantity: 5000,
            supplierHeatNumber: 'TK-HEAT-4340-901',
            mtrNumber: 'MTR-TK-2026-901'
          }
        ]
      };

      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${qcInspectorToken}`)
        .send(grnPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.grnNumber).toBe('GRN-202609-0001');
      expect(res.body.data.poNumber).toBe('PO-202609-0001');
      expect(res.body.data.supplierName).toBe('TimkenSteel Corporation'); // Authoritative PO derivation
      expect(res.body.data.status).toBe('AVAILABLE_FOR_PLANNING');
      expect(res.body.data.totalUnitsGenerated).toBeGreaterThan(0);

      // Verify Material Receipt transitioned to GRN_CREATED
      expect(storedReceipt.status).toBe('GRN_CREATED');
      expect(storedGrn).toBeDefined();
      expect(storedUnits.length).toBeGreaterThan(0);
    });

    it('Step 5 (Individual Part Units): Every generated unit contains complete authoritative lineage', async () => {
      const res = await request(app)
        .get('/api/v1/grn/units/traceable')
        .set('Authorization', `Bearer ${qcInspectorToken}`)
        .query({ grnNumber: 'GRN-202609-0001' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const firstUnit = res.body.data[0];
      expect(firstUnit.poId).toBe(storedPo.id);
      expect(firstUnit.poNumber).toBe(storedPo.poNumber);
      expect(firstUnit.grnId).toBe(storedGrn.id);
      expect(firstUnit.grnNumber).toBe(storedGrn.grnNumber);
      expect(firstUnit.materialReceiptId).toBe(storedReceipt.id);
      expect(firstUnit.itemCode).toBe('MAT-4340-RND-80');
      expect(firstUnit.materialGrade).toBe('AISI 4340');
      expect(firstUnit.recipeCode).toBe('REC-CARB-4340-01');
      expect(firstUnit.recipeRevision).toBe(2);
      expect(firstUnit.supplierHeatNumber).toBe('TK-HEAT-4340-901');
      expect(firstUnit.mtrNumber || firstUnit.millTestCertificateNumber).toBe('MTR-TK-2026-901');
      expect(firstUnit.warehouseCode).toBe('WH-AERO-01');
      expect(firstUnit.storageLocationCode).toBe('BAY-AERO-01');
      expect(firstUnit.status).toBe('AVAILABLE_FOR_PLANNING');
    });

    it('Step 6 (Recipe Traceability): Bi-directional lookup verifies Unit -> Recipe and Recipe -> Units', async () => {
      const unitId = storedUnits[0].unitIdentifier;

      // Forward query: Unit Traceability
      const traceRes = await request(app)
        .get(`/api/v1/grn/units/${unitId}/traceability`)
        .set('Authorization', `Bearer ${qcInspectorToken}`);

      expect(traceRes.status).toBe(200);
      expect(traceRes.body.success).toBe(true);
      expect(traceRes.body.data.unitIdentifier).toBe(unitId);
      expect(traceRes.body.data.po.poNumber).toBe('PO-202609-0001');
      expect(traceRes.body.data.recipe.recipeCode).toBe('REC-CARB-4340-01');
      expect(traceRes.body.data.recipe.processFamily).toBe('CARBURIZING');

      // Reverse query: Available units for Recipe
      const recipeRes = await request(app)
        .get('/api/v1/grn/units/available-for-planning')
        .set('Authorization', `Bearer ${plannerToken}`)
        .query({ itemId: mockItem.id, recipeId: mockRecipe.id });

      expect(recipeRes.status).toBe(200);
      expect(recipeRes.body.success).toBe(true);
      expect(recipeRes.body.data.length).toBe(storedUnits.length);
      expect(recipeRes.body.data.every((u: any) => u.recipeCode === 'REC-CARB-4340-01')).toBe(true);
    });

    it('Step 7 (GRN Viewing & Printing): Authorized user views record and prints Nadcap certificate with PO banner', async () => {
      // 1. Authoritative Record View
      const viewRes = await request(app)
        .get(`/api/v1/grn/${storedGrn.id}`)
        .set('Authorization', `Bearer ${storekeeperToken}`);

      expect(viewRes.status).toBe(200);
      expect(viewRes.body.success).toBe(true);
      expect(viewRes.body.data.grnNumber).toBe('GRN-202609-0001');
      expect(viewRes.body.data.poNumber).toBe('PO-202609-0001');
      expect(viewRes.body.data.supplierName).toBe('TimkenSteel Corporation');
      expect(viewRes.body.data.units.length).toBe(storedUnits.length);

      // 2. Printable Certificate Generation (with PO lineage banner)
      const printRes = await request(app)
        .get(`/api/v1/grn/${storedGrn.id}/print`)
        .set('Authorization', `Bearer ${storekeeperToken}`)
        .set('Accept', 'text/html');

      expect(printRes.status).toBe(200);
      expect(printRes.text).toContain('GOODS RECEIPT NOTE');
      expect(printRes.text).toContain('PO-202609-0001');
      expect(printRes.text).toContain('Authoritative Lineage:');
      expect(printRes.text).toContain('TimkenSteel Corporation');
      expect(printRes.text).toContain('REC-CARB-4340-01');
      expect(printRes.text).toContain('Stores / Receiving In-Charge');
      expect(printRes.text).toContain('Metallurgical QC Inspector');
      expect(printRes.text).toContain('Plant Operations Manager');

      // Verify print audit event
      const printAudit = auditRecords.find((a) => a.action === 'GRN_PRINTED');
      expect(printAudit).toBeDefined();
      expect(printAudit.entityId).toBe(storedGrn.id);
      expect(storedGrn.printCount).toBeGreaterThanOrEqual(1);
    });

    it('Step 8 (Available for Planning Gate): Planner successfully allocates certified unit and genealogy is locked', async () => {
      const unitToAllocate = storedUnits[0];

      const allocPayload = {
        allocatedPlanId: 'plan_aerospace_001',
        allocatedPlanNumber: 'PLAN-202609-0001',
        allocatedQuantity: unitToAllocate.quantity,
        allocationNotes: 'Allocated to Aerospace Pinion Production Batch 1'
      };

      const allocRes = await request(app)
        .post(`/api/v1/grn/units/${unitToAllocate.unitIdentifier}/allocate`)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send(allocPayload);

      expect(allocRes.status).toBe(200);
      expect(allocRes.body.success).toBe(true);
      expect(allocRes.body.data.status).toBe('ALLOCATED_TO_PLAN');
      expect(allocRes.body.data.allocatedPlanNumber).toBe('PLAN-202609-0001');

      // Attempting to re-allocate or alter genealogy is permanently blocked
      const reAllocRes = await request(app)
        .post(`/api/v1/grn/units/${unitToAllocate.unitIdentifier}/allocate`)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send(allocPayload);

      expect(reAllocRes.status).toBe(400);
      expect(reAllocRes.body.message).toContain('State Machine Violation');
      expect(reAllocRes.body.message).toContain('ALLOCATED_TO_PLAN');
    });
  });

  // =========================================================================
  // 2. AUTHORIZATION TESTING (STRICT SERVER-SIDE BOUNDARIES)
  // =========================================================================
  describe('2. Authorization Testing (Every Creation Phase Permission Boundary)', () => {
    it('rejects unauthorized PO creation from user lacking PURCHASE_ORDER_CREATE', async () => {
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${unprivilegedToken}`)
        .send({
          supplierName: 'Rogue Supplier',
          items: [{ itemId: mockItem.id, recipeId: mockRecipe.id, orderedQuantity: 100 }]
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Access Denied');
    });

    it('rejects unauthorized material receipt from user lacking INVENTORY_STORAGE_RECORD', async () => {
      const res = await request(app)
        .post('/api/v1/grn/material-receipts')
        .set('Authorization', `Bearer ${unprivilegedToken}`)
        .send({
          poId: storedPo.id,
          supplierChallanNumber: 'DC-UNAUTH-01',
          items: [{ itemId: mockItem.id, receivedQuantity: 100, supplierHeatNumber: 'H1' }]
        });

      expect(res.status).toBe(403);
    });

    it('rejects unauthorized warehouse storage from user lacking INVENTORY_STORAGE_RECORD', async () => {
      const res = await request(app)
        .post(`/api/v1/grn/receipts/${storedReceipt.id}/store`)
        .set('Authorization', `Bearer ${unprivilegedToken}`)
        .send({
          warehouseId: mockWarehouse.id,
          storageLocationCode: 'BAY-01',
          quantity: 100
        });

      expect(res.status).toBe(403);
    });

    it('rejects unauthorized GRN creation from user lacking INVENTORY_GRN_CREATE', async () => {
      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${unprivilegedToken}`)
        .send({
          poId: storedPo.id,
          materialReceiptId: storedReceipt.id,
          items: [{ itemId: mockItem.id, receivedQuantity: 100 }]
        });

      expect(res.status).toBe(403);
    });

    it('rejects unauthorized GRN viewing from user lacking INVENTORY_GRN_VIEW', async () => {
      const res = await request(app)
        .get(`/api/v1/grn/${storedGrn.id}`)
        .set('Authorization', `Bearer ${unprivilegedToken}`);

      expect(res.status).toBe(403);
    });

    it('rejects unauthorized GRN printing from user lacking INVENTORY_GRN_PRINT', async () => {
      const res = await request(app)
        .get(`/api/v1/grn/${storedGrn.id}/print`)
        .set('Authorization', `Bearer ${unprivilegedToken}`);

      expect(res.status).toBe(403);
    });

    it('rejects unauthenticated requests without JWT across Creation Phase routes', async () => {
      const poRes = await request(app).post('/api/v1/purchase-orders').send({});
      expect(poRes.status).toBe(401);

      const rcptRes = await request(app).post('/api/v1/grn/material-receipts').send({});
      expect(rcptRes.status).toBe(401);

      const grnRes = await request(app).post('/api/v1/grn').send({});
      expect(grnRes.status).toBe(401);

      const printRes = await request(app).get(`/api/v1/grn/${storedGrn.id}/print`);
      expect(printRes.status).toBe(401);
    });
  });

  // =========================================================================
  // 3. DATA INTEGRITY & STATE MACHINE ANTI-BYPASS TESTING
  // =========================================================================
  describe('3. Data Integrity & State Machine Anti-Bypass Testing', () => {
    it('rejects PO creation if Item material grade is incompatible with Recipe', async () => {
      const incompatibleRecipe = {
        ...mockRecipe,
        id: 'rec_incompatible',
        applicableMaterialGrades: ['INCONEL 718', 'TITANIUM GR5']
      };
      jest.spyOn(recipeService, 'getRecipeById').mockResolvedValueOnce(incompatibleRecipe as any);

      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${procurementToken}`)
        .send({
          supplierName: 'TimkenSteel',
          expectedDeliveryDate: new Date(Date.now() + 14 * 86400000).toISOString(),
          items: [{ itemId: mockItem.id, recipeId: 'rec_incompatible', orderedQuantity: 500 }]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Material grade mismatch');
    });

    it('rejects material receipt against DRAFT, CANCELLED, or non-existent PO', async () => {
      const draftPo = { ...storedPo, status: 'DRAFT' };
      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValueOnce(draftPo as any);

      const res = await request(app)
        .post('/api/v1/grn/material-receipts')
        .set('Authorization', `Bearer ${receiverToken}`)
        .send({
          poId: storedPo.id,
          supplierChallanNumber: 'DC-999',
          items: [{ itemId: mockItem.id, receivedQuantity: 100, supplierHeatNumber: 'H1' }]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("'DRAFT' status");
    });

    it('rejects excessive material receipt exceeding PO ordered balance', async () => {
      const issuedPo = {
        ...storedPo,
        status: 'ISSUED',
        totalOrderedQuantity: 5000,
        totalReceivedQuantity: 0,
        items: storedPo.items.map((i: any) => ({ ...i, receivedQuantity: 0, balanceQuantity: 5000 }))
      };
      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValueOnce(issuedPo as any);

      const res = await request(app)
        .post('/api/v1/grn/material-receipts')
        .set('Authorization', `Bearer ${receiverToken}`)
        .send({
          poId: storedPo.id,
          supplierChallanNumber: 'DC-EXCESS-01',
          items: [{ itemId: mockItem.id, receivedQuantity: 999999, supplierHeatNumber: 'H1' }]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('exceeds remaining ordered quantity');
    });

    it('rejects storage putaway if material receipt is not in RECEIVED or PARTIALLY_STORED status', async () => {
      const alreadyStoredReceipt = { ...storedReceipt, status: 'STORED', remainingQuantityToStore: 0 };
      jest.spyOn(grnRepository, 'findReceiptById').mockResolvedValueOnce(alreadyStoredReceipt as any);

      const res = await request(app)
        .post(`/api/v1/grn/receipts/${storedReceipt.id}/store`)
        .set('Authorization', `Bearer ${storekeeperToken}`)
        .send({
          warehouseId: mockWarehouse.id,
          storageLocationCode: 'BAY-AERO-01',
          quantity: 100
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Duplicate storage');
    });

    it('rejects GRN creation if material has not been stored into warehouse (State Skipping)', async () => {
      const unstoredReceipt = { ...storedReceipt, status: 'RECEIVED', totalStoredQuantity: 0 };
      jest.spyOn(grnRepository, 'findReceiptById').mockResolvedValueOnce(unstoredReceipt as any);

      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${qcInspectorToken}`)
        .send({
          poId: storedPo.id,
          materialReceiptId: storedReceipt.id,
          items: [{ itemId: mockItem.id, receivedQuantity: 100 }]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Material must be stored in the warehouse first');
    });

    it('rejects duplicate GRN generation on already GRN_CREATED receipt', async () => {
      const completedReceipt = { ...storedReceipt, status: 'GRN_CREATED' };
      jest.spyOn(grnRepository, 'findReceiptById').mockResolvedValueOnce(completedReceipt as any);

      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${qcInspectorToken}`)
        .send({
          poId: storedPo.id,
          materialReceiptId: storedReceipt.id,
          items: [{ itemId: mockItem.id, receivedQuantity: 100 }]
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('Duplicate GRN');
    });

    it('rejects GRN creation with items not present in parent PO', async () => {
      const storedEligibleReceipt = { ...storedReceipt, status: 'STORED' };
      jest.spyOn(grnRepository, 'findReceiptById').mockResolvedValueOnce(storedEligibleReceipt as any);

      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${qcInspectorToken}`)
        .send({
          poId: storedPo.id,
          materialReceiptId: storedReceipt.id,
          items: [{ itemId: 'rogue_item_unreferenced', receivedQuantity: 100, acceptedQuantity: 100 }]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('does not belong to Purchase Order');
    });
  });

  // =========================================================================
  // 4. INVENTORY QUANTITY CONSISTENCY & RECONCILIATION
  // =========================================================================
  describe('4. Inventory Quantity Consistency & Reconciliation Across Entire Chain', () => {
    it('verifies exact mathematical quantity conservation: Ordered = Received = Stored = Units Total', () => {
      const orderedQty = storedPo.items[0].orderedQuantity;
      const receivedQty = storedReceipt.items[0].receivedQuantity;
      const storedQty = storedReceipt.totalStoredQuantity;
      const grnAcceptedQty = storedGrn.items[0].acceptedQuantity;
      const totalUnitsQty = storedUnits.reduce((acc, u) => acc + u.quantity, 0);

      expect(orderedQty).toBe(5000);
      expect(receivedQty).toBe(5000);
      expect(storedQty).toBe(5000);
      expect(grnAcceptedQty).toBe(5000);
      expect(totalUnitsQty).toBe(5000);

      // Verify no drift or phantom stock
      expect(receivedQty - storedQty).toBe(0);
      expect(storedQty - grnAcceptedQty).toBe(0);
      expect(grnAcceptedQty - totalUnitsQty).toBe(0);
    });
  });

  // =========================================================================
  // 5. FINAL ARCHITECTURE INVARIANCE VERIFICATION
  // =========================================================================
  describe('5. Final Architecture Invariance Verification', () => {
    it('verifies state machine lifecycle endpoint returns strict linear sequence', async () => {
      const res = await request(app)
        .get('/api/v1/grn/state-control/lifecycle')
        .set('Authorization', `Bearer ${storekeeperToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sequence).toEqual([
        'PO_CREATED',
        'MATERIAL_RECEIVED',
        'MATERIAL_STORED',
        'GRN_CREATED',
        'CREATION_COMPLETE',
        'AVAILABLE_FOR_PLANNING',
        'ALLOCATED_TO_PLAN'
      ]);
      expect(res.body.data.enforcement).toBe('SERVER_SIDE_STRICT');
    });

    it('verifies that historical records remain accessible and printable even after unit allocation', async () => {
      // Units have been allocated to planning; assert GRN can still be viewed and printed
      const viewRes = await request(app)
        .get(`/api/v1/grn/${storedGrn.id}`)
        .set('Authorization', `Bearer ${storekeeperToken}`);

      expect(viewRes.status).toBe(200);
      expect(viewRes.body.data.grnNumber).toBe('GRN-202609-0001');

      const printRes = await request(app)
        .get(`/api/v1/grn/${storedGrn.id}/print`)
        .set('Authorization', `Bearer ${storekeeperToken}`);

      expect(printRes.status).toBe(200);
      expect(storedGrn.printCount).toBe(2);
    });
  });
});
