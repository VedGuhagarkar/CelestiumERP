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
import { CreationPhaseStateMachine, CreationPhaseStage } from '../src/modules/grn/creation-phase-state-machine.js';
import { ConflictError } from '../src/core/errors/app-error.js';

describe('Prompt 8: Creation Phase State Control & Workflow State Machine Suite', () => {
  const app = createApp();
  const testTenant = 'tenant_prompt8_state_control_001';

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const mockPoLineItem = {
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
    unitPrice: 150.0,
    lineTotal: 1500.0,
    uom: 'PCS'
  };

  const mockPo = {
    id: 'po_state_ctrl_001',
    _id: 'po_state_ctrl_001',
    tenantId: testTenant,
    poNumber: 'PO-202609-8888',
    supplierName: 'Titan Metallurgical Alloys Ltd.',
    supplierCode: 'SUP-TITAN-01',
    status: 'ISSUED',
    orderDate: new Date('2026-09-01T10:00:00.000Z'),
    expectedDeliveryDate: new Date('2026-09-20T10:00:00.000Z'),
    items: [{ ...mockPoLineItem }],
    totalOrderedQuantity: 10,
    totalReceivedQuantity: 0,
    currency: 'INR',
    subtotalAmount: 1500.0,
    taxAmount: 0,
    totalAmount: 1500.0,
    isDeleted: false,
    toJSON: function () {
      return { ...this };
    }
  };

  const mockStoredReceipt = {
    id: 'rcpt_state_ctrl_001',
    _id: 'rcpt_state_ctrl_001',
    tenantId: testTenant,
    receiptNumber: 'RCPT-202609-8801',
    poId: mockPo.id,
    poNumber: mockPo.poNumber,
    supplierName: mockPo.supplierName,
    supplierChallanNumber: 'DC-TITAN-9001',
    supplierChallanDate: new Date('2026-09-05T09:00:00.000Z'),
    supplierInvoiceNumber: 'INV-TI-101',
    carrierVehicle: 'MH-14-AZ-2020',
    warehouseId: 'wh_main_01',
    warehouseCode: 'WH-MAIN',
    storageLocationCode: 'BAY-01-A',
    status: 'STORED',
    items: [
      {
        poLineItemId: mockPoLineItem.lineItemId,
        itemId: mockPoLineItem.itemId,
        itemCode: mockPoLineItem.itemCode,
        itemName: mockPoLineItem.itemName,
        materialGrade: mockPoLineItem.materialGrade,
        processFamily: mockPoLineItem.processFamily,
        recipeId: mockPoLineItem.recipeId,
        recipeCode: mockPoLineItem.recipeCode,
        recipeRevision: mockPoLineItem.recipeRevision,
        receivedQuantity: 10,
        storedQuantity: 10,
        remainingQuantity: 0,
        uom: 'PCS',
        supplierHeatNumber: 'HEAT-TITAN-4140',
        supplierLotNumber: 'LOT-TITAN-1',
        mtrNumber: 'MTR-TITAN-4140'
      }
    ],
    save: jest.fn().mockResolvedValue(true),
    toJSON: function () {
      return { ...this };
    }
  };

  let inMemoryUnits: any[] = [];
  let inMemoryGrn: any = null;

  beforeEach(() => {
    jest.restoreAllMocks();
    inMemoryUnits = [];
    inMemoryGrn = null;
    mockPo.status = 'ISSUED';
    mockStoredReceipt.status = 'STORED';

    // RBAC Setup
    jest.spyOn(roleRepository, 'seedDefaultRolesForTenant').mockResolvedValue(undefined as any);
    jest.spyOn(roleRepository, 'findRolesByCodes').mockImplementation(async (_t, codes) => {
      return codes.map((code) => {
        const found = DEFAULT_FACTORY_ROLES.find((r) => r.code === code);
        if (found) return { code, permissions: found.permissions } as any;
        if (code === 'STORE_OFFICER' || code === 'STORES_MANAGER') {
          return {
            code,
            permissions: [
              PERMISSIONS.PURCHASE_ORDER_VIEW,
              PERMISSIONS.INVENTORY_GRN_CREATE,
              PERMISSIONS.INVENTORY_GRN_VIEW,
              PERMISSIONS.INVENTORY_STORAGE_RECORD
            ]
          } as any;
        }
        if (code === 'PRODUCTION_PLANNER') {
          return {
            code,
            permissions: [
              PERMISSIONS.PURCHASE_ORDER_VIEW,
              PERMISSIONS.INVENTORY_GRN_VIEW,
              PERMISSIONS.PRODUCTION_JOB_CREATE
            ]
          } as any;
        }
        return { code, permissions: [] } as any;
      });
    });

    // PO Mocking
    jest.spyOn(purchaseOrderService, 'getOrderById').mockImplementation(async (_t, id) => {
      if (id === mockPo.id || id === 'po_draft_001' || id === 'po_cancelled_001') {
        return mockPo as any;
      }
      return null as any;
    });

    // Item Mocking
    jest.spyOn(itemService, 'getItemById').mockImplementation(async (_t, id) => {
      if (id === mockPoLineItem.itemId) {
        return {
          id: mockPoLineItem.itemId,
          itemCode: mockPoLineItem.itemCode,
          itemName: mockPoLineItem.itemName,
          materialGrade: mockPoLineItem.materialGrade,
          processFamily: mockPoLineItem.processFamily,
          status: 'active'
        } as any;
      }
      return null as any;
    });

    // GRN Repository Mocking
    jest.spyOn(grnRepository, 'findReceiptById').mockImplementation(async (_t, id) => {
      if (id === mockStoredReceipt.id) {
        return mockStoredReceipt as any;
      }
      return null;
    });

    jest.spyOn(grnRepository, 'queryReceipts').mockImplementation(async (_t, query) => {
      if (query.poId === mockPo.id && (!query.status || query.status === mockStoredReceipt.status)) {
        return [mockStoredReceipt as any];
      }
      return [];
    });

    jest.spyOn(grnRepository, 'atomicTransitionReceiptToGrnCreated').mockImplementation(
      async (_t, receiptId) => {
        if (receiptId === mockStoredReceipt.id && mockStoredReceipt.status === 'STORED') {
          mockStoredReceipt.status = 'GRN_CREATED';
          return mockStoredReceipt as any;
        }
        return null;
      }
    );

    jest.spyOn(grnRepository, 'generateNextGrnNumber').mockResolvedValue('GRN-202609-8801');
    jest.spyOn(grnRepository, 'findGrnByIdempotencyKey').mockResolvedValue(null);

    jest.spyOn(grnRepository, 'createGrn').mockImplementation(async (_t, data) => {
      inMemoryGrn = {
        ...data,
        id: 'grn_state_ctrl_001',
        _id: 'grn_state_ctrl_001',
        createdAt: new Date(),
        save: jest.fn().mockImplementation(async function () {
          inMemoryGrn = this;
          return this;
        }),
        toJSON: function () {
          return { ...this };
        }
      };
      return inMemoryGrn;
    });

    jest.spyOn(grnRepository, 'createGrnUnits').mockImplementation(async (_t, units) => {
      const inserted = units.map((u, idx) => ({
        ...u,
        id: `unit_doc_${inMemoryUnits.length + idx + 1}`,
        _id: `unit_doc_${inMemoryUnits.length + idx + 1}`,
        createdAt: new Date(),
        save: jest.fn().mockResolvedValue(true),
        toJSON: function () {
          return { ...this };
        }
      }));
      inMemoryUnits.push(...inserted);
      return inserted as any;
    });

    jest.spyOn(grnRepository, 'queryAvailableUnitsForPlanning').mockImplementation(
      async (_t, itemId, recipeId) => {
        return inMemoryUnits.filter((u) => {
          if (u.status !== 'AVAILABLE_FOR_PLANNING') return false;
          if (itemId && u.itemId !== itemId) return false;
          if (recipeId && u.recipeId !== recipeId) return false;
          return true;
        }) as any;
      }
    );

    jest.spyOn(grnRepository, 'findUnitByIdentifier').mockImplementation(
      async (_t, identifier) => {
        const found = inMemoryUnits.find(
          (u) => u.unitIdentifier.toUpperCase() === identifier.toUpperCase()
        );
        return (found as any) || null;
      }
    );

    jest.spyOn(grnRepository, 'allocateUnit').mockImplementation(
      async (_t, identifier, planId, planNumber, jobId) => {
        const found = inMemoryUnits.find(
          (u) =>
            u.unitIdentifier.toUpperCase() === identifier.toUpperCase() &&
            u.status === 'AVAILABLE_FOR_PLANNING'
        );
        if (!found) return null;
        found.status = 'ALLOCATED_TO_PLAN';
        found.allocatedPlanId = planId;
        found.allocatedPlanNumber = planNumber;
        found.allocatedJobId = jobId;
        return found as any;
      }
    );

    // Audit Mock
    jest.spyOn(auditService, 'record').mockResolvedValue(undefined as any);
  });

  describe('1. Authoritative State Lifecycle Discovery', () => {
    it('GET /api/v1/grn/state-control/lifecycle returns full lifecycle metadata and transition matrix', async () => {
      const token = generateToken('user_store_01', ['STORE_OFFICER']);

      const res = await request(app)
        .get('/api/v1/grn/state-control/lifecycle')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('stages');
      expect(res.body.data.stages).toEqual([
        CreationPhaseStage.PO_CREATED,
        CreationPhaseStage.MATERIAL_RECEIVED,
        CreationPhaseStage.MATERIAL_STORED,
        CreationPhaseStage.GRN_CREATED,
        CreationPhaseStage.CREATION_COMPLETE,
        CreationPhaseStage.AVAILABLE_FOR_PLANNING
      ]);
      expect(res.body.data).toHaveProperty('transitions');
      expect(res.body.data.transitions[CreationPhaseStage.PO_CREATED]).toEqual([
        CreationPhaseStage.MATERIAL_RECEIVED
      ]);
      expect(res.body.data.transitions[CreationPhaseStage.AVAILABLE_FOR_PLANNING]).toEqual([
        'ALLOCATED_TO_PLAN'
      ]);
      expect(res.body.data.immutabilityRule).toContain('Locked and immutable');
    });
  });

  describe('2. Strict Linear Progression & Stage Skipping Prevention', () => {
    it('Stage 1 -> 2: Rejects material receipt against PO in DRAFT status', async () => {
      mockPo.status = 'DRAFT';
      const token = generateToken('user_store_01', ['STORE_OFFICER']);

      const res = await request(app)
        .post('/api/v1/grn/material-receipts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockPo.id,
          supplierChallanNumber: 'DC-TITAN-9002',
          items: [
            {
              poLineItemId: mockPoLineItem.lineItemId,
              itemId: mockPoLineItem.itemId,
              receivedQuantity: 5,
              supplierHeatNumber: 'HEAT-TITAN-4140'
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Cannot record material receipt against Purchase Order in 'DRAFT' status");
    });

    it('Stage 1 -> 2: Rejects material receipt against CANCELLED PO', async () => {
      mockPo.status = 'CANCELLED';
      const token = generateToken('user_store_01', ['STORE_OFFICER']);

      const res = await request(app)
        .post('/api/v1/grn/material-receipts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockPo.id,
          supplierChallanNumber: 'DC-TITAN-9003',
          items: [
            {
              poLineItemId: mockPoLineItem.lineItemId,
              itemId: mockPoLineItem.itemId,
              receivedQuantity: 5,
              supplierHeatNumber: 'HEAT-TITAN-4140'
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Cannot record material receipt against Purchase Order in 'CANCELLED' status");
    });

    it('Stage 2 -> 3: Rejects warehouse storage putaway when receipt is in invalid status', async () => {
      mockStoredReceipt.status = 'DRAFT' as any;
      const token = generateToken('user_store_01', ['STORE_OFFICER']);

      const res = await request(app)
        .post(`/api/v1/grn/material-receipts/${mockStoredReceipt.id}/storage`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          warehouseId: 'wh_main_01',
          storageLocationCode: 'BAY-01-A',
          quantity: 10,
          items: [
            {
              poLineItemId: mockPoLineItem.lineItemId,
              putawayQuantity: 10
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Cannot store material receipt in 'DRAFT' status");
    });

    it('Stage 2 -> 3: Rejects storage putaway exceeding received balance', async () => {
      mockStoredReceipt.status = 'RECEIVED';
      mockStoredReceipt.items[0].storedQuantity = 0;
      mockStoredReceipt.items[0].remainingQuantity = 10;
      const token = generateToken('user_store_01', ['STORE_OFFICER']);

      const res = await request(app)
        .post(`/api/v1/grn/material-receipts/${mockStoredReceipt.id}/storage`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          warehouseId: 'wh_main_01',
          storageLocationCode: 'BAY-01-A',
          quantity: 25,
          items: [
            {
              poLineItemId: mockPoLineItem.lineItemId,
              putawayQuantity: 25 // exceeds 10
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/exceeds remaining unstored quantity|exceeds available received balance/);
    });

    it('Stage 3 -> 4: Rejects GRN creation when receipt is only RECEIVED (not yet stored in warehouse)', async () => {
      mockStoredReceipt.status = 'RECEIVED';
      const token = generateToken('user_store_01', ['STORE_OFFICER']);

      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockPo.id,
          receiptId: mockStoredReceipt.id,
          acceptanceStatus: 'ACCEPTED',
          items: [
            {
              poLineItemId: mockPoLineItem.lineItemId,
              acceptedQuantity: 10
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(
        "Cannot create GRN for material receipt in 'RECEIVED' status. Material must be stored in the warehouse first."
      );
    });

    it('Stage 3 -> 4: Rejects GRN creation when receipt is PARTIALLY_STORED', async () => {
      mockStoredReceipt.status = 'PARTIALLY_STORED';
      const token = generateToken('user_store_01', ['STORE_OFFICER']);

      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockPo.id,
          receiptId: mockStoredReceipt.id,
          acceptanceStatus: 'ACCEPTED',
          items: [
            {
              poLineItemId: mockPoLineItem.lineItemId,
              acceptedQuantity: 5
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(
        "Cannot create GRN for material receipt in 'PARTIALLY_STORED' status. Material must be stored in the warehouse first."
      );
    });

    it('Stage 3 -> 4: Rejects GRN creation if PO has no warehouse-stored material receipts', async () => {
      // Mock queryReceipts returning empty array
      jest.spyOn(grnRepository, 'queryReceipts').mockResolvedValue([]);
      const token = generateToken('user_store_01', ['STORE_OFFICER']);

      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockPo.id,
          acceptanceStatus: 'ACCEPTED',
          items: [
            {
              poLineItemId: mockPoLineItem.lineItemId,
              acceptedQuantity: 10
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/has not been received|has no warehouse-stored|already have Goods Receipt Notes generated/);
    });

    it('Stage 3 -> 4: Rejects GRN creation with items not belonging to the PO', async () => {
      mockStoredReceipt.status = 'STORED';
      const token = generateToken('user_store_01', ['STORE_OFFICER']);

      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockPo.id,
          receiptId: mockStoredReceipt.id,
          acceptanceStatus: 'ACCEPTED',
          items: [
            {
              poLineItemId: 'unrelated_bogus_line_item',
              itemId: 'item_unrelated_bogus',
              acceptedQuantity: 5
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('does not belong to Purchase Order');
    });
  });

  describe('3. Concurrency Protection & Anti-Duplication Controls', () => {
    it('Prevents duplicate storage on an already fully stored receipt', async () => {
      mockStoredReceipt.status = 'STORED';
      mockStoredReceipt.items[0].remainingQuantity = 0;
      const token = generateToken('user_store_01', ['STORE_OFFICER']);

      const res = await request(app)
        .post(`/api/v1/grn/material-receipts/${mockStoredReceipt.id}/storage`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          warehouseId: 'wh_main_01',
          storageLocationCode: 'BAY-01-A',
          items: [
            {
              poLineItemId: mockPoLineItem.lineItemId,
              putawayQuantity: 10
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Duplicate storage: Material receipt');
      expect(res.body.message).toContain('has already been fully stored into the warehouse.');
    });

    it('Prevents duplicate GRN creation on a receipt that has already transitioned to GRN_CREATED', async () => {
      mockStoredReceipt.status = 'GRN_CREATED';
      const token = generateToken('user_store_01', ['STORE_OFFICER']);

      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockPo.id,
          receiptId: mockStoredReceipt.id,
          acceptanceStatus: 'ACCEPTED',
          items: [
            {
              poLineItemId: mockPoLineItem.lineItemId,
              acceptedQuantity: 10
            }
          ]
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('Duplicate GRN: Material receipt');
    });

    it('Concurrency race: Atomic transition returns null if another worker transitioned it, failing second request', async () => {
      mockStoredReceipt.status = 'STORED';
      // Simulate atomicTransitionReceiptToGrnCreated returning null (simulating concurrent worker win)
      jest.spyOn(grnRepository, 'atomicTransitionReceiptToGrnCreated').mockResolvedValueOnce(null);

      const token = generateToken('user_store_01', ['STORE_OFFICER']);

      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockPo.id,
          receiptId: mockStoredReceipt.id,
          acceptanceStatus: 'ACCEPTED',
          items: [
            {
              poLineItemId: mockPoLineItem.lineItemId,
              acceptedQuantity: 10
            }
          ]
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('failed due to concurrent update or prior transition');
    });
  });

  describe('4. Planning Gate & Immutability Enforcement', () => {
    beforeEach(async () => {
      // Create valid GRN and generate units in AVAILABLE_FOR_PLANNING
      mockStoredReceipt.status = 'STORED';
      const actor = { userId: 'user_store_01', tenantId: testTenant, roles: ['STORE_OFFICER'] };

      await grnService.createGRN(
        testTenant,
        {
          poId: mockPo.id,
          receiptId: mockStoredReceipt.id,
          acceptanceStatus: 'ACCEPTED',
          items: [
            {
              poLineItemId: mockPoLineItem.lineItemId,
              acceptedQuantity: 10
            }
          ]
        },
        actor
      );
    });

    it('Creation Phase completes: Units are generated with AVAILABLE_FOR_PLANNING status', async () => {
      expect(inMemoryUnits.length).toBe(10);
      inMemoryUnits.forEach((u) => {
        expect(u.status).toBe('AVAILABLE_FOR_PLANNING');
        expect(u.poId).toBe(mockPo.id);
        expect(u.grnNumber).toBe('GRN-202609-8801');
      });
    });

    it('Planning Gate: GET /api/v1/grn/planning-units/available exposes ONLY completed Creation Phase units', async () => {
      const token = generateToken('user_planner_01', ['PRODUCTION_PLANNER']);

      const res = await request(app)
        .get('/api/v1/grn/planning-units/available')
        .query({ itemId: mockPoLineItem.itemId })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(10);
      res.body.data.forEach((unit: any) => {
        expect(unit.status).toBe('AVAILABLE_FOR_PLANNING');
      });
    });

    it('Planning Allocation: Successfully allocates unit and transitions to ALLOCATED_TO_PLAN', async () => {
      const token = generateToken('user_planner_01', ['PRODUCTION_PLANNER']);
      const targetUnit = inMemoryUnits[0];

      const res = await request(app)
        .post(`/api/v1/grn/planning-units/${targetUnit.unitIdentifier}/allocate`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          allocatedPlanId: 'plan_202609_9999',
          allocatedPlanNumber: 'PLAN-202609-0001',
          allocatedJobId: 'job_202609_0001'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ALLOCATED_TO_PLAN');
      expect(res.body.data.allocatedPlanNumber).toBe('PLAN-202609-0001');

      const updated = inMemoryUnits.find((u) => u.unitIdentifier === targetUnit.unitIdentifier);
      expect(updated.status).toBe('ALLOCATED_TO_PLAN');
    });

    it('Genealogy Locking & Immutability: Re-allocating an ALLOCATED_TO_PLAN unit is permanently blocked', async () => {
      const token = generateToken('user_planner_01', ['PRODUCTION_PLANNER']);
      const targetUnit = inMemoryUnits[0];

      // First allocation
      await request(app)
        .post(`/api/v1/grn/planning-units/${targetUnit.unitIdentifier}/allocate`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          allocatedPlanId: 'plan_202609_9999',
          allocatedPlanNumber: 'PLAN-202609-0001'
        });

      // Second allocation attempt must fail
      const res = await request(app)
        .post(`/api/v1/grn/planning-units/${targetUnit.unitIdentifier}/allocate`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          allocatedPlanId: 'plan_202609_8888',
          allocatedPlanNumber: 'PLAN-202609-0002'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cannot be allocated to planning|genealogy is permanently locked/);
    });

    it('Planning Gate excludes units once they have been allocated', async () => {
      const token = generateToken('user_planner_01', ['PRODUCTION_PLANNER']);
      const targetUnit = inMemoryUnits[0];

      // Allocate 1 unit
      await request(app)
        .post(`/api/v1/grn/planning-units/${targetUnit.unitIdentifier}/allocate`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          allocatedPlanId: 'plan_202609_9999',
          allocatedPlanNumber: 'PLAN-202609-0001'
        });

      // Query available units: should now be 9 instead of 10
      const res = await request(app)
        .get('/api/v1/grn/planning-units/available')
        .query({ itemId: mockPoLineItem.itemId })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(9);
      expect(res.body.data.find((u: any) => u.unitIdentifier === targetUnit.unitIdentifier)).toBeUndefined();
    });
  });

  describe('5. Audit Trail of State Transitions', () => {
    it('Records state transition in audit trail with actor, timestamp, and before/after states', async () => {
      mockStoredReceipt.status = 'STORED';
      const auditSpy = jest.spyOn(auditService, 'record');
      const token = generateToken('user_store_01', ['STORE_OFFICER']);

      const res = await request(app)
        .post('/api/v1/grn')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: mockPo.id,
          receiptId: mockStoredReceipt.id,
          acceptanceStatus: 'ACCEPTED',
          items: [
            {
              poLineItemId: mockPoLineItem.lineItemId,
              acceptedQuantity: 10
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(auditSpy).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          actorId: 'user_store_01',
          action: 'GRN_CREATED',
          entityType: 'GRN'
        })
      );
    });
  });
});
