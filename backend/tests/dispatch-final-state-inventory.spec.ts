import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { dispatchRepository } from '../src/modules/dispatch/dispatch.repository.js';
import { finishedGoodsRepository } from '../src/modules/finished-goods/finished-goods.repository.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { userRepository } from '../src/modules/auth/user.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES, PERMISSIONS } from '../src/modules/rbac/rbac.constants.js';

describe('Dispatch Phase — Prompt 9: Final Dispatch State and Inventory Removal', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_dispatch_final';

  const generateToken = (userId: string, roleCodes: string[], permissions: string[] = []) => {
    return jwt.sign(
      {
        userId,
        email: `${userId}@celestium-logistics.internal`,
        tenantId: testTenant,
        roles: roleCodes,
        permissions
      },
      config.auth.jwtSecret
    );
  };

  const dispatchToken = generateToken(
    'usr_dispatch_officer_09',
    ['DISPATCH_OFFICER'],
    [
      PERMISSIONS.DISPATCH_DELIVERY_DISPATCH,
      PERMISSIONS.DISPATCH_PASS_GENERATE,
      PERMISSIONS.DISPATCH_DELIVERY_VIEW
    ]
  );

  const unauthorizedToken = generateToken(
    'usr_operator_unauthorized',
    ['OPERATOR'],
    ['production:view']
  );

  const mockBo = {
    id: 'job_bo_4140_final',
    _id: 'job_bo_4140_final',
    jobNumber: 'BO-202609-0901',
    boNumber: 'BO-202609-0901',
    batchOrderNumber: 'BO-202609-0901',
    tenantId: testTenant,
    poId: 'po_4140_001',
    poNumber: 'PO-202609-0010',
    grnId: 'grn_4140_001',
    grnNumber: 'GRN-202609-0025',
    status: 'WAITING_FOR_DISPATCH',
    waitingForProduction: false,
    inProduction: false,
    waitingForInspection: false,
    inInspection: false,
    waitingForDispatch: true,
    dispatched: false,
    inspection: false,
    workflowState: {
      waitingForProduction: false,
      inProduction: false,
      waitingForInspection: false,
      inInspection: false,
      waitingForDispatch: true,
      dispatched: false,
      inspection: false
    },
    outwardChallanNumber: 'OC-202609-0901',
    outwardChallanDate: new Date('2026-09-16T08:00:00.000Z'),
    customer: {
      customerId: 'cust_apex_01',
      customerCode: 'CUST-APEX-01',
      customerName: 'Apex Drivetrains Heavy Industries'
    },
    item: {
      itemId: 'item_4140_pinion',
      itemCode: 'MAT-4140-PINION',
      itemName: 'Case-Hardened Pinion Shafts 4140',
      description: 'Carburized pinion shafts',
      materialGrade: 'AISI 4140H',
      uom: 'PCS'
    },
    quantity: {
      targetQuantity: 500,
      loadedQuantity: 500,
      completedQuantity: 495,
      scrappedQuantity: 5
    },
    execution: {
      inspectionData: {
        isQualityApproved: true,
        disposition: 'APPROVED',
        cocNumber: 'COC-2026-0901',
        furnaceCode: 'FURNACE-SECO-02',
        quantityDelivered: 495
      }
    },
    isDeleted: false
  };

  const createMockConsignment = (overrides: Record<string, any> = {}) => {
    const consignment: any = {
      id: 'disp_oc_4140_final',
      _id: 'disp_oc_4140_final',
      tenantId: testTenant,
      dispatchNumber: 'DSP-202609-0901',
      outwardChallanNumber: 'OC-202609-0901',
      deliveryChallanNumber: 'DC-202609-0901',
      batchOrderId: mockBo.id,
      batchOrderNumber: mockBo.boNumber,
      isOutwardChallan: true,
      customerId: 'cust_apex_01',
      customer: {
        customerId: 'cust_apex_01',
        customerCode: 'CUST-APEX-01',
        customerName: 'Apex Drivetrains Heavy Industries'
      },
      hierarchy: {
        poId: mockBo.poId,
        poNumber: mockBo.poNumber,
        grnId: mockBo.grnId,
        grnNumber: mockBo.grnNumber,
        batchOrderId: mockBo.id,
        batchOrderNumber: mockBo.boNumber,
        outwardChallanNumber: 'OC-202609-0901'
      },
      status: 'WAITING_FOR_DISPATCH',
      totalQuantity: 495,
      lines: [
        {
          finishedGoodsId: 'fg_lot_4140_01',
          dispatchedQuantity: 495,
          jobId: mockBo.id,
          jobNumber: mockBo.jobNumber
        }
      ],
      items: [
        {
          serialNumber: 1,
          partName: 'Case-Hardened Pinion Shafts 4140',
          partDescription: 'Carburized pinion shafts',
          partNumber: 'MAT-4140-PINION',
          materialGrade: 'AISI 4140H',
          heatTreatmentProcess: 'CARBURIZING',
          batchLotNumber: 'BO-202609-0901',
          quantity: 495,
          unitOfMeasure: 'PCS'
        }
      ],
      timeline: {},
      carrier: {},
      vehicle: {},
      history: [],
      authorizedSignatory: {
        userId: 'usr_plant_mgr',
        name: 'Marcus Vance',
        username: 'mvance',
        email: 'mvance@factory.internal',
        role: 'PLANT_MANAGER',
        designation: 'Plant Operations Manager',
        authorizedAt: new Date('2026-09-16T09:00:00.000Z')
      },
      preparedBy: {
        userId: 'usr_dispatch_officer_09',
        name: 'Elena Rostova',
        username: 'erostova',
        email: 'usr_dispatch_officer_09@celestium-logistics.internal',
        role: 'DISPATCH_OFFICER',
        preparedAt: new Date('2026-09-16T08:30:00.000Z')
      },
      isDeleted: false,
      save: jest.fn().mockImplementation(async function (this: any) {
        return this;
      }),
      toJSON: jest.fn().mockImplementation(function (this: any) {
        return { ...this };
      }),
      ...overrides
    };
    return consignment;
  };

  const createMockFg = (overrides: Record<string, any> = {}) => {
    const fg: any = {
      id: 'fg_lot_4140_01',
      _id: 'fg_lot_4140_01',
      tenantId: testTenant,
      fgLotNumber: 'FG-202609-0901',
      jobCardId: mockBo.id,
      jobCardNumber: mockBo.jobNumber,
      totalQuantity: 495,
      availableQuantity: 495,
      reservedQuantity: 0,
      dispatchedQuantity: 0,
      status: 'RELEASED_FOR_DISPATCH',
      location: 'BAY-D3-RACK1',
      movementHistory: [],
      save: jest.fn().mockImplementation(async function (this: any) {
        return this;
      }),
      toJSON: jest.fn().mockImplementation(function (this: any) {
        return { ...this };
      }),
      ...overrides
    };
    return fg;
  };

  let currentBoState: any;
  let mockConsignmentInstance: any;
  let mockFgInstance: any;

  const resetFixtures = () => {
    currentBoState = JSON.parse(JSON.stringify(mockBo));
    mockConsignmentInstance = createMockConsignment();
    mockFgInstance = createMockFg();
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetFixtures();

    jest.spyOn(roleRepository, 'seedDefaultRolesForTenant').mockResolvedValue([] as any);
    jest.spyOn(roleRepository, 'findRolesByCodes').mockImplementation(async (_tenantId, codes) => {
      return DEFAULT_FACTORY_ROLES.filter((r) => codes.includes(r.code)).map((r) => ({
        ...r,
        id: `role_${r.code}`,
        status: 'active'
      })) as any;
    });

    jest.spyOn(userRepository, 'findById').mockImplementation(async (_tenantId, userId) => {
      return {
        id: userId,
        _id: userId,
        tenantId: testTenant,
        username: userId,
        firstName: 'Authorized',
        lastName: 'Signatory',
        email: `${userId}@factory.internal`,
        roles: ['PLANT_MANAGER'],
        status: 'active',
        isDeleted: false
      } as any;
    });

    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

    jest.spyOn(dispatchRepository, 'findById').mockImplementation(async (_tenantId, id) => {
      if (
        id === mockConsignmentInstance.id ||
        id === mockConsignmentInstance._id ||
        id === mockConsignmentInstance.dispatchNumber ||
        id === mockConsignmentInstance.outwardChallanNumber
      ) {
        return mockConsignmentInstance;
      }
      return null;
    });

    jest.spyOn(finishedGoodsRepository, 'findById').mockImplementation(async (_tenantId, id) => {
      if (id === mockFgInstance.id) {
        return mockFgInstance;
      }
      return null;
    });

    jest.spyOn(finishedGoodsRepository, 'findByJobCardNumber').mockImplementation(async (_tenantId, identifier) => {
      if (identifier === mockBo.jobNumber || identifier === mockBo.id) {
        return [mockFgInstance];
      }
      return [];
    });

    jest.spyOn(productionJobRepository, 'findById').mockImplementation(async (_tenantId, id) => {
      if (id === currentBoState.id || id === currentBoState.boNumber) {
        return { ...currentBoState } as any;
      }
      return null;
    });

    jest.spyOn(productionJobRepository, 'atomicMarkDispatched').mockImplementation(
      async (_tenantId, jobId, updateData) => {
        if (currentBoState.status === 'DISPATCHED' || currentBoState.dispatched) {
          return null;
        }
        currentBoState.status = 'DISPATCHED';
        currentBoState.waitingForProduction = false;
        currentBoState.inProduction = false;
        currentBoState.waitingForInspection = false;
        currentBoState.inInspection = false;
        currentBoState.waitingForDispatch = false;
        currentBoState.dispatched = true;
        currentBoState.inspection = false;
        currentBoState.workflowState = {
          waitingForProduction: false,
          inProduction: false,
          waitingForInspection: false,
          inInspection: false,
          waitingForDispatch: false,
          dispatched: true,
          inspection: false
        };
        currentBoState.dispatchedAt = updateData.dispatchedAt;
        currentBoState.dispatchedBy = updateData.dispatchedBy;
        return { ...currentBoState } as any;
      }
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ==========================================================================
  // 1. Valid Dispatch: waitingForDispatch -> dispatched transition & inventory removal
  // ==========================================================================
  it('1. should execute valid physical dispatch: transition BO to dispatched=true and deduct warehouse inventory without deleting record', async () => {
    const res = await request(app)
      .post(`/api/v1/dispatches/${mockConsignmentInstance.id}/dispatch`)
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        transporter: 'Trans-India Logistics Express',
        vehicleNumber: 'MH-14-GH-9988',
        dispatchDate: '2026-09-16T11:00:00.000Z',
        ewayBillNumber: '112233445566'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify Consignment State
    expect(mockConsignmentInstance.status).toBe('DISPATCHED');
    expect(mockConsignmentInstance.transporter).toBe('Trans-India Logistics Express');
    expect(mockConsignmentInstance.vehicleNumber).toBe('MH-14-GH-9988');

    // Verify BO Final Workflow State: waitingForDispatch=false, dispatched=true
    expect(currentBoState.status).toBe('DISPATCHED');
    expect(currentBoState.waitingForDispatch).toBe(false);
    expect(currentBoState.dispatched).toBe(true);
    expect(currentBoState.workflowState.waitingForDispatch).toBe(false);
    expect(currentBoState.workflowState.dispatched).toBe(true);

    // Verify Mutual Exclusivity: exactly one workflow flag is active
    const activeFlags = [
      currentBoState.waitingForProduction,
      currentBoState.inProduction,
      currentBoState.waitingForInspection,
      currentBoState.inInspection,
      currentBoState.waitingForDispatch,
      currentBoState.dispatched,
      currentBoState.inspection
    ].filter(Boolean);
    expect(activeFlags.length).toBe(1);

    // Verify Inventory Removal (availability reduced, dispatched increased, not deleted)
    expect(mockFgInstance.availableQuantity).toBe(0);
    expect(mockFgInstance.dispatchedQuantity).toBe(495);
    expect(mockFgInstance.status).toBe('FULLY_DISPATCHED');
    expect(mockFgInstance.movementHistory.length).toBeGreaterThan(0);
    expect(mockFgInstance.movementHistory[0].reason).toContain('Physical outbound dispatch');
  });

  // ==========================================================================
  // 2. Invalid Workflow State: Reject BOs not currently waiting for dispatch
  // ==========================================================================
  it('2. should reject physical dispatch if Batch Order is in an invalid workflow state (IN_PRODUCTION, IN_INSPECTION, etc.)', async () => {
    const invalidStates = [
      { status: 'WAITING_FOR_PRODUCTION', waitingForProduction: true, waitingForDispatch: false },
      { status: 'IN_PRODUCTION', inProduction: true, waitingForDispatch: false },
      { status: 'WAITING_FOR_INSPECTION', waitingForInspection: true, waitingForDispatch: false },
      { status: 'IN_INSPECTION', inInspection: true, waitingForDispatch: false },
      { status: 'INSPECTION', inspection: true, waitingForDispatch: false }
    ];

    for (const st of invalidStates) {
      resetFixtures();
      currentBoState.status = st.status;
      currentBoState.waitingForProduction = !!st.waitingForProduction;
      currentBoState.inProduction = !!st.inProduction;
      currentBoState.waitingForInspection = !!st.waitingForInspection;
      currentBoState.inInspection = !!st.inInspection;
      currentBoState.waitingForDispatch = false;
      currentBoState.inspection = !!st.inspection;
      currentBoState.workflowState = {
        waitingForProduction: !!st.waitingForProduction,
        inProduction: !!st.inProduction,
        waitingForInspection: !!st.waitingForInspection,
        inInspection: !!st.inInspection,
        waitingForDispatch: false,
        dispatched: false,
        inspection: !!st.inspection
      };

      const res = await request(app)
        .post(`/api/v1/dispatches/${mockConsignmentInstance.id}/dispatch`)
        .set('Authorization', `Bearer ${dispatchToken}`)
        .send({
          transporter: 'Trans-India Logistics Express',
          vehicleNumber: 'MH-14-GH-9988',
          dispatchDate: '2026-09-16T11:00:00.000Z'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid workflow state/i);
    }
  });

  // ==========================================================================
  // 3. Multiple Workflow Flags: Reject when more than 1 flag is active
  // ==========================================================================
  it('3. should reject physical dispatch if Batch Order has multiple active workflow flags', async () => {
    currentBoState.waitingForDispatch = true;
    currentBoState.inProduction = true; // Invariant violation: 2 active flags
    currentBoState.workflowState.waitingForDispatch = true;
    currentBoState.workflowState.inProduction = true;

    const res = await request(app)
      .post(`/api/v1/dispatches/${mockConsignmentInstance.id}/dispatch`)
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        transporter: 'Trans-India Logistics Express',
        vehicleNumber: 'MH-14-GH-9988',
        dispatchDate: '2026-09-16T11:00:00.000Z'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/multiple active workflow flags/i);
  });

  // ==========================================================================
  // 4. Missing Outward Challan (OC Requirement)
  // ==========================================================================
  it('4. should reject physical dispatch if Outward Challan is missing on consignment or Batch Order', async () => {
    // Missing on consignment
    mockConsignmentInstance.outwardChallanNumber = null;

    const res1 = await request(app)
      .post(`/api/v1/dispatches/${mockConsignmentInstance.id}/dispatch`)
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        transporter: 'Trans-India Logistics Express',
        vehicleNumber: 'MH-14-GH-9988',
        dispatchDate: '2026-09-16T11:00:00.000Z'
      });

    expect(res1.status).toBe(400);
    expect(res1.body.message).toMatch(/Outward Challan \(OC\) has not been generated/i);
  });

  // ==========================================================================
  // 5. Lineage Mismatch: PO / GRN / BO / OC mismatch protection
  // ==========================================================================
  it('5. should reject physical dispatch if Outward Challan belongs to a mismatched PO or GRN', async () => {
    // PO mismatch
    mockConsignmentInstance.hierarchy.poId = 'po_mismatched_999';

    const res = await request(app)
      .post(`/api/v1/dispatches/${mockConsignmentInstance.id}/dispatch`)
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        transporter: 'Trans-India Logistics Express',
        vehicleNumber: 'MH-14-GH-9988',
        dispatchDate: '2026-09-16T11:00:00.000Z'
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Lineage mismatch/i);
  });

  // ==========================================================================
  // 6. Duplicate Dispatch Rejection
  // ==========================================================================
  it('6. should strictly reject repeated dispatch requests on an already dispatched BO or consignment', async () => {
    // Consignment already dispatched
    mockConsignmentInstance.status = 'DISPATCHED';

    const res1 = await request(app)
      .post(`/api/v1/dispatches/${mockConsignmentInstance.id}/dispatch`)
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        transporter: 'Trans-India Logistics Express',
        vehicleNumber: 'MH-14-GH-9988',
        dispatchDate: '2026-09-16T11:00:00.000Z'
      });

    expect(res1.status).toBe(400);
    expect(res1.body.message).toMatch(/Duplicate dispatch rejected/i);

    // BO already dispatched
    resetFixtures();
    currentBoState.status = 'DISPATCHED';
    currentBoState.dispatched = true;

    const res2 = await request(app)
      .post(`/api/v1/dispatches/${mockConsignmentInstance.id}/dispatch`)
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        transporter: 'Trans-India Logistics Express',
        vehicleNumber: 'MH-14-GH-9988',
        dispatchDate: '2026-09-16T11:00:00.000Z'
      });

    expect(res2.status).toBe(400);
    expect(res2.body.message).toMatch(/Duplicate dispatch rejected/i);
  });

  // ==========================================================================
  // 7. Concurrent Dispatch Collision: Only one operation succeeds
  // ==========================================================================
  it('7. should protect against concurrent dispatch collisions, returning 409 Conflict and rolling back inventory', async () => {
    // Mock atomicMarkDispatched returning null (indicating another request won the race)
    jest.spyOn(productionJobRepository, 'atomicMarkDispatched').mockResolvedValueOnce(null as any);

    const res = await request(app)
      .post(`/api/v1/dispatches/${mockConsignmentInstance.id}/dispatch`)
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        transporter: 'Trans-India Logistics Express',
        vehicleNumber: 'MH-14-GH-9988',
        dispatchDate: '2026-09-16T11:00:00.000Z'
      });

    expect([409, 400]).toContain(res.status);
    expect(res.body.success).toBe(false);

    // Verify that inventory deductions were rolled back
    expect(mockFgInstance.availableQuantity).toBe(495);
    expect(mockFgInstance.dispatchedQuantity).toBe(0);
  });

  // ==========================================================================
  // 8. Insufficient Inventory: Prevent negative stock
  // ==========================================================================
  it('8. should prevent negative inventory and reject dispatch when warehouse stock is insufficient', async () => {
    mockFgInstance.availableQuantity = 200; // Requested is 495

    const res = await request(app)
      .post(`/api/v1/dispatches/${mockConsignmentInstance.id}/dispatch`)
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        transporter: 'Trans-India Logistics Express',
        vehicleNumber: 'MH-14-GH-9988',
        dispatchDate: '2026-09-16T11:00:00.000Z'
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Insufficient warehouse quantity|Cannot create negative inventory/i);
  });

  // ==========================================================================
  // 9. Quantity Mismatch: Dispatched quantity must match authoritative delivered quantity
  // ==========================================================================
  it('9. should reject physical dispatch if requested line quantity does not match authoritative BO delivered quantity', async () => {
    mockConsignmentInstance.lines[0].dispatchedQuantity = 350; // BO delivered is 495

    const res = await request(app)
      .post(`/api/v1/dispatches/${mockConsignmentInstance.id}/dispatch`)
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        transporter: 'Trans-India Logistics Express',
        vehicleNumber: 'MH-14-GH-9988',
        dispatchDate: '2026-09-16T11:00:00.000Z'
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Quantity mismatch/i);
  });

  // ==========================================================================
  // 10. Unauthorized User: Only users with dispatch permission may dispatch
  // ==========================================================================
  it('10. should reject physical dispatch by user lacking dispatch permission with 403 Forbidden', async () => {
    const res = await request(app)
      .post(`/api/v1/dispatches/${mockConsignmentInstance.id}/dispatch`)
      .set('Authorization', `Bearer ${unauthorizedToken}`)
      .send({
        transporter: 'Trans-India Logistics Express',
        vehicleNumber: 'MH-14-GH-9988',
        dispatchDate: '2026-09-16T11:00:00.000Z'
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // ==========================================================================
  // 11. Historical Traceability: Lineage remains accessible after physical dispatch
  // ==========================================================================
  it('11. should preserve unbroken PO -> GRN -> BO -> OC -> Dispatched Material lineage after completion', async () => {
    const res = await request(app)
      .post(`/api/v1/dispatches/${mockConsignmentInstance.id}/dispatch`)
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        transporter: 'Trans-India Logistics Express',
        vehicleNumber: 'MH-14-GH-9988',
        dispatchDate: '2026-09-16T11:00:00.000Z'
      });

    expect(res.status).toBe(200);

    // Historical access via Outward Challan view endpoint
    const viewRes = await request(app)
      .get(`/api/v1/dispatches/outward-challan/${mockConsignmentInstance.outwardChallanNumber}`)
      .set('Authorization', `Bearer ${dispatchToken}`);

    expect(viewRes.status).toBe(200);
    expect(viewRes.body.data.outwardChallanNumber).toBe('OC-202609-0901');
    expect(viewRes.body.data.hierarchy.poNumber).toBe('PO-202609-0010');
    expect(viewRes.body.data.hierarchy.grnNumber).toBe('GRN-202609-0025');
    expect(viewRes.body.data.hierarchy.batchOrderNumber).toBe('BO-202609-0901');
    expect(viewRes.body.data.status).toBe('DISPATCHED');
  });
});
