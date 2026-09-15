import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { grnRepository } from '../src/modules/grn/grn.repository.js';
import { purchaseOrderRepository } from '../src/modules/purchase-order/purchase-order.repository.js';
import { dispatchRepository } from '../src/modules/dispatch/dispatch.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';

describe('Dispatch Phase — Prompt 4: GRN-Derived OC Header and Delivery Information', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_001';

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const mockPo = {
    id: 'po_4140_001',
    _id: 'po_4140_001',
    tenantId: testTenant,
    poNumber: 'PO-202609-0010',
    supplierName: 'Titan Alloy Forge Ltd',
    supplierCode: 'SUP-TITAN-01',
    vendorAddress: '100 Industrial Parkway, Detroit, MI 48201',
    contactEmail: 'orders@titanforge.com',
    contactPhone: '+1-313-555-0199',
    orderDate: new Date('2026-09-01T08:00:00Z'),
    status: 'RECEIVED',
    items: [
      {
        lineItemId: 'po_line_01',
        itemId: 'item_4140_bar',
        itemCode: 'MAT-4140-BAR',
        itemName: 'AISI 4140 Bar Stock',
        materialGrade: 'AISI 4140',
        processFamily: 'CARBURIZING',
        recipeId: 'rec_4140_01',
        recipeCode: 'REC-4140-V1',
        recipeRevision: 1,
        orderedQuantity: 500,
        receivedQuantity: 500,
        uom: 'PCS',
        unitPrice: 45
      }
    ],
    isDeleted: false
  };

  const mockGrnWithFullDelivery = {
    id: 'grn_4140_001',
    _id: 'grn_4140_001',
    tenantId: testTenant,
    grnNumber: 'GRN-202609-0025',
    poId: 'po_4140_001',
    poNumber: 'PO-202609-0010',
    supplierName: 'Titan Precision Aerospace LLC',
    supplierCode: 'CUST-TITAN-01',
    customerName: 'Titan Precision Aerospace LLC',
    customerCode: 'CUST-TITAN-01',
    customerId: 'cust_titan_01',
    address: '450 Aerospace Boulevard, Sector 9, Huntsville, AL 35801',
    deliveryAddress: '450 Aerospace Boulevard, Sector 9, Huntsville, AL 35801',
    destinationAddress: '450 Aerospace Boulevard, Sector 9, Huntsville, AL 35801',
    gstin: '01AAAAA0000A1Z5',
    contactEmail: 'dispatch-receiving@titan-aerospace.com',
    grnDate: new Date('2026-09-05T10:30:00Z'),
    status: 'AVAILABLE_FOR_PLANNING',
    items: [
      {
        poLineItemId: 'po_line_01',
        itemId: 'item_4140_bar',
        itemCode: 'MAT-4140-BAR',
        itemName: 'AISI 4140 Bar Stock',
        materialGrade: 'AISI 4140',
        processFamily: 'CARBURIZING',
        recipeId: 'rec_4140_01',
        recipeCode: 'REC-4140-V1',
        recipeRevision: 1,
        challanQuantity: 500,
        receivedQuantity: 500,
        acceptedQuantity: 500,
        uom: 'PCS',
        unitCount: 500,
        supplierHeatNumber: 'HEAT-4140-ALPHA',
        unitIdentifiers: ['UNIT-001']
      }
    ],
    isDeleted: false
  };

  const mockGrnMissingContactEmail = {
    id: 'grn_4140_no_email',
    _id: 'grn_4140_no_email',
    tenantId: testTenant,
    grnNumber: 'GRN-202609-0026',
    poId: 'po_4140_001',
    poNumber: 'PO-202609-0010',
    supplierName: 'Apex Defense Drivetrains',
    customerName: 'Apex Defense Drivetrains',
    customerCode: 'CUST-APEX-02',
    customerId: 'cust_apex_02',
    address: '700 Defense Highway, Fort Worth, TX 76101',
    gstin: '02BBBBB1111B2Z6',
    contactEmail: undefined, // Optional email missing!
    grnDate: new Date('2026-09-06T14:00:00Z'),
    status: 'AVAILABLE_FOR_PLANNING',
    items: [
      {
        poLineItemId: 'po_line_01',
        itemId: 'item_4140_bar',
        itemCode: 'MAT-4140-BAR',
        itemName: 'AISI 4140 Bar Stock',
        materialGrade: 'AISI 4140',
        processFamily: 'CARBURIZING',
        recipeId: 'rec_4140_01',
        recipeCode: 'REC-4140-V1',
        recipeRevision: 1,
        challanQuantity: 200,
        receivedQuantity: 200,
        acceptedQuantity: 200,
        uom: 'PCS',
        unitCount: 200,
        supplierHeatNumber: 'HEAT-4140-BETA',
        unitIdentifiers: ['UNIT-002']
      }
    ],
    isDeleted: false
  };

  const mockBo = {
    id: 'job_bo_4140_001',
    _id: 'job_bo_4140_001',
    jobNumber: 'BO-202609-0088',
    boNumber: 'BO-202609-0088',
    batchOrderNumber: 'BO-202609-0088',
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
    outwardChallanNumber: null,
    customer: {
      customerId: 'cust_titan_01',
      customerCode: 'CUST-TITAN-01',
      customerName: 'Titan Precision Aerospace LLC'
    },
    item: {
      itemId: 'item_4140_bar',
      itemCode: 'MAT-4140-BAR',
      itemName: 'AISI 4140 Bar Stock',
      materialGrade: 'AISI 4140',
      uom: 'PCS'
    },
    quantity: {
      targetQuantity: 500,
      loadedQuantity: 500,
      completedQuantity: 500,
      scrappedQuantity: 0
    },
    weightKg: 2450.5,
    recipeSnapshot: {
      recipeId: 'rec_4140_01',
      recipeCode: 'REC-4140-V1',
      name: 'Carburize & Quench 58-62 HRC',
      revisionNumber: 1
    },
    execution: {
      inspectionData: {
        isQualityApproved: true,
        cocNumber: 'COC-2026-0988',
        hardnessAverage: 60.5,
        effectiveCaseDepthMm: 1.15
      }
    },
    isDeleted: false
  };

  const dispatchToken = generateToken('dispatch_manager_01', ['DISPATCH_MANAGER', 'DISPATCH_OFFICER']);

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Spies
    jest.spyOn(roleRepository, 'seedDefaultRolesForTenant').mockResolvedValue([] as any);
    jest.spyOn(roleRepository, 'findRolesByCodes').mockImplementation(async (_tenantId, codes) => {
      return DEFAULT_FACTORY_ROLES.filter((r) => codes.includes(r.code)).map((r) => ({
        ...r,
        id: `role_${r.code}`,
        status: 'active'
      })) as any;
    });

    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

    jest.spyOn(productionJobRepository, 'findById').mockImplementation(async (tenantId, id) => {
      if (id === mockBo.id) return { ...mockBo } as any;
      return null;
    });

    jest.spyOn(grnRepository, 'findGrnById').mockImplementation(async (tenantId, id) => {
      if (id === mockGrnWithFullDelivery.id) return { ...mockGrnWithFullDelivery } as any;
      if (id === mockGrnMissingContactEmail.id) return { ...mockGrnMissingContactEmail } as any;
      return null;
    });

    jest.spyOn(purchaseOrderRepository, 'findById').mockImplementation(async (tenantId, id) => {
      if (id === mockPo.id) return { ...mockPo } as any;
      return null;
    });

    jest.spyOn(dispatchRepository, 'findByBatchOrderId').mockResolvedValue(null);

    let counter = 1000;
    jest.spyOn(dispatchRepository, 'generateNextOutwardChallanNumber').mockImplementation(async () => {
      return `OC-202609-${++counter}`;
    });
    jest.spyOn(dispatchRepository, 'generateNextDispatchNumber').mockImplementation(async () => {
      return `DSP-202609-${++counter}`;
    });
    jest.spyOn(dispatchRepository, 'generateNextDeliveryChallanNumber').mockImplementation(async () => {
      return `DC-202609-${++counter}`;
    });

    jest.spyOn(productionJobRepository, 'atomicLinkOutwardChallan').mockImplementation(
      async (tenantId, jobId, ocId, ocNumber, ocDate) => {
        return {
          ...mockBo,
          outwardChallanNumber: ocNumber,
          outwardChallanDate: ocDate
        } as any;
      }
    );

    jest.spyOn(productionJobRepository, 'atomicUnlinkOutwardChallan').mockResolvedValue({
      ...mockBo,
      outwardChallanNumber: null
    } as any);

    jest.spyOn(dispatchRepository, 'create').mockImplementation(async (tenantId, data) => {
      return {
        id: 'disp_consignment_new_01',
        _id: 'disp_consignment_new_01',
        tenantId,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        toJSON: () => data
      } as any;
    });
  });

  // --------------------------------------------------------------------------
  // 1. Valid GRN & Authoritative Derived Information
  // --------------------------------------------------------------------------
  it('1. should derive OC header and delivery information authoritatively from the valid GRN', async () => {
    const res = await request(app)
      .post('/api/v1/dispatches/outward-challan')
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        batchOrderId: mockBo.id,
        carrierName: 'Swift Heavy Haul Logistics',
        transportMode: 'ROAD',
        vehicleNumber: 'MH-12-QC-8821'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const oc = res.body.data;
    // 1. OC Header verification
    expect(oc.outwardChallanNumber).toMatch(/^OC-\d{6}-\d{4}$/);
    expect(oc.grnId).toBe(mockGrnWithFullDelivery.id);
    expect(oc.grnNumber).toBe(mockGrnWithFullDelivery.grnNumber);
    expect(oc.poId).toBe(mockPo.id);
    expect(oc.poNumber).toBe(mockPo.poNumber);
    expect(new Date(oc.ocDate).toISOString()).toBe(mockGrnWithFullDelivery.grnDate.toISOString());

    // 2. Delivery Customer Information verification (Derived from GRN)
    expect(oc.customer.customerName).toBe(mockGrnWithFullDelivery.customerName);
    expect(oc.customer.address).toBe(mockGrnWithFullDelivery.address);
    expect(oc.customer.destinationAddress).toBe(mockGrnWithFullDelivery.address);
    expect(oc.customer.gstin).toBe(mockGrnWithFullDelivery.gstin);
    expect(oc.customer.contactEmail).toBe(mockGrnWithFullDelivery.contactEmail);

    // 3. Dedicated deliveryInformation structure
    expect(oc.deliveryInformation).toBeDefined();
    expect(oc.deliveryInformation.customerName).toBe(mockGrnWithFullDelivery.customerName);
    expect(oc.deliveryInformation.address).toBe(mockGrnWithFullDelivery.address);
    expect(oc.deliveryInformation.gstin).toBe(mockGrnWithFullDelivery.gstin);
    expect(oc.deliveryInformation.contactEmail).toBe(mockGrnWithFullDelivery.contactEmail);

    // 4. Traceability hierarchy preservation
    expect(oc.hierarchy).toBeDefined();
    expect(oc.hierarchy.customerName).toBe(mockGrnWithFullDelivery.customerName);
    expect(oc.hierarchy.address).toBe(mockGrnWithFullDelivery.address);
    expect(oc.hierarchy.gstin).toBe(mockGrnWithFullDelivery.gstin);
    expect(oc.hierarchy.contactEmail).toBe(mockGrnWithFullDelivery.contactEmail);
  });

  // --------------------------------------------------------------------------
  // 2. Invalid GRN Rejection
  // --------------------------------------------------------------------------
  it('2. should strictly reject OC creation when the referenced GRN does not exist', async () => {
    jest.spyOn(grnRepository, 'findGrnById').mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/dispatches/outward-challan')
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        batchOrderId: mockBo.id
      });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Goods Receipt Note with ID .* not found/i);
  });

  // --------------------------------------------------------------------------
  // 3. Mismatched BO Rejection
  // --------------------------------------------------------------------------
  it('3. should strictly reject OC creation when client attempts to pair an unrelated GRN with the BO', async () => {
    const res = await request(app)
      .post('/api/v1/dispatches/outward-challan')
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        batchOrderId: mockBo.id,
        grnId: 'unrelated_grn_99999'
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/BO\/GRN mismatch/i);
  });

  // --------------------------------------------------------------------------
  // 4. Mismatched PO Rejection
  // --------------------------------------------------------------------------
  it('4. should strictly reject OC creation when client attempts to provide an unrelated PO', async () => {
    const res = await request(app)
      .post('/api/v1/dispatches/outward-challan')
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        batchOrderId: mockBo.id,
        poId: 'unrelated_po_99999'
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/GRN\/PO mismatch/i);
  });

  // --------------------------------------------------------------------------
  // 5. Altered Customer Submitted by Client
  // --------------------------------------------------------------------------
  it('5. should ignore client-submitted altered customer and authoritatively enforce GRN customer name', async () => {
    const res = await request(app)
      .post('/api/v1/dispatches/outward-challan')
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        batchOrderId: mockBo.id,
        customerName: 'HACKED_FAKE_CUSTOMER_INC',
        customer: {
          customerName: 'HACKED_FAKE_CUSTOMER_INC',
          customerCode: 'FAKE_CODE'
        }
      });

    expect(res.status).toBe(201);
    const oc = res.body.data;
    // Must NOT be the client-submitted fake name!
    expect(oc.customer.customerName).toBe(mockGrnWithFullDelivery.customerName);
    expect(oc.customer.customerName).not.toBe('HACKED_FAKE_CUSTOMER_INC');
    expect(oc.deliveryInformation.customerName).toBe(mockGrnWithFullDelivery.customerName);
    expect(oc.hierarchy.customerName).toBe(mockGrnWithFullDelivery.customerName);
  });

  // --------------------------------------------------------------------------
  // 6. Altered GSTIN Submitted by Client
  // --------------------------------------------------------------------------
  it('6. should ignore client-submitted altered GSTIN and authoritatively enforce GRN GSTIN', async () => {
    const res = await request(app)
      .post('/api/v1/dispatches/outward-challan')
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        batchOrderId: mockBo.id,
        gstin: '99HACKED0000Z9'
      });

    expect(res.status).toBe(201);
    const oc = res.body.data;
    // Must NOT be the client-submitted altered GSTIN!
    expect(oc.customer.gstin).toBe(mockGrnWithFullDelivery.gstin);
    expect(oc.customer.gstin).not.toBe('99HACKED0000Z9');
    expect(oc.deliveryInformation.gstin).toBe(mockGrnWithFullDelivery.gstin);
    expect(oc.hierarchy.gstin).toBe(mockGrnWithFullDelivery.gstin);
  });

  // --------------------------------------------------------------------------
  // 7. Altered Address Submitted by Client
  // --------------------------------------------------------------------------
  it('7. should ignore client-submitted altered address and authoritatively enforce GRN address', async () => {
    const res = await request(app)
      .post('/api/v1/dispatches/outward-challan')
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        batchOrderId: mockBo.id,
        address: '999 Pirate Cove, Nowhere Island',
        destinationAddress: '999 Pirate Cove, Nowhere Island'
      });

    expect(res.status).toBe(201);
    const oc = res.body.data;
    // Must NOT be the client-submitted altered address!
    expect(oc.customer.address).toBe(mockGrnWithFullDelivery.address);
    expect(oc.customer.destinationAddress).toBe(mockGrnWithFullDelivery.address);
    expect(oc.customer.address).not.toBe('999 Pirate Cove, Nowhere Island');
    expect(oc.deliveryInformation.address).toBe(mockGrnWithFullDelivery.address);
    expect(oc.hierarchy.address).toBe(mockGrnWithFullDelivery.address);
  });

  // --------------------------------------------------------------------------
  // 8. Altered OC Date Submitted by Client
  // --------------------------------------------------------------------------
  it('8. should ignore client-submitted altered OC date and authoritatively enforce GRN date', async () => {
    const res = await request(app)
      .post('/api/v1/dispatches/outward-challan')
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        batchOrderId: mockBo.id,
        ocDate: '1990-01-01T00:00:00.000Z'
      });

    expect(res.status).toBe(201);
    const oc = res.body.data;
    // Must NOT be the client-submitted 1990 date!
    expect(new Date(oc.ocDate).toISOString()).toBe(mockGrnWithFullDelivery.grnDate.toISOString());
    expect(new Date(oc.ocDate).getFullYear()).toBe(2026);
  });

  // --------------------------------------------------------------------------
  // 9. Missing Optional Contact Email
  // --------------------------------------------------------------------------
  it('9. should cleanly handle missing optional contact email from GRN without error', async () => {
    // Point BO to the GRN that does not have contactEmail
    const boWithNoEmail = {
      ...mockBo,
      id: 'job_bo_4140_002',
      grnId: mockGrnMissingContactEmail.id,
      grnNumber: mockGrnMissingContactEmail.grnNumber
    };

    jest.spyOn(productionJobRepository, 'findById').mockImplementation(async (tenantId, id) => {
      if (id === boWithNoEmail.id) return { ...boWithNoEmail } as any;
      return null;
    });

    const res = await request(app)
      .post('/api/v1/dispatches/outward-challan')
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        batchOrderId: boWithNoEmail.id
      });

    expect(res.status).toBe(201);
    const oc = res.body.data;
    expect(oc.outwardChallanNumber).toBeDefined();
    expect(oc.grnId).toBe(mockGrnMissingContactEmail.id);
    expect(oc.customer.customerName).toBe(mockGrnMissingContactEmail.customerName);
    expect(oc.customer.address).toBe(mockGrnMissingContactEmail.address);
    expect(oc.customer.gstin).toBe(mockGrnMissingContactEmail.gstin);
    // Contact email should be null / undefined cleanly without breaking
    expect(oc.customer.contactEmail == null).toBe(true);
    expect(oc.deliveryInformation.contactEmail == null).toBe(true);
  });
});
