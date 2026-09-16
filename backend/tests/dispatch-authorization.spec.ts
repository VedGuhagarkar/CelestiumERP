import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { dispatchRepository } from '../src/modules/dispatch/dispatch.repository.js';
import { finishedGoodsRepository } from '../src/modules/finished-goods/finished-goods.repository.js';
import { userRepository } from '../src/modules/auth/user.repository.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { customerRepository } from '../src/modules/customer/customer.repository.js';
import { grnRepository } from '../src/modules/grn/grn.repository.js';
import { purchaseOrderRepository } from '../src/modules/purchase-order/purchase-order.repository.js';
import { rbacService } from '../src/modules/rbac/rbac.service.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES, PERMISSIONS } from '../src/modules/rbac/rbac.constants.js';

describe('Dispatch Phase — Prompt 7: OC Authorization and Customer Acknowledgement', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_authorization';

  const generateToken = (userId: string, roleCodes: string[], perms: string[] = []) => {
    return jwt.sign(
      {
        userId,
        email: `${userId}@celestium-dispatch.internal`,
        tenantId: testTenant,
        roles: roleCodes,
        permissions: [
          PERMISSIONS.DISPATCH_DELIVERY_DISPATCH,
          PERMISSIONS.DISPATCH_PASS_GENERATE,
          'dispatch:manage',
          'dispatch:create',
          'dispatch:view',
          ...perms
        ]
      },
      config.auth.jwtSecret
    );
  };

  const dispatchOfficerToken = generateToken('usr_officer_01', ['DISPATCH_OFFICER']);
  const plantManagerToken = generateToken('usr_manager_01', ['PLANT_MANAGER']);
  const unauthorizedToken = generateToken('usr_operator_01', ['OPERATOR']);

  const mockUsers: Record<string, any> = {
    usr_officer_01: {
      id: 'usr_officer_01',
      _id: 'usr_officer_01',
      tenantId: testTenant,
      username: 'officer_elena',
      firstName: 'Elena',
      lastName: 'Rostova',
      email: 'usr_officer_01@celestium-dispatch.internal',
      roles: ['DISPATCH_OFFICER'],
      status: 'active',
      isDeleted: false
    },
    usr_manager_01: {
      id: 'usr_manager_01',
      _id: 'usr_manager_01',
      tenantId: testTenant,
      username: 'mgr_marcus',
      firstName: 'Marcus',
      lastName: 'Vance',
      email: 'usr_manager_01@celestium-dispatch.internal',
      roles: ['PLANT_MANAGER'],
      status: 'active',
      isDeleted: false
    },
    usr_admin_01: {
      id: 'usr_admin_01',
      _id: 'usr_admin_01',
      tenantId: testTenant,
      username: 'admin_sophia',
      firstName: 'Sophia',
      lastName: 'Chen',
      email: 'usr_admin_01@celestium-dispatch.internal',
      roles: ['ADMIN'],
      status: 'active',
      isDeleted: false
    },
    usr_operator_01: {
      id: 'usr_operator_01',
      _id: 'usr_operator_01',
      tenantId: testTenant,
      username: 'op_john',
      firstName: 'John',
      lastName: 'Doe',
      email: 'usr_operator_01@celestium-dispatch.internal',
      roles: ['OPERATOR'],
      status: 'active',
      isDeleted: false
    },
    usr_suspended_01: {
      id: 'usr_suspended_01',
      _id: 'usr_suspended_01',
      tenantId: testTenant,
      username: 'suspended_user',
      firstName: 'Suspended',
      lastName: 'User',
      email: 'usr_suspended_01@celestium-dispatch.internal',
      roles: ['DISPATCH_OFFICER'],
      status: 'suspended',
      isDeleted: false
    }
  };

  const mockBo = {
    id: '507f191e810c19729de860ea',
    _id: '507f191e810c19729de860ea',
    jobNumber: 'BO-202609-0701',
    boNumber: 'BO-202609-0701',
    batchOrderNumber: 'BO-202609-0701',
    tenantId: testTenant,
    poId: 'po_auth_001',
    poNumber: 'PO-202609-0010',
    grnId: 'grn_auth_001',
    grnNumber: 'GRN-202609-0025',
    customer: {
      customerId: 'cust_aerospace_01',
      customerCode: 'CUST-AERO-01',
      customerName: 'Aero Dynamics Propulsion Ltd'
    },
    item: {
      itemId: 'item_auth_01',
      itemCode: 'PART-AERO-01',
      itemName: 'Aero Turbine Pinion',
      materialGrade: 'AISI 4140',
      uom: 'PCS'
    },
    recipeSnapshot: {
      recipeId: 'rec_auth_01',
      recipeCode: 'REC-CARB-01',
      name: 'Aerospace Vacuum Carburizing',
      processFamily: 'CARBURIZING',
      revisionNumber: 1,
      metallurgicalTargets: {
        surfaceHardnessMin: 58,
        surfaceHardnessMax: 62,
        hardnessScale: 'HRC',
        effectiveCaseDepthMinMm: 0.8,
        effectiveCaseDepthMaxMm: 1.2
      }
    },
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
    quantity: {
      targetQuantity: 300,
      completedQuantity: 300,
      loadedQuantity: 300,
      scrappedQuantity: 0
    },
    execution: {
      inspectionData: {
        isQualityApproved: true,
        disposition: 'APPROVED',
        cocNumber: 'COC-2026-0701',
        furnaceCode: 'FURNACE-SECO-01',
        hardnessAverage: 60.5,
        effectiveCaseDepthMm: 1.05,
        hardnessSpecification: {
          minHardness: 58,
          maxHardness: 62,
          scale: 'HRC'
        },
        actualHardness: {
          measuredAverage: 60.5,
          scale: 'HRC'
        },
        caseDepth: {
          effectiveCaseDepthMm: 1.05
        },
        quantityDelivered: 300
      }
    },
    isDeleted: false
  };

  const createMockConsignment = (overrides: Record<string, any> = {}) => {
    const consignment: any = {
      id: 'disp_oc_auth_01',
      _id: 'disp_oc_auth_01',
      tenantId: testTenant,
      dispatchNumber: 'DSP-202609-0701',
      outwardChallanNumber: 'OC-202609-0701',
      batchOrderId: mockBo.id,
      batchOrderNumber: mockBo.boNumber,
      isOutwardChallan: true,
      customerId: 'cust_aerospace_01',
      customer: {
        customerId: 'cust_aerospace_01',
        customerCode: 'CUST-AERO-01',
        customerName: 'Aero Dynamics Propulsion Ltd'
      },
      status: 'QUALITY_VERIFIED',
      totalQuantity: 300,
      lines: [
        {
          lineId: 'LINE-001',
          finishedGoodsId: 'fg_auth_01',
          dispatchedQuantity: 300,
          jobId: mockBo.id,
          jobNumber: mockBo.jobNumber,
          uom: 'PCS'
        }
      ],
      timeline: {},
      carrier: {
        carrierName: 'Precision Aero Haulers',
        transportMode: 'ROAD'
      },
      vehicle: {
        vehicleNumber: 'KA-04-TR-8812'
      },
      history: [],
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

  beforeEach(() => {
    jest.restoreAllMocks();

    jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockBo as any);
    jest.spyOn(productionJobRepository, 'atomicMarkDispatched').mockResolvedValue({
      ...mockBo,
      status: 'DISPATCHED',
      dispatched: true
    } as any);

    jest.spyOn(finishedGoodsRepository, 'findById').mockResolvedValue({
      id: 'fg_auth_01',
      _id: 'fg_auth_01',
      tenantId: testTenant,
      fgLotNumber: 'FG-LOT-0701',
      customerCode: 'CUST-AERO-01',
      totalQuantity: 300,
      availableQuantity: 0,
      reservedQuantity: 300,
      dispatchedQuantity: 0,
      status: 'RESERVED',
      isDeleted: false,
      save: jest.fn().mockResolvedValue(true as any),
      toJSON: function () {
        return { ...this };
      }
    } as any);

    // Mock RoleRepository for RBAC checks in middleware and service
    jest.spyOn(roleRepository, 'seedDefaultRolesForTenant').mockResolvedValue([] as any);
    jest.spyOn(roleRepository, 'findRolesByCodes').mockImplementation(async (_tenantId, codes) => {
      return DEFAULT_FACTORY_ROLES.filter((r) => codes.includes(r.code)).map((r) => ({
        ...r,
        id: `role_${r.code}`,
        status: 'active'
      })) as any;
    });

    jest.spyOn(customerRepository, 'findById').mockResolvedValue({
      id: 'cust_aerospace_01',
      customerCode: 'CUST-AERO-01',
      customerName: 'Aero Dynamics Propulsion Ltd',
      status: 'ACTIVE'
    } as any);

    jest.spyOn(grnRepository, 'findGrnById').mockResolvedValue({
      id: 'grn_auth_001',
      grnNumber: 'GRN-202609-0025',
      customerName: 'Aero Dynamics Propulsion Ltd',
      status: 'AVAILABLE_FOR_PLANNING'
    } as any);

    jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValue({
      id: 'po_auth_001',
      poNumber: 'PO-202609-0010',
      status: 'RECEIVED'
    } as any);

    jest.spyOn(dispatchRepository, 'findByBatchOrderId').mockResolvedValue(null);
    jest.spyOn(dispatchRepository, 'findByOutwardChallanNumber').mockResolvedValue(null);
    jest.spyOn(dispatchRepository, 'generateNextOutwardChallanNumber').mockResolvedValue('OC-202609-0701');
    jest.spyOn(dispatchRepository, 'generateNextDispatchNumber').mockResolvedValue('DSP-202609-0701');
    jest.spyOn(dispatchRepository, 'generateNextDeliveryChallanNumber').mockResolvedValue('DC-202609-0701');
    jest.spyOn(dispatchRepository, 'generateNextGatePassNumber').mockResolvedValue('GP-202609-0701');
    jest.spyOn(productionJobRepository, 'atomicLinkOutwardChallan').mockResolvedValue(mockBo as any);
    jest.spyOn(productionJobRepository, 'atomicUnlinkOutwardChallan').mockResolvedValue(undefined as any);
    jest.spyOn(dispatchRepository, 'create').mockImplementation(async (_tenantId, data) => {
      return {
        id: '507f191e810c19729de860eb',
        ...data,
        toJSON: function () {
          return { ...this };
        }
      } as any;
    });

    // Mock UserRepository to lookup mockUsers
    jest.spyOn(userRepository, 'findById').mockImplementation(async (_tenantId, userId) => {
      return mockUsers[userId] || null;
    });
    jest.spyOn(userRepository, 'findByIdentifier').mockImplementation(async (_tenantId, identifier) => {
      const clean = identifier.toLowerCase().trim();
      for (const u of Object.values(mockUsers)) {
        if (u.username.toLowerCase() === clean || u.email.toLowerCase() === clean) {
          return u;
        }
      }
      return null;
    });

    jest.spyOn(auditService, 'record').mockResolvedValue(undefined as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Prepared By (OC Authoritative Preparer)', () => {
    it('should record the authenticated user as preparer when not explicitly supplied', async () => {
      const consignment = createMockConsignment();
      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(consignment);
      jest.spyOn(dispatchRepository, 'generateNextGatePassNumber').mockResolvedValue('GP-202609-0701');

      const res = await request(app)
        .post(`/api/v1/dispatches/${consignment.id}/authorize`)
        .set('Authorization', `Bearer ${plantManagerToken}`)
        .send({
          signatureRef: 'SIG-MGR-0701',
          approvalNotes: 'Inspection records verified and delivery approved'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('APPROVED');
      expect(res.body.data.authorizedSignatory).toBeDefined();
      expect(res.body.data.authorizedSignatory.userId).toBe('usr_manager_01');
      expect(res.body.data.authorizedSignatory.name).toBe('Marcus Vance');
      expect(res.body.data.authorizedSignatory.signatureRef).toBe('SIG-MGR-0701');
    });

    it('should strictly reject arbitrary non-existent user identifier as preparer', async () => {
      const consignment = createMockConsignment();
      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(consignment);

      // Attempt to physically dispatch with arbitrary preparer in direct call
      const res = await request(app)
        .post(`/api/v1/dispatches/outward-challan`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .send({
          batchOrderId: mockBo.id,
          preparedById: 'usr_completely_fake_arbitrary_9999',
          carrierName: 'Reliable Freight',
          vehicleNumber: 'MH-12-AB-1234'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Arbitrary user identifiers are strictly prohibited/i);
    });

    it('should accept valid explicit user as preparer', async () => {
      jest.spyOn(dispatchRepository, 'generateNextOutwardChallanNumber').mockResolvedValue('OC-202609-0702');
      jest.spyOn(dispatchRepository, 'generateNextDispatchNumber').mockResolvedValue('DSP-202609-0702');
      jest.spyOn(dispatchRepository, 'generateNextDeliveryChallanNumber').mockResolvedValue('DC-202609-0702');
      jest.spyOn(productionJobRepository, 'atomicLinkOutwardChallan').mockResolvedValue(mockBo as any);
      jest.spyOn(dispatchRepository, 'create').mockImplementation(async (_tenantId, data) => {
        return {
          id: 'disp_oc_created_01',
          ...data,
          toJSON: function () {
            return { ...this };
          }
        } as any;
      });

      const res = await request(app)
        .post(`/api/v1/dispatches/outward-challan`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .send({
          batchOrderId: mockBo.id,
          preparedById: 'usr_officer_01',
          carrierName: 'Aerospace Hauler',
          vehicleNumber: 'KA-01-AF-9900'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.preparedBy).toBeDefined();
      expect(res.body.data.preparedBy.userId).toBe('usr_officer_01');
      expect(res.body.data.preparedBy.name).toBe('Elena Rostova');
    });
  });

  describe('2. Authorized Signatory & ERP Permission Validation', () => {
    it('should validate and attach authorized signatory with PLANT_MANAGER role and issue Gate Pass', async () => {
      const consignment = createMockConsignment();
      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(consignment);
      jest.spyOn(dispatchRepository, 'generateNextGatePassNumber').mockResolvedValue('GP-202609-0702');

      const res = await request(app)
        .post(`/api/v1/dispatches/${consignment.id}/authorize`)
        .set('Authorization', `Bearer ${plantManagerToken}`)
        .send({
          authorizedSignatoryId: 'usr_manager_01',
          signatureRef: 'SIG-STAMP-VANCE-2026',
          approvalNotes: 'Authorized for factory gate exit'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.status).toBe('APPROVED');
      expect(data.authorizedSignatory.userId).toBe('usr_manager_01');
      expect(data.authorizedSignatory.name).toBe('Marcus Vance');
      expect(data.authorizedSignatory.role).toBe('PLANT_MANAGER');
      expect(data.authorizedSignatory.signatureRef).toBe('SIG-STAMP-VANCE-2026');
      expect(data.gatePass.gatePassNumber).toBe('GP-202609-0702');

      // Audit event DISPATCH_OC_AUTHORIZED must be emitted
      expect(auditService.record).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          action: 'DISPATCH_OC_AUTHORIZED',
          entityType: 'DispatchConsignment',
          entityId: consignment.id
        })
      );
    });

    it('should validate and attach authorized signatory with ADMIN role', async () => {
      const consignment = createMockConsignment();
      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(consignment);
      jest.spyOn(dispatchRepository, 'generateNextGatePassNumber').mockResolvedValue('GP-202609-0703');

      const res = await request(app)
        .post(`/api/v1/dispatches/${consignment.id}/authorize`)
        .set('Authorization', `Bearer ${generateToken('usr_admin_01', ['ADMIN'])}`)
        .send({
          authorizedSignatoryId: 'usr_admin_01',
          signatureRef: 'DIGI-SIGN-CHEN-ADMIN'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.authorizedSignatory.userId).toBe('usr_admin_01');
      expect(res.body.data.authorizedSignatory.role).toBe('ADMIN');
    });

    it('should strictly reject arbitrary non-existent user as authorized signatory', async () => {
      const consignment = createMockConsignment();
      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(consignment);

      const res = await request(app)
        .post(`/api/v1/dispatches/${consignment.id}/authorize`)
        .set('Authorization', `Bearer ${plantManagerToken}`)
        .send({
          authorizedSignatoryId: 'usr_arbitrary_ghost_007',
          signatureRef: 'SIG-FAKE'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Arbitrary users cannot be represented as authorized signatories/i);
    });

    it('should strictly reject inactive or suspended user as authorized signatory', async () => {
      const consignment = createMockConsignment();
      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(consignment);

      const res = await request(app)
        .post(`/api/v1/dispatches/${consignment.id}/authorize`)
        .set('Authorization', `Bearer ${plantManagerToken}`)
        .send({
          authorizedSignatoryId: 'usr_suspended_01'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/does not exist or is inactive/i);
    });

    it('should strictly reject user lacking authorization in the ERP permission system (unauthorized signatory)', async () => {
      const consignment = createMockConsignment();
      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(consignment);

      // Attempt to authorize using an operator who does not hold dispatch approval permissions
      const res = await request(app)
        .post(`/api/v1/dispatches/${consignment.id}/authorize`)
        .set('Authorization', `Bearer ${plantManagerToken}`)
        .send({
          authorizedSignatoryId: 'usr_operator_01',
          signatureRef: 'SIG-OPERATOR'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/is not authorized to sign off dispatch documents according to the ERP permission system/i);
    });

    it('should reject direct API manipulation attempting to bypass authorization check via client claims', async () => {
      const consignment = createMockConsignment();
      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(consignment);

      // Client attempts to send forged isAuthorized or arbitrary signatory payload
      const res = await request(app)
        .post(`/api/v1/dispatches/${consignment.id}/authorize`)
        .set('Authorization', `Bearer ${plantManagerToken}`)
        .send({
          authorizedSignatoryId: 'usr_operator_01',
          isAuthorized: true,
          roles: ['SUPER_ADMIN_CLAIM'],
          signatureRef: 'HACKED-SIGNATURE'
        });

      // Backend must strictly ignore client claims and evaluate real DB permissions
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not authorized to sign off dispatch documents/i);
    });
  });

  describe('3. Finalization & Missing Authorization Gate', () => {
    it('should strictly block physical dispatch if Outward Challan lacks authorized signatory', async () => {
      // Consignment in QUALITY_VERIFIED without authorizedSignatory
      const unauthorizedConsignment = createMockConsignment({
        status: 'QUALITY_VERIFIED',
        authorizedSignatory: undefined,
        approvals: undefined
      });
      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(unauthorizedConsignment);

      const res = await request(app)
        .post(`/api/v1/dispatches/${unauthorizedConsignment.id}/depart`)
        .set('Authorization', `Bearer ${plantManagerToken}`)
        .send({
          transporter: 'Apex Transport',
          vehicleNumber: 'MH-12-AB-9901',
          dispatchDate: new Date().toISOString()
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Missing required authorization: Outward Challan requires an authorized signatory/i);
    });

    it('should permit physical dispatch once Outward Challan has been authoritatively authorized', async () => {
      const authorizedConsignment = createMockConsignment({
        status: 'APPROVED',
        authorizedSignatory: {
          userId: 'usr_manager_01',
          name: 'Marcus Vance',
          username: 'mgr_marcus',
          email: 'usr_manager_01@celestium-dispatch.internal',
          role: 'PLANT_MANAGER',
          designation: 'Plant Operations Manager',
          authorizedAt: new Date()
        },
        preparedBy: {
          userId: 'usr_officer_01',
          name: 'Elena Rostova',
          username: 'officer_elena',
          email: 'usr_officer_01@celestium-dispatch.internal',
          role: 'DISPATCH_OFFICER',
          preparedAt: new Date()
        }
      });
      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(authorizedConsignment);

      const res = await request(app)
        .post(`/api/v1/dispatches/${authorizedConsignment.id}/depart`)
        .set('Authorization', `Bearer ${plantManagerToken}`)
        .send({
          transporter: 'Apex Transport Express',
          vehicleNumber: 'KA-04-TR-8812',
          dispatchDate: new Date().toISOString()
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('DISPATCHED');
      expect(res.body.data.authorizedSignatory).toBeDefined();
      expect(res.body.data.authorizedSignatory.userId).toBe('usr_manager_01');
    });
  });

  describe('4. Customer Acknowledgement & Proof of Delivery (POD)', () => {
    it('should record optional customer acknowledgement fields and transition status to DELIVERED', async () => {
      const dispatchedConsignment = createMockConsignment({
        status: 'DISPATCHED',
        authorizedSignatory: {
          userId: 'usr_manager_01',
          name: 'Marcus Vance',
          username: 'mgr_marcus',
          email: 'usr_manager_01@celestium-dispatch.internal',
          role: 'PLANT_MANAGER',
          authorizedAt: new Date()
        }
      });
      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(dispatchedConsignment);

      const ackDate = new Date('2026-09-16T14:30:00.000Z');
      const res = await request(app)
        .post(`/api/v1/dispatches/${dispatchedConsignment.id}/acknowledge`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .send({
          receivedBy: 'James Sterling (Receiving Dock Manager)',
          signatureStampRef: 'STAMP-AERO-2026-RECV-09',
          date: ackDate.toISOString(),
          remarks: 'Received 300 heat-treated parts. Clean inspection and test report verified.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const updated = res.body.data;
      expect(updated.status).toBe('DELIVERED');
      expect(updated.customerAcknowledgement).toBeDefined();
      expect(updated.customerAcknowledgement.receivedBy).toBe('James Sterling (Receiving Dock Manager)');
      expect(updated.customerAcknowledgement.signatureStampRef).toBe('STAMP-AERO-2026-RECV-09');
      expect(updated.customerAcknowledgement.remarks).toBe(
        'Received 300 heat-treated parts. Clean inspection and test report verified.'
      );

      // Audit event DISPATCH_CUSTOMER_ACKNOWLEDGED recorded
      expect(auditService.record).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          action: 'DISPATCH_CUSTOMER_ACKNOWLEDGED',
          entityType: 'DispatchConsignment',
          entityId: dispatchedConsignment.id,
          metadata: expect.objectContaining({
            receivedBy: 'James Sterling (Receiving Dock Manager)',
            signatureStampRef: 'STAMP-AERO-2026-RECV-09'
          })
        })
      );
    });

    it('should accept customer acknowledgement with all optional fields omitted', async () => {
      const dispatchedConsignment = createMockConsignment({
        status: 'DISPATCHED'
      });
      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(dispatchedConsignment);

      const res = await request(app)
        .post(`/api/v1/dispatches/${dispatchedConsignment.id}/acknowledge`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('DELIVERED');
      expect(res.body.data.customerAcknowledgement).toBeDefined();
    });

    it('should also be accessible via the legacy alias route /api/v1/dispatches/:id/deliver', async () => {
      const dispatchedConsignment = createMockConsignment({
        status: 'DISPATCHED'
      });
      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(dispatchedConsignment);

      const res = await request(app)
        .post(`/api/v1/dispatches/${dispatchedConsignment.id}/deliver`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .send({
          receivedBy: 'Rajesh Kumar',
          signatureStampRef: 'SIG-STAMP-DELIVER-01',
          remarks: 'Delivered via legacy endpoint integration'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('DELIVERED');
      expect(res.body.data.customerAcknowledgement.receivedBy).toBe('Rajesh Kumar');
      expect(res.body.data.customerAcknowledgement.signatureStampRef).toBe('SIG-STAMP-DELIVER-01');
    });

    it('should reject customer acknowledgement on non-dispatched consignment', async () => {
      const draftConsignment = createMockConsignment({
        status: 'QUALITY_VERIFIED'
      });
      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(draftConsignment);

      const res = await request(app)
        .post(`/api/v1/dispatches/${draftConsignment.id}/acknowledge`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .send({
          receivedBy: 'Premature Recipient'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Cannot record customer acknowledgement for dispatch in status/i);
    });
  });
});
