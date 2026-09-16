import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { dispatchRepository } from '../src/modules/dispatch/dispatch.repository.js';
import { finishedGoodsRepository } from '../src/modules/finished-goods/finished-goods.repository.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES, PERMISSIONS } from '../src/modules/rbac/rbac.constants.js';

describe('Dispatch Phase — Prompt 6: Transport and Physical Dispatch Information', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_transport';

  const generateToken = (userId: string, roleCodes: string[]) => {
    return jwt.sign(
      {
        userId,
        email: `${userId}@celestium-logistics.internal`,
        tenantId: testTenant,
        roles: roleCodes,
        permissions: [
          PERMISSIONS.DISPATCH_DELIVERY_DISPATCH,
          PERMISSIONS.DISPATCH_PASS_GENERATE,
          'dispatch:manage',
          'dispatch:create',
          'dispatch:view'
        ]
      },
      config.auth.jwtSecret
    );
  };

  const dispatchToken = generateToken('dispatch_officer_01', ['DISPATCH_OFFICER', 'DISPATCH_MANAGER']);

  const mockBo = {
    id: 'job_bo_4140_transport',
    _id: 'job_bo_4140_transport',
    jobNumber: 'BO-202609-0099',
    boNumber: 'BO-202609-0099',
    batchOrderNumber: 'BO-202609-0099',
    tenantId: testTenant,
    poId: 'po_4140_001',
    poNumber: 'PO-202609-0010',
    grnId: 'grn_4140_001',
    grnNumber: 'GRN-202609-0025',
    status: 'WAITING_FOR_DISPATCH',
    waitingForDispatch: true,
    dispatched: false,
    workflowState: {
      waitingForProduction: false,
      inProduction: false,
      waitingForInspection: false,
      inInspection: false,
      waitingForDispatch: true,
      dispatched: false,
      inspection: false
    },
    outwardChallanNumber: 'OC-202609-0088',
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
        cocNumber: 'COC-2026-0099',
        furnaceCode: 'FURNACE-SECO-02',
        quantityDelivered: 495
      }
    },
    isDeleted: false
  };

  const createMockConsignment = (overrides: Record<string, any> = {}) => {
    const consignment: any = {
      id: 'disp_oc_4140_01',
      _id: 'disp_oc_4140_01',
      tenantId: testTenant,
      dispatchNumber: 'DSP-202609-0099',
      outwardChallanNumber: 'OC-202609-0088',
      batchOrderId: mockBo.id,
      batchOrderNumber: mockBo.boNumber,
      isOutwardChallan: true,
      customerId: 'cust_apex_01',
      customer: {
        customerId: 'cust_apex_01',
        customerCode: 'CUST-APEX-01',
        customerName: 'Apex Drivetrains Heavy Industries'
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
        authorizedAt: new Date('2026-09-15T09:00:00.000Z')
      },
      preparedBy: {
        userId: 'usr_dispatch_officer',
        name: 'Elena Rostova',
        username: 'erostova',
        email: 'erostova@factory.internal',
        role: 'DISPATCH_OFFICER',
        preparedAt: new Date('2026-09-15T08:30:00.000Z')
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
      fgLotNumber: 'FG-202609-001',
      jobCardId: mockBo.id,
      jobCardNumber: mockBo.jobNumber,
      totalQuantity: 495,
      availableQuantity: 495,
      reservedQuantity: 0,
      dispatchedQuantity: 0,
      status: 'AVAILABLE',
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

  let mockConsignmentInstance: any;
  let mockFgInstance: any;
  let currentBoState: any;

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

    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

    jest.spyOn(dispatchRepository, 'findById').mockImplementation(async (_tenantId, id) => {
      if (id === mockConsignmentInstance.id || id === 'disp_oc_4140_01') {
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
      if (id === currentBoState.id) {
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
        currentBoState.waitingForDispatch = false;
        currentBoState.dispatched = true;
        currentBoState.workflowState.waitingForDispatch = false;
        currentBoState.workflowState.dispatched = true;
        currentBoState.dispatchedAt = updateData.dispatchedAt;
        currentBoState.dispatchedBy = updateData.dispatchedBy;
        return { ...currentBoState } as any;
      }
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // 1. Valid Transporter: Accepted and Persisted
  // --------------------------------------------------------------------------
  it('1. should accept and persist valid transporter information', async () => {
    const res = await request(app)
      .post(`/api/v1/dispatches/${mockConsignmentInstance.id}/dispatch`)
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        transporter: 'VRL Logistics Express Ltd',
        vehicleNumber: 'MH-12-AB-1234',
        dispatchDate: '2026-09-16T10:00:00.000Z'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockConsignmentInstance.transporter).toBe('VRL Logistics Express Ltd');
    expect(mockConsignmentInstance.carrier.carrierName).toBe('VRL Logistics Express Ltd');
    expect(mockConsignmentInstance.status).toBe('DISPATCHED');
  });

  // --------------------------------------------------------------------------
  // 2. Invalid Transporter: Reject empty or meaningless values
  // --------------------------------------------------------------------------
  it('2. should strictly reject invalid or meaningless transporter values', async () => {
    const invalidTransporters = ['', '   ', '-', 'N/A', 'none', 'A', 'null'];

    for (const badTransporter of invalidTransporters) {
      resetFixtures();
      const res = await request(app)
        .post(`/api/v1/dispatches/${mockConsignmentInstance.id}/dispatch`)
        .set('Authorization', `Bearer ${dispatchToken}`)
        .send({
          transporter: badTransporter,
          vehicleNumber: 'MH-12-AB-1234',
          dispatchDate: '2026-09-16T10:00:00.000Z'
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
      const msg = JSON.stringify(res.body);
      expect(msg).toMatch(/transporter/i);
    }
  });

  // --------------------------------------------------------------------------
  // 3. Valid Vehicle Number: Standard registration / fleet formats accepted
  // --------------------------------------------------------------------------
  it('3. should accept valid vehicle registration numbers across standard formats', async () => {
    const validVehicles = ['MH-12-AB-1234', 'KA01AB1234', 'DL 1C AA 1111', 'GJ-06-XX-9999', 'FLEET-TRUCK-09'];

    for (const validVeh of validVehicles) {
      resetFixtures();

      const res = await request(app)
        .post(`/api/v1/dispatches/${mockConsignmentInstance.id}/dispatch`)
        .set('Authorization', `Bearer ${dispatchToken}`)
        .send({
          transporter: 'Mahindra Logistics Ltd',
          vehicleNumber: validVeh,
          dispatchDate: '2026-09-16T10:00:00.000Z'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockConsignmentInstance.vehicleNumber).toBe(validVeh);
      expect(mockConsignmentInstance.vehicle.vehicleNumber).toBe(validVeh);
    }
  });

  // --------------------------------------------------------------------------
  // 4. Invalid Vehicle Number: Reject meaningless or ill-formatted values
  // --------------------------------------------------------------------------
  it('4. should strictly reject invalid or meaningless vehicle registration numbers', async () => {
    const invalidVehicles = ['', '   ', '123', 'car', 'invalid-veh', '???', 'A-B', 'TRK'];

    for (const badVeh of invalidVehicles) {
      resetFixtures();
      const res = await request(app)
        .post(`/api/v1/dispatches/${mockConsignmentInstance.id}/dispatch`)
        .set('Authorization', `Bearer ${dispatchToken}`)
        .send({
          transporter: 'Mahindra Logistics Ltd',
          vehicleNumber: badVeh,
          dispatchDate: '2026-09-16T10:00:00.000Z'
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
      const msg = JSON.stringify(res.body);
      expect(msg).toMatch(/vehicle/i);
    }
  });

  // --------------------------------------------------------------------------
  // 5. Optional E-Way Bill Number: Valid formats accepted, omitted accepted, malformed rejected
  // --------------------------------------------------------------------------
  it('5. should allow optional E-Way Bill when omitted, accept valid E-Way Bill, and reject malformed', async () => {
    // 5a. Omitted: Allowed
    resetFixtures();
    const resOmitted = await request(app)
      .post(`/api/v1/dispatches/${mockConsignmentInstance.id}/dispatch`)
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        transporter: 'TCI Freight Ltd',
        vehicleNumber: 'MH-14-GH-5555',
        dispatchDate: '2026-09-16T10:00:00.000Z'
      });

    expect(resOmitted.status).toBe(200);
    expect(resOmitted.body.success).toBe(true);

    // 5b. Valid 12-digit numeric: Accepted
    resetFixtures();
    const res12Digit = await request(app)
      .post(`/api/v1/dispatches/${mockConsignmentInstance.id}/dispatch`)
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        transporter: 'TCI Freight Ltd',
        vehicleNumber: 'MH-14-GH-5555',
        dispatchDate: '2026-09-16T10:00:00.000Z',
        ewayBillNumber: '101234567890'
      });

    expect(res12Digit.status).toBe(200);
    expect(mockConsignmentInstance.ewayBillNumber).toBe('101234567890');

    // 5c. Valid standard EWB-code: Accepted
    resetFixtures();
    const resStandard = await request(app)
      .post(`/api/v1/dispatches/${mockConsignmentInstance.id}/dispatch`)
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        transporter: 'TCI Freight Ltd',
        vehicleNumber: 'MH-14-GH-5555',
        dispatchDate: '2026-09-16T10:00:00.000Z',
        ewayBillNumber: 'EWB-2026-889977'
      });

    expect(resStandard.status).toBe(200);
    expect(mockConsignmentInstance.ewayBillNumber).toBe('EWB-2026-889977');

    // 5d. Malformed E-Way Bill: Rejected
    const malformedEwbs = ['123', 'abc', 'EWB!INVALID', '12345678901234567890'];
    for (const badEwb of malformedEwbs) {
      resetFixtures();
      const resBad = await request(app)
        .post(`/api/v1/dispatches/${mockConsignmentInstance.id}/dispatch`)
        .set('Authorization', `Bearer ${dispatchToken}`)
        .send({
          transporter: 'TCI Freight Ltd',
          vehicleNumber: 'MH-14-GH-5555',
          dispatchDate: '2026-09-16T10:00:00.000Z',
          ewayBillNumber: badEwb
        });

      expect([400, 422]).toContain(resBad.status);
      const msg = JSON.stringify(resBad.body);
      expect(msg).toMatch(/eway/i);
    }
  });

  // --------------------------------------------------------------------------
  // 6. Missing Required Transport Data: Rejection
  // --------------------------------------------------------------------------
  it('6. should reject dispatch when required transport fields are missing', async () => {
    // Missing transporter
    resetFixtures();
    const resNoTransporter = await request(app)
      .post(`/api/v1/dispatches/${mockConsignmentInstance.id}/dispatch`)
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        vehicleNumber: 'MH-12-AB-1234',
        dispatchDate: '2026-09-16T10:00:00.000Z'
      });
    expect([400, 422]).toContain(resNoTransporter.status);

    // Missing vehicle number
    resetFixtures();
    const resNoVehicle = await request(app)
      .post(`/api/v1/dispatches/${mockConsignmentInstance.id}/dispatch`)
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        transporter: 'VRL Logistics Ltd',
        dispatchDate: '2026-09-16T10:00:00.000Z'
      });
    expect([400, 422]).toContain(resNoVehicle.status);

    // Missing dispatch date
    resetFixtures();
    const resNoDate = await request(app)
      .post(`/api/v1/dispatches/${mockConsignmentInstance.id}/dispatch`)
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        transporter: 'VRL Logistics Ltd',
        vehicleNumber: 'MH-12-AB-1234'
      });
    expect([400, 422]).toContain(resNoDate.status);
  });

  // --------------------------------------------------------------------------
  // 7. Invalid Dispatch Date: Rejection
  // --------------------------------------------------------------------------
  it('7. should reject invalid or non-parseable dispatch date', async () => {
    resetFixtures();
    const res = await request(app)
      .post(`/api/v1/dispatches/${mockConsignmentInstance.id}/dispatch`)
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        transporter: 'VRL Logistics Ltd',
        vehicleNumber: 'MH-12-AB-1234',
        dispatchDate: 'not-a-valid-date-string'
      });

    expect([400, 422]).toContain(res.status);
    const msg = JSON.stringify(res.body);
    expect(msg).toMatch(/date/i);
  });

  // --------------------------------------------------------------------------
  // 8. Insufficient Warehouse Quantity: Negative Inventory Prevention
  // --------------------------------------------------------------------------
  it('8. should prevent negative inventory and reject dispatch when requested qty exceeds available stock', async () => {
    // Only 200 available in warehouse, but 495 requested
    mockFgInstance.availableQuantity = 200;
    mockFgInstance.reservedQuantity = 0;
    mockFgInstance.totalQuantity = 200;

    const res = await request(app)
      .post(`/api/v1/dispatches/${mockConsignmentInstance.id}/dispatch`)
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        transporter: 'SafeXpress Logistics',
        vehicleNumber: 'KA-04-E-7890',
        dispatchDate: '2026-09-16T10:00:00.000Z'
      });

    expect(res.status).toBe(400);
    const msg = res.body.message || JSON.stringify(res.body);
    expect(msg).toMatch(/insufficient warehouse quantity|negative inventory/i);

    // Inventory must remain intact
    expect(mockFgInstance.availableQuantity).toBe(200);
    expect(mockFgInstance.dispatchedQuantity).toBe(0);
    // BO must remain in waiting state
    expect(currentBoState.dispatched).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 9. Duplicate Dispatch: Reject already dispatched consignment or BO
  // --------------------------------------------------------------------------
  it('9. should strictly reject duplicate dispatch on an already dispatched consignment', async () => {
    // Complete first dispatch
    const res1 = await request(app)
      .post(`/api/v1/dispatches/${mockConsignmentInstance.id}/dispatch`)
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        transporter: 'Gati KWE Logistics',
        vehicleNumber: 'MH-12-CD-9012',
        dispatchDate: '2026-09-16T10:00:00.000Z'
      });
    expect(res1.status).toBe(200);

    // Attempt second dispatch on same consignment
    const res2 = await request(app)
      .post(`/api/v1/dispatches/${mockConsignmentInstance.id}/dispatch`)
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        transporter: 'Gati KWE Logistics',
        vehicleNumber: 'MH-12-CD-9012',
        dispatchDate: '2026-09-16T10:00:00.000Z'
      });

    expect(res2.status).toBe(400);
    const msg = res2.body.message || JSON.stringify(res2.body);
    expect(msg).toMatch(/already dispatched|duplicate/i);
  });

  // --------------------------------------------------------------------------
  // 10. Concurrent Dispatch Collision: Atomic Single-Winner Protection (409 Conflict)
  // --------------------------------------------------------------------------
  it('10. should protect against concurrent dispatch collisions and return 409 Conflict', async () => {
    // Simulate atomicMarkDispatched failing due to concurrent winner
    jest.spyOn(productionJobRepository, 'atomicMarkDispatched').mockResolvedValue(null);

    const res = await request(app)
      .post(`/api/v1/dispatches/${mockConsignmentInstance.id}/dispatch`)
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        transporter: 'BlueDart DHL Express',
        vehicleNumber: 'DL-01-AB-1234',
        dispatchDate: '2026-09-16T10:00:00.000Z'
      });

    expect(res.status).toBe(409);
    const msg = res.body.message || JSON.stringify(res.body);
    expect(msg).toMatch(/concurrent dispatch collision/i);
    // Inventory deductions must be rolled back
    expect(mockFgInstance.dispatchedQuantity).toBe(0);
    expect(mockFgInstance.availableQuantity).toBe(495);
  });

  // --------------------------------------------------------------------------
  // 11. Authenticated User Attribution: Enforce actor context, reject client identity spoofing
  // --------------------------------------------------------------------------
  it('11. should authoritatively record authenticated actor identity and ignore client-supplied user payload', async () => {
    const res = await request(app)
      .post(`/api/v1/dispatches/${mockConsignmentInstance.id}/dispatch`)
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        transporter: 'Allcargo Logistics',
        vehicleNumber: 'MH-04-JK-4444',
        dispatchDate: '2026-09-16T10:00:00.000Z',
        // Malicious client attempt to spoof user identity
        dispatchedBy: {
          userId: 'attacker_fake_user',
          email: 'attacker@evilcorp.com',
          role: 'ADMIN'
        }
      });

    expect(res.status).toBe(200);
    expect(mockConsignmentInstance.dispatchedBy).toBeDefined();
    expect(mockConsignmentInstance.dispatchedBy.userId).toBe('dispatch_officer_01');
    expect(mockConsignmentInstance.dispatchedBy.email).toBe('dispatch_officer_01@celestium-logistics.internal');
    expect(mockConsignmentInstance.dispatchedBy.role).toBe('DISPATCH_OFFICER');
    expect(mockConsignmentInstance.dispatchedBy.userId).not.toBe('attacker_fake_user');
  });

  // --------------------------------------------------------------------------
  // 12. Separation of OC Preparation vs Physical Dispatch
  // --------------------------------------------------------------------------
  it('12. should maintain clear separation between OC preparation and physical dispatch execution', async () => {
    // Before physical dispatch: BO is in waitingForDispatch: true, dispatched: false
    expect(currentBoState.waitingForDispatch).toBe(true);
    expect(currentBoState.dispatched).toBe(false);
    expect(currentBoState.status).toBe('WAITING_FOR_DISPATCH');

    // Execute physical dispatch
    const res = await request(app)
      .post(`/api/v1/dispatches/${mockConsignmentInstance.id}/dispatch`)
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        transporter: 'DHL Supply Chain Ltd',
        vehicleNumber: 'MH-12-PQ-8888',
        dispatchDate: '2026-09-16T11:00:00.000Z'
      });

    expect(res.status).toBe(200);

    // After physical dispatch: BO transitions to dispatched: true, status: 'DISPATCHED'
    expect(currentBoState.status).toBe('DISPATCHED');
    expect(currentBoState.dispatched).toBe(true);
    expect(currentBoState.waitingForDispatch).toBe(false);
    expect(currentBoState.workflowState.dispatched).toBe(true);
    expect(currentBoState.workflowState.waitingForDispatch).toBe(false);
    expect(currentBoState.dispatchedBy.userId).toBe('dispatch_officer_01');
  });

  // --------------------------------------------------------------------------
  // 13. Atomicity: The system must not produce a dispatch without an OC
  // --------------------------------------------------------------------------
  it('13. should strictly reject physical dispatch when the consignment does not have an Outward Challan (OC)', async () => {
    // Remove OC number from consignment
    mockConsignmentInstance.outwardChallanNumber = null;

    const res = await request(app)
      .post(`/api/v1/dispatches/${mockConsignmentInstance.id}/dispatch`)
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        transporter: 'DHL Supply Chain Ltd',
        vehicleNumber: 'MH-12-PQ-8888',
        dispatchDate: '2026-09-16T11:00:00.000Z'
      });

    expect(res.status).toBe(400);
    const msg = res.body.message || JSON.stringify(res.body);
    expect(msg).toMatch(/Outward Challan \(OC\) has not been generated/i);
    expect(currentBoState.dispatched).toBe(false);
  });
});
