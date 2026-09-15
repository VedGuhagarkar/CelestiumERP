import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { grnRepository } from '../src/modules/grn/grn.repository.js';
import { purchaseOrderRepository } from '../src/modules/purchase-order/purchase-order.repository.js';
import { dispatchRepository } from '../src/modules/dispatch/dispatch.repository.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';

describe('Dispatch Phase — Prompt 5: BO-Derived OC Items and Heat-Treatment Information', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_core';

  const generateToken = (userId: string, roleCodes: string[]) => {
    return jwt.sign(
      {
        userId,
        tenantId: testTenant,
        roles: roleCodes,
        permissions: ['dispatch:manage', 'dispatch:create', 'dispatch:view']
      },
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
    orderDate: new Date('2026-09-01T08:00:00Z'),
    status: 'RECEIVED',
    items: [
      {
        lineItemId: 'po_line_01',
        itemId: 'item_4140_bar',
        itemCode: 'MAT-4140-BAR',
        itemName: 'AISI 4140 Pinion Shafts',
        materialGrade: 'AISI 4140',
        processFamily: 'CARBURIZING',
        recipeId: 'rec_4140_01',
        recipeCode: 'REC-4140-V1',
        recipeRevision: 1,
        orderedQuantity: 500,
        receivedQuantity: 500,
        uom: 'PCS'
      }
    ],
    isDeleted: false
  };

  const mockGrn = {
    id: 'grn_4140_001',
    _id: 'grn_4140_001',
    tenantId: testTenant,
    grnNumber: 'GRN-202609-0025',
    poId: 'po_4140_001',
    poNumber: 'PO-202609-0010',
    supplierName: 'Apex Drivetrains Heavy Industries',
    customerName: 'Apex Drivetrains Heavy Industries',
    customerCode: 'CUST-APEX-01',
    customerId: 'cust_apex_01',
    address: '450 Aerospace Boulevard, Sector 9, Huntsville, AL 35801',
    deliveryAddress: '450 Aerospace Boulevard, Sector 9, Huntsville, AL 35801',
    destinationAddress: '450 Aerospace Boulevard, Sector 9, Huntsville, AL 35801',
    gstin: '01AAAAA0000A1Z5',
    contactEmail: 'receiving@apex-drivetrains.com',
    grnDate: new Date('2026-09-05T10:30:00Z'),
    status: 'AVAILABLE_FOR_PLANNING',
    items: [
      {
        poLineItemId: 'po_line_01',
        itemId: 'item_4140_bar',
        itemCode: 'MAT-4140-BAR',
        itemName: 'AISI 4140 Pinion Shafts',
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
        supplierHeatNumber: 'HEAT-4140-ALPHA'
      }
    ],
    isDeleted: false
  };

  const mockBoValid = {
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
      customerId: 'cust_apex_01',
      customerCode: 'CUST-APEX-01',
      customerName: 'Apex Drivetrains Heavy Industries'
    },
    item: {
      itemId: 'item_4140_bar',
      itemCode: 'MAT-4140-PINION',
      itemName: 'Case-Hardened Pinion Shafts 4140',
      description: 'Heavy duty carburized transmission pinion shafts',
      materialGrade: 'AISI 4140H',
      uom: 'PCS'
    },
    quantity: {
      targetQuantity: 500,
      loadedQuantity: 500,
      completedQuantity: 495,
      verifiedQuantity: 495,
      scrappedQuantity: 5
    },
    weightKg: 2450.5,
    heatLotNumber: 'HL-4140-2026B',
    recipeSnapshot: {
      recipeId: 'rec_4140_01',
      recipeCode: 'REC-4140-V1',
      name: 'Carburize & Quench 58-62 HRC',
      processFamily: 'CARBURIZING',
      revisionNumber: 1
    },
    specificationSnapshot: {
      specificationId: 'spec_4140_01',
      specCode: 'SPEC-PINION-01',
      title: 'Transmission Pinion Hardening Specification',
      surfaceHardness: {
        min: 58,
        max: 62,
        scale: 'HRC'
      }
    },
    execution: {
      equipmentAssignment: {
        furnaceCode: 'FURNACE-SECO-02'
      },
      inspectionData: {
        isQualityApproved: true,
        disposition: 'APPROVED',
        cocNumber: 'COC-2026-0988',
        furnaceCode: 'FURNACE-SECO-02',
        hardnessSpecification: {
          minHardness: 58,
          maxHardness: 62,
          scale: 'HRC'
        },
        actualHardness: {
          measuredAverage: 60.8,
          scale: 'HRC',
          isCompliant: true
        },
        caseDepth: {
          effectiveCaseDepthMm: 1.25,
          isCompliant: true
        },
        quantityReceived: 500,
        quantityDelivered: 495,
        quantityRejected: 5,
        inspectionNotes: 'All case depth and surface hardness criteria conforming to customer print.'
      }
    },
    isDeleted: false
  };

  const dispatchToken = generateToken('dispatch_lead_01', ['DISPATCH_MANAGER', 'DISPATCH_OFFICER']);

  beforeEach(() => {
    jest.clearAllMocks();

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
      if (id === mockBoValid.id) return { ...mockBoValid } as any;
      return null;
    });

    jest.spyOn(grnRepository, 'findGrnById').mockImplementation(async (tenantId, id) => {
      if (id === mockGrn.id) return { ...mockGrn } as any;
      return null;
    });

    jest.spyOn(purchaseOrderRepository, 'findById').mockImplementation(async (tenantId, id) => {
      if (id === mockPo.id) return { ...mockPo } as any;
      return null;
    });

    jest.spyOn(dispatchRepository, 'findByBatchOrderId').mockResolvedValue(null);
    jest.spyOn(dispatchRepository, 'generateNextOutwardChallanNumber').mockResolvedValue('OC-202609-0001');
    jest.spyOn(dispatchRepository, 'generateNextDispatchNumber').mockResolvedValue('DSP-202609-0001');
    jest.spyOn(dispatchRepository, 'generateNextDeliveryChallanNumber').mockResolvedValue('DC-202609-0001');

    jest.spyOn(productionJobRepository, 'atomicLinkOutwardChallan').mockImplementation(
      async (tenantId, batchOrderId, challanNumber) => {
        return {
          ...mockBoValid,
          outwardChallanNumber: challanNumber
        } as any;
      }
    );

    jest.spyOn(productionJobRepository, 'atomicUnlinkOutwardChallan').mockResolvedValue(undefined as any);

    jest.spyOn(dispatchRepository, 'create').mockImplementation(async (tenantId, data: any) => {
      return {
        id: 'disp_created_01',
        _id: 'disp_created_01',
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      } as any;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // 1. Valid BO: Complete Derivation of Item and Heat-Treatment Data
  // --------------------------------------------------------------------------
  it('1. should authoritatively derive all 8 item fields and all 6 heat-treatment fields from the valid BO', async () => {
    const res = await request(app)
      .post('/api/v1/dispatches/outward-challan')
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        batchOrderId: mockBoValid.id
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const oc = res.body.data;
    expect(oc.outwardChallanNumber).toBe('OC-202609-0001');

    // Section 1: Item Information (All 8 required fields)
    expect(oc.items).toBeDefined();
    expect(oc.items.length).toBe(1);
    const item = oc.items[0];
    expect(item.serialNumber).toBe(1);
    expect(item.partName).toBe('Case-Hardened Pinion Shafts 4140');
    expect(item.partNumber).toBe('MAT-4140-PINION');
    expect(item.materialGrade).toBe('AISI 4140H');
    expect(item.heatTreatmentProcess).toBe('Carburize & Quench 58-62 HRC');
    expect(item.batchLotNumber).toBe('HL-4140-2026B');
    expect(item.quantity).toBe(495);
    expect(item.unitOfMeasure).toBe('PCS');

    // Section 4: Heat-Treatment Information (All 6 required fields)
    expect(oc.heatTreatmentInformation).toBeDefined();
    const ht = oc.heatTreatmentInformation;
    expect(ht.furnaceEquipment).toBe('FURNACE-SECO-02');
    expect(ht.hardnessSpecification).toBe('58-62 HRC');
    expect(ht.actualHardness).toBe('60.8 HRC');
    expect(ht.actualHardnessValue).toBe(60.8);
    expect(ht.caseDepth).toBe('1.25 mm');
    expect(ht.effectiveCaseDepthMm).toBe(1.25);
    expect(ht.quantityReceived).toBe(500);
    expect(ht.quantityDelivered).toBe(495);
  });

  // --------------------------------------------------------------------------
  // 2. Mismatched BO: Relationship to GRN strictly enforced
  // --------------------------------------------------------------------------
  it('2. should strictly reject OC creation when client attempts to pair an unrelated GRN with the BO', async () => {
    const res = await request(app)
      .post('/api/v1/dispatches/outward-challan')
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        batchOrderId: mockBoValid.id,
        grnId: 'grn_unrelated_9999' // Mismatched GRN
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/BO\/GRN mismatch|Unrelated GRNs cannot be paired/i);
  });

  // --------------------------------------------------------------------------
  // 3. Changed Client Item Data: Ignored or Overwritten by Authoritative BO Data
  // --------------------------------------------------------------------------
  it('3. should ignore client-submitted altered item data and enforce authoritative BO item data', async () => {
    const res = await request(app)
      .post('/api/v1/dispatches/outward-challan')
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        batchOrderId: mockBoValid.id,
        items: [
          {
            partName: 'Tampered Gear Part Name',
            partNumber: 'FAKE-PART-999',
            materialGrade: 'Cheap Plastic',
            heatTreatmentProcess: 'None',
            batchLotNumber: 'FAKE-LOT-000'
          }
        ],
        partName: 'Tampered Gear Part Name',
        partNumber: 'FAKE-PART-999',
        materialGrade: 'Cheap Plastic'
      });

    expect(res.status).toBe(201);
    const oc = res.body.data;
    const item = oc.items[0];

    // Must be the authoritative BO item, NOT the client's tampered data!
    expect(item.partName).toBe('Case-Hardened Pinion Shafts 4140');
    expect(item.partNumber).toBe('MAT-4140-PINION');
    expect(item.materialGrade).toBe('AISI 4140H');
    expect(item.heatTreatmentProcess).toBe('Carburize & Quench 58-62 HRC');
    expect(item.batchLotNumber).toBe('HL-4140-2026B');
  });

  // --------------------------------------------------------------------------
  // 4. Changed Client Heat-Treatment Data: Ignored and Overwritten by BO Data
  // --------------------------------------------------------------------------
  it('4. should ignore client-submitted altered heat-treatment parameters and enforce BO inspection data', async () => {
    const res = await request(app)
      .post('/api/v1/dispatches/outward-challan')
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        batchOrderId: mockBoValid.id,
        heatTreatmentInformation: {
          furnaceEquipment: 'ALTERED-FURNACE-99',
          hardnessSpecification: '20-30 HRC',
          actualHardness: '99.9 HRC',
          caseDepth: '10.0 mm',
          quantityReceived: 999,
          quantityDelivered: 999
        },
        furnaceEquipment: 'ALTERED-FURNACE-99',
        actualHardness: '99.9 HRC',
        caseDepth: '10.0 mm'
      });

    expect(res.status).toBe(201);
    const oc = res.body.data;
    const ht = oc.heatTreatmentInformation;

    // Must NOT contain client-submitted tampered values!
    expect(ht.furnaceEquipment).toBe('FURNACE-SECO-02');
    expect(ht.hardnessSpecification).toBe('58-62 HRC');
    expect(ht.actualHardness).toBe('60.8 HRC');
    expect(ht.caseDepth).toBe('1.25 mm');
    expect(ht.quantityReceived).toBe(500);
    expect(ht.quantityDelivered).toBe(495);
  });

  // --------------------------------------------------------------------------
  // 5. Missing BO Heat-Treatment Data: Rejected with 400 Bad Request
  // --------------------------------------------------------------------------
  it('5. should strictly reject OC creation when the BO is missing required heat-treatment data', async () => {
    const boMissingInspection = {
      ...mockBoValid,
      id: mockBoValid.id,
      execution: {
        // Missing inspectionData completely!
        inspectionData: null
      }
    };

    jest.spyOn(productionJobRepository, 'findById').mockImplementation(async (tenantId, id) => {
      if (id === boMissingInspection.id) return { ...boMissingInspection } as any;
      return null;
    });

    const res = await request(app)
      .post('/api/v1/dispatches/outward-challan')
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        batchOrderId: boMissingInspection.id
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/missing required heat-treatment inspection data/i);
  });

  // --------------------------------------------------------------------------
  // 6. Quantity Manipulation: Client Altered Quantity Strictly Rejected
  // --------------------------------------------------------------------------
  it('6. should strictly reject OC creation when client attempts quantity manipulation', async () => {
    // Client tries to dispatch 200 instead of authoritative completed quantity 495
    const res = await request(app)
      .post('/api/v1/dispatches/outward-challan')
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        batchOrderId: mockBoValid.id,
        quantity: 200
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Quantity manipulation rejected/i);
    expect(res.body.message).toContain('495');
  });

  it('6b. should strictly reject OC creation when client attempts dispatchedQuantity manipulation', async () => {
    const res = await request(app)
      .post('/api/v1/dispatches/outward-challan')
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        batchOrderId: mockBoValid.id,
        dispatchedQuantity: 100
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Quantity manipulation rejected/i);
  });

  // --------------------------------------------------------------------------
  // 7. Recipe Mismatch: Client Altered Recipe Strictly Rejected
  // --------------------------------------------------------------------------
  it('7. should strictly reject OC creation when client attempts recipe mismatch manipulation', async () => {
    const res = await request(app)
      .post('/api/v1/dispatches/outward-challan')
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        batchOrderId: mockBoValid.id,
        recipeId: 'rec_altered_wrong_recipe'
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Recipe mismatch/i);
  });

  // --------------------------------------------------------------------------
  // 8. Historical Record Modification: BO Records Preserved and Unaltered
  // --------------------------------------------------------------------------
  it('8. should preserve BO historical inspection and production records without alteration upon OC creation', async () => {
    const originalInspectionData = JSON.parse(JSON.stringify(mockBoValid.execution.inspectionData));
    const originalRecipeSnapshot = JSON.parse(JSON.stringify(mockBoValid.recipeSnapshot));

    const res = await request(app)
      .post('/api/v1/dispatches/outward-challan')
      .set('Authorization', `Bearer ${dispatchToken}`)
      .send({
        batchOrderId: mockBoValid.id
      });

    expect(res.status).toBe(201);

    // Verify mockBo was not mutated in its historical inspection records
    expect(mockBoValid.execution.inspectionData).toEqual(originalInspectionData);
    expect(mockBoValid.recipeSnapshot).toEqual(originalRecipeSnapshot);
    expect(mockBoValid.workflowState.dispatched).toBe(false);
  });
});
