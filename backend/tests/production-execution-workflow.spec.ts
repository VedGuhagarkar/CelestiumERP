import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { furnaceCapacityRepository } from '../src/modules/furnace-capacity/furnace-capacity.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { DomainEventBus } from '../src/core/events/domain-event-bus.js';
import { DomainEvents } from '../src/core/constants/events.js';

describe('Shop-Floor Furnace Cycle Execution Workflow (Phase 4 Integration Core)', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_001';
  const eventBus = DomainEventBus.getInstance();

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const createMockJobDocument = (overrides: any = {}) => {
    const doc: any = {
      id: 'job_exec_001',
      jobNumber: 'JOB-202608-0100',
      tenantId: testTenant,
      planId: 'plan_001',
      planNumber: 'PLAN-202608-0001',
      status: 'SCHEDULED',
      priority: 'HIGH',
      customer: {
        customerId: 'cust_001',
        customerCode: 'CUST-AERO-001',
        customerName: 'Aero Dynamics'
      },
      item: {
        itemId: 'item_4140',
        itemCode: 'MAT-4140-BAR',
        itemName: 'AISI 4140 Round Bar',
        materialGrade: 'AISI 4140',
        uom: 'KG'
      },
      quantity: {
        targetQuantity: 100,
        loadedQuantity: 0,
        completedQuantity: 0,
        scrappedQuantity: 0
      },
      recipeSnapshot: {
        recipeId: 'rec_001',
        recipeCode: 'REC-CARB-4140',
        revisionNumber: 1,
        processFamily: 'CARBURIZING',
        stages: [{ targetTemperatureC: 920 }]
      },
      specificationSnapshot: {
        specificationId: 'spec_001',
        specCode: 'SPEC-AMS-2759',
        revisionNumber: 1
      },
      materialAllocations: [
        {
          heatLotId: 'hl_4140_01',
          heatLotNumber: 'HL-202608-001',
          allocatedQuantity: 100,
          uom: 'KG'
        }
      ],
      equipmentAssignment: {
        furnaceId: 'furnace_sqf_01',
        furnaceCode: 'FURNACE-SQF-01',
        locationBay: 'BAY_A',
        pyrometryClass: 'CLASS_2'
      },
      operatorAssignment: {
        operatorId: 'emp_op_01',
        operatorCode: 'EMP-OP-01',
        operatorName: 'Marcus Vance'
      },
      timeline: {
        plannedStartDate: new Date('2026-09-01T08:00:00.000Z'),
        targetCompletionDate: new Date('2026-09-01T16:00:00.000Z')
      },
      execution: {
        stageProgress: [],
        downtimeLog: [],
        productionLogs: []
      },
      transitionHistory: [],
      assignmentHistory: [],
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

  const mockFurnace = {
    id: 'furnace_sqf_01',
    furnaceCode: 'FURNACE-SQF-01',
    status: 'OPERATIONAL',
    locationBay: 'BAY_A',
    thermalCapabilities: {
      minOperatingTempC: 750,
      maxOperatingTempC: 1050,
      pyrometryClass: 'CLASS_2'
    },
    processCapabilities: {
      supportedProcessFamilies: ['CARBURIZING', 'CARBONITRIDING']
    }
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

  describe('End-to-End Shop-Floor Furnace Cycle Execution', () => {
    it('should execute full furnace cycle: Start -> Preheat -> Soak -> Quench -> Complete -> QC Handoff -> Storage', async () => {
      const operatorToken = generateToken('usr_op', ['PLANT_MANAGER']);
      const job = createMockJobDocument({ status: 'SCHEDULED' });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(furnaceCapacityRepository, 'findFurnaceById').mockResolvedValue(mockFurnace as any);

      const publishedEvents: string[] = [];
      jest.spyOn(eventBus, 'publish').mockImplementation((event: any) => {
        publishedEvents.push(event.name);
      });

      // 1. Start Furnace Cycle
      const startRes = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/start`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          chargeNumber: 'CHG-202608-01',
          loadedWeightKg: 450.5,
          loadedPieceCount: 100,
          fixtureId: 'BASKET-INCONEL-01',
          initialFurnaceTempC: 250,
          thermocoupleLocations: ['TC-TOP-LEFT', 'TC-CORE-CENTER', 'TC-BOTTOM-RIGHT']
        });

      expect(startRes.status).toBe(200);
      expect(startRes.body.success).toBe(true);
      expect(job.status).toBe('IN_PROGRESS');
      expect(job.execution.furnaceCharge.chargeNumber).toBe('CHG-202608-01');
      expect(job.execution.cycleTimer.cycleStartTime).toBeDefined();
      expect(publishedEvents).toContain(DomainEvents.JOB_STARTED);

      // 2. Record Preheat Stage Progress
      const preheatRes = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/stage-progress`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          stageSequence: 1,
          stageName: 'Equalizing Preheat',
          stageType: 'PREHEAT',
          targetTemperatureC: 650,
          actualTemperatureC: 652,
          targetDurationMinutes: 60,
          actualDurationMinutes: 65
        });

      expect(preheatRes.status).toBe(200);
      expect(job.execution.stageProgress).toHaveLength(1);
      expect(job.execution.stageProgress[0].stageType).toBe('PREHEAT');

      // 3. Record Soak Stage Progress
      const soakRes = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/stage-progress`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          stageSequence: 2,
          stageName: 'Carburizing Soak',
          stageType: 'SOAK',
          targetTemperatureC: 920,
          actualTemperatureC: 921,
          targetDurationMinutes: 240,
          actualDurationMinutes: 245,
          atmosphereDetails: { carbonPotential: 1.15 }
        });

      expect(soakRes.status).toBe(200);
      expect(job.execution.stageProgress).toHaveLength(2);

      // 4. Record Quench Stage Progress
      const quenchRes = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/stage-progress`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          stageSequence: 3,
          stageName: 'Direct Oil Quench',
          stageType: 'QUENCH',
          targetTemperatureC: 840,
          actualTemperatureC: 838,
          targetDurationMinutes: 20,
          actualDurationMinutes: 20,
          quenchMedium: 'FAST_QUENCH_OIL',
          quenchAgitationSpeedRpm: 1200,
          quenchMediaInitialTempC: 55,
          quenchMediaFinalTempC: 68
        });

      expect(quenchRes.status).toBe(200);
      expect(job.execution.stageProgress).toHaveLength(3);

      // 5. Add Shift Handover Log
      const notesRes = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/notes`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          type: 'SHIFT_HANDOVER',
          shift: 'SHIFT_1_MORNING',
          message: 'Cycle completed smoothly. Clean oil quench with zero flare.'
        });

      expect(notesRes.status).toBe(200);
      expect(job.execution.productionLogs).toHaveLength(1);

      // 6. Complete Production Execution & Quality Handoff
      const completeRes = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/complete`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          completedQuantity: 98,
          scrappedQuantity: 2,
          operatorNotes: '2 samples pulled for microhardness test coupon'
        });

      expect(completeRes.status).toBe(200);
      expect(job.status).toBe('QUALITY_CHECK');
      expect(job.execution.qualityHandoff.inspectionRequestId).toMatch(/^INSP-REQ-/);
      expect(job.execution.qualityHandoff.pyrometryArchiveId).toMatch(/^PYRO-/);
      expect(publishedEvents).toContain(DomainEvents.JOB_COMPLETED);
      expect(publishedEvents).toContain(DomainEvents.QC_INSPECTION_CREATED);

      // 7. Transfer to Warehouse Storage
      const storageRes = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/transition-storage`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          warehouseId: 'WH_FG_MAIN',
          locationBay: 'BAY_C_RACK_04',
          palletId: 'PALLET-099'
        });

      expect(storageRes.status).toBe(200);
      expect(job.status).toBe('STORAGE');
      expect(job.execution.storagePlacement.warehouseId).toBe('WH_FG_MAIN');
      expect(publishedEvents).toContain(DomainEvents.WAREHOUSE_FG_RECEIVED);
    });
  });

  describe('Controlled Pause / Resume & Downtime Logging for OEE', () => {
    it('should pause cycle, log categorized downtime, and calculate downtime duration upon resume', async () => {
      const operatorToken = generateToken('usr_op', ['PLANT_MANAGER']);
      const job = createMockJobDocument({ status: 'IN_PROGRESS' });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const publishedEvents: string[] = [];
      jest.spyOn(eventBus, 'publish').mockImplementation((event: any) => {
        publishedEvents.push(event.name);
      });

      // 1. Pause Cycle
      const pauseRes = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/pause`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          category: 'ATMOSPHERE_LOSS',
          reason: 'Endogas generator pressure drop',
          impactOnCycle: 'Soak paused under nitrogen purge'
        });

      expect(pauseRes.status).toBe(200);
      expect(job.status).toBe('PAUSED');
      expect(job.execution.downtimeLog).toHaveLength(1);
      expect(job.execution.downtimeLog[0].category).toBe('ATMOSPHERE_LOSS');
      expect(publishedEvents).toContain(DomainEvents.JOB_PAUSED);
      expect(publishedEvents).toContain(DomainEvents.JOB_DOWNTIME_LOGGED);

      // 2. Resume Cycle
      const resumeRes = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/resume`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          actionTaken: 'Replaced dewpoint sensor and restored gas pressure to 1.15% C'
        });

      expect(resumeRes.status).toBe(200);
      expect(job.status).toBe('IN_PROGRESS');
      expect(job.execution.downtimeLog[0].endTime).toBeDefined();
      expect(job.execution.downtimeLog[0].actionTaken).toContain('Replaced dewpoint sensor');
      expect(publishedEvents).toContain(DomainEvents.JOB_RESUMED);
    });

    it('should provide furnace utilization and downtime analytics for OEE calculations', async () => {
      const viewerToken = generateToken('usr_viewer', ['PLANT_MANAGER']);

      const mockJobs = [
        {
          id: 'job_1',
          execution: {
            cycleTimer: { totalRunDurationMinutes: 480, totalDowntimeDurationMinutes: 60 },
            downtimeLog: [
              { category: 'ATMOSPHERE_LOSS', durationMinutes: 40 },
              { category: 'MECHANICAL_FAILURE', durationMinutes: 20 }
            ]
          }
        }
      ];

      jest.spyOn(productionJobRepository, 'find').mockResolvedValue(mockJobs as any);

      const res = await request(app)
        .get('/api/v1/production-jobs/analytics/utilization')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const stats = res.body.data;
      expect(stats.totalRunMinutes).toBe(480);
      expect(stats.totalDowntimeMinutes).toBe(60);
      expect(stats.availabilityPercentage).toBe(88.9); // 480 / 540 = 88.88%
      expect(stats.downtimeByCategory.ATMOSPHERE_LOSS).toBe(40);
      expect(stats.downtimeByCategory.MECHANICAL_FAILURE).toBe(20);
    });
  });

  describe('Domain Rejection Scenarios', () => {
    it('should reject starting a job without heat lot material allocations', async () => {
      const operatorToken = generateToken('usr_op', ['PLANT_MANAGER']);
      const job = createMockJobDocument({
        status: 'SCHEDULED',
        materialAllocations: [] // Missing material allocation!
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(furnaceCapacityRepository, 'findFurnaceById').mockResolvedValue(mockFurnace as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/start`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          chargeNumber: 'CHG-001',
          loadedWeightKg: 100,
          loadedPieceCount: 50,
          initialFurnaceTempC: 150
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('No heat lot material allocations assigned');
    });

    it('should reject starting a job if assigned furnace is in BREAKDOWN status', async () => {
      const operatorToken = generateToken('usr_op', ['PLANT_MANAGER']);
      const job = createMockJobDocument({ status: 'SCHEDULED' });

      const breakdownFurnace = { ...mockFurnace, status: 'BREAKDOWN' };

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(furnaceCapacityRepository, 'findFurnaceById').mockResolvedValue(breakdownFurnace as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/start`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          chargeNumber: 'CHG-001',
          loadedWeightKg: 100,
          loadedPieceCount: 50,
          initialFurnaceTempC: 150
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not in OPERATIONAL state');
    });

    it('should reject completing a job without recorded stage progress', async () => {
      const operatorToken = generateToken('usr_op', ['PLANT_MANAGER']);
      const job = createMockJobDocument({
        status: 'IN_PROGRESS',
        execution: { stageProgress: [], downtimeLog: [], productionLogs: [] }
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/complete`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ completedQuantity: 100 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('No heat treatment stage execution records found');
    });

    it('should block unauthorized completion lacking PRODUCTION_JOB_TRANSITION', async () => {
      const guestToken = generateToken('usr_guest', ['MAINTENANCE_TECH']);

      const res = await request(app)
        .post('/api/v1/production-jobs/job_001/complete')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${guestToken}`)
        .send({ completedQuantity: 100 });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access Denied');
    });
  });
});
