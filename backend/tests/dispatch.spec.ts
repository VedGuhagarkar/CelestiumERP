import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { customerRepository } from '../src/modules/customer/customer.repository.js';
import { finishedGoodsRepository } from '../src/modules/finished-goods/finished-goods.repository.js';
import { qualityInspectionRepository } from '../src/modules/quality-inspection/quality-inspection.repository.js';
import { qualityDocumentationRepository } from '../src/modules/quality-documentation/quality-documentation.repository.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { dispatchRepository } from '../src/modules/dispatch/dispatch.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';

describe('Finished-Goods Dispatch & Consignment Domain', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_001';
  const otherTenant = 'tenant_heat_treat_002';

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const createMockCustomer = (overrides: any = {}) => {
    return {
      id: 'cust_aero_001',
      customerCode: 'CUST-AERO-001',
      customerName: 'Aero Dynamics Corp',
      status: 'ACTIVE',
      contactInfo: {
        address: '100 Aerospace Blvd, Seattle, WA',
        primaryContactName: 'John Davis',
        phone: '+1-206-555-0199'
      },
      isDeleted: false,
      ...overrides
    };
  };

  const createMockFinishedGoods = (overrides: any = {}) => {
    const doc: any = {
      id: 'fg_lot_001',
      tenantId: testTenant,
      fgLotNumber: 'FG-202608-0001',
      jobCardId: 'job_4140_01',
      jobCardNumber: 'JOB-202608-0010',
      heatLotNumber: 'HL-4140-202608-01',
      customerCode: 'CUST-AERO-001',
      itemId: 'item_4140',
      itemCode: 'MAT-4140-BAR',
      description: 'AISI 4140 Quenched & Tempered Shafts',
      totalQuantity: 100,
      availableQuantity: 100,
      reservedQuantity: 0,
      dispatchedQuantity: 0,
      uom: 'PCS',
      location: 'FG_RACK_A1',
      status: 'RELEASED_FOR_DISPATCH',
      qualityRelease: {
        isReleased: true,
        releasedAt: new Date(),
        releasedByActorId: 'usr_qc_lead',
        cocNumber: 'COC-202608-0001',
        inspectionReportId: 'insp_4140_01',
        releaseNotes: 'Conforms to AMS 2759 spec'
      },
      movementHistory: [],
      isDeleted: false,
      save: jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      }),
      toJSON: function () {
        return { ...this };
      },
      ...overrides
    };
    return doc;
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
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/v1/dispatches (Creation & Reservation)', () => {
    it('should create a dispatch in DRAFT status and reserve finished goods stock', async () => {
      const token = generateToken('usr_logistics', ['PLANT_MANAGER']);
      const mockCustomer = createMockCustomer();
      const mockFg = createMockFinishedGoods();

      jest.spyOn(customerRepository, 'findById').mockResolvedValue(mockCustomer as any);
      jest.spyOn(finishedGoodsRepository, 'findById').mockResolvedValue(mockFg as any);
      jest.spyOn(dispatchRepository, 'generateNextDispatchNumber').mockResolvedValue('DSP-202608-0001');
      jest.spyOn(dispatchRepository, 'generateNextDeliveryChallanNumber').mockResolvedValue('DC-202608-0001');
      jest.spyOn(dispatchRepository, 'create').mockImplementation(async (_tenantId, data) => {
        return {
          id: 'dsp_001',
          ...data,
          save: jest.fn().mockResolvedValue(this),
          toJSON: function () {
            return { ...this };
          }
        } as any;
      });

      const res = await request(app)
        .post('/api/v1/dispatches')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customerId: 'cust_aero_001',
          purchaseOrderNumber: 'PO-AERO-99881',
          destinationAddress: '100 Aerospace Blvd, Seattle, WA',
          carrierName: 'FastTrack Logistics',
          transportMode: 'ROAD',
          lines: [
            {
              finishedGoodsId: 'fg_lot_001',
              dispatchedQuantity: 50,
              packageDetails: {
                packagingType: 'WOODEN_CRATE',
                packageCount: 2,
                grossWeightKg: 520,
                netWeightKg: 500
              }
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.data.dispatchNumber).toBe('DSP-202608-0001');
      expect(res.body.data.deliveryChallanNumber).toBe('DC-202608-0001');
      expect(res.body.data.status).toBe('DRAFT');
      expect(res.body.data.totalQuantity).toBe(50);
      expect(res.body.data.lines[0].dispatchedQuantity).toBe(50);
      expect(mockFg.availableQuantity).toBe(50);
      expect(mockFg.reservedQuantity).toBe(50);
    });

    it('should reject dispatch creation when finished goods lot is QUARANTINED', async () => {
      const token = generateToken('usr_logistics', ['PLANT_MANAGER']);
      const mockCustomer = createMockCustomer();
      const mockFg = createMockFinishedGoods({ status: 'QUARANTINED', availableQuantity: 0 });

      jest.spyOn(customerRepository, 'findById').mockResolvedValue(mockCustomer as any);
      jest.spyOn(finishedGoodsRepository, 'findById').mockResolvedValue(mockFg as any);

      const res = await request(app)
        .post('/api/v1/dispatches')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customerId: 'cust_aero_001',
          lines: [
            {
              finishedGoodsId: 'fg_lot_001',
              dispatchedQuantity: 20
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('QUARANTINED');
    });

    it('should reject dispatch creation when requested quantity exceeds available stock', async () => {
      const token = generateToken('usr_logistics', ['PLANT_MANAGER']);
      const mockCustomer = createMockCustomer();
      const mockFg = createMockFinishedGoods({ availableQuantity: 10 });

      jest.spyOn(customerRepository, 'findById').mockResolvedValue(mockCustomer as any);
      jest.spyOn(finishedGoodsRepository, 'findById').mockResolvedValue(mockFg as any);

      const res = await request(app)
        .post('/api/v1/dispatches')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customerId: 'cust_aero_001',
          lines: [
            {
              finishedGoodsId: 'fg_lot_001',
              dispatchedQuantity: 50
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Insufficient available quantity');
    });
  });

  describe('POST /api/v1/dispatches/:id/verify-quality (Quality Verification)', () => {
    it('should verify quality approval and CoC compliance for all items', async () => {
      const token = generateToken('usr_qc_lead', ['METALLURGIST']);
      const mockFg = createMockFinishedGoods();
      const mockInspection = {
        id: 'insp_4140_01',
        inspectionNumber: 'INSP-202608-0001',
        status: 'APPROVED',
        disposition: 'CONFORMING'
      };
      const mockCoc = {
        id: 'doc_coc_001',
        documentNumber: 'COC-202608-0001',
        reportType: 'CERTIFICATE_OF_CONFORMANCE',
        isApproved: true
      };

      const mockConsignment: any = {
        id: 'dsp_001',
        tenantId: testTenant,
        dispatchNumber: 'DSP-202608-0001',
        status: 'DRAFT',
        lines: [
          {
            lineId: 'LINE-001',
            finishedGoodsId: 'fg_lot_001',
            fgLotNumber: 'FG-202608-0001',
            jobId: 'job_4140_01',
            jobNumber: 'JOB-202608-0010',
            dispatchedQuantity: 50,
            uom: 'PCS'
          }
        ],
        timeline: { createdAt: new Date() },
        history: [],
        isDeleted: false,
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
        toJSON: function () {
          return { ...this };
        }
      };

      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(mockConsignment);
      jest.spyOn(finishedGoodsRepository, 'findById').mockResolvedValue(mockFg as any);
      jest.spyOn(qualityInspectionRepository, 'findById').mockResolvedValue(mockInspection as any);
      jest.spyOn(qualityDocumentationRepository, 'findByDocumentNumber').mockResolvedValue(mockCoc as any);

      const res = await request(app)
        .post('/api/v1/dispatches/dsp_001/verify-quality')
        .set('Authorization', `Bearer ${token}`)
        .send({
          verificationNotes: 'All metallurgical and pyrometry records validated.'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('QUALITY_VERIFIED');
      expect(res.body.data.lines[0].qualityVerification.isQualityApproved).toBe(true);
      expect(res.body.data.lines[0].qualityVerification.cocNumber).toBe('COC-202608-0001');
    });

    it('should reject quality verification if finished goods lot is not released by QC', async () => {
      const token = generateToken('usr_qc_lead', ['METALLURGIST']);
      const mockFg = createMockFinishedGoods({
        qualityRelease: { isReleased: false, cocNumber: undefined, inspectionReportId: undefined }
      });
      const mockConsignment: any = {
        id: 'dsp_001',
        tenantId: testTenant,
        dispatchNumber: 'DSP-202608-0001',
        status: 'DRAFT',
        lines: [
          {
            lineId: 'LINE-001',
            finishedGoodsId: 'fg_lot_001',
            fgLotNumber: 'FG-202608-0001',
            jobId: 'job_4140_01',
            jobNumber: 'JOB-202608-0010',
            dispatchedQuantity: 50
          }
        ],
        timeline: { createdAt: new Date() },
        history: [],
        isDeleted: false,
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
        toJSON: function () {
          return { ...this };
        }
      };

      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(mockConsignment);
      jest.spyOn(finishedGoodsRepository, 'findById').mockResolvedValue(mockFg as any);
      jest.spyOn(qualityInspectionRepository, 'findByJobId').mockResolvedValue([]);

      const res = await request(app)
        .post('/api/v1/dispatches/dsp_001/verify-quality')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Quality Verification failed');
    });
  });

  describe('POST /api/v1/dispatches/:id/schedule (Scheduling Transport)', () => {
    it('should schedule dispatch with carrier, vehicle, driver, and departure time', async () => {
      const token = generateToken('usr_logistics', ['PLANT_MANAGER']);
      const mockConsignment: any = {
        id: 'dsp_001',
        tenantId: testTenant,
        dispatchNumber: 'DSP-202608-0001',
        status: 'QUALITY_VERIFIED',
        carrier: { transportMode: 'ROAD' },
        timeline: { createdAt: new Date() },
        history: [],
        isDeleted: false,
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
        toJSON: function () {
          return { ...this };
        }
      };

      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(mockConsignment);

      const res = await request(app)
        .post('/api/v1/dispatches/dsp_001/schedule')
        .set('Authorization', `Bearer ${token}`)
        .send({
          scheduledDepartureTime: '2026-09-02T10:00:00.000Z',
          estimatedArrivalTime: '2026-09-02T18:00:00.000Z',
          carrierName: 'AeroHaul Logistics',
          transportMode: 'ROAD',
          trackingNumber: 'TRK-990011',
          vehicleNumber: 'WA-88-TX-1092',
          vehicleType: 'Tautliner 24T',
          ewayBillNumber: 'EWB-5544332211',
          driverName: 'Robert Lang',
          driverPhone: '+1-206-555-4321',
          driverLicenseNumber: 'DL-WA-992100'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('SCHEDULED');
      expect(res.body.data.carrier.carrierName).toBe('AeroHaul Logistics');
      expect(res.body.data.vehicle.vehicleNumber).toBe('WA-88-TX-1092');
      expect(res.body.data.driver.driverName).toBe('Robert Lang');
    });
  });

  describe('POST /api/v1/dispatches/:id/approve (Approval & Gate Pass)', () => {
    it('should approve scheduled dispatch and generate security gate pass', async () => {
      const token = generateToken('usr_manager', ['PLANT_MANAGER']);
      const mockConsignment: any = {
        id: 'dsp_001',
        tenantId: testTenant,
        dispatchNumber: 'DSP-202608-0001',
        status: 'SCHEDULED',
        lines: [
          {
            lineId: 'LINE-001',
            qualityVerification: { isQualityApproved: true }
          }
        ],
        timeline: { createdAt: new Date() },
        history: [],
        isDeleted: false,
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
        toJSON: function () {
          return { ...this };
        }
      };

      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(mockConsignment);
      jest.spyOn(dispatchRepository, 'generateNextGatePassNumber').mockResolvedValue('GP-202608-0001');

      const res = await request(app)
        .post('/api/v1/dispatches/dsp_001/approve')
        .set('Authorization', `Bearer ${token}`)
        .send({
          approvalNotes: 'Inspection records and customer PO reconciled. Release granted.'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('APPROVED');
      expect(res.body.data.gatePass.gatePassNumber).toBe('GP-202608-0001');
      expect(res.body.data.approvals.approvedBy.userId).toBe('usr_manager');
    });
  });

  describe('POST /api/v1/dispatches/:id/depart (Physical Factory Departure & Stock Deduction)', () => {
    it('should record departure, gate clearance, and permanently deduct stock', async () => {
      const token = generateToken('usr_security', ['PLANT_MANAGER']);
      const mockFg = createMockFinishedGoods({
        totalQuantity: 50,
        availableQuantity: 0,
        reservedQuantity: 50,
        dispatchedQuantity: 0
      });
      const mockConsignment: any = {
        id: 'dsp_001',
        tenantId: testTenant,
        dispatchNumber: 'DSP-202608-0001',
        status: 'APPROVED',
        lines: [
          {
            lineId: 'LINE-001',
            finishedGoodsId: 'fg_lot_001',
            dispatchedQuantity: 50
          }
        ],
        gatePass: { gatePassNumber: 'GP-202608-0001' },
        timeline: { createdAt: new Date() },
        history: [],
        isDeleted: false,
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
        toJSON: function () {
          return { ...this };
        }
      };

      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(mockConsignment);
      jest.spyOn(finishedGoodsRepository, 'findById').mockResolvedValue(mockFg as any);

      const res = await request(app)
        .post('/api/v1/dispatches/dsp_001/depart')
        .set('Authorization', `Bearer ${token}`)
        .send({
          securityOfficerName: 'Officer Bradley',
          sealNumber: 'SEAL-AERO-9988',
          actualDepartureTime: '2026-09-02T10:15:00.000Z'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('DISPATCHED');
      expect(mockFg.reservedQuantity).toBe(0);
      expect(mockFg.dispatchedQuantity).toBe(50);
      expect(mockFg.status).toBe('FULLY_DISPATCHED');
    });

    it('should reject departure if dispatch has not been approved', async () => {
      const token = generateToken('usr_security', ['PLANT_MANAGER']);
      const mockConsignment: any = {
        id: 'dsp_001',
        tenantId: testTenant,
        dispatchNumber: 'DSP-202608-0001',
        status: 'SCHEDULED',
        isDeleted: false
      };

      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(mockConsignment);

      const res = await request(app)
        .post('/api/v1/dispatches/dsp_001/depart')
        .set('Authorization', `Bearer ${token}`)
        .send({
          securityOfficerName: 'Officer Bradley'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Dispatch must be APPROVED first');
    });
  });

  describe('POST /api/v1/dispatches/:id/deliver (Proof of Delivery)', () => {
    it('should record proof of delivery and set status to DELIVERED', async () => {
      const token = generateToken('usr_logistics', ['PLANT_MANAGER']);
      const mockConsignment: any = {
        id: 'dsp_001',
        tenantId: testTenant,
        dispatchNumber: 'DSP-202608-0001',
        status: 'DISPATCHED',
        totalQuantity: 50,
        timeline: { createdAt: new Date() },
        history: [],
        isDeleted: false,
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
        toJSON: function () {
          return { ...this };
        }
      };

      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(mockConsignment);

      const res = await request(app)
        .post('/api/v1/dispatches/dsp_001/deliver')
        .set('Authorization', `Bearer ${token}`)
        .send({
          receiverName: 'David Miller (Dock Receiving)',
          receivedQuantity: 50,
          receivedCondition: 'CONFORMING',
          receiverSignatureRef: 'SIG-DM-9901',
          podDocumentUrl: 'https://docs.factory.com/pod/POD-202608-0001.pdf',
          remarks: 'Received in good condition with original CoC.'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('DELIVERED');
      expect(res.body.data.proofOfDelivery.receiverName).toBe('David Miller (Dock Receiving)');
      expect(res.body.data.proofOfDelivery.receivedCondition).toBe('CONFORMING');
    });
  });

  describe('POST /api/v1/dispatches/:id/cancel (Controlled Cancellation & Stock Release)', () => {
    it('should cancel dispatch and return reserved finished goods back to available stock', async () => {
      const token = generateToken('usr_manager', ['PLANT_MANAGER']);
      const mockFg = createMockFinishedGoods({
        totalQuantity: 100,
        availableQuantity: 50,
        reservedQuantity: 50,
        dispatchedQuantity: 0
      });
      const mockConsignment: any = {
        id: 'dsp_001',
        tenantId: testTenant,
        dispatchNumber: 'DSP-202608-0001',
        status: 'SCHEDULED',
        lines: [
          {
            lineId: 'LINE-001',
            finishedGoodsId: 'fg_lot_001',
            fgLotNumber: 'FG-202608-0001',
            dispatchedQuantity: 50
          }
        ],
        timeline: { createdAt: new Date() },
        history: [],
        isDeleted: false,
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
        toJSON: function () {
          return { ...this };
        }
      };

      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(mockConsignment);
      jest.spyOn(finishedGoodsRepository, 'findById').mockResolvedValue(mockFg as any);

      const res = await request(app)
        .post('/api/v1/dispatches/dsp_001/cancel')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cancellationReason: 'Customer requested reschedule for next week shipment window.'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CANCELLED');
      expect(res.body.data.cancellation.cancellationReason).toContain('Customer requested reschedule');
      expect(mockFg.availableQuantity).toBe(100);
      expect(mockFg.reservedQuantity).toBe(0);
    });

    it('should reject cancellation if dispatch is already DISPATCHED', async () => {
      const token = generateToken('usr_manager', ['PLANT_MANAGER']);
      const mockConsignment: any = {
        id: 'dsp_001',
        tenantId: testTenant,
        dispatchNumber: 'DSP-202608-0001',
        status: 'DISPATCHED',
        isDeleted: false
      };

      jest.spyOn(dispatchRepository, 'findById').mockResolvedValue(mockConsignment);

      const res = await request(app)
        .post('/api/v1/dispatches/dsp_001/cancel')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cancellationReason: 'Attempting cancellation after departure'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Physical departure has already occurred');
    });
  });

  describe('Tenant Isolation & RBAC', () => {
    it('should block user from other tenant accessing dispatch', async () => {
      const otherToken = generateToken('usr_other', ['PLANT_MANAGER'], otherTenant);

      jest.spyOn(dispatchRepository, 'findById').mockImplementation(async (tenantId, _id) => {
        if (tenantId === otherTenant) return null;
        return { id: 'dsp_001', tenantId: testTenant } as any;
      });

      const res = await request(app)
        .get('/api/v1/dispatches/dsp_001')
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(404);
    });
  });
});
