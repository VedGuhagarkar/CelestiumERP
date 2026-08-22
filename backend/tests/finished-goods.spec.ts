import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { finishedGoodsRepository } from '../src/modules/finished-goods/finished-goods.repository.js';
import { itemRepository } from '../src/modules/item/item.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';

describe('Finished-Goods Storage & Pre-Dispatch Master Subsystem', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_001';

  const generateToken = (userId: string, roles: string[]) => {
    return jwt.sign(
      { userId, tenantId: testTenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const mockItem = {
    id: 'item_gear_001',
    tenantId: testTenant,
    itemCode: 'GEAR-PINION-4140',
    name: 'Helical Pinion Gear 4140',
    uom: 'PCS'
  };

  const mockInwardPayload: any = {
    jobCardId: 'jc_001',
    jobCardNumber: 'JC-2026-0801',
    heatLotNumber: 'HL-202608-0001',
    customerCode: 'CUST-AERO-001',
    itemId: 'item_gear_001',
    description: 'Heat-treated, oil-quenched and tempered pinion gears',
    totalQuantity: 250,
    location: 'FG-STAGE-BAY-01'
  };

  beforeEach(() => {
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

  describe('POST /api/v1/finished-goods/inward (Production Output Inwarding)', () => {
    it('should inward finished goods in AWAITING_QC_RELEASE status with 0 available quantity', async () => {
      const operatorToken = generateToken('usr_op', ['FURNACE_OPERATOR']);

      jest.spyOn(itemRepository, 'findById').mockResolvedValue(mockItem as any);
      jest.spyOn(finishedGoodsRepository, 'generateFgLotNumber').mockResolvedValue('FG-202608-0001');

      jest.spyOn(finishedGoodsRepository, 'create').mockResolvedValue({
        ...mockInwardPayload,
        id: 'fg_001',
        tenantId: testTenant,
        fgLotNumber: 'FG-202608-0001',
        itemCode: 'GEAR-PINION-4140',
        uom: 'PCS',
        status: 'AWAITING_QC_RELEASE',
        availableQuantity: 0,
        reservedQuantity: 0,
        dispatchedQuantity: 0,
        qualityRelease: { isReleased: false },
        movementHistory: [],
        toJSON: () => ({
          ...mockInwardPayload,
          id: 'fg_001',
          fgLotNumber: 'FG-202608-0001',
          status: 'AWAITING_QC_RELEASE',
          availableQuantity: 0
        })
      } as any);

      const auditSpy = jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/finished-goods/inward')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send(mockInwardPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.fgLotNumber).toBe('FG-202608-0001');
      expect(res.body.data.status).toBe('AWAITING_QC_RELEASE');
      expect(res.body.data.availableQuantity).toBe(0);
      expect(auditSpy).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          action: 'FINISHED_GOODS_INWARDED',
          entityType: 'FinishedGoods'
        })
      );
    });
  });

  describe('Quality Gate & Release Workflow', () => {
    it('should reject dispatch reservation for unreleased finished goods', async () => {
      const dispatchToken = generateToken('usr_disp', ['DISPATCH_OFFICER']);

      const mockUnreleasedFG: any = {
        id: 'fg_001',
        tenantId: testTenant,
        fgLotNumber: 'FG-202608-0001',
        status: 'AWAITING_QC_RELEASE',
        availableQuantity: 0,
        totalQuantity: 250,
        qualityRelease: { isReleased: false }
      };

      jest.spyOn(finishedGoodsRepository, 'findById').mockResolvedValue(mockUnreleasedFG);

      const res = await request(app)
        .post('/api/v1/finished-goods/fg_001/reserve')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${dispatchToken}`)
        .send({
          quantity: 100,
          deliveryChallanNumber: 'DC-2026-001'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not released by QC');
    });

    it('should release finished goods with CoC reference and unlock available quantity', async () => {
      const metToken = generateToken('usr_met', ['METALLURGIST']);

      const mockFG: any = {
        id: 'fg_001',
        tenantId: testTenant,
        fgLotNumber: 'FG-202608-0001',
        totalQuantity: 250,
        reservedQuantity: 0,
        dispatchedQuantity: 0,
        uom: 'PCS',
        status: 'AWAITING_QC_RELEASE',
        qualityRelease: { isReleased: false },
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
        toJSON: () => ({
          fgLotNumber: 'FG-202608-0001',
          status: 'RELEASED_FOR_DISPATCH',
          availableQuantity: 250
        })
      };

      jest.spyOn(finishedGoodsRepository, 'findById').mockResolvedValue(mockFG);
      const auditSpy = jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/finished-goods/fg_001/release')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`)
        .send({
          cocNumber: 'COC-2026-0081',
          inspectionReportId: 'QC-INSP-2026-092',
          releaseNotes: 'Case hardness 60 HRC, Core hardness 32 HRC, ECD 1.15 mm conform to aerospace print.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockFG.status).toBe('RELEASED_FOR_DISPATCH');
      expect(mockFG.availableQuantity).toBe(250);
      expect(auditSpy).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          action: 'FINISHED_GOODS_QC_RELEASED'
        })
      );
    });
  });

  describe('Reservation for Dispatch Preparation', () => {
    it('should reserve released finished goods and deduct available quantity', async () => {
      const dispatchToken = generateToken('usr_disp', ['DISPATCH_OFFICER']);

      const mockReleasedFG: any = {
        id: 'fg_001',
        tenantId: testTenant,
        fgLotNumber: 'FG-202608-0001',
        totalQuantity: 250,
        availableQuantity: 250,
        reservedQuantity: 0,
        uom: 'PCS',
        status: 'RELEASED_FOR_DISPATCH',
        qualityRelease: { isReleased: true },
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
        toJSON: () => ({
          fgLotNumber: 'FG-202608-0001',
          availableQuantity: 150,
          reservedQuantity: 100
        })
      };

      jest.spyOn(finishedGoodsRepository, 'findById').mockResolvedValue(mockReleasedFG);
      jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/finished-goods/fg_001/reserve')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${dispatchToken}`)
        .send({
          quantity: 100,
          deliveryChallanNumber: 'DC-2026-001'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockReleasedFG.availableQuantity).toBe(150);
      expect(mockReleasedFG.reservedQuantity).toBe(100);
    });

    it('should release reservation and restore available quantity', async () => {
      const dispatchToken = generateToken('usr_disp', ['DISPATCH_OFFICER']);

      const mockReservedFG: any = {
        id: 'fg_001',
        tenantId: testTenant,
        fgLotNumber: 'FG-202608-0001',
        totalQuantity: 250,
        availableQuantity: 150,
        reservedQuantity: 100,
        uom: 'PCS',
        status: 'RELEASED_FOR_DISPATCH',
        qualityRelease: { isReleased: true },
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
        toJSON: () => ({
          fgLotNumber: 'FG-202608-0001',
          availableQuantity: 250,
          reservedQuantity: 0
        })
      };

      jest.spyOn(finishedGoodsRepository, 'findById').mockResolvedValue(mockReservedFG);
      jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/finished-goods/fg_001/reserve/release')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${dispatchToken}`)
        .send({
          quantity: 100
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockReservedFG.availableQuantity).toBe(250);
      expect(mockReservedFG.reservedQuantity).toBe(0);
    });
  });

  describe('Storage Location Relocation', () => {
    it('should move finished goods lot to another warehouse location and preserve history', async () => {
      const clerkToken = generateToken('usr_clerk', ['INVENTORY_CLERK']);

      const mockFG: any = {
        id: 'fg_001',
        tenantId: testTenant,
        fgLotNumber: 'FG-202608-0001',
        totalQuantity: 250,
        dispatchedQuantity: 0,
        location: 'FG-STAGE-BAY-01',
        movementHistory: [],
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
        toJSON: () => ({
          fgLotNumber: 'FG-202608-0001',
          location: 'FG-RACK-B-04'
        })
      };

      jest.spyOn(finishedGoodsRepository, 'findById').mockResolvedValue(mockFG);
      jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .patch('/api/v1/finished-goods/fg_001/location')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({
          destinationLocation: 'FG-RACK-B-04',
          reason: 'Moved to long-term storage rack'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockFG.location).toBe('FG-RACK-B-04');
      expect(mockFG.movementHistory.length).toBe(1);
      expect(mockFG.movementHistory[0].fromLocation).toBe('FG-STAGE-BAY-01');
      expect(mockFG.movementHistory[0].toLocation).toBe('FG-RACK-B-04');
    });
  });

  describe('RBAC Permission Gates', () => {
    it('should block unauthorized user lacking QUALITY_COC_APPROVE permission from releasing finished goods', async () => {
      const opToken = generateToken('usr_op', ['FURNACE_OPERATOR']);

      const res = await request(app)
        .post('/api/v1/finished-goods/fg_001/release')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          releaseNotes: 'Attempting operator bypass'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access Denied');
    });
  });
});
