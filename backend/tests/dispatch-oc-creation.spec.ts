import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { customerRepository } from '../src/modules/customer/customer.repository.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { grnRepository } from '../src/modules/grn/grn.repository.js';
import { purchaseOrderRepository } from '../src/modules/purchase-order/purchase-order.repository.js';
import { dispatchRepository } from '../src/modules/dispatch/dispatch.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';

describe('Authoritative Outward Challan (OC) Creation & PO/GRN/BO/OC Hierarchy', () => {
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

  const mockGrn = {
    id: 'grn_4140_001',
    _id: 'grn_4140_001',
    tenantId: testTenant,
    grnNumber: 'GRN-202609-0025',
    poId: 'po_4140_001',
    poNumber: 'PO-202609-0010',
    supplierName: 'Titan Alloy Forge Ltd',
    supplierCode: 'SUP-TITAN-01',
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
        acceptedQuantity: 500,
        uom: 'PCS',
        unitCount: 500,
        supplierHeatNumber: 'HEAT-994140-A',
        unitIdentifiers: ['UNIT-001', 'UNIT-002']
      }
    ],
    isDeleted: false
  };

  const createMockJob = (overrides: any = {}) => {
    return {
      id: 'job_bo_4140_01',
      _id: 'job_bo_4140_01',
      tenantId: testTenant,
      jobNumber: 'JOB-202609-0040',
      boNumber: 'BO-202609-0040',
      batchOrderNumber: 'BO-202609-0040',
      poId: 'po_4140_001',
      poNumber: 'PO-202609-0010',
      grnId: 'grn_4140_001',
      grnNumber: 'GRN-202609-0025',
      customer: {
        customerId: 'cust_aero_01',
        customerCode: 'CUST-AERO-01',
        customerName: 'Aero Dynamics Corp'
      },
      item: {
        itemId: 'item_4140_bar',
        itemCode: 'PART-PINION-4140',
        itemName: 'Precision Pinion Shaft 4140',
        materialGrade: 'AISI 4140',
        uom: 'PCS'
      },
      recipeSnapshot: {
        recipeId: 'rec_4140_01',
        recipeCode: 'REC-4140-V1',
        revisionNumber: 1,
        processFamily: 'CARBURIZING',
        name: 'Aerospace Vacuum Carburize Cycle',
        applicableMaterialGrades: ['AISI 4140'],
        stages: [],
        metallurgicalTargets: {
          surfaceHardnessMin: 58,
          surfaceHardnessMax: 62,
          hardnessScale: 'HRC',
          effectiveCaseDepthMinMm: 0.8,
          effectiveCaseDepthMaxMm: 1.2
        },
        machineRequirements: { minWorkingTempC: 800, maxWorkingTempC: 1000 },
        snapshottedAt: new Date()
      },
      quantity: {
        targetQuantity: 200,
        loadedQuantity: 200,
        completedQuantity: 200,
        scrappedQuantity: 0
      },
      weightKg: 850,
      weight: 850,
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
      execution: {
        inspectionData: {
          disposition: 'APPROVED',
          inspectionId: 'insp_4140_01',
          cocNumber: 'COC-202609-0088',
          hardnessAverage: 60.5,
          effectiveCaseDepthMm: 1.05,
          isConforming: true
        }
      },
      genealogy: {
        whichPo: { poId: 'po_4140_001', poNumber: 'PO-202609-0010' },
        whichGrn: { grnId: 'grn_4140_001', grnNumber: 'GRN-202609-0025' },
        whichHeatLot: { heatLotNumber: 'HEAT-994140-A' }
      },
      heatLotNumber: 'HEAT-994140-A',
      outwardChallanNumber: null,
      outwardChallanId: null,
      outwardChallanDate: null,
      isDeleted: false,
      ...overrides
    };
  };

  beforeEach(() => {
    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);
    jest.spyOn(roleRepository, 'seedDefaultRolesForTenant').mockResolvedValue([] as any);
    jest.spyOn(roleRepository, 'findRolesByCodes').mockImplementation(async (_tenantId, codes) => {
      return DEFAULT_FACTORY_ROLES.filter((r) => codes.includes(r.code)).map((r) => ({
        ...r,
        id: `role_${r.code}`,
        status: 'active'
      })) as any;
    });

    // Default repository mock implementations
    jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValue(mockPo as any);
    jest.spyOn(grnRepository, 'findGrnById').mockResolvedValue(mockGrn as any);
    jest.spyOn(customerRepository, 'findById').mockResolvedValue({
      id: 'cust_aero_01',
      customerCode: 'CUST-AERO-01',
      customerName: 'Aero Dynamics Corp',
      status: 'ACTIVE'
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Valid waiting-for-dispatch BO & PO/GRN/BO/OC Hierarchy', () => {
    it('should create an OC for exactly one eligible BO with complete unbroken PO -> GRN -> BO -> OC hierarchy', async () => {
      const token = generateToken('usr_dispatch', ['DISPATCH_OFFICER']);
      const mockJob = createMockJob();

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob as any);
      jest.spyOn(dispatchRepository, 'findByBatchOrderId').mockResolvedValue(null);
      jest.spyOn(dispatchRepository, 'generateNextOutwardChallanNumber').mockResolvedValue('OC-202609-0001');
      jest.spyOn(dispatchRepository, 'generateNextDispatchNumber').mockResolvedValue('DSP-202609-0001');
      jest.spyOn(dispatchRepository, 'generateNextDeliveryChallanNumber').mockResolvedValue('DC-202609-0001');
      jest.spyOn(productionJobRepository, 'atomicLinkOutwardChallan').mockResolvedValue({
        ...mockJob,
        outwardChallanNumber: 'OC-202609-0001',
        outwardChallanDate: mockGrn.grnDate
      } as any);

      jest.spyOn(dispatchRepository, 'create').mockImplementation(async (_tenantId, data) => {
        return {
          id: 'oc_disp_001',
          ...data,
          toJSON: function () {
            return { ...this };
          }
        } as any;
      });

      const res = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${token}`)
        .send({
          batchOrderId: 'job_bo_4140_01',
          carrierName: 'FastTrack Aerospace Freight',
          transportMode: 'ROAD',
          vehicleNumber: 'KA-01-AF-9900',
          driverName: 'Robert Vance'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const oc = res.body.data;
      expect(oc.outwardChallanNumber).toBe('OC-202609-0001');
      expect(oc.isOutwardChallan).toBe(true);
      expect(oc.status).toBe('QUALITY_VERIFIED');

      // Assert Unbroken Hierarchy: PO -> GRN -> BO -> OC
      expect(oc.batchOrderId).toBe('job_bo_4140_01');
      expect(oc.batchOrderNumber).toBe('BO-202609-0040');
      expect(oc.grnId).toBe('grn_4140_001');
      expect(oc.grnNumber).toBe('GRN-202609-0025');
      expect(oc.poId).toBe('po_4140_001');
      expect(oc.poNumber).toBe('PO-202609-0010');

      expect(oc.hierarchy).toBeDefined();
      expect(oc.hierarchy.poId).toBe('po_4140_001');
      expect(oc.hierarchy.poNumber).toBe('PO-202609-0010');
      expect(oc.hierarchy.grnId).toBe('grn_4140_001');
      expect(oc.hierarchy.grnNumber).toBe('GRN-202609-0025');
      expect(oc.hierarchy.batchOrderId).toBe('job_bo_4140_01');
      expect(oc.hierarchy.batchOrderNumber).toBe('BO-202609-0040');
      expect(oc.hierarchy.outwardChallanNumber).toBe('OC-202609-0001');

      // Assert Authoritative Date derived from GRN
      expect(new Date(oc.ocDate).toISOString()).toBe(mockGrn.grnDate.toISOString());

      // Assert Line details derived from BO
      expect(oc.lines).toHaveLength(1);
      expect(oc.lines[0].dispatchedQuantity).toBe(200);
      expect(oc.lines[0].itemCode).toBe('PART-PINION-4140');
      expect(oc.lines[0].heatLotNumber).toBe('HEAT-994140-A');
    });

    it('should also be accessible via the alias route /api/v1/dispatch/outward-challan', async () => {
      const token = generateToken('usr_dispatch', ['DISPATCH_OFFICER']);
      const mockJob = createMockJob();

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob as any);
      jest.spyOn(dispatchRepository, 'findByBatchOrderId').mockResolvedValue(null);
      jest.spyOn(dispatchRepository, 'generateNextOutwardChallanNumber').mockResolvedValue('OC-202609-0002');
      jest.spyOn(dispatchRepository, 'generateNextDispatchNumber').mockResolvedValue('DSP-202609-0002');
      jest.spyOn(dispatchRepository, 'generateNextDeliveryChallanNumber').mockResolvedValue('DC-202609-0002');
      jest.spyOn(productionJobRepository, 'atomicLinkOutwardChallan').mockResolvedValue({
        ...mockJob,
        outwardChallanNumber: 'OC-202609-0002'
      } as any);

      jest.spyOn(dispatchRepository, 'create').mockImplementation(async (_tenantId, data) => {
        return {
          id: 'oc_disp_002',
          ...data,
          toJSON: function () {
            return { ...this };
          }
        } as any;
      });

      const res = await request(app)
        .post('/api/v1/dispatch/outward-challan')
        .set('Authorization', `Bearer ${token}`)
        .send({
          batchOrderId: 'job_bo_4140_01'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.outwardChallanNumber).toBe('OC-202609-0002');
    });
  });

  describe('2. Invalid BO State Enforcement (waitingForDispatch = true is mandatory)', () => {
    const invalidStates = [
      {
        stateName: 'WAITING_FOR_PRODUCTION',
        overrides: {
          status: 'WAITING_FOR_PRODUCTION',
          waitingForProduction: true,
          waitingForDispatch: false,
          workflowState: { waitingForProduction: true, waitingForDispatch: false }
        },
        expectedErrSubstring: 'waiting for production'
      },
      {
        stateName: 'IN_PRODUCTION',
        overrides: {
          status: 'IN_PRODUCTION',
          inProduction: true,
          waitingForDispatch: false,
          workflowState: { inProduction: true, waitingForDispatch: false }
        },
        expectedErrSubstring: 'currently in production'
      },
      {
        stateName: 'WAITING_FOR_INSPECTION',
        overrides: {
          status: 'WAITING_FOR_INSPECTION',
          waitingForInspection: true,
          waitingForDispatch: false,
          workflowState: { waitingForInspection: true, waitingForDispatch: false }
        },
        expectedErrSubstring: 'waiting for inspection'
      },
      {
        stateName: 'IN_INSPECTION',
        overrides: {
          status: 'IN_INSPECTION',
          inInspection: true,
          waitingForDispatch: false,
          workflowState: { inInspection: true, waitingForDispatch: false }
        },
        expectedErrSubstring: 'currently in inspection'
      },
      {
        stateName: 'INSPECTION (quarantined failure)',
        overrides: {
          status: 'INSPECTION',
          inspection: true,
          waitingForDispatch: false,
          workflowState: { inspection: true, waitingForDispatch: false }
        },
        expectedErrSubstring: 'failed Quality Inspection and is quarantined'
      },
      {
        stateName: 'DISPATCHED',
        overrides: {
          status: 'DISPATCHED',
          dispatched: true,
          waitingForDispatch: false,
          workflowState: { dispatched: true, waitingForDispatch: false }
        },
        expectedErrSubstring: 'already been dispatched'
      }
    ];

    invalidStates.forEach(({ stateName, overrides, expectedErrSubstring }) => {
      it(`should strictly reject OC creation when BO is in ${stateName}`, async () => {
        const token = generateToken('usr_dispatch', ['DISPATCH_OFFICER']);
        const invalidJob = createMockJob(overrides);

        jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(invalidJob as any);

        const res = await request(app)
          .post('/api/v1/dispatches/outward-challan')
          .set('Authorization', `Bearer ${token}`)
          .send({
            batchOrderId: invalidJob.id
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain('Dispatch Protection Violation');
        expect(res.body.message).toContain(expectedErrSubstring);
      });
    });
  });

  describe('3. BO/GRN Relationship & Mismatch Rejection', () => {
    it('should reject OC creation when user attempts to pair an unrelated GRN with the BO', async () => {
      const token = generateToken('usr_dispatch', ['DISPATCH_OFFICER']);
      const mockJob = createMockJob({ grnId: 'grn_4140_001' });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob as any);

      // Attempt to pair with unrelated GRN
      const res = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${token}`)
        .send({
          batchOrderId: mockJob.id,
          grnId: 'grn_UNRELATED_999'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('BO/GRN mismatch');
      expect(res.body.message).toContain('grn_4140_001');
      expect(res.body.message).toContain('grn_UNRELATED_999');
    });

    it('should reject OC creation if the referenced GRN does not exist in the database', async () => {
      const token = generateToken('usr_dispatch', ['DISPATCH_OFFICER']);
      const mockJob = createMockJob({ grnId: 'grn_nonexistent_01' });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob as any);
      jest.spyOn(grnRepository, 'findGrnById').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${token}`)
        .send({
          batchOrderId: mockJob.id
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Goods Receipt Note with ID');
    });
  });

  describe('4. GRN/PO Relationship & Mismatch Rejection', () => {
    it('should reject OC creation when user attempts to independently provide an unrelated PO', async () => {
      const token = generateToken('usr_dispatch', ['DISPATCH_OFFICER']);
      const mockJob = createMockJob();

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob as any);
      jest.spyOn(grnRepository, 'findGrnById').mockResolvedValue(mockGrn as any); // belongs to po_4140_001

      // Attempt to provide unrelated PO
      const res = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${token}`)
        .send({
          batchOrderId: mockJob.id,
          grnId: 'grn_4140_001',
          poId: 'po_UNRELATED_777'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('GRN/PO mismatch');
      expect(res.body.message).toContain('po_4140_001');
      expect(res.body.message).toContain('po_UNRELATED_777');
    });

    it('should reject OC creation if the derived PO does not exist in the database', async () => {
      const token = generateToken('usr_dispatch', ['DISPATCH_OFFICER']);
      const mockJob = createMockJob();

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob as any);
      jest.spyOn(grnRepository, 'findGrnById').mockResolvedValue(mockGrn as any);
      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${token}`)
        .send({
          batchOrderId: mockJob.id
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Purchase Order with ID');
    });
  });

  describe('5. Duplicate OC Creation Rejection', () => {
    it('should reject duplicate OC creation when an active consignment already exists for the BO', async () => {
      const token = generateToken('usr_dispatch', ['DISPATCH_OFFICER']);
      const mockJob = createMockJob();

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob as any);
      jest.spyOn(grnRepository, 'findGrnById').mockResolvedValue(mockGrn as any);
      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValue(mockPo as any);

      // Existing consignment already present in database
      jest.spyOn(dispatchRepository, 'findByBatchOrderId').mockResolvedValue({
        id: 'disp_existing_01',
        outwardChallanNumber: 'OC-202609-0001',
        status: 'QUALITY_VERIFIED'
      } as any);

      const res = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${token}`)
        .send({
          batchOrderId: mockJob.id
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Duplicate OC Creation');
      expect(res.body.message).toContain('OC-202609-0001');
    });

    it('should reject duplicate OC creation if the BO already has outwardChallanNumber stamped', async () => {
      const token = generateToken('usr_dispatch', ['DISPATCH_OFFICER']);
      const mockJobWithOc = createMockJob({
        outwardChallanNumber: 'OC-202609-0001',
        outwardChallanId: 'oc_disp_001'
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJobWithOc as any);
      jest.spyOn(dispatchRepository, 'findByBatchOrderId').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${token}`)
        .send({
          batchOrderId: mockJobWithOc.id
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Duplicate OC Creation');
    });
  });

  describe('6. Concurrent OC Creation Collision Protection', () => {
    it('should allow exactly one winner and reject the competing transaction with 409 Conflict when concurrent requests race', async () => {
      const token = generateToken('usr_dispatch', ['DISPATCH_OFFICER']);
      const mockJob = createMockJob();

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob as any);
      jest.spyOn(dispatchRepository, 'findByBatchOrderId').mockResolvedValue(null);
      jest.spyOn(dispatchRepository, 'generateNextOutwardChallanNumber').mockResolvedValue('OC-202609-0003');
      jest.spyOn(dispatchRepository, 'generateNextDispatchNumber').mockResolvedValue('DSP-202609-0003');
      jest.spyOn(dispatchRepository, 'generateNextDeliveryChallanNumber').mockResolvedValue('DC-202609-0003');

      let attemptCount = 0;
      jest.spyOn(productionJobRepository, 'atomicLinkOutwardChallan').mockImplementation(async () => {
        attemptCount++;
        // First concurrent request succeeds; second concurrent request fails atomic conditional update
        if (attemptCount === 1) {
          return { ...mockJob, outwardChallanNumber: 'OC-202609-0003' } as any;
        }
        return null;
      });

      jest.spyOn(dispatchRepository, 'create').mockImplementation(async (_tenantId, data) => {
        return {
          id: 'oc_disp_003',
          ...data,
          toJSON: function () {
            return { ...this };
          }
        } as any;
      });

      // Fire concurrent requests simultaneously
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/v1/dispatches/outward-challan')
          .set('Authorization', `Bearer ${token}`)
          .send({ batchOrderId: mockJob.id }),
        request(app)
          .post('/api/v1/dispatches/outward-challan')
          .set('Authorization', `Bearer ${token}`)
          .send({ batchOrderId: mockJob.id })
      ]);

      const results = [res1, res2];
      const success = results.find((r) => r.status === 201);
      const conflict = results.find((r) => r.status === 409);

      expect(success).toBeDefined();
      expect(conflict).toBeDefined();
      expect(conflict?.body.message).toContain('Concurrent OC Creation');
    });
  });

  describe('7. Automatic OC Number & Immutability Enforcement', () => {
    it('should ignore client-supplied custom OC number and always generate authoritative OC-YYYYMM-XXXX', async () => {
      const token = generateToken('usr_dispatch', ['DISPATCH_OFFICER']);
      const mockJob = createMockJob();

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob as any);
      jest.spyOn(dispatchRepository, 'findByBatchOrderId').mockResolvedValue(null);
      jest.spyOn(dispatchRepository, 'generateNextOutwardChallanNumber').mockResolvedValue('OC-202609-0004');
      jest.spyOn(dispatchRepository, 'generateNextDispatchNumber').mockResolvedValue('DSP-202609-0004');
      jest.spyOn(dispatchRepository, 'generateNextDeliveryChallanNumber').mockResolvedValue('DC-202609-0004');
      jest.spyOn(productionJobRepository, 'atomicLinkOutwardChallan').mockResolvedValue({
        ...mockJob,
        outwardChallanNumber: 'OC-202609-0004'
      } as any);

      jest.spyOn(dispatchRepository, 'create').mockImplementation(async (_tenantId, data) => {
        return {
          id: 'oc_disp_004',
          ...data,
          toJSON: function () {
            return { ...this };
          }
        } as any;
      });

      // Direct API manipulation: client supplies custom OC number
      const res = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${token}`)
        .send({
          batchOrderId: mockJob.id,
          outwardChallanNumber: 'TAMPERED-CUSTOM-OC-999',
          ocNumber: 'TAMPERED-001'
        });

      expect(res.status).toBe(201);
      // Must NOT be the client-entered number; must be system generated
      expect(res.body.data.outwardChallanNumber).toBe('OC-202609-0004');
      expect(res.body.data.hierarchy.outwardChallanNumber).toBe('OC-202609-0004');
    });
  });

  describe('8. Direct API Manipulation & Authoritative OC Date', () => {
    it('should ignore client-supplied date and authoritatively derive OC date strictly from the GRN', async () => {
      const token = generateToken('usr_dispatch', ['DISPATCH_OFFICER']);
      const mockJob = createMockJob();

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob as any);
      jest.spyOn(dispatchRepository, 'findByBatchOrderId').mockResolvedValue(null);
      jest.spyOn(dispatchRepository, 'generateNextOutwardChallanNumber').mockResolvedValue('OC-202609-0005');
      jest.spyOn(dispatchRepository, 'generateNextDispatchNumber').mockResolvedValue('DSP-202609-0005');
      jest.spyOn(dispatchRepository, 'generateNextDeliveryChallanNumber').mockResolvedValue('DC-202609-0005');
      jest.spyOn(productionJobRepository, 'atomicLinkOutwardChallan').mockResolvedValue({
        ...mockJob,
        outwardChallanNumber: 'OC-202609-0005'
      } as any);

      jest.spyOn(dispatchRepository, 'create').mockImplementation(async (_tenantId, data) => {
        return {
          id: 'oc_disp_005',
          ...data,
          toJSON: function () {
            return { ...this };
          }
        } as any;
      });

      // Client attempts to pass arbitrary historical or future dates
      const res = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${token}`)
        .send({
          batchOrderId: mockJob.id,
          ocDate: '1999-01-01T00:00:00Z',
          customDate: '2030-12-31T00:00:00Z'
        });

      expect(res.status).toBe(201);
      // Authoritative date matches GRN's grnDate exactly
      expect(new Date(res.body.data.ocDate).toISOString()).toBe(mockGrn.grnDate.toISOString());
      expect(new Date(res.body.data.hierarchy.ocDate).toISOString()).toBe(mockGrn.grnDate.toISOString());
    });
  });

  describe('9. Dispatch Boundary Enforcement', () => {
    it('should NOT mark the Batch Order as dispatched upon OC creation (dispatched = false)', async () => {
      const token = generateToken('usr_dispatch', ['DISPATCH_OFFICER']);
      const mockJob = createMockJob();

      let linkedBO: any = null;
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob as any);
      jest.spyOn(dispatchRepository, 'findByBatchOrderId').mockResolvedValue(null);
      jest.spyOn(dispatchRepository, 'generateNextOutwardChallanNumber').mockResolvedValue('OC-202609-0006');
      jest.spyOn(dispatchRepository, 'generateNextDispatchNumber').mockResolvedValue('DSP-202609-0006');
      jest.spyOn(dispatchRepository, 'generateNextDeliveryChallanNumber').mockResolvedValue('DC-202609-0006');
      jest.spyOn(productionJobRepository, 'atomicLinkOutwardChallan').mockImplementation(async (_tenantId, _jobId, ocId, ocNumber, ocDate) => {
        linkedBO = {
          ...mockJob,
          outwardChallanId: ocId,
          outwardChallanNumber: ocNumber,
          outwardChallanDate: ocDate,
          waitingForDispatch: true,
          dispatched: false
        };
        return linkedBO as any;
      });

      jest.spyOn(dispatchRepository, 'create').mockImplementation(async (_tenantId, data) => {
        return {
          id: 'oc_disp_006',
          ...data,
          toJSON: function () {
            return { ...this };
          }
        } as any;
      });

      const res = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${token}`)
        .send({
          batchOrderId: mockJob.id
        });

      expect(res.status).toBe(201);

      // Verify that BO is NOT marked as dispatched
      expect(linkedBO).toBeDefined();
      expect(linkedBO.waitingForDispatch).toBe(true);
      expect(linkedBO.dispatched).toBe(false);
      expect(res.body.data.status).not.toBe('DISPATCHED');
    });
  });

  describe('10. Dedicated Dispatch Queue (Prompt 2 Integration)', () => {
    it('should return only BOs with waitingForDispatch = true enriched with complete PO, GRN, Part, Recipe, and Inspection clearance', async () => {
      const token = generateToken('usr_dispatch', ['DISPATCH_OFFICER']);
      const mockJob = createMockJob();

      jest.spyOn(productionJobRepository, 'findWaitingForDispatchQueue').mockResolvedValue([mockJob as any]);

      const res = await request(app)
        .get('/api/v1/dispatches/queue')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(1);

      const queueItem = res.body.data[0];
      expect(queueItem.boNumber).toBe('BO-202609-0040');
      expect(queueItem.waitingForDispatch).toBe(true);
      expect(queueItem.dispatched).toBe(false);

      // Lineage & Metadata Enriched
      expect(queueItem.poNumber).toBe('PO-202609-0010');
      expect(queueItem.grnNumber).toBe('GRN-202609-0025');
      expect(queueItem.customer.customerName).toBe('Aero Dynamics Corp');
      expect(queueItem.part.itemCode).toBe('PART-PINION-4140');
      expect(queueItem.recipe.recipeCode).toBe('REC-4140-V1');
      expect(queueItem.quantities.targetQuantity).toBe(200);
      expect(queueItem.weightKg).toBe(850);
      expect(queueItem.inspectionCompletion.isQualityApproved).toBe(true);
      expect(queueItem.inspectionCompletion.cocNumber).toBe('COC-202609-0088');
    });
  });
});
