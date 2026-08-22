import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { furnaceCapacityRepository } from '../src/modules/furnace-capacity/furnace-capacity.repository.js';
import { workforceCapacityRepository } from '../src/modules/workforce-capacity/workforce-capacity.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';

describe('Shop-Floor Job Resource Allocation Subsystem', () => {
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
      id: 'job_alloc_001',
      jobNumber: 'JOB-202608-0050',
      tenantId: testTenant,
      status: 'APPROVED',
      priority: 'HIGH',
      customer: {
        customerId: 'cust_001',
        customerCode: 'CUST-AERO-001',
        customerName: 'Apex Aero'
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
        stages: [
          {
            sequence: 1,
            stageName: 'Carburize Soak',
            targetTemperatureC: 920
          }
        ]
      },
      specificationSnapshot: {
        specificationId: 'spec_001',
        specCode: 'SPEC-AMS-2759',
        revisionNumber: 1
      },
      equipmentAssignment: {
        furnaceId: null,
        furnaceCode: null,
        locationBay: null,
        pyrometryClass: null
      },
      operatorAssignment: {
        operatorId: null,
        operatorCode: null,
        operatorName: null,
        shift: null
      },
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

  const mockQualifiedOperator = {
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

  describe('POST /api/v1/production-jobs/:id/assign-operator (Worker Allocation)', () => {
    it('should assign a qualified operator and record assignment history', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);
      const job = createMockJobDocument();

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(workforceCapacityRepository, 'findEmployeeById').mockResolvedValue(mockQualifiedOperator as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/assign-operator`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          operatorId: 'emp_op_01',
          shift: 'SHIFT_1_MORNING',
          reason: 'Primary shift allocation'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(job.operatorAssignment.operatorId).toBe('emp_op_01');
      expect(job.operatorAssignment.operatorCode).toBe('EMP-OP-01');
      expect(job.assignmentHistory).toHaveLength(1);
      expect(job.assignmentHistory[0].action).toBe('ASSIGN');
      expect(job.assignmentHistory[0].resourceType).toBe('OPERATOR');
    });

    it('should reject operator assignment if operator lacks certified skill for recipe process', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);
      const job = createMockJobDocument();

      const unqualifiedOp = {
        ...mockQualifiedOperator,
        skills: [] // Missing CARBURIZING_OPERATION skill!
      };

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(workforceCapacityRepository, 'findEmployeeById').mockResolvedValue(unqualifiedOp as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/assign-operator`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ operatorId: 'emp_op_01' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('lacks certified, non-expired qualification');
    });

    it('should reject operator assignment if operator is on approved leave during job window', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);
      const job = createMockJobDocument();

      const opOnLeave = {
        ...mockQualifiedOperator,
        approvedLeaves: [
          {
            startDate: new Date('2026-09-01T00:00:00.000Z'),
            endDate: new Date('2026-09-05T23:59:59.000Z'),
            leaveType: 'VACATION'
          }
        ]
      };

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(workforceCapacityRepository, 'findEmployeeById').mockResolvedValue(opOnLeave as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/assign-operator`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ operatorId: 'emp_op_01' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('has approved leave overlapping');
    });

    it('should reallocate worker and record REALLOCATE in assignment history', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);
      const job = createMockJobDocument({
        operatorAssignment: {
          operatorId: 'emp_prev_01',
          operatorCode: 'EMP-PREV-01',
          operatorName: 'Old Operator',
          shift: 'SHIFT_1_MORNING'
        }
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(workforceCapacityRepository, 'findEmployeeById').mockResolvedValue(mockQualifiedOperator as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/assign-operator`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ operatorId: 'emp_op_01', reason: 'Shift rotation' });

      expect(res.status).toBe(200);
      expect(job.assignmentHistory).toHaveLength(1);
      expect(job.assignmentHistory[0].action).toBe('REALLOCATE');
      expect(job.assignmentHistory[0].previousResourceId).toBe('emp_prev_01');
      expect(job.assignmentHistory[0].newResourceId).toBe('emp_op_01');
    });

    it('should remove operator and record REMOVE in assignment history', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);
      const job = createMockJobDocument({
        operatorAssignment: {
          operatorId: 'emp_op_01',
          operatorCode: 'EMP-OP-01',
          operatorName: 'Marcus Vance',
          shift: 'SHIFT_1_MORNING'
        }
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/remove-operator`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ reason: 'Replaced with unmanned automation cycle' });

      expect(res.status).toBe(200);
      expect(job.operatorAssignment.operatorId).toBeNull();
      expect(job.assignmentHistory).toHaveLength(1);
      expect(job.assignmentHistory[0].action).toBe('REMOVE');
    });

    it('should block removing operator while job is actively IN_PROGRESS', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);
      const job = createMockJobDocument({
        status: 'IN_PROGRESS',
        operatorAssignment: { operatorId: 'emp_op_01', operatorCode: 'EMP-OP-01' }
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/remove-operator`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ reason: 'Premature operator removal' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('is actively IN_PROGRESS');
    });
  });

  describe('POST /api/v1/production-jobs/:id/assign-furnace (Equipment Allocation)', () => {
    it('should assign a compatible operational furnace, transition status to SCHEDULED, and log history', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);
      const job = createMockJobDocument({ status: 'APPROVED' });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(furnaceCapacityRepository, 'findFurnaceById').mockResolvedValue(mockFurnace as any);
      jest.spyOn(productionJobRepository, 'findConflictingJobs').mockResolvedValue([]);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/assign-furnace`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          furnaceId: 'furnace_sqf_01',
          reason: 'Scheduled on SQF-01 for 8-hour carburizing cycle'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(job.equipmentAssignment.furnaceId).toBe('furnace_sqf_01');
      expect(job.equipmentAssignment.furnaceCode).toBe('FURNACE-SQF-01');
      expect(job.status).toBe('SCHEDULED');
      expect(job.assignmentHistory).toHaveLength(1);
      expect(job.assignmentHistory[0].action).toBe('ASSIGN');
      expect(job.assignmentHistory[0].resourceType).toBe('FURNACE');
    });

    it('should reject furnace assignment if furnace status is not OPERATIONAL', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);
      const job = createMockJobDocument();

      const breakdownFurnace = {
        ...mockFurnace,
        status: 'BREAKDOWN'
      };

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(furnaceCapacityRepository, 'findFurnaceById').mockResolvedValue(breakdownFurnace as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/assign-furnace`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ furnaceId: 'furnace_sqf_01' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('is not available for assignment');
    });

    it('should reject furnace assignment if furnace does not support recipe process family', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);
      const job = createMockJobDocument();

      const incompatibleFurnace = {
        ...mockFurnace,
        processCapabilities: { supportedProcessFamilies: ['ANNEALING'] } // Does not support CARBURIZING!
      };

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(furnaceCapacityRepository, 'findFurnaceById').mockResolvedValue(incompatibleFurnace as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/assign-furnace`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ furnaceId: 'furnace_sqf_01' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('does not support process family');
    });

    it('should reject furnace assignment if recipe temperature exceeds furnace max limit', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);
      const job = createMockJobDocument({
        recipeSnapshot: {
          processFamily: 'CARBURIZING',
          stages: [{ stageName: 'High Temp Soak', targetTemperatureC: 1100 }] // 1100C > 1050C max!
        }
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(furnaceCapacityRepository, 'findFurnaceById').mockResolvedValue(mockFurnace as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/assign-furnace`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ furnaceId: 'furnace_sqf_01' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('outside furnace');
    });

    it('should reject furnace assignment if there is a schedule collision with another job', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);
      const job = createMockJobDocument();

      const conflictingJob = {
        id: 'job_other_099',
        jobNumber: 'JOB-202608-0099'
      };

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(furnaceCapacityRepository, 'findFurnaceById').mockResolvedValue(mockFurnace as any);
      jest.spyOn(productionJobRepository, 'findConflictingJobs').mockResolvedValue([conflictingJob as any]);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/assign-furnace`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ furnaceId: 'furnace_sqf_01' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Schedule conflict');
      expect(res.body.message).toContain('JOB-202608-0099');
    });

    it('should remove furnace and revert status from SCHEDULED to APPROVED', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);
      const job = createMockJobDocument({
        status: 'SCHEDULED',
        equipmentAssignment: {
          furnaceId: 'furnace_sqf_01',
          furnaceCode: 'FURNACE-SQF-01',
          locationBay: 'BAY_A',
          pyrometryClass: 'CLASS_2'
        }
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/remove-furnace`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ reason: 'Furnace undergoing emergency maintenance' });

      expect(res.status).toBe(200);
      expect(job.equipmentAssignment.furnaceId).toBeNull();
      expect(job.status).toBe('APPROVED');
      expect(job.assignmentHistory).toHaveLength(1);
      expect(job.assignmentHistory[0].action).toBe('REMOVE');
    });
  });

  describe('RBAC Permission Gates', () => {
    it('should block unauthorized user lacking PRODUCTION_JOB_UPDATE from assigning resources', async () => {
      const techToken = generateToken('usr_tech', ['MAINTENANCE_TECH']);

      const res = await request(app)
        .post('/api/v1/production-jobs/job_001/assign-operator')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${techToken}`)
        .send({ operatorId: 'emp_001' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access Denied');
    });
  });
});
