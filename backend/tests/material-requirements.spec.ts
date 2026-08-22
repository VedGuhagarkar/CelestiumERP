import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { materialRequirementsRepository } from '../src/modules/material-requirements/material-requirements.repository.js';
import { productionPlanRepository } from '../src/modules/production-planning/production-plan.repository.js';
import { heatLotRepository } from '../src/modules/traceability/heat-lot.repository.js';
import { quarantineRepository } from '../src/modules/quarantine/quarantine.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';

describe('Manufacturing Material Requirements & Heat-Lot Allocation Domain', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_001';

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const mockPlan1 = {
    id: 'plan_001',
    tenantId: testTenant,
    planNumber: 'PLAN-202608-0001',
    status: 'CONFIRMED',
    priority: 'HIGH',
    customer: { customerCode: 'CUST-AERO-001' },
    item: {
      itemId: 'item_001',
      itemCode: 'MAT-4140-RND-50',
      itemName: 'AISI 4140 Round Bar Ø50mm',
      materialGrade: 'AISI 4140',
      uom: 'KG'
    },
    quantityTargets: {
      plannedQuantity: 500,
      completedQuantity: 100 // Net demand: 400 KG
    },
    timeline: {
      targetCompletionDate: new Date('2026-09-05')
    }
  };

  const mockPlan2 = {
    id: 'plan_002',
    tenantId: testTenant,
    planNumber: 'PLAN-202608-0002',
    status: 'PLANNED',
    priority: 'URGENT',
    customer: { customerCode: 'CUST-AUTO-002' },
    item: {
      itemId: 'item_001',
      itemCode: 'MAT-4140-RND-50',
      itemName: 'AISI 4140 Round Bar Ø50mm',
      materialGrade: 'AISI 4140',
      uom: 'KG'
    },
    quantityTargets: {
      plannedQuantity: 300,
      completedQuantity: 0 // Net demand: 300 KG -> Total demand: 700 KG
    },
    timeline: {
      targetCompletionDate: new Date('2026-09-02')
    }
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

  describe('POST /api/v1/material-requirements/calculate (Requirement & Shortage Engine)', () => {
    it('should aggregate demand across active plans and identify net shortage when stock is insufficient', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);

      jest.spyOn(productionPlanRepository, 'queryPlans').mockResolvedValue({
        plans: [mockPlan1, mockPlan2] as any,
        total: 2
      });

      // Mock heat lots: only 400 KG available, 100 KG already allocated -> Free stock = 300 KG
      jest.spyOn(heatLotRepository, 'searchHeatLots').mockResolvedValue({
        items: [
          {
            id: 'hl_001',
            heatLotNumber: 'HL-202608-0001',
            itemCode: 'MAT-4140-RND-50',
            currentQuantity: 400,
            allocatedQuantity: 100
          }
        ],
        total: 1,
        page: 1,
        limit: 100,
        totalPages: 1
      } as any);

      jest.spyOn(quarantineRepository, 'findActiveQuarantineForTarget').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/material-requirements/calculate')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);

      const reqSummary = res.body.data[0];
      expect(reqSummary.itemCode).toBe('MAT-4140-RND-50');
      expect(reqSummary.totalRequiredQuantity).toBe(700); // 400 + 300
      expect(reqSummary.totalAvailableQuantity).toBe(300); // 400 - 100
      expect(reqSummary.totalReservedQuantity).toBe(100);
      expect(reqSummary.netShortageQuantity).toBe(400); // 700 - 300
      expect(reqSummary.severity).toBe('PARTIAL');
      expect(reqSummary.impactedPlans).toHaveLength(2);
      // Verify impacted plans are ordered by earliest target completion date
      expect(reqSummary.impactedPlans[0].planNumber).toBe('PLAN-202608-0002'); // Sep 2 < Sep 5
    });
  });

  describe('POST /api/v1/material-requirements/reserve (Atomic Lot Reservation)', () => {
    it('should atomically reserve heat lot quantity against a production plan', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);
      const auditSpy = jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      jest.spyOn(productionPlanRepository, 'findById').mockResolvedValue(mockPlan1 as any);

      const mockHeatLot = {
        id: 'hl_001',
        tenantId: testTenant,
        heatLotNumber: 'HL-202608-0001',
        itemId: 'item_001',
        itemCode: 'MAT-4140-RND-50',
        materialGrade: 'AISI 4140',
        uom: 'KG',
        currentQuantity: 500,
        allocatedQuantity: 100, // 400 available
        allocations: [],
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        })
      };
      jest.spyOn(heatLotRepository, 'findById').mockResolvedValue(mockHeatLot as any);
      jest.spyOn(quarantineRepository, 'findActiveQuarantineForTarget').mockResolvedValue(null);
      jest.spyOn(materialRequirementsRepository, 'generateNextReservationNumber').mockResolvedValue('RES-202608-0001');

      const mockCreatedReservation = {
        id: 'res_001',
        reservationNumber: 'RES-202608-0001',
        planId: 'plan_001',
        planNumber: 'PLAN-202608-0001',
        targetType: 'HEAT_LOT',
        targetId: 'hl_001',
        targetIdentifier: 'HL-202608-0001',
        reservedQuantity: 250,
        uom: 'KG',
        status: 'ACTIVE',
        toJSON: () => ({ reservationNumber: 'RES-202608-0001', status: 'ACTIVE', reservedQuantity: 250 })
      };
      jest.spyOn(materialRequirementsRepository, 'create').mockResolvedValue(mockCreatedReservation as any);

      const res = await request(app)
        .post('/api/v1/material-requirements/reserve')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          planId: 'plan_001',
          targetType: 'HEAT_LOT',
          targetId: 'hl_001',
          reservedQuantity: 250,
          notes: 'Reserved for batch 1'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reservationNumber).toBe('RES-202608-0001');
      expect(mockHeatLot.allocatedQuantity).toBe(350); // 100 + 250
      expect(auditSpy).toHaveBeenCalled();
    });

    it('should block over-reservation when requested quantity exceeds available lot stock', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);

      jest.spyOn(productionPlanRepository, 'findById').mockResolvedValue(mockPlan1 as any);

      const mockHeatLot = {
        id: 'hl_001',
        tenantId: testTenant,
        heatLotNumber: 'HL-202608-0001',
        uom: 'KG',
        currentQuantity: 200,
        allocatedQuantity: 150 // Only 50 KG free
      };
      jest.spyOn(heatLotRepository, 'findById').mockResolvedValue(mockHeatLot as any);
      jest.spyOn(quarantineRepository, 'findActiveQuarantineForTarget').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/material-requirements/reserve')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          planId: 'plan_001',
          targetType: 'HEAT_LOT',
          targetId: 'hl_001',
          reservedQuantity: 100 // Exceeds 50 free
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Over-reservation prevented');
    });

    it('should prevent reservation on heat lots locked under active quarantine', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);

      jest.spyOn(productionPlanRepository, 'findById').mockResolvedValue(mockPlan1 as any);

      const mockHeatLot = {
        id: 'hl_001',
        tenantId: testTenant,
        heatLotNumber: 'HL-202608-0001',
        uom: 'KG',
        currentQuantity: 500,
        allocatedQuantity: 0
      };
      jest.spyOn(heatLotRepository, 'findById').mockResolvedValue(mockHeatLot as any);

      // Active quarantine hold
      jest.spyOn(quarantineRepository, 'findActiveQuarantineForTarget').mockResolvedValue({
        quarantineNumber: 'QRN-2026-00001',
        status: 'ACTIVE_QUARANTINE'
      } as any);

      const res = await request(app)
        .post('/api/v1/material-requirements/reserve')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          planId: 'plan_001',
          targetType: 'HEAT_LOT',
          targetId: 'hl_001',
          reservedQuantity: 100
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('locked under active QUARANTINE');
    });
  });

  describe('POST /api/v1/material-requirements/reservations/:id/release (Reservation Release)', () => {
    it('should release an active reservation and decrement allocated stock on heat lot', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);
      const auditSpy = jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const mockReservation = {
        id: 'res_001',
        tenantId: testTenant,
        reservationNumber: 'RES-202608-0001',
        planNumber: 'PLAN-202608-0001',
        targetType: 'HEAT_LOT',
        targetId: 'hl_001',
        reservedQuantity: 200,
        status: 'ACTIVE',
        releasedByActorId: null,
        releasedAt: null,
        releaseReason: null,
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
        toJSON: () => ({ reservationNumber: 'RES-202608-0001', status: 'RELEASED' })
      };

      jest.spyOn(materialRequirementsRepository, 'findById').mockResolvedValue(mockReservation as any);

      const mockHeatLot = {
        id: 'hl_001',
        allocatedQuantity: 300,
        allocations: [{ jobCardNumber: 'PLAN-202608-0001', status: 'ALLOCATED' }],
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        })
      };
      jest.spyOn(heatLotRepository, 'findById').mockResolvedValue(mockHeatLot as any);

      const res = await request(app)
        .post('/api/v1/material-requirements/reservations/res_001/release')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ reason: 'Production plan scope reduced by customer' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockReservation.status).toBe('RELEASED');
      expect(mockHeatLot.allocatedQuantity).toBe(100); // 300 - 200
      expect(auditSpy).toHaveBeenCalled();
    });
  });

  describe('RBAC Permission Gates', () => {
    it('should block unauthorized user from reserving material', async () => {
      const operatorToken = generateToken('usr_op', ['FURNACE_OPERATOR']);

      const res = await request(app)
        .post('/api/v1/material-requirements/reserve')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          planId: 'plan_001',
          targetType: 'HEAT_LOT',
          targetId: 'hl_001',
          reservedQuantity: 50
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access Denied');
    });
  });
});
