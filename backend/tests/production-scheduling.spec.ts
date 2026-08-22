import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { productionScheduleRepository } from '../src/modules/production-schedule/production-schedule.repository.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { furnaceCapacityRepository } from '../src/modules/furnace-capacity/furnace-capacity.repository.js';
import { workforceCapacityRepository } from '../src/modules/workforce-capacity/workforce-capacity.repository.js';
import { constraintAnalysisService } from '../src/modules/constraint-analysis/constraint-analysis.service.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';

describe('Production Scheduling Domain & Finite Resource Binding', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_001';

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const createMockJobDocument = (overrides: any = {}) => {
    const doc: any = {
      id: 'job_sched_001',
      jobNumber: 'JOB-202608-0010',
      tenantId: testTenant,
      planId: 'plan_001',
      planNumber: 'PLAN-202608-0001',
      status: 'APPROVED',
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
      equipmentAssignment: {},
      operatorAssignment: {},
      timeline: {
        plannedStartDate: new Date('2026-09-01T08:00:00.000Z'),
        targetCompletionDate: new Date('2026-09-01T16:00:00.000Z')
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

  const mockOperator = {
    id: 'emp_op_01',
    employeeCode: 'EMP-OP-01',
    fullName: 'Marcus Vance',
    status: 'ACTIVE',
    defaultShift: 'SHIFT_1_MORNING',
    approvedLeaves: [],
    skills: [
      {
        skillCode: 'CARBURIZING_OPERATION',
        isCertified: true,
        expiryDate: new Date('2027-01-01')
      }
    ]
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

  describe('POST /api/v1/production-schedules (Job Scheduling)', () => {
    it('should schedule an approved job, bind furnace and operator, and set job status to SCHEDULED', async () => {
      const schedulerToken = generateToken('usr_sched', ['PLANT_MANAGER']);
      const job = createMockJobDocument({ status: 'APPROVED' });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(productionScheduleRepository, 'findActiveScheduleByJobId').mockResolvedValue(null);

      // Clean constraints
      jest.spyOn(constraintAnalysisService, 'evaluatePlanConstraints').mockResolvedValue({
        isBlocked: false,
        violations: []
      } as any);

      jest.spyOn(furnaceCapacityRepository, 'findFurnaceById').mockResolvedValue(mockFurnace as any);
      jest.spyOn(productionScheduleRepository, 'findActiveSchedulesByFurnaceAndTime').mockResolvedValue([]);

      jest.spyOn(workforceCapacityRepository, 'findEmployeeById').mockResolvedValue(mockOperator as any);
      jest.spyOn(productionScheduleRepository, 'findActiveSchedulesByOperatorAndTime').mockResolvedValue([]);

      jest.spyOn(productionScheduleRepository, 'generateNextScheduleNumber').mockResolvedValue('SCHED-202608-0001');

      const mockCreatedSchedule = {
        id: 'sched_001',
        scheduleNumber: 'SCHED-202608-0001',
        jobId: job.id,
        jobNumber: job.jobNumber,
        furnaceId: 'furnace_sqf_01',
        furnaceCode: 'FURNACE-SQF-01',
        status: 'SCHEDULED',
        startTime: new Date('2026-09-01T08:00:00.000Z'),
        endTime: new Date('2026-09-01T16:00:00.000Z'),
        toJSON: () => ({
          scheduleNumber: 'SCHED-202608-0001',
          jobNumber: job.jobNumber,
          status: 'SCHEDULED'
        })
      };

      jest.spyOn(productionScheduleRepository, 'create').mockResolvedValue(mockCreatedSchedule as any);

      const res = await request(app)
        .post('/api/v1/production-schedules')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${schedulerToken}`)
        .send({
          jobId: job.id,
          furnaceId: 'furnace_sqf_01',
          operatorId: 'emp_op_01',
          shift: 'SHIFT_1_MORNING',
          plannedStartTime: '2026-09-01T08:00:00.000Z',
          plannedEndTime: '2026-09-01T16:00:00.000Z'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.scheduleNumber).toBe('SCHED-202608-0001');
      expect(job.status).toBe('SCHEDULED');
      expect(job.equipmentAssignment.furnaceId).toBe('furnace_sqf_01');
      expect(job.operatorAssignment.operatorId).toBe('emp_op_01');
    });

    it('should reject scheduling when furnace slot collision is detected', async () => {
      const schedulerToken = generateToken('usr_sched', ['PLANT_MANAGER']);
      const job = createMockJobDocument();

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(productionScheduleRepository, 'findActiveScheduleByJobId').mockResolvedValue(null);
      jest.spyOn(constraintAnalysisService, 'evaluatePlanConstraints').mockResolvedValue({ isBlocked: false, violations: [] } as any);
      jest.spyOn(furnaceCapacityRepository, 'findFurnaceById').mockResolvedValue(mockFurnace as any);

      // Collision detected!
      const conflictingSchedule = {
        jobNumber: 'JOB-202608-0099',
        scheduleNumber: 'SCHED-202608-0099'
      };
      jest.spyOn(productionScheduleRepository, 'findActiveSchedulesByFurnaceAndTime').mockResolvedValue([conflictingSchedule as any]);

      const res = await request(app)
        .post('/api/v1/production-schedules')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${schedulerToken}`)
        .send({
          jobId: job.id,
          furnaceId: 'furnace_sqf_01',
          plannedStartTime: '2026-09-01T08:00:00.000Z',
          plannedEndTime: '2026-09-01T16:00:00.000Z'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Furnace schedule collision');
      expect(res.body.message).toContain('JOB-202608-0099');
    });

    it('should reject scheduling when operator double-booking conflict is detected', async () => {
      const schedulerToken = generateToken('usr_sched', ['PLANT_MANAGER']);
      const job = createMockJobDocument();

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(productionScheduleRepository, 'findActiveScheduleByJobId').mockResolvedValue(null);
      jest.spyOn(constraintAnalysisService, 'evaluatePlanConstraints').mockResolvedValue({ isBlocked: false, violations: [] } as any);
      jest.spyOn(furnaceCapacityRepository, 'findFurnaceById').mockResolvedValue(mockFurnace as any);
      jest.spyOn(productionScheduleRepository, 'findActiveSchedulesByFurnaceAndTime').mockResolvedValue([]);

      jest.spyOn(workforceCapacityRepository, 'findEmployeeById').mockResolvedValue(mockOperator as any);

      // Operator conflict detected!
      const operatorConflict = {
        jobNumber: 'JOB-202608-0088'
      };
      jest.spyOn(productionScheduleRepository, 'findActiveSchedulesByOperatorAndTime').mockResolvedValue([operatorConflict as any]);

      const res = await request(app)
        .post('/api/v1/production-schedules')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${schedulerToken}`)
        .send({
          jobId: job.id,
          furnaceId: 'furnace_sqf_01',
          operatorId: 'emp_op_01',
          plannedStartTime: '2026-09-01T08:00:00.000Z',
          plannedEndTime: '2026-09-01T16:00:00.000Z'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Operator schedule collision');
      expect(res.body.message).toContain('double-booked');
    });

    it('should reject scheduling when constraint analysis detects blocking constraint without override', async () => {
      const schedulerToken = generateToken('usr_sched', ['PLANT_MANAGER']);
      const job = createMockJobDocument();

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(productionScheduleRepository, 'findActiveScheduleByJobId').mockResolvedValue(null);

      // Blocking constraint!
      jest.spyOn(constraintAnalysisService, 'evaluatePlanConstraints').mockResolvedValue({
        isBlocked: true,
        violations: [
          {
            category: 'HEAT_LOT_AVAILABILITY',
            severity: 'BLOCKING',
            message: 'Heat lot quarantined'
          }
        ]
      } as any);

      const res = await request(app)
        .post('/api/v1/production-schedules')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${schedulerToken}`)
        .send({
          jobId: job.id,
          furnaceId: 'furnace_sqf_01',
          plannedStartTime: '2026-09-01T08:00:00.000Z',
          plannedEndTime: '2026-09-01T16:00:00.000Z'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Blocked by factory constraints');
    });
  });

  describe('POST /api/v1/production-schedules/:id/reschedule (Rescheduling)', () => {
    it('should reschedule an existing schedule and record transition history', async () => {
      const schedulerToken = generateToken('usr_sched', ['PLANT_MANAGER']);
      const job = createMockJobDocument({ status: 'SCHEDULED' });

      const mockSchedule: any = {
        id: 'sched_001',
        scheduleNumber: 'SCHED-202608-0001',
        jobId: job.id,
        furnaceId: 'furnace_sqf_01',
        furnaceCode: 'FURNACE-SQF-01',
        status: 'SCHEDULED',
        startTime: new Date('2026-09-01T08:00:00.000Z'),
        endTime: new Date('2026-09-01T16:00:00.000Z'),
        history: [],
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
        toJSON: function () {
          return { ...this };
        }
      };

      jest.spyOn(productionScheduleRepository, 'findById').mockResolvedValue(mockSchedule as any);
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(furnaceCapacityRepository, 'findFurnaceById').mockResolvedValue(mockFurnace as any);
      jest.spyOn(productionScheduleRepository, 'findActiveSchedulesByFurnaceAndTime').mockResolvedValue([]);

      const res = await request(app)
        .post(`/api/v1/production-schedules/${mockSchedule.id}/reschedule`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${schedulerToken}`)
        .send({
          newPlannedStartTime: '2026-09-02T08:00:00.000Z',
          newPlannedEndTime: '2026-09-02T16:00:00.000Z',
          reason: 'Customer requested 24-hour delay'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockSchedule.status).toBe('RESCHEDULED');
      expect(mockSchedule.history).toHaveLength(1);
      expect(mockSchedule.history[0].action).toBe('RESCHEDULE');
      expect(job.timeline.plannedStartDate).toEqual(new Date('2026-09-02T08:00:00.000Z'));
    });
  });

  describe('POST /api/v1/production-schedules/:id/unschedule (Controlled Cancellation / Return to Backlog)', () => {
    it('should cancel schedule and return job to APPROVED backlog state', async () => {
      const schedulerToken = generateToken('usr_sched', ['PLANT_MANAGER']);
      const job = createMockJobDocument({
        status: 'SCHEDULED',
        equipmentAssignment: { furnaceId: 'furnace_sqf_01', furnaceCode: 'FURNACE-SQF-01' }
      });

      const mockSchedule: any = {
        id: 'sched_001',
        scheduleNumber: 'SCHED-202608-0001',
        jobId: job.id,
        furnaceId: 'furnace_sqf_01',
        furnaceCode: 'FURNACE-SQF-01',
        status: 'SCHEDULED',
        history: [],
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
        toJSON: function () {
          return { ...this };
        }
      };

      jest.spyOn(productionScheduleRepository, 'findById').mockResolvedValue(mockSchedule as any);
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-schedules/${mockSchedule.id}/unschedule`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${schedulerToken}`)
        .send({ reason: 'Furnace maintenance emergency' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockSchedule.status).toBe('UNSCHEDULED');
      expect(job.status).toBe('APPROVED'); // Returned to backlog!
      expect(job.equipmentAssignment.furnaceId).toBeNull();
      expect(mockSchedule.history[0].action).toBe('UNSCHEDULE');
    });

    it('should reject unscheduling if job is actively IN_PROGRESS', async () => {
      const schedulerToken = generateToken('usr_sched', ['PLANT_MANAGER']);
      const job = createMockJobDocument({ status: 'IN_PROGRESS' });

      const mockSchedule: any = {
        id: 'sched_001',
        jobId: job.id,
        status: 'SCHEDULED',
        history: []
      };

      jest.spyOn(productionScheduleRepository, 'findById').mockResolvedValue(mockSchedule as any);
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-schedules/${mockSchedule.id}/unschedule`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${schedulerToken}`)
        .send({ reason: 'Illegal unschedule' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('actively IN_PROGRESS');
    });
  });

  describe('GET /api/v1/production-schedules/queue (Prioritized Production Queue)', () => {
    it('should rank AOG_CRITICAL scheduled jobs ahead of NORMAL priority jobs', async () => {
      const schedulerToken = generateToken('usr_sched', ['PLANT_MANAGER']);

      const schedNormal = {
        id: 'sched_1',
        scheduleNumber: 'SCHED-001',
        priority: 'NORMAL',
        startTime: new Date('2026-09-01T08:00:00Z'),
        status: 'SCHEDULED'
      };
      const schedAog = {
        id: 'sched_2',
        scheduleNumber: 'SCHED-002',
        priority: 'AOG_CRITICAL',
        startTime: new Date('2026-09-05T08:00:00Z'),
        status: 'SCHEDULED'
      };

      jest.spyOn(productionScheduleRepository, 'querySchedules').mockResolvedValue({
        items: [schedNormal, schedAog],
        total: 2,
        page: 1,
        limit: 100,
        totalPages: 1
      } as any);

      const res = await request(app)
        .get('/api/v1/production-schedules/queue')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${schedulerToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const queue = res.body.data;
      expect(queue).toHaveLength(2);
      expect(queue[0].priority).toBe('AOG_CRITICAL');
      expect(queue[0].scheduleNumber).toBe('SCHED-002');
      expect(queue[0].queuePosition).toBe(1);
    });
  });

  describe('RBAC Permission Gates', () => {
    it('should block unauthorized user lacking PRODUCTION_SCHEDULE_MANAGE from scheduling jobs', async () => {
      const techToken = generateToken('usr_tech', ['MAINTENANCE_TECH']);

      const res = await request(app)
        .post('/api/v1/production-schedules')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${techToken}`)
        .send({
          jobId: 'job_001',
          furnaceId: 'furnace_001',
          plannedStartTime: '2026-09-01T08:00:00.000Z',
          plannedEndTime: '2026-09-01T16:00:00.000Z'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access Denied');
    });
  });
});
