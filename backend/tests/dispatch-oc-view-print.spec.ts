import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { dispatchRepository } from '../src/modules/dispatch/dispatch.repository.js';
import { userRepository } from '../src/modules/auth/user.repository.js';
import { rbacService } from '../src/modules/rbac/rbac.service.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { PERMISSIONS } from '../src/modules/rbac/rbac.constants.js';

describe('Dispatch Phase — Prompt 8: OC Viewing, Printing and Dispatch Documentation', () => {
  const app = createApp();
  const testTenant = 'tenant_oc_view_print_001';

  const generateToken = (userId: string, roleCodes: string[], perms: string[] = []) => {
    return jwt.sign(
      {
        userId,
        email: `${userId}@celestium-dispatch.internal`,
        tenantId: testTenant,
        roles: roleCodes,
        permissions: perms
      },
      config.auth.jwtSecret
    );
  };

  const dispatchOfficerToken = generateToken('usr_officer_01', ['DISPATCH_OFFICER'], [
    PERMISSIONS.DISPATCH_DELIVERY_VIEW,
    PERMISSIONS.DISPATCH_CHALLAN_PRINT,
    PERMISSIONS.DISPATCH_DELIVERY_DISPATCH,
    PERMISSIONS.DISPATCH_PASS_GENERATE
  ]);

  const plantManagerToken = generateToken('usr_manager_01', ['PLANT_MANAGER'], [
    PERMISSIONS.DISPATCH_DELIVERY_VIEW,
    PERMISSIONS.DISPATCH_CHALLAN_PRINT,
    PERMISSIONS.DISPATCH_DELIVERY_DISPATCH,
    PERMISSIONS.DISPATCH_PASS_GENERATE
  ]);

  const viewOnlyToken = generateToken('usr_view_only_01', ['VIEW_ONLY_OPERATOR'], [
    PERMISSIONS.DISPATCH_DELIVERY_VIEW
  ]);

  const unprivilegedToken = generateToken('usr_unprivileged_01', ['OPERATOR'], [
    'production:floor:operate'
  ]);

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
    usr_view_only_01: {
      id: 'usr_view_only_01',
      _id: 'usr_view_only_01',
      tenantId: testTenant,
      username: 'viewer_anna',
      firstName: 'Anna',
      lastName: 'Kareva',
      email: 'usr_view_only_01@celestium-dispatch.internal',
      roles: ['VIEW_ONLY_OPERATOR'],
      status: 'active',
      isDeleted: false
    },
    usr_unprivileged_01: {
      id: 'usr_unprivileged_01',
      _id: 'usr_unprivileged_01',
      tenantId: testTenant,
      username: 'unprivileged_john',
      firstName: 'John',
      lastName: 'Doe',
      email: 'usr_unprivileged_01@celestium-dispatch.internal',
      roles: ['OPERATOR'],
      status: 'active',
      isDeleted: false
    }
  };

  const createMockConsignment = (overrides: Record<string, any> = {}) => {
    const consignment: any = {
      id: '507f191e810c19729de860c1',
      _id: '507f191e810c19729de860c1',
      tenantId: testTenant,
      dispatchNumber: 'DISP-202609-0801',
      deliveryChallanNumber: 'DC-202609-0801',
      outwardChallanNumber: 'OC-202609-0801',
      ocDate: new Date('2026-09-05T08:00:00.000Z'),
      batchOrderId: 'bo_test_0801',
      batchOrderNumber: 'BO-202609-0801',
      grnId: 'grn_test_0801',
      grnNumber: 'GRN-202609-0801',
      poId: 'po_test_0801',
      poNumber: 'PO-202609-0801',
      hierarchy: {
        poId: 'po_test_0801',
        poNumber: 'PO-202609-0801',
        grnId: 'grn_test_0801',
        grnNumber: 'GRN-202609-0801',
        batchOrderId: 'bo_test_0801',
        batchOrderNumber: 'BO-202609-0801',
        outwardChallanNumber: 'OC-202609-0801',
        ocDate: new Date('2026-09-05T08:00:00.000Z'),
        customerName: 'AeroDrive Transmission Systems Inc.',
        address: '700 Aerospace Park Blvd, Greenville, SC',
        gstin: '36AAACB1234F1Z0',
        contactEmail: 'logistics@aerodrive.com'
      },
      deliveryInformation: {
        customerName: 'AeroDrive Transmission Systems Inc.',
        address: '700 Aerospace Park Blvd, Greenville, SC',
        gstin: '36AAACB1234F1Z0',
        contactEmail: 'logistics@aerodrive.com'
      },
      items: [
        {
          serialNumber: 1,
          partName: 'Turbine Rotor Shaft 4340',
          partDescription: 'Precision carburized rotor shaft with ground journals',
          partNumber: 'PART-SHAFT-4340',
          materialGrade: 'AISI 4340H',
          heatTreatmentProcess: 'Gas Carburizing & Oil Quench',
          batchLotNumber: 'HL-4340-0801',
          quantity: 250,
          unitOfMeasure: 'PCS'
        }
      ],
      heatTreatmentInformation: {
        furnaceEquipment: 'Continuous Carburizing Furnace Bay #1',
        furnaceCode: 'FURNACE-01',
        hardnessSpecification: '58-62 HRC',
        actualHardness: '60.5 HRC',
        caseDepth: '1.20 mm',
        quantityReceived: 250,
        quantityDelivered: 250
      },
      isOutwardChallan: true,
      status: 'APPROVED',
      customer: {
        customerId: 'cust_aerodrive_01',
        customerCode: 'CUST-AERO-01',
        customerName: 'AeroDrive Transmission Systems Inc.',
        destinationAddress: '700 Aerospace Park Blvd, Greenville, SC',
        gstin: '36AAACB1234F1Z0',
        contactPerson: 'Sarah Jenkins',
        contactPhone: '+1-864-555-0199',
        purchaseOrderNumber: 'PO-202609-0801'
      },
      lines: [
        {
          finishedGoodsId: 'fg_0801',
          jobId: 'bo_test_0801',
          itemCode: 'PART-SHAFT-4340',
          itemName: 'Turbine Rotor Shaft 4340',
          dispatchedQuantity: 250,
          uom: 'PCS',
          heatLotNumber: 'HL-4340-0801',
          qualityVerification: { isQualityApproved: true, cocNumber: 'COC-2026-0801' }
        }
      ],
      totalQuantity: 250,
      totalPackages: 5,
      totalNetWeightKg: 1850,
      totalGrossWeightKg: 1950,
      carrier: {
        carrierName: 'Swift Heavy Haul Logistics',
        transportMode: 'ROAD',
        trackingNumber: 'TRK-SWIFT-0801'
      },
      transporter: 'Swift Heavy Haul Logistics',
      vehicle: {
        vehicleNumber: 'MH-12-QC-8821',
        ewayBillNumber: '221144338899'
      },
      vehicleNumber: 'MH-12-QC-8821',
      dispatchDate: new Date('2026-09-06T09:30:00.000Z'),
      ewayBillNumber: '221144338899',
      driver: {
        driverName: 'Rajesh Sharma',
        driverPhone: '+91 98230 11223'
      },
      timeline: {
        createdAt: new Date('2026-09-05T08:00:00.000Z'),
        qualityVerifiedAt: new Date('2026-09-05T09:00:00.000Z'),
        approvedAt: new Date('2026-09-05T10:00:00.000Z')
      },
      dispatchedBy: {
        userId: 'usr_officer_01',
        name: 'Elena Rostova',
        email: 'usr_officer_01@celestium-dispatch.internal',
        role: 'DISPATCH_OFFICER'
      },
      dispatchedAt: new Date('2026-09-06T09:30:00.000Z'),
      preparedBy: {
        userId: 'usr_officer_01',
        name: 'Elena Rostova',
        username: 'officer_elena',
        email: 'usr_officer_01@celestium-dispatch.internal',
        role: 'DISPATCH_OFFICER',
        designation: 'Dispatch Lead',
        preparedAt: new Date('2026-09-05T08:00:00.000Z')
      },
      authorizedSignatory: {
        userId: 'usr_manager_01',
        name: 'Marcus Vance',
        username: 'mgr_marcus',
        email: 'usr_manager_01@celestium-dispatch.internal',
        role: 'PLANT_MANAGER',
        designation: 'Plant Operations Director',
        signatureRef: 'SIG-AUTH-7712',
        authorizedAt: new Date('2026-09-05T10:00:00.000Z')
      },
      customerAcknowledgement: {
        receivedBy: 'David Miller',
        signatureStampRef: 'STAMP-AERODRIVE-991',
        date: new Date('2026-09-07T14:00:00.000Z'),
        remarks: 'Received 250 pcs in pristine condition with verified inspection reports'
      },
      gatePass: {
        gatePassNumber: 'GP-2026-0801',
        securityOfficerName: 'James Wilson',
        issuedAt: new Date('2026-09-06T09:30:00.000Z')
      },
      history: [
        {
          fromStatus: 'DRAFT',
          toStatus: 'APPROVED',
          timestamp: new Date('2026-09-05T10:00:00.000Z'),
          performedBy: { userId: 'usr_manager_01', role: 'PLANT_MANAGER' },
          reason: 'Authorized signatory signed OC'
        }
      ],
      printCount: 0,
      printedAt: undefined,
      printedBy: undefined,
      isDeleted: false,
      createdAt: new Date('2026-09-05T08:00:00.000Z'),
      updatedAt: new Date('2026-09-05T10:00:00.000Z'),
      save: jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      }),
      toObject: function () {
        return { ...this };
      },
      ...overrides
    };
    return consignment;
  };

  let mockConsignment: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConsignment = createMockConsignment();

    // Mock Dispatch Repository finders
    jest.spyOn(dispatchRepository, 'findById').mockImplementation(async (_tenantId, id) => {
      if (
        id === mockConsignment.id ||
        id === mockConsignment._id ||
        id === mockConsignment.outwardChallanNumber ||
        id === mockConsignment.dispatchNumber
      ) {
        return mockConsignment;
      }
      return null;
    });

    jest.spyOn(dispatchRepository, 'findByOutwardChallanNumber').mockImplementation(async (_tenantId, num) => {
      if (num.toUpperCase() === mockConsignment.outwardChallanNumber.toUpperCase()) {
        return mockConsignment;
      }
      return null;
    });

    jest.spyOn(dispatchRepository, 'findByDispatchNumber').mockImplementation(async (_tenantId, num) => {
      if (num.toUpperCase() === mockConsignment.dispatchNumber.toUpperCase()) {
        return mockConsignment;
      }
      return null;
    });

    // Mock User Repository
    jest.spyOn(userRepository, 'findById').mockImplementation(async (_tenantId, id) => {
      return mockUsers[id] || null;
    });
    jest.spyOn(userRepository, 'findByIdentifier').mockImplementation(async (_tenantId, ident) => {
      return (
        Object.values(mockUsers).find(
          (u) => u.id === ident || u.username === ident || u.email === ident
        ) || null
      );
    });

    // Mock RBAC Service
    jest.spyOn(rbacService, 'getUserEffectivePermissions').mockImplementation(async (_tenantId, userId) => {
      const user = mockUsers[userId];
      if (!user) {
        return { tenantId: testTenant, userId, roles: [], permissions: [], isSuperAdmin: false };
      }
      if (user.roles.includes('ADMIN')) {
        return {
          tenantId: testTenant,
          userId,
          roles: ['ADMIN'],
          permissions: Object.values(PERMISSIONS),
          isSuperAdmin: true
        };
      }
      if (user.roles.includes('PLANT_MANAGER')) {
        return {
          tenantId: testTenant,
          userId,
          roles: ['PLANT_MANAGER'],
          permissions: [
            PERMISSIONS.DISPATCH_DELIVERY_VIEW,
            PERMISSIONS.DISPATCH_CHALLAN_PRINT,
            PERMISSIONS.DISPATCH_DELIVERY_DISPATCH,
            PERMISSIONS.DISPATCH_PASS_GENERATE
          ],
          isSuperAdmin: false
        };
      }
      if (user.roles.includes('DISPATCH_OFFICER')) {
        return {
          tenantId: testTenant,
          userId,
          roles: ['DISPATCH_OFFICER'],
          permissions: [
            PERMISSIONS.DISPATCH_DELIVERY_VIEW,
            PERMISSIONS.DISPATCH_CHALLAN_PRINT,
            PERMISSIONS.DISPATCH_DELIVERY_DISPATCH,
            PERMISSIONS.DISPATCH_PASS_GENERATE
          ],
          isSuperAdmin: false
        };
      }
      if (user.roles.includes('VIEW_ONLY_OPERATOR')) {
        return {
          tenantId: testTenant,
          userId,
          roles: ['VIEW_ONLY_OPERATOR'],
          permissions: [PERMISSIONS.DISPATCH_DELIVERY_VIEW],
          isSuperAdmin: false
        };
      }
      return {
        tenantId: testTenant,
        userId,
        roles: user.roles,
        permissions: ['production:floor:operate'],
        isSuperAdmin: false
      };
    });

    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);
  });

  describe('1. Server-Side OC Permission Enforcement', () => {
    it('rejects unauthenticated requests to view Outward Challan with 401 Unauthorized', async () => {
      const res = await request(app).get(`/api/v1/dispatches/outward-challan/${mockConsignment.id}`);
      expect(res.status).toBe(401);
    });

    it('rejects unprivileged user lacking DISPATCH_DELIVERY_VIEW with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/dispatches/outward-challan/${mockConsignment.id}`)
        .set('Authorization', `Bearer ${unprivilegedToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/permission|access denied/i);
    });

    it('rejects unprivileged user attempting to print Outward Challan with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/dispatches/outward-challan/${mockConsignment.id}/print`)
        .set('Authorization', `Bearer ${unprivilegedToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/permission|access denied/i);
    });

    it('rejects view-only operator attempting to print without DISPATCH_CHALLAN_PRINT with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/dispatches/outward-challan/${mockConsignment.id}/print`)
        .set('Authorization', `Bearer ${viewOnlyToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/permission|access denied/i);
    });

    it('allows authorized DISPATCH_OFFICER with DISPATCH_DELIVERY_VIEW to view Outward Challan', async () => {
      const res = await request(app)
        .get(`/api/v1/dispatches/outward-challan/${mockConsignment.id}`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.outwardChallanNumber).toBe('OC-202609-0801');
    });

    it('allows authorized DISPATCH_OFFICER with DISPATCH_CHALLAN_PRINT to print Outward Challan', async () => {
      const res = await request(app)
        .get(`/api/v1/dispatches/outward-challan/${mockConsignment.id}/print`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.htmlReport).toBeDefined();
    });
  });

  describe('2. Authoritative OC Record View (Single Source of Truth & Lineage)', () => {
    it('returns complete authoritative OC record displaying all required sections', async () => {
      const res = await request(app)
        .get(`/api/v1/dispatches/outward-challan/${mockConsignment.id}`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`);

      expect(res.status).toBe(200);
      const oc = res.body.data;

      // 1. OC identity & status
      expect(oc.outwardChallanNumber).toBe('OC-202609-0801');
      expect(oc.dispatchNumber).toBe('DISP-202609-0801');
      expect(oc.status).toBe('APPROVED');
      expect(oc.isOutwardChallan).toBe(true);

      // 2. Unbroken Genealogy Hierarchy: PO -> GRN -> BO -> OC
      expect(oc.hierarchy).toBeDefined();
      expect(oc.hierarchy.poNumber).toBe('PO-202609-0801');
      expect(oc.hierarchy.grnNumber).toBe('GRN-202609-0801');
      expect(oc.hierarchy.batchOrderNumber).toBe('BO-202609-0801');
      expect(oc.hierarchy.outwardChallanNumber).toBe('OC-202609-0801');

      // 3. Customer & Delivery destination
      expect(oc.customer.customerName).toBe('AeroDrive Transmission Systems Inc.');
      expect(oc.customer.customerCode).toBe('CUST-AERO-01');
      expect(oc.deliveryInformation.address).toBe('700 Aerospace Park Blvd, Greenville, SC');
      expect(oc.deliveryInformation.gstin).toBe('36AAACB1234F1Z0');

      // 4. Actual Transport information
      expect(oc.transporter).toBe('Swift Heavy Haul Logistics');
      expect(oc.vehicleNumber).toBe('MH-12-QC-8821');
      expect(oc.ewayBillNumber).toBe('221144338899');
      expect(oc.carrier.transportMode).toBe('ROAD');

      // 5. Authoritative BO-derived items (all 8 fields)
      expect(oc.items).toHaveLength(1);
      const item = oc.items[0];
      expect(item.serialNumber).toBe(1);
      expect(item.partName).toBe('Turbine Rotor Shaft 4340');
      expect(item.partNumber).toBe('PART-SHAFT-4340');
      expect(item.materialGrade).toBe('AISI 4340H');
      expect(item.heatTreatmentProcess).toBe('Gas Carburizing & Oil Quench');
      expect(item.batchLotNumber).toBe('HL-4340-0801');
      expect(item.quantity).toBe(250);
      expect(item.unitOfMeasure).toBe('PCS');

      // 6. Metallurgical & Heat-treatment parameters (all 6 parameters)
      expect(oc.heatTreatmentInformation).toBeDefined();
      expect(oc.heatTreatmentInformation.furnaceEquipment).toBe('Continuous Carburizing Furnace Bay #1');
      expect(oc.heatTreatmentInformation.hardnessSpecification).toBe('58-62 HRC');
      expect(oc.heatTreatmentInformation.actualHardness).toBe('60.5 HRC');
      expect(oc.heatTreatmentInformation.caseDepth).toBe('1.20 mm');
      expect(oc.heatTreatmentInformation.quantityReceived).toBe(250);
      expect(oc.heatTreatmentInformation.quantityDelivered).toBe(250);

      // 7. Authorization attribution
      expect(oc.preparedBy).toBeDefined();
      expect(oc.preparedBy.userId).toBe('usr_officer_01');
      expect(oc.preparedBy.name).toBe('Elena Rostova');
      expect(oc.preparedBy.designation).toBe('Dispatch Lead');

      expect(oc.authorizedSignatory).toBeDefined();
      expect(oc.authorizedSignatory.userId).toBe('usr_manager_01');
      expect(oc.authorizedSignatory.name).toBe('Marcus Vance');
      expect(oc.authorizedSignatory.designation).toBe('Plant Operations Director');
      expect(oc.authorizedSignatory.signatureRef).toBe('SIG-AUTH-7712');

      // 8. Customer Acknowledgement
      expect(oc.customerAcknowledgement).toBeDefined();
      expect(oc.customerAcknowledgement.receivedBy).toBe('David Miller');
      expect(oc.customerAcknowledgement.signatureStampRef).toBe('STAMP-AERODRIVE-991');
    });

    it('supports looking up OC by human-readable outwardChallanNumber directly', async () => {
      const res = await request(app)
        .get(`/api/v1/dispatches/outward-challan/OC-202609-0801`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.outwardChallanNumber).toBe('OC-202609-0801');
      expect(res.body.data.hierarchy.batchOrderNumber).toBe('BO-202609-0801');
    });

    it('supports looking up OC via alias /api/v1/dispatches/:id/outward-challan', async () => {
      const res = await request(app)
        .get(`/api/v1/dispatches/${mockConsignment.id}/outward-challan`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.outwardChallanNumber).toBe('OC-202609-0801');
    });

    it('returns 404 Not Found for non-existent or invalid OC identifier without data leakage', async () => {
      const res = await request(app)
        .get(`/api/v1/dispatches/outward-challan/OC-NONEXISTENT-9999`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('gracefully handles incomplete OC with missing optional customer acknowledgement', async () => {
      const incompleteConsignment = createMockConsignment({
        customerAcknowledgement: undefined,
        authorizedSignatory: undefined
      });
      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(incompleteConsignment as any);

      const res = await request(app)
        .get(`/api/v1/dispatches/outward-challan/${incompleteConsignment.id}`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.customerAcknowledgement).toBeUndefined();
      expect(res.body.data.authorizedSignatory).toBeUndefined();
    });
  });

  describe('3. Reliable Printing, Document Layout & Audit Trail', () => {
    it('executes formal OC printing, increments printCount, and records DISPATCH_OC_PRINTED audit log', async () => {
      mockConsignment.printCount = 0;

      const res = await request(app)
        .get(`/api/v1/dispatches/outward-challan/${mockConsignment.id}/print`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockConsignment.printCount).toBe(1);
      expect(mockConsignment.printedAt).toBeDefined();
      expect(mockConsignment.printedBy).toBe('usr_officer_01');

      // Audit Service check
      expect(auditService.record).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          actorId: 'usr_officer_01',
          action: 'DISPATCH_OC_PRINTED',
          entityType: 'DispatchConsignment',
          metadata: expect.objectContaining({
            outwardChallanNumber: 'OC-202609-0801',
            printCount: 1
          })
        })
      );
    });

    it('supports POST /outward-challan/:id/print to record print action idempotently', async () => {
      mockConsignment.printCount = 1;

      const res = await request(app)
        .post(`/api/v1/dispatches/outward-challan/${mockConsignment.id}/print`)
        .set('Authorization', `Bearer ${plantManagerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockConsignment.printCount).toBe(2);
      expect(mockConsignment.printedBy).toBe('usr_manager_01');
    });

    it('renders full Nadcap-certified HTML document matching authoritative OC record', async () => {
      const res = await request(app)
        .get(`/api/v1/dispatches/outward-challan/${mockConsignment.id}/print`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`);

      expect(res.status).toBe(200);
      const html = res.body.data.htmlReport;

      // Letterhead & Nadcap accreditation
      expect(html).toContain('ASTRALIS MANUFACTURING ERP');
      expect(html).toContain('Nadcap / AS9100D Certified');
      expect(html).toContain('Authoritative Outward Challan');

      // Unbroken genealogy banner
      expect(html).toContain('PRODUCTION GENEALOGY HIERARCHY');
      expect(html).toContain('PO: PO-202609-0801 ➔ GRN: GRN-202609-0801 ➔ BO: BO-202609-0801 ➔ OC: OC-202609-0801');
      expect(html).toContain('UNBROKEN TRACEABILITY CERTIFIED');

      // BO Items & Metallurgical Parameters
      expect(html).toContain('Turbine Rotor Shaft 4340');
      expect(html).toContain('PART-SHAFT-4340');
      expect(html).toContain('AISI 4340H');
      expect(html).toContain('Gas Carburizing & Oil Quench');
      expect(html).toContain('Continuous Carburizing Furnace Bay #1');
      expect(html).toContain('58-62 HRC');
      expect(html).toContain('60.5 HRC');
      expect(html).toContain('1.20 mm');

      // Two-tier authorizations
      expect(html).toContain('Elena Rostova');
      expect(html).toContain('usr_officer_01');
      expect(html).toContain('Marcus Vance');
      expect(html).toContain('usr_manager_01');
      expect(html).toContain('SIG-AUTH-7712');
      expect(html).toContain('RBAC COMPLIANT PLANT AUTHORITY');

      // Watermark & CSS @media print
      expect(html).toContain('Printed via Astralis ERP System');
      expect(html).toContain('@media print');
    });

    it('returns direct HTML content when Accept: text/html is requested', async () => {
      const res = await request(app)
        .get(`/api/v1/dispatches/outward-challan/${mockConsignment.id}/print`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .set('Accept', 'text/html');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('<!DOCTYPE html>');
      expect(res.text).toContain('OUTWARD CHALLAN — OC-202609-0801');
    });
  });

  describe('4. Historical Dispatched OC Viewing and Traceability', () => {
    it('allows viewing and printing historical DISPATCHED and DELIVERED OCs without modifying downstream states', async () => {
      const historicalConsignment = createMockConsignment({
        id: '507f191e810c19729de860c2',
        outwardChallanNumber: 'OC-202608-0550',
        status: 'DISPATCHED',
        printCount: 4
      });
      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(historicalConsignment as any);

      // 1. View Historical OC
      const viewRes = await request(app)
        .get(`/api/v1/dispatches/outward-challan/${historicalConsignment.id}`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`);

      expect(viewRes.status).toBe(200);
      expect(viewRes.body.data.status).toBe('DISPATCHED');
      expect(viewRes.body.data.outwardChallanNumber).toBe('OC-202608-0550');

      // 2. Print Historical OC
      const printRes = await request(app)
        .post(`/api/v1/dispatches/outward-challan/${historicalConsignment.id}/print`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`);

      expect(printRes.status).toBe(200);
      expect(historicalConsignment.printCount).toBe(5);
      // Status must remain DISPATCHED (not altered or regressed)
      expect(historicalConsignment.status).toBe('DISPATCHED');
    });

    it('guarantees viewing and printing operations are read-only and never alter items, recipe, or quantities', async () => {
      const initialItems = JSON.stringify(mockConsignment.items);
      const initialHeatTreatment = JSON.stringify(mockConsignment.heatTreatmentInformation);
      const initialTotalQty = mockConsignment.totalQuantity;

      await request(app)
        .get(`/api/v1/dispatches/outward-challan/${mockConsignment.id}`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`);

      await request(app)
        .get(`/api/v1/dispatches/outward-challan/${mockConsignment.id}/print`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`);

      expect(JSON.stringify(mockConsignment.items)).toBe(initialItems);
      expect(JSON.stringify(mockConsignment.heatTreatmentInformation)).toBe(initialHeatTreatment);
      expect(mockConsignment.totalQuantity).toBe(initialTotalQty);
    });
  });

  describe('5. Read-Only Protection & Direct API Manipulation Prevention', () => {
    it('rejects direct API modification (PUT/PATCH) of finalized dispatched Outward Challans with 400 Bad Request', async () => {
      const dispatchedConsignment = createMockConsignment({
        status: 'DISPATCHED'
      });
      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(dispatchedConsignment as any);

      const res = await request(app)
        .put(`/api/v1/dispatches/outward-challan/${dispatchedConsignment.id}`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .send({
          items: [{ partName: 'Tampered Part', quantity: 9999 }]
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/immutable document protection|finalized/i);
    });

    it('rejects direct API deletion (DELETE) of dispatched Outward Challans with 400 Bad Request', async () => {
      const dispatchedConsignment = createMockConsignment({
        status: 'DISPATCHED'
      });
      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(dispatchedConsignment as any);

      const res = await request(app)
        .delete(`/api/v1/dispatches/outward-challan/${dispatchedConsignment.id}`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/cannot delete outward challan|historical records/i);
    });

    it('rejects cancellation of dispatched Outward Challans with 400 Bad Request', async () => {
      const dispatchedConsignment = createMockConsignment({
        status: 'DISPATCHED'
      });
      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(dispatchedConsignment as any);

      const res = await request(app)
        .post(`/api/v1/dispatches/${dispatchedConsignment.id}/cancel`)
        .set('Authorization', `Bearer ${dispatchOfficerToken}`)
        .send({
          cancellationReason: 'Attempting to cancel already departed consignment'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/cannot cancel dispatch.*physical departure/i);
    });
  });
});
