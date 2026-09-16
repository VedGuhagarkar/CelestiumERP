import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { dispatchRepository } from '../src/modules/dispatch/dispatch.repository.js';
import { finishedGoodsRepository } from '../src/modules/finished-goods/finished-goods.repository.js';
import { customerRepository } from '../src/modules/customer/customer.repository.js';
import { purchaseOrderRepository } from '../src/modules/purchase-order/purchase-order.repository.js';
import { grnRepository } from '../src/modules/grn/grn.repository.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { userRepository } from '../src/modules/auth/user.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES, PERMISSIONS } from '../src/modules/rbac/rbac.constants.js';

describe('Dispatch Phase — Prompt 10: Complete Dispatch Phase Integration, Testing and Final Cleanup', () => {
  const app = createApp();
  const testTenant = 'tenant_dispatch_phase_final_integration';
  jest.setTimeout(30000);

  const generateToken = (userId: string, roleCodes: string[], permissions: string[] = []) => {
    return jwt.sign(
      {
        userId,
        email: `${userId}@astralis-aerospace.internal`,
        tenantId: testTenant,
        roles: roleCodes,
        permissions
      },
      config.auth.jwtSecret
    );
  };

  const dispatchOfficerToken = generateToken(
    'usr_dispatch_lead_10',
    ['DISPATCH_OFFICER'],
    [
      PERMISSIONS.DISPATCH_DELIVERY_CREATE,
      PERMISSIONS.DISPATCH_DELIVERY_DISPATCH,
      PERMISSIONS.DISPATCH_PASS_GENERATE,
      PERMISSIONS.DISPATCH_DELIVERY_VIEW,
      PERMISSIONS.DISPATCH_CHALLAN_PRINT
    ]
  );

  const plantManagerToken = generateToken(
    'usr_plant_mgr_10',
    ['PLANT_MANAGER'],
    [
      PERMISSIONS.DISPATCH_DELIVERY_CREATE,
      PERMISSIONS.DISPATCH_DELIVERY_DISPATCH,
      PERMISSIONS.DISPATCH_PASS_GENERATE,
      PERMISSIONS.DISPATCH_DELIVERY_VIEW,
      PERMISSIONS.DISPATCH_CHALLAN_PRINT
    ]
  );

  const productionOperatorToken = generateToken(
    'usr_furnace_operator_10',
    ['FURNACE_OPERATOR'],
    [PERMISSIONS.PRODUCTION_RUN_RECORD, PERMISSIONS.PRODUCTION_PLAN_VIEW]
  );

  const qcInspectorToken = generateToken(
    'usr_qc_inspector_10',
    ['QC_INSPECTOR'],
    [PERMISSIONS.QUALITY_INSPECTION_RECORD, PERMISSIONS.QUALITY_INSPECTION_VIEW]
  );

  const unrelatedUserToken = generateToken(
    'usr_finance_clerk_10',
    ['FINANCE_USER'],
    [PERMISSIONS.FINANCE_PERIOD_CLOSE, PERMISSIONS.FINANCE_ACCOUNT_VIEW]
  );

  // Authoritative Models
  const mockPo = {
    id: 'po_defense_aerospace_10',
    _id: 'po_defense_aerospace_10',
    poNumber: 'PO-2026-AERO-010',
    tenantId: testTenant,
    supplierName: 'Titan Aerospace Dynamics',
    customerCode: 'CUST-TITAN-01',
    customerName: 'Titan Aerospace Dynamics',
    deliveryAddress: 'Hangar 4, Propulsion Facility, Mojave, CA 93501',
    gstin: '06AABCT1332L1Z9',
    status: 'APPROVED',
    isDeleted: false
  };

  const mockGrn = {
    id: 'grn_defense_aerospace_10',
    _id: 'grn_defense_aerospace_10',
    grnNumber: 'GRN-202609-0010',
    tenantId: testTenant,
    poId: 'po_defense_aerospace_10',
    poNumber: 'PO-2026-AERO-010',
    customerCode: 'CUST-TITAN-01',
    customerName: 'Titan Aerospace Dynamics',
    supplierName: 'Titan Aerospace Dynamics',
    deliveryAddress: 'Hangar 4, Propulsion Facility, Mojave, CA 93501',
    gstNumber: '06AABCT1332L1Z9',
    gstin: '06AABCT1332L1Z9',
    contactPerson: 'Col. Arthur Pendelton',
    contactPhone: '+1-555-890-4411',
    contactEmail: 'arthur.pendelton@titan-aerospace.com',
    grnDate: new Date('2026-09-10T09:00:00Z'),
    status: 'COMPLETED',
    isDeleted: false
  };

  const mockBo = {
    id: 'bo_shaft_4340_e2e_10',
    _id: 'bo_shaft_4340_e2e_10',
    jobNumber: 'BO-202609-1010',
    boNumber: 'BO-202609-1010',
    batchOrderNumber: 'BO-202609-1010',
    tenantId: testTenant,
    poId: 'po_defense_aerospace_10',
    poNumber: 'PO-2026-AERO-010',
    grnId: 'grn_defense_aerospace_10',
    grnNumber: 'GRN-202609-0010',
    heatLotNumber: 'HEAT-4340-TITAN-99',
    status: 'WAITING_FOR_DISPATCH',
    priority: 'CRITICAL',

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

    customer: {
      customerId: 'cust_titan_01',
      customerCode: 'CUST-TITAN-01',
      customerName: 'Titan Aerospace Dynamics'
    },

    item: {
      itemId: 'item_rotor_shaft_4340',
      itemCode: 'SHAFT-4340-TITAN',
      itemName: 'High-Torque Turbine Rotor Shaft',
      description: 'Vacuum Carburized Turbine Rotor Shaft for High-Stress Core',
      materialGrade: 'AISI 4340 Vacuum Melt',
      uom: 'PCS'
    },

    recipeSnapshot: {
      recipeId: 'rec_aero_carb_010',
      recipeCode: 'REC-CARB-TITAN',
      name: 'Aerospace Vacuum Carburize & Quench Specification',
      revisionNumber: 3,
      processFamily: 'CASE_HARDENING_CARBURIZING'
    },

    quantity: {
      targetQuantity: 120,
      loadedQuantity: 120,
      completedQuantity: 120,
      scrappedQuantity: 0
    },

    execution: {
      inspectionData: {
        furnaceEquipment: 'IPSEN Vacuum Carburizing Furnace Bay 4',
        furnaceCode: 'FURN-VAC-04',
        hardnessSpecification: '58.0 - 62.0 HRC',
        actualHardness: '60.4 HRC',
        caseDepth: '1.15 mm',
        quantityReceived: 120,
        quantityDelivered: 120,
        disposition: 'CONFORMING',
        isApproved: true,
        approvedAt: new Date('2026-09-15T14:30:00Z'),
        inspectedBy: {
          userId: 'usr_qc_lead_01',
          email: 'qc.lead@astralis-aerospace.internal',
          role: 'METALLURGIST'
        }
      }
    },

    outwardChallanNumber: null as string | null,
    isDeleted: false,
    save: jest.fn().mockImplementation(function (this: any) {
      return Promise.resolve(this);
    })
  };

  const mockFg = {
    id: 'fg_shaft_4340_lot10',
    _id: 'fg_shaft_4340_lot10',
    tenantId: testTenant,
    fgLotNumber: 'FG-4340-TITAN-10',
    jobNumber: 'BO-202609-1010',
    jobCardId: 'bo_shaft_4340_e2e_10',
    itemCode: 'SHAFT-4340-TITAN',
    totalQuantity: 120,
    availableQuantity: 120,
    reservedQuantity: 0,
    dispatchedQuantity: 0,
    uom: 'PCS',
    status: 'AVAILABLE',
    location: 'WAREHOUSE_BAY_7_FINISHED_GOODS',
    movementHistory: [] as any[],
    isDeleted: false,
    toJSON: function () {
      return { ...this };
    },
    save: jest.fn().mockImplementation(function (this: any) {
      return Promise.resolve(this);
    })
  };

  const mockSignatoryUser = {
    id: 'usr_signatory_director',
    _id: 'usr_signatory_director',
    tenantId: testTenant,
    userId: 'usr_signatory_director',
    username: 'signatory.director',
    firstName: 'Reginald',
    lastName: 'Vance',
    email: 'reginald.vance@astralis-aerospace.internal',
    role: 'PLANT_MANAGER',
    roles: ['PLANT_MANAGER'],
    designation: 'Director of Aerospace Quality & Logistics',
    permissions: [
      PERMISSIONS.DISPATCH_DELIVERY_DISPATCH,
      PERMISSIONS.DISPATCH_PASS_GENERATE
    ],
    status: 'active',
    isActive: true,
    isDeleted: false
  };

  const mockUsersMap: Record<string, any> = {
    usr_dispatch_lead_10: {
      id: 'usr_dispatch_lead_10',
      _id: 'usr_dispatch_lead_10',
      tenantId: testTenant,
      username: 'dispatch.lead',
      firstName: 'Dispatch',
      lastName: 'Lead',
      email: 'usr_dispatch_lead_10@celestium-dispatch.internal',
      roles: ['DISPATCH_OFFICER'],
      status: 'active',
      isDeleted: false
    },
    usr_plant_mgr_10: {
      id: 'usr_plant_mgr_10',
      _id: 'usr_plant_mgr_10',
      tenantId: testTenant,
      username: 'plant.mgr',
      firstName: 'Plant',
      lastName: 'Manager',
      email: 'usr_plant_mgr_10@celestium-dispatch.internal',
      roles: ['PLANT_MANAGER'],
      status: 'active',
      isDeleted: false
    },
    usr_furnace_operator_10: {
      id: 'usr_furnace_operator_10',
      _id: 'usr_furnace_operator_10',
      tenantId: testTenant,
      username: 'furnace.op',
      firstName: 'Furnace',
      lastName: 'Operator',
      email: 'usr_furnace_operator_10@celestium-dispatch.internal',
      roles: ['FURNACE_OPERATOR'],
      status: 'active',
      isDeleted: false
    },
    usr_qc_inspector_10: {
      id: 'usr_qc_inspector_10',
      _id: 'usr_qc_inspector_10',
      tenantId: testTenant,
      username: 'qc.inspector',
      firstName: 'QC',
      lastName: 'Inspector',
      email: 'usr_qc_inspector_10@celestium-dispatch.internal',
      roles: ['QC_INSPECTOR'],
      status: 'active',
      isDeleted: false
    },
    usr_finance_clerk_10: {
      id: 'usr_finance_clerk_10',
      _id: 'usr_finance_clerk_10',
      tenantId: testTenant,
      username: 'finance.clerk',
      firstName: 'Finance',
      lastName: 'Clerk',
      email: 'usr_finance_clerk_10@celestium-dispatch.internal',
      roles: ['FINANCE_USER'],
      status: 'active',
      isDeleted: false
    },
    usr_signatory_director: mockSignatoryUser
  };

  let activeConsignment: any = null;

  beforeEach(() => {
    activeConsignment = null;
    mockBo.waitingForProduction = false;
    mockBo.inProduction = false;
    mockBo.waitingForInspection = false;
    mockBo.inInspection = false;
    mockBo.waitingForDispatch = true;
    mockBo.dispatched = false;
    mockBo.inspection = false;
    mockBo.status = 'WAITING_FOR_DISPATCH';
    mockBo.workflowState = {
      waitingForProduction: false,
      inProduction: false,
      waitingForInspection: false,
      inInspection: false,
      waitingForDispatch: true,
      dispatched: false,
      inspection: false
    };
    mockBo.outwardChallanNumber = null;
    mockFg.availableQuantity = 120;
    mockFg.reservedQuantity = 0;
    mockFg.dispatchedQuantity = 0;
    mockFg.status = 'AVAILABLE';
    mockFg.movementHistory = [];

    // Repositories mocking
    jest.spyOn(productionJobRepository, 'findById').mockImplementation(async (_t, id) => {
      if (id === mockBo.id) return { ...mockBo } as any;
      return null;
    });

    jest.spyOn(productionJobRepository, 'findWaitingForDispatchQueue').mockImplementation(async () => {
      if (mockBo.waitingForDispatch && !mockBo.dispatched) {
        return [{ ...mockBo }] as any;
      }
      return [];
    });

    jest.spyOn(productionJobRepository, 'atomicLinkOutwardChallan').mockImplementation(
      async (_t, _id, ocNum, _dcNum, _date) => {
        if (mockBo.outwardChallanNumber) return null;
        mockBo.outwardChallanNumber = ocNum;
        return { ...mockBo } as any;
      }
    );

    jest.spyOn(productionJobRepository, 'atomicMarkDispatched').mockImplementation(
      async (_t, _id, updateData: any) => {
        if (mockBo.dispatched || mockBo.status === 'DISPATCHED') return null;
        mockBo.waitingForDispatch = false;
        mockBo.dispatched = true;
        mockBo.waitingForProduction = false;
        mockBo.inProduction = false;
        mockBo.waitingForInspection = false;
        mockBo.inInspection = false;
        mockBo.inspection = false;
        mockBo.workflowState = {
          waitingForProduction: false,
          inProduction: false,
          waitingForInspection: false,
          inInspection: false,
          waitingForDispatch: false,
          dispatched: true,
          inspection: false
        };
        mockBo.status = 'DISPATCHED';
        (mockBo as any).dispatchedAt = updateData.dispatchedAt;
        (mockBo as any).dispatchedBy = updateData.dispatchedBy;
        return { ...mockBo } as any;
      }
    );

    jest.spyOn(purchaseOrderRepository, 'findById').mockImplementation(async (_t, id) => {
      if (id === mockPo.id) return { ...mockPo } as any;
      return null;
    });

    jest.spyOn(grnRepository, 'findGrnById').mockImplementation(async (_t, id) => {
      if (id === mockGrn.id) return { ...mockGrn } as any;
      return null;
    });

    jest.spyOn(customerRepository, 'findById').mockImplementation(async (_t, id) => {
      if (id === mockPo.customerCode || id === 'cust_titan_01') {
        return {
          id: 'cust_titan_01',
          customerCode: 'CUST-TITAN-01',
          companyName: 'Titan Aerospace Dynamics',
          qualityStatus: 'active',
          isDeleted: false
        } as any;
      }
      return null;
    });

    jest.spyOn(finishedGoodsRepository, 'findById').mockImplementation(async (_t, id) => {
      if (id === mockFg.id) return mockFg as any;
      return null;
    });

    jest.spyOn(finishedGoodsRepository, 'findByJobCardNumber').mockImplementation(async () => {
      return [mockFg as any];
    });

    jest.spyOn(userRepository, 'findById').mockImplementation(async (_t, id) => {
      return (
        mockUsersMap[id] || {
          id,
          _id: id,
          tenantId: testTenant,
          username: id,
          firstName: 'Authorized',
          lastName: 'User',
          email: `${id}@factory.internal`,
          roles: ['DISPATCH_OFFICER'],
          status: 'active',
          isDeleted: false
        }
      );
    });

    jest.spyOn(userRepository, 'findByIdentifier').mockImplementation(async (_t, identifier) => {
      const clean = identifier.toLowerCase().trim();
      for (const u of Object.values(mockUsersMap)) {
        if (
          (u.username && u.username.toLowerCase() === clean) ||
          (u.email && u.email.toLowerCase() === clean) ||
          (u.id && u.id.toLowerCase() === clean)
        ) {
          return u as any;
        }
      }
      return null;
    });

    jest.spyOn(roleRepository, 'seedDefaultRolesForTenant').mockResolvedValue([] as any);
    jest.spyOn(roleRepository, 'findRolesByCodes').mockImplementation(async (_tenantId, codes) => {
      return DEFAULT_FACTORY_ROLES.filter((r) => codes.includes(r.code)).map((r) => ({
        ...r,
        id: `role_${r.code}`,
        status: 'active'
      })) as any;
    });

    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

    let ocCounter = 10;
    let dispCounter = 10;
    let dcCounter = 10;
    let gpCounter = 10;

    jest.spyOn(dispatchRepository, 'generateNextOutwardChallanNumber').mockImplementation(async () => {
      ocCounter++;
      return `OC-202609-${String(ocCounter).padStart(4, '0')}`;
    });

    jest.spyOn(dispatchRepository, 'generateNextDispatchNumber').mockImplementation(async () => {
      dispCounter++;
      return `DSP-202609-${String(dispCounter).padStart(4, '0')}`;
    });

    jest.spyOn(dispatchRepository, 'generateNextDeliveryChallanNumber').mockImplementation(async () => {
      dcCounter++;
      return `DC-2026-${String(dcCounter).padStart(4, '0')}`;
    });

    jest.spyOn(dispatchRepository, 'generateNextGatePassNumber').mockImplementation(async () => {
      gpCounter++;
      return `GP-2026-${String(gpCounter).padStart(4, '0')}`;
    });

    jest.spyOn(dispatchRepository, 'findByBatchOrderId').mockImplementation(async () => {
      return activeConsignment;
    });

    jest.spyOn(dispatchRepository, 'findById').mockImplementation(async (_t, id) => {
      if (!activeConsignment) return null;
      if (
        activeConsignment.id === id ||
        activeConsignment._id === id ||
        activeConsignment.dispatchNumber === id ||
        activeConsignment.outwardChallanNumber === id
      ) {
        return activeConsignment;
      }
      return null;
    });

    jest.spyOn(dispatchRepository, 'findByOutwardChallanNumber').mockImplementation(async (_t, num) => {
      if (activeConsignment && activeConsignment.outwardChallanNumber === num) {
        return activeConsignment;
      }
      return null;
    });

    jest.spyOn(dispatchRepository, 'create').mockImplementation(async (_t, docData: any) => {
      activeConsignment = {
        id: 'disp_consign_e2e_10',
        _id: 'disp_consign_e2e_10',
        ...docData,
        dispatchDate: docData.ocDate,
        heatTreatment: docData.heatTreatmentInformation,
        deliveryInformation: {
          ...docData.deliveryInformation,
          deliveryAddress: docData.deliveryInformation?.address,
          gstNumber: docData.deliveryInformation?.gstin,
          contactPerson: mockGrn.contactPerson
        },
        printCount: 0,
        history: [],
        timeline: docData.timeline || {},
        toJSON: function (this: any) {
          return {
            ...this,
            dispatchDate: this.ocDate,
            heatTreatment: this.heatTreatmentInformation || this.heatTreatment,
            deliveryInformation: {
              ...this.deliveryInformation,
              deliveryAddress: this.deliveryInformation?.address || this.deliveryInformation?.deliveryAddress,
              gstNumber: this.deliveryInformation?.gstin || this.deliveryInformation?.gstNumber,
              contactPerson: mockGrn.contactPerson
            }
          };
        },
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        })
      };
      return activeConsignment;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // 1. Full 21-Step End-to-End Workflow Execution
  // =========================================================================
  describe('1. Authoritative 21-Step End-to-End Workflow Execution', () => {
    it('should complete the entire 21-step workflow from waitingForDispatch through OC, authorization, physical dispatch, inventory removal, and terminal dispatched state', async () => {
      // Step 1: Start with BO in waiting for dispatch
      expect(mockBo.waitingForDispatch).toBe(true);
      expect(mockBo.dispatched).toBe(false);
      expect(mockBo.status).toBe('WAITING_FOR_DISPATCH');

      // Step 2 & 3: Log in as authorized Dispatch user and query dedicated Dispatch Queue
      const queueRes = await request(app)
        .get('/api/v1/dispatches/queue')
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant);
      expect(queueRes.status).toBe(200);

      // Step 4: Select the BO
      const selectedBoId = mockBo.id;
      expect(selectedBoId).toBe('bo_shaft_4340_e2e_10');

      // Step 5: Verify BO belongs to its GRN
      expect(mockBo.grnId).toBe(mockGrn.id);

      // Step 6: Verify GRN belongs to its PO
      expect(mockGrn.poId).toBe(mockPo.id);

      // Step 7: Create the Outward Challan
      const createOcRes = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({
          batchOrderId: selectedBoId,
          notes: 'Standard Outward Challan for Aerospace Propulsion Shafts'
        });
      expect(createOcRes.status).toBe(201);
      const oc = createOcRes.body.data;

      // Step 8: Assert system-controlled OC number
      expect(oc.outwardChallanNumber).toMatch(/^OC-202609-\d{4}$/);

      // Step 9: Verify OC header information derived from GRN
      expect(oc.hierarchy.poId).toBe(mockPo.id);
      expect(oc.hierarchy.grnId).toBe(mockGrn.id);
      expect(oc.hierarchy.batchOrderId).toBe(mockBo.id);
      expect(new Date(oc.dispatchDate).toISOString()).toBe(mockGrn.grnDate.toISOString());

      // Step 10: Verify delivery information derived from GRN
      expect(oc.deliveryInformation.customerName).toBe(mockGrn.customerName);
      expect(oc.deliveryInformation.deliveryAddress).toBe(mockGrn.deliveryAddress);
      expect(oc.deliveryInformation.gstNumber).toBe(mockGrn.gstNumber);
      expect(oc.deliveryInformation.contactPerson).toBe(mockGrn.contactPerson);

      // Step 11: Verify 8 line item fields derived from BO
      expect(oc.items).toHaveLength(1);
      const item = oc.items[0];
      expect(item.serialNumber).toBe(1);
      expect(item.partName).toBe(mockBo.item.itemName);
      expect(item.partDescription).toBe(mockBo.item.description);
      expect(item.partNumber).toBe(mockBo.item.itemCode);
      expect(item.materialGrade).toBe(mockBo.item.materialGrade);
      expect(item.heatTreatmentProcess).toBe(mockBo.recipeSnapshot.name);
      expect(item.batchLotNumber).toBe(mockBo.heatLotNumber);
      expect(item.quantity).toBe(120);
      expect(item.unitOfMeasure).toBe('PCS');

      // Step 12: Verify 6 heat-treatment parameters derived from BO inspection records
      expect(oc.heatTreatment.furnaceEquipment).toBe(mockBo.execution.inspectionData.furnaceEquipment);
      expect(oc.heatTreatment.hardnessSpecification).toBe(mockBo.execution.inspectionData.hardnessSpecification);
      expect(oc.heatTreatment.actualHardness).toBe(mockBo.execution.inspectionData.actualHardness);
      expect(oc.heatTreatment.caseDepth).toBe(mockBo.execution.inspectionData.caseDepth);
      expect(oc.heatTreatment.quantityReceived).toBe(120);
      expect(oc.heatTreatment.quantityDelivered).toBe(120);

      // Step 13 & 14: Enter transport info and verify optional E-Way Bill behavior
      const transportPayload = {
        transporter: 'Apex Defense Air Freight',
        vehicleNumber: 'CA-99-AF-8821',
        dispatchDate: new Date('2026-09-16T10:00:00Z').toISOString(),
        ewayBillNumber: '102938475610' // Optional 12-digit numeric
      };

      // Step 15: Complete required authorization
      const authRes = await request(app)
        .post(`/api/v1/dispatches/${oc.id}/authorize`)
        .set('Authorization', `Bearer ${plantManagerToken}`)
        .set('x-tenant-id', testTenant)
        .send({
          authorizedSignatory: {
            userId: mockSignatoryUser.id,
            signatureRef: 'SIG-DEFENSE-AERO-01'
          },
          approvalNotes: 'Authorized for flight clearance gate departure.'
        });
      expect(authRes.status).toBe(200);
      expect(authRes.body.data.authorizedSignatory.userId).toBe(mockSignatoryUser.id);

      // Step 16: Generate and view the Outward Challan
      const viewRes = await request(app)
        .get(`/api/v1/dispatches/outward-challan/${oc.outwardChallanNumber}`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant);
      expect(viewRes.status).toBe(200);
      expect(viewRes.body.data.outwardChallanNumber).toBe(oc.outwardChallanNumber);

      const printRes = await request(app)
        .post(`/api/v1/dispatches/outward-challan/${oc.outwardChallanNumber}/print`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant);
      expect(printRes.status).toBe(200);
      expect(printRes.body.data.printCount ?? printRes.body.data.outwardChallan?.printCount).toBe(1);

      // Step 17: Perform physical dispatch
      const dispatchRes = await request(app)
        .post(`/api/v1/dispatches/${oc.id}/dispatch`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send(transportPayload);
      expect(dispatchRes.status).toBe(200);
      expect(dispatchRes.body.data.status).toBe('DISPATCHED');

      // Step 18: Remove dispatched material from warehouse/storage inventory without deleting document
      expect(mockFg.availableQuantity).toBe(0);
      expect(mockFg.dispatchedQuantity).toBe(120);
      expect(mockFg.status).toBe('FULLY_DISPATCHED');
      expect(mockFg.movementHistory).toHaveLength(1);
      expect(mockFg.movementHistory[0].toLocation).toBe('CARRIER_APEX_DEFENSE_AIR_FREIGHT');
      expect(mockFg.isDeleted).toBe(false);

      // Step 19: Change BO state to dispatched
      expect(mockBo.status).toBe('DISPATCHED');
      expect(mockBo.dispatched).toBe(true);
      expect(mockBo.waitingForDispatch).toBe(false);

      // Step 20: Verify all other workflow flags are false (exact single active flag invariant)
      expect(mockBo.workflowState.waitingForProduction).toBe(false);
      expect(mockBo.workflowState.inProduction).toBe(false);
      expect(mockBo.workflowState.waitingForInspection).toBe(false);
      expect(mockBo.workflowState.inInspection).toBe(false);
      expect(mockBo.workflowState.waitingForDispatch).toBe(false);
      expect(mockBo.workflowState.inspection).toBe(false);
      expect(mockBo.workflowState.dispatched).toBe(true);

      const activeFlags = Object.values(mockBo.workflowState).filter(Boolean).length;
      expect(activeFlags).toBe(1);

      // Step 21: Verify OC remains historically accessible in read-only mode
      const historicalRes = await request(app)
        .get(`/api/v1/dispatches/outward-challan/${oc.outwardChallanNumber}`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant);
      expect(historicalRes.status).toBe(200);
      expect(historicalRes.body.data.status).toBe('DISPATCHED');
    });
  });

  // =========================================================================
  // 2. Relationship Testing
  // =========================================================================
  describe('2. Relationship Corroboration & Mismatch Rejection', () => {
    it('should strictly reject pairing an unrelated GRN with the Batch Order', async () => {
      const res = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({
          batchOrderId: mockBo.id,
          grnId: 'grn_unrelated_foreign_99'
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/BO\/GRN mismatch/i);
    });

    it('should strictly reject client attempts to pair an unrelated PO with the GRN', async () => {
      const res = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({
          batchOrderId: mockBo.id,
          poId: 'po_unrelated_foreign_99'
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/GRN\/PO mismatch/i);
    });

    it('should reject OC creation against a BO in WAITING_FOR_PRODUCTION state', async () => {
      mockBo.status = 'WAITING_FOR_PRODUCTION';
      mockBo.waitingForDispatch = false;
      mockBo.waitingForProduction = true;
      mockBo.workflowState.waitingForDispatch = false;
      mockBo.workflowState.waitingForProduction = true;

      const res = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({ batchOrderId: mockBo.id });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/waiting for production/i);
    });

    it('should reject OC creation against an in-Inspection BO', async () => {
      mockBo.status = 'IN_INSPECTION';
      mockBo.waitingForDispatch = false;
      mockBo.inInspection = true;
      mockBo.workflowState.waitingForDispatch = false;
      mockBo.workflowState.inInspection = true;

      const res = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({ batchOrderId: mockBo.id });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/currently in inspection/i);
    });

    it('should reject OC creation against a quarantined failed Inspection BO', async () => {
      mockBo.status = 'INSPECTION';
      mockBo.waitingForDispatch = false;
      mockBo.inspection = true;
      mockBo.workflowState.waitingForDispatch = false;
      mockBo.workflowState.inspection = true;

      const res = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({ batchOrderId: mockBo.id });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/failed quality inspection/i);
    });
  });

  // =========================================================================
  // 3. Source-of-Truth Integrity Testing
  // =========================================================================
  describe('3. Source-of-Truth Integrity Testing (Derivation vs Manipulation)', () => {
    it('should ignore client-supplied customer delivery replacements and populate authoritatively from GRN', async () => {
      const res = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({
          batchOrderId: mockBo.id,
          customerName: 'Fake Fraudulent Logistics Ltd.',
          deliveryAddress: '99 Scam Alley, Nowhere City',
          gstNumber: '99FAKEGSTIN1234',
          contactPerson: 'Malicious Attacker'
        });
      expect(res.status).toBe(201);
      const oc = res.body.data;
      expect(oc.deliveryInformation.customerName).toBe(mockGrn.customerName);
      expect(oc.deliveryInformation.deliveryAddress).toBe(mockGrn.deliveryAddress);
      expect(oc.deliveryInformation.gstNumber).toBe(mockGrn.gstNumber);
      expect(oc.deliveryInformation.contactPerson).toBe(mockGrn.contactPerson);
    });

    it('should ignore client-supplied items array and derive items strictly from BO', async () => {
      const res = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({
          batchOrderId: mockBo.id,
          items: [
            {
              partName: 'Arbitrary Plastic Widget',
              partNumber: 'WIDGET-999',
              materialGrade: 'Cheap Plastic',
              quantity: 5000
            }
          ]
        });
      expect(res.status).toBe(201);
      const oc = res.body.data;
      expect(oc.items[0].partName).toBe(mockBo.item.itemName);
      expect(oc.items[0].partNumber).toBe(mockBo.item.itemCode);
      expect(oc.items[0].materialGrade).toBe(mockBo.item.materialGrade);
      expect(oc.items[0].quantity).toBe(120);
    });

    it('should ignore client-supplied heat treatment overrides and derive strictly from BO inspection data', async () => {
      const res = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({
          batchOrderId: mockBo.id,
          heatTreatment: {
            furnaceEquipment: 'Open Fire Pit',
            actualHardness: '99 HRC',
            caseDepth: '10.0 mm'
          }
        });
      expect(res.status).toBe(201);
      const oc = res.body.data;
      expect(oc.heatTreatment.furnaceEquipment).toBe(mockBo.execution.inspectionData.furnaceEquipment);
      expect(oc.heatTreatment.actualHardness).toBe(mockBo.execution.inspectionData.actualHardness);
      expect(oc.heatTreatment.caseDepth).toBe(mockBo.execution.inspectionData.caseDepth);
    });
  });

  // =========================================================================
  // 4. Authorization & RBAC Testing
  // =========================================================================
  describe('4. Authorization & RBAC Testing', () => {
    it('should reject unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('x-tenant-id', testTenant)
        .send({ batchOrderId: mockBo.id });
      expect(res.status).toBe(401);
    });

    it('should reject Production-only user from creating an Outward Challan with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${productionOperatorToken}`)
        .set('x-tenant-id', testTenant)
        .send({ batchOrderId: mockBo.id });
      expect(res.status).toBe(403);
    });

    it('should reject Inspection-only user from executing physical dispatch with 403 Forbidden', async () => {
      // First create valid OC
      const ocRes = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({ batchOrderId: mockBo.id });
      expect(ocRes.status).toBe(201);
      const oc = ocRes.body.data;

      const res = await request(app)
        .post(`/api/v1/dispatches/${oc.id}/dispatch`)
        .set('Authorization', `Bearer ${qcInspectorToken}`)
        .set('x-tenant-id', testTenant)
        .send({
          transporter: 'Test Transporter',
          vehicleNumber: 'MH-12-AB-1234',
          dispatchDate: new Date().toISOString()
        });
      expect(res.status).toBe(403);
    });

    it('should reject unrelated user without Dispatch permission with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${unrelatedUserToken}`)
        .set('x-tenant-id', testTenant)
        .send({ batchOrderId: mockBo.id });
      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // 5. Workflow State Invariant & Boundary Testing
  // =========================================================================
  describe('5. Workflow State Invariant & Boundary Testing', () => {
    it('should reject physical dispatch if Batch Order has corrupted multiple active flags', async () => {
      const ocRes = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({ batchOrderId: mockBo.id });
      expect(ocRes.status).toBe(201);
      const oc = ocRes.body.data;

      // Authorize first so authorization gate passes
      await request(app)
        .post(`/api/v1/dispatches/${oc.id}/authorize`)
        .set('Authorization', `Bearer ${plantManagerToken}`)
        .set('x-tenant-id', testTenant)
        .send({ authorizedSignatory: { userId: mockSignatoryUser.id } });

      // Corrupt BO flags
      mockBo.waitingForDispatch = true;
      mockBo.inProduction = true;
      mockBo.workflowState.waitingForDispatch = true;
      mockBo.workflowState.inProduction = true;

      const res = await request(app)
        .post(`/api/v1/dispatches/${oc.id}/dispatch`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({
          transporter: 'Apex Defense Air Freight',
          vehicleNumber: 'CA-99-AF-8821',
          dispatchDate: new Date().toISOString()
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/multiple active workflow flags/i);
    });

    it('should reject physical dispatch without prior authorized signatory approval', async () => {
      const ocRes = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({ batchOrderId: mockBo.id });
      expect(ocRes.status).toBe(201);
      const oc = ocRes.body.data;

      // Omit authorization step
      const res = await request(app)
        .post(`/api/v1/dispatches/${oc.id}/dispatch`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({
          transporter: 'Apex Defense Air Freight',
          vehicleNumber: 'CA-99-AF-8821',
          dispatchDate: new Date().toISOString()
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/requires an authorized signatory before physical dispatch/i);
    });

    it('should reject physical dispatch if the BO is already dispatched', async () => {
      const ocRes = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({ batchOrderId: mockBo.id });
      expect(ocRes.status).toBe(201);
      const oc = ocRes.body.data;

      // Authorize
      await request(app)
        .post(`/api/v1/dispatches/${oc.id}/authorize`)
        .set('Authorization', `Bearer ${plantManagerToken}`)
        .set('x-tenant-id', testTenant)
        .send({
          authorizedSignatory: { userId: mockSignatoryUser.id }
        });

      // First dispatch succeeds
      const firstRes = await request(app)
        .post(`/api/v1/dispatches/${oc.id}/dispatch`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({
          transporter: 'Apex Defense Air Freight',
          vehicleNumber: 'CA-99-AF-8821',
          dispatchDate: new Date().toISOString()
        });
      expect(firstRes.status).toBe(200);

      // Second dispatch must fail safely
      const secondRes = await request(app)
        .post(`/api/v1/dispatches/${oc.id}/dispatch`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({
          transporter: 'Apex Defense Air Freight',
          vehicleNumber: 'CA-99-AF-8821',
          dispatchDate: new Date().toISOString()
        });
      expect(secondRes.status).toBe(400);
      expect(secondRes.body.message).toMatch(/already dispatched/i);
    });
  });

  // =========================================================================
  // 6. Inventory Removal & Negative Stock Prevention
  // =========================================================================
  describe('6. Inventory Removal & Negative Stock Prevention', () => {
    it('should reject physical dispatch when warehouse stock is insufficient to prevent negative inventory', async () => {
      mockFg.availableQuantity = 50; // Insufficient for 120 qty BO

      const ocRes = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({ batchOrderId: mockBo.id });
      expect(ocRes.status).toBe(201);
      const oc = ocRes.body.data;

      await request(app)
        .post(`/api/v1/dispatches/${oc.id}/authorize`)
        .set('Authorization', `Bearer ${plantManagerToken}`)
        .set('x-tenant-id', testTenant)
        .send({ authorizedSignatory: { userId: mockSignatoryUser.id } });

      const res = await request(app)
        .post(`/api/v1/dispatches/${oc.id}/dispatch`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({
          transporter: 'Apex Defense Air Freight',
          vehicleNumber: 'CA-99-AF-8821',
          dispatchDate: new Date().toISOString()
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cannot create negative inventory/i);
    });

    it('should reject physical dispatch if requested line quantity does not match authoritative BO delivered quantity', async () => {
      const ocRes = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({ batchOrderId: mockBo.id });
      expect(ocRes.status).toBe(201);
      const oc = ocRes.body.data;

      // Artificially modify line quantity on consignment
      activeConsignment.lines[0].dispatchedQuantity = 999;

      await request(app)
        .post(`/api/v1/dispatches/${oc.id}/authorize`)
        .set('Authorization', `Bearer ${plantManagerToken}`)
        .set('x-tenant-id', testTenant)
        .send({ authorizedSignatory: { userId: mockSignatoryUser.id } });

      const res = await request(app)
        .post(`/api/v1/dispatches/${oc.id}/dispatch`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({
          transporter: 'Apex Defense Air Freight',
          vehicleNumber: 'CA-99-AF-8821',
          dispatchDate: new Date().toISOString()
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/quantity mismatch/i);
    });
  });

  // =========================================================================
  // 7. Concurrency & Collision Protection
  // =========================================================================
  describe('7. Concurrency & Collision Protection', () => {
    it('should handle concurrent OC creation with single-winner lock returning 409 Conflict to loser', async () => {
      let firstCall = true;
      jest.spyOn(productionJobRepository, 'atomicLinkOutwardChallan').mockImplementation(
        async (_t, _id, ocNum, _dcNum, _date) => {
          if (firstCall) {
            firstCall = false;
            mockBo.outwardChallanNumber = ocNum;
            return { ...mockBo } as any;
          }
          return null; // Losing concurrent request
        }
      );

      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/v1/dispatches/outward-challan')
          .set('Authorization', `Bearer ${dispatchOfficerToken}`)
          .set('x-tenant-id', testTenant)
          .send({ batchOrderId: mockBo.id }),
        request(app)
          .post('/api/v1/dispatches/outward-challan')
          .set('Authorization', `Bearer ${plantManagerToken}`)
          .set('x-tenant-id', testTenant)
          .send({ batchOrderId: mockBo.id })
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 409]);
    });

    it('should protect against concurrent physical dispatch collisions, returning 409 Conflict and rolling back inventory', async () => {
      const ocRes = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({ batchOrderId: mockBo.id });
      expect(ocRes.status).toBe(201);
      const oc = ocRes.body.data;

      await request(app)
        .post(`/api/v1/dispatches/${oc.id}/authorize`)
        .set('Authorization', `Bearer ${plantManagerToken}`)
        .set('x-tenant-id', testTenant)
        .send({ authorizedSignatory: { userId: mockSignatoryUser.id } });

      // Mock atomicMarkDispatched to fail simulating race collision
      jest.spyOn(productionJobRepository, 'atomicMarkDispatched').mockResolvedValue(null as any);

      const res = await request(app)
        .post(`/api/v1/dispatches/${oc.id}/dispatch`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({
          transporter: 'Apex Defense Air Freight',
          vehicleNumber: 'CA-99-AF-8821',
          dispatchDate: new Date().toISOString()
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/concurrent dispatch collision/i);
      // Verify rollback: stock restored to available
      expect(mockFg.availableQuantity).toBe(120);
      expect(mockFg.dispatchedQuantity).toBe(0);
    });
  });

  // =========================================================================
  // 8. Document Testing & Immutability Protection
  // =========================================================================
  describe('8. Document Testing & Immutability Protection', () => {
    it('should generate printable Nadcap AC7102-compliant HTML containing all authoritative sections', async () => {
      const ocRes = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({ batchOrderId: mockBo.id });
      expect(ocRes.status).toBe(201);
      const oc = ocRes.body.data;

      const printRes = await request(app)
        .get(`/api/v1/dispatches/outward-challan/${oc.outwardChallanNumber}/print`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant);
      expect(printRes.status).toBe(200);
      const html = printRes.body.data.htmlDocument || printRes.body.data.htmlReport;

      expect(html).toContain(oc.outwardChallanNumber);
      expect(html).toContain(mockPo.poNumber);
      expect(html).toContain(mockGrn.grnNumber);
      expect(html).toContain(mockBo.boNumber);
      expect(html).toContain(mockGrn.customerName);
      expect(html).toContain(mockBo.item.itemCode);
      expect(html).toContain(mockBo.execution.inspectionData.hardnessSpecification);
      expect(html).toContain('Nadcap');
    });

    it('should reject direct API modification of a dispatched Outward Challan with 400 Bad Request', async () => {
      const ocRes = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({ batchOrderId: mockBo.id });
      expect(ocRes.status).toBe(201);
      const oc = ocRes.body.data;

      await request(app)
        .post(`/api/v1/dispatches/${oc.id}/authorize`)
        .set('Authorization', `Bearer ${plantManagerToken}`)
        .set('x-tenant-id', testTenant)
        .send({ authorizedSignatory: { userId: mockSignatoryUser.id } });

      await request(app)
        .post(`/api/v1/dispatches/${oc.id}/dispatch`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({
          transporter: 'Apex Defense Air Freight',
          vehicleNumber: 'CA-99-AF-8821',
          dispatchDate: new Date().toISOString()
        });

      const updateRes = await request(app)
        .put(`/api/v1/dispatches/outward-challan/${oc.outwardChallanNumber}`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({ notes: 'Attempting to modify dispatched document' });
      expect(updateRes.status).toBe(400);
      expect(updateRes.body.message).toMatch(/immutable|cannot.*modified/i);
    });

    it('should reject deletion of a dispatched Outward Challan with 400 Bad Request', async () => {
      const ocRes = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({ batchOrderId: mockBo.id });
      expect(ocRes.status).toBe(201);
      const oc = ocRes.body.data;

      await request(app)
        .post(`/api/v1/dispatches/${oc.id}/authorize`)
        .set('Authorization', `Bearer ${plantManagerToken}`)
        .set('x-tenant-id', testTenant)
        .send({ authorizedSignatory: { userId: mockSignatoryUser.id } });

      await request(app)
        .post(`/api/v1/dispatches/${oc.id}/dispatch`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({
          transporter: 'Apex Defense Air Freight',
          vehicleNumber: 'CA-99-AF-8821',
          dispatchDate: new Date().toISOString()
        });

      const delRes = await request(app)
        .delete(`/api/v1/dispatches/outward-challan/${oc.outwardChallanNumber}`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant);
      expect(delRes.status).toBe(400);
      expect(delRes.body.message).toMatch(/cannot delete|authoritative|immutable|protected/i);
    });
  });

  // =========================================================================
  // 9. Cross-Phase Boundary & Final Termination Chain
  // =========================================================================
  describe('9. Cross-Phase Boundary & Final Termination Chain', () => {
    it('should verify that Dispatch only begins after waitingForDispatch and terminates the entire ERP lifecycle as dispatched', async () => {
      // 1. Inception Gate: Cannot create OC while BO is still in earlier phases
      mockBo.status = 'IN_PRODUCTION';
      mockBo.waitingForDispatch = false;
      mockBo.inProduction = true;
      mockBo.workflowState.waitingForDispatch = false;
      mockBo.workflowState.inProduction = true;

      const earlyRes = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({ batchOrderId: mockBo.id });
      expect(earlyRes.status).toBe(400);

      // 2. Normal handoff from QA Inspection to waitingForDispatch
      mockBo.status = 'WAITING_FOR_DISPATCH';
      mockBo.inProduction = false;
      mockBo.waitingForDispatch = true;
      mockBo.workflowState.inProduction = false;
      mockBo.workflowState.waitingForDispatch = true;

      // 3. OC Creation
      const ocRes = await request(app)
        .post('/api/v1/dispatches/outward-challan')
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({ batchOrderId: mockBo.id });
      expect(ocRes.status).toBe(201);
      const oc = ocRes.body.data;

      // Verify the unbroken hierarchy: PO -> GRN -> BO -> OC
      expect(oc.hierarchy).toMatchObject({
        poId: mockPo.id,
        poNumber: mockPo.poNumber,
        grnId: mockGrn.id,
        grnNumber: mockGrn.grnNumber,
        batchOrderId: mockBo.id,
        batchOrderNumber: mockBo.boNumber,
        outwardChallanNumber: oc.outwardChallanNumber
      });

      // 4. Authorization
      await request(app)
        .post(`/api/v1/dispatches/${oc.id}/authorize`)
        .set('Authorization', `Bearer ${plantManagerToken}`)
        .set('x-tenant-id', testTenant)
        .send({ authorizedSignatory: { userId: mockSignatoryUser.id } });

      // 5. Physical Dispatch Departure
      const dispatchRes = await request(app)
        .post(`/api/v1/dispatches/${oc.id}/dispatch`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('x-tenant-id', testTenant)
        .send({
          transporter: 'Apex Defense Air Freight',
          vehicleNumber: 'CA-99-AF-8821',
          dispatchDate: new Date().toISOString()
        });
      expect(dispatchRes.status).toBe(200);

      // 6. Terminal State Verification: BO dispatched = true, waitingForDispatch = false, all other flags false
      expect(mockBo.status).toBe('DISPATCHED');
      expect(mockBo.dispatched).toBe(true);
      expect(mockBo.waitingForDispatch).toBe(false);
      expect(mockBo.waitingForProduction).toBe(false);
      expect(mockBo.inProduction).toBe(false);
      expect(mockBo.waitingForInspection).toBe(false);
      expect(mockBo.inInspection).toBe(false);
      expect(mockBo.inspection).toBe(false);

      // 7. Finished goods material availability removed
      expect(mockFg.availableQuantity).toBe(0);
      expect(mockFg.status).toBe('FULLY_DISPATCHED');
    });
  });
});
