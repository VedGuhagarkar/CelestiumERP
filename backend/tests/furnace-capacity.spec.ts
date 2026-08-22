import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { furnaceCapacityRepository } from '../src/modules/furnace-capacity/furnace-capacity.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';

describe('Industrial Furnace Finite Capacity & Capability Planning Domain', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_001';

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const mockFurnace = {
    id: 'furnace_sqf_001',
    tenantId: testTenant,
    furnaceCode: 'FURNACE-SQF-01',
    name: 'Sealed Quench Furnace #1',
    furnaceType: 'SEALED_QUENCH_FURNACE',
    locationBay: 'Furnace Bay Alpha',
    status: 'OPERATIONAL',
    nominalDailyOperatingHours: 24.0,
    dimensions: {
      lengthMm: 1200,
      widthMm: 800,
      heightMm: 800,
      usableVolumeM3: 0.768,
      maxGrossWeightKg: 1200
    },
    thermalCapabilities: {
      minOperatingTempC: 750,
      maxOperatingTempC: 1050,
      temperatureUniformityToleranceC: 6,
      pyrometryClass: 'CLASS_2', // AMS 2750G Class 2 (±6°C)
      instrumentationType: 'TYPE_B'
    },
    processCapabilities: {
      supportedProcessFamilies: ['CARBURIZING', 'CARBONITRIDING', 'NEUTRAL_HARDENING'],
      supportedAtmospheres: ['CARBON_POTENTIAL', 'ENDOTHERMIC', 'NITROGEN_PURGE'],
      supportedQuenchMedia: ['FAST_QUENCH_OIL'],
      maxQuenchWeightKg: 1000,
      hasAgitationControl: true
    },
    toJSON: () => ({
      furnaceCode: 'FURNACE-SQF-01',
      status: 'OPERATIONAL',
      thermalCapabilities: { pyrometryClass: 'CLASS_2', maxOperatingTempC: 1050 }
    })
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

  describe('POST /api/v1/furnaces (Furnace Registration)', () => {
    it('should register a new furnace master with pyrometry and thermal limits', async () => {
      const adminToken = generateToken('usr_admin', ['ADMIN']);
      const auditSpy = jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      jest.spyOn(furnaceCapacityRepository, 'findFurnaceByCode').mockResolvedValue(null);
      jest.spyOn(furnaceCapacityRepository, 'createFurnace').mockResolvedValue(mockFurnace as any);

      const res = await request(app)
        .post('/api/v1/furnaces')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          furnaceCode: 'FURNACE-SQF-01',
          name: 'Sealed Quench Furnace #1',
          furnaceType: 'SEALED_QUENCH_FURNACE',
          locationBay: 'Furnace Bay Alpha',
          dimensions: {
            lengthMm: 1200,
            widthMm: 800,
            heightMm: 800,
            usableVolumeM3: 0.768,
            maxGrossWeightKg: 1200
          },
          thermalCapabilities: {
            minOperatingTempC: 750,
            maxOperatingTempC: 1050,
            temperatureUniformityToleranceC: 6,
            pyrometryClass: 'CLASS_2',
            instrumentationType: 'TYPE_B'
          },
          processCapabilities: {
            supportedProcessFamilies: ['CARBURIZING', 'CARBONITRIDING', 'NEUTRAL_HARDENING'],
            supportedAtmospheres: ['CARBON_POTENTIAL', 'ENDOTHERMIC'],
            supportedQuenchMedia: ['FAST_QUENCH_OIL']
          }
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.furnaceCode).toBe('FURNACE-SQF-01');
      expect(auditSpy).toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/furnace-capacity/check-compatibility (Capability & pyrometry validation)', () => {
    it('should validate compatibility when recipe parameters match furnace capabilities', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);

      jest.spyOn(furnaceCapacityRepository, 'findFurnaceById').mockResolvedValue(mockFurnace as any);
      jest.spyOn(furnaceCapacityRepository, 'findOverlappingAllocations').mockResolvedValue([]);

      const res = await request(app)
        .post('/api/v1/furnace-capacity/check-compatibility')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          furnaceId: 'furnace_sqf_001',
          processFamily: 'CARBURIZING',
          targetTemperatureC: 920,
          requiredFurnaceClass: 'CLASS_2',
          requiredAtmosphere: 'CARBON_POTENTIAL',
          requiredQuenchMedium: 'FAST_QUENCH_OIL',
          totalBatchWeightKg: 850
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isCompatible).toBe(true);
      expect(res.body.data.violations).toHaveLength(0);
    });

    it('should reject compatibility when recipe target temperature exceeds furnace max thermal limit', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);

      jest.spyOn(furnaceCapacityRepository, 'findFurnaceById').mockResolvedValue(mockFurnace as any);
      jest.spyOn(furnaceCapacityRepository, 'findOverlappingAllocations').mockResolvedValue([]);

      const res = await request(app)
        .post('/api/v1/furnace-capacity/check-compatibility')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          furnaceId: 'furnace_sqf_001',
          processFamily: 'CARBURIZING',
          targetTemperatureC: 1150, // Exceeds 1050 max
          totalBatchWeightKg: 500
        });

      expect(res.status).toBe(200);
      expect(res.body.data.isCompatible).toBe(false);
      expect(res.body.data.violations[0]).toContain('out of furnace operating range');
    });

    it('should reject compatibility when recipe requires AMS 2750 Class 1 but furnace is Class 2', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);

      jest.spyOn(furnaceCapacityRepository, 'findFurnaceById').mockResolvedValue(mockFurnace as any);
      jest.spyOn(furnaceCapacityRepository, 'findOverlappingAllocations').mockResolvedValue([]);

      const res = await request(app)
        .post('/api/v1/furnace-capacity/check-compatibility')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          furnaceId: 'furnace_sqf_001',
          processFamily: 'CARBURIZING',
          targetTemperatureC: 920,
          requiredFurnaceClass: 'CLASS_1', // Stricter than Class 2
          totalBatchWeightKg: 500
        });

      expect(res.status).toBe(200);
      expect(res.body.data.isCompatible).toBe(false);
      expect(res.body.data.violations[0]).toContain('Pyrometry class non-compliance');
    });

    it('should reject compatibility when furnace is in CALIBRATION_OVERDUE or MAINTENANCE status', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);

      jest.spyOn(furnaceCapacityRepository, 'findFurnaceById').mockResolvedValue({
        ...mockFurnace,
        status: 'CALIBRATION_OVERDUE'
      } as any);

      const res = await request(app)
        .post('/api/v1/furnace-capacity/check-compatibility')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          furnaceId: 'furnace_sqf_001',
          processFamily: 'CARBURIZING',
          targetTemperatureC: 920,
          totalBatchWeightKg: 500
        });

      expect(res.status).toBe(200);
      expect(res.body.data.isCompatible).toBe(false);
      expect(res.body.data.violations[0]).toContain('not OPERATIONAL');
    });
  });

  describe('POST /api/v1/furnace-capacity/book (Capacity Booking)', () => {
    it('should book time-window capacity on an operational and compatible furnace', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);
      const auditSpy = jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      jest.spyOn(furnaceCapacityRepository, 'findFurnaceById').mockResolvedValue(mockFurnace as any);
      jest.spyOn(furnaceCapacityRepository, 'findOverlappingAllocations').mockResolvedValue([]);
      jest.spyOn(furnaceCapacityRepository, 'generateNextAllocationNumber').mockResolvedValue('FNA-202608-0001');

      const mockAllocation = {
        id: 'fna_001',
        allocationNumber: 'FNA-202608-0001',
        furnaceId: 'furnace_sqf_001',
        furnaceCode: 'FURNACE-SQF-01',
        startTime: new Date('2026-09-01T08:00:00.000Z'),
        endTime: new Date('2026-09-01T16:00:00.000Z'),
        durationHours: 8,
        status: 'BOOKED',
        toJSON: () => ({ allocationNumber: 'FNA-202608-0001', status: 'BOOKED', durationHours: 8 })
      };
      jest.spyOn(furnaceCapacityRepository, 'createAllocation').mockResolvedValue(mockAllocation as any);

      const res = await request(app)
        .post('/api/v1/furnace-capacity/book')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          furnaceId: 'furnace_sqf_001',
          processFamily: 'CARBURIZING',
          targetTemperatureC: 920,
          allocatedWeightKg: 800,
          startTime: '2026-09-01T08:00:00.000Z',
          endTime: '2026-09-01T16:00:00.000Z'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.allocationNumber).toBe('FNA-202608-0001');
      expect(auditSpy).toHaveBeenCalled();
    });

    it('should reject booking when overlapping allocation exists in requested window', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);

      jest.spyOn(furnaceCapacityRepository, 'findFurnaceById').mockResolvedValue(mockFurnace as any);
      // Overlapping slot found!
      jest.spyOn(furnaceCapacityRepository, 'findOverlappingAllocations').mockResolvedValue([
        { allocationNumber: 'FNA-202608-0001' } as any
      ]);

      const res = await request(app)
        .post('/api/v1/furnace-capacity/book')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          furnaceId: 'furnace_sqf_001',
          processFamily: 'CARBURIZING',
          targetTemperatureC: 920,
          allocatedWeightKg: 800,
          startTime: '2026-09-01T10:00:00.000Z',
          endTime: '2026-09-01T14:00:00.000Z'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('overlapping booking(s)');
    });
  });

  describe('GET /api/v1/furnace-capacity/utilization (Utilization & Bottleneck Engine)', () => {
    it('should calculate utilization percentage and identify bottleneck furnaces', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);

      jest.spyOn(furnaceCapacityRepository, 'findFurnaces').mockResolvedValue([mockFurnace as any]);

      // 7-day period = 24 * 7 = 168 available hours.
      // Mock allocations total = 155 hours -> utilization = (155 / 168) * 100 = 92% (Bottleneck!)
      jest.spyOn(furnaceCapacityRepository, 'findAllocationsInPeriod').mockResolvedValue([
        { durationHours: 75 },
        { durationHours: 80 }
      ] as any);

      const res = await request(app)
        .get('/api/v1/furnace-capacity/utilization')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .query({
          startDate: '2026-09-01T00:00:00.000Z',
          endDate: '2026-09-08T00:00:00.000Z'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);

      const ut = res.body.data[0];
      expect(ut.furnaceCode).toBe('FURNACE-SQF-01');
      expect(ut.totalAvailableHours).toBe(168);
      expect(ut.bookedHours).toBe(155);
      expect(ut.utilizationPercentage).toBe(92);
      expect(ut.isBottleneck).toBe(true);
      expect(ut.isUnderutilized).toBe(false);
    });
  });

  describe('RBAC Permission Gates', () => {
    it('should block unauthorized user lacking MACHINES_FURNACE_CONFIGURE from creating furnaces', async () => {
      const operatorToken = generateToken('usr_op', ['FURNACE_OPERATOR']);

      const res = await request(app)
        .post('/api/v1/furnaces')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          furnaceCode: 'FURNACE-HACK',
          name: 'Unauthorized Furnace',
          furnaceType: 'PIT_FURNACE',
          locationBay: 'Bay 1'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access Denied');
    });
  });
});
