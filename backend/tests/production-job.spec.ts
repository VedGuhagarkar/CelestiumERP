import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { customerRepository } from '../src/modules/customer/customer.repository.js';
import { itemRepository } from '../src/modules/item/item.repository.js';
import { recipeRepository } from '../src/modules/recipe/recipe.repository.js';
import { specificationRepository } from '../src/modules/specification/specification.repository.js';
import { furnaceCapacityRepository } from '../src/modules/furnace-capacity/furnace-capacity.repository.js';
import { workforceCapacityRepository } from '../src/modules/workforce-capacity/workforce-capacity.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { purchaseOrderRepository } from '../src/modules/purchase-order/purchase-order.repository.js';
import { grnRepository } from '../src/modules/grn/grn.repository.js';

describe('Production Job Domain & 12-Stage Lifecycle State Machine', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_001';

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const mockCustomer = {
    id: 'cust_001',
    customerCode: 'CUST-AERO-001',
    companyName: 'Apex Aerospace Components',
    status: 'ACTIVE'
  };

  const mockItem = {
    id: 'item_4140',
    itemCode: 'MAT-4140-BAR',
    itemName: 'AISI 4140 Round Bar',
    materialGrade: 'AISI 4140',
    uom: 'KG',
    status: 'ACTIVE'
  };

  const mockRecipe = {
    id: 'rec_001',
    recipeCode: 'REC-CARB-4140',
    revision: 1,
    name: 'Carburizing Cycle 920C',
    processFamily: 'CARBURIZING',
    status: 'APPROVED',
    applicableMaterialGrades: ['AISI 4140'],
    stages: [
      {
        sequence: 1,
        stageName: 'Carburize Soak',
        targetTemperatureC: 920,
        temperatureToleranceMinusC: 5,
        temperatureTolerancePlusC: 5,
        soakTimeMinutes: 240,
        soakCriteria: 'LOAD_THERMOCOUPLE_REACHED'
      }
    ],
    metallurgicalTargets: {
      targetHardnessMin: 58,
      targetHardnessMax: 62,
      hardnessScale: 'HRC',
      effectiveCaseDepthMinMm: 0.8,
      effectiveCaseDepthMaxMm: 1.2
    },
    machineRequirements: {
      compatibleFurnaceTypes: ['SEALED_QUENCH_FURNACE'],
      minimumFurnaceClass: 'CLASS_2',
      maxOperatingTempRequiredC: 1000
    }
  };

  const mockSpecification = {
    id: 'spec_001',
    specCode: 'SPEC-AMS-2759',
    revision: 1,
    title: 'Aerospace Heat Treatment Specification',
    status: 'APPROVED',
    customerCode: 'CUST-AERO-001',
    surfaceHardness: { min: 58, max: 62, scale: 'HRC' },
    caseDepth: { effectiveCaseDepthMinMm: 0.8, effectiveCaseDepthMaxMm: 1.2 },
    customerAcceptance: { samplingPlan: 'LEVEL_II', cocRequired: true }
  };

  const createMockJobDocument = (overrides: any = {}) => {
    const doc: any = {
      id: 'job_001',
      jobNumber: 'JOB-202608-0001',
      tenantId: testTenant,
      customer: {
        customerId: 'cust_001',
        customerCode: 'CUST-AERO-001',
        customerName: 'Apex Aerospace Components'
      },
      item: {
        itemId: 'item_4140',
        itemCode: 'MAT-4140-BAR',
        itemName: 'AISI 4140 Round Bar',
        materialGrade: 'AISI 4140',
        uom: 'KG'
      },
      quantity: {
        targetQuantity: 500,
        loadedQuantity: 0,
        completedQuantity: 0,
        scrappedQuantity: 0
      },
      status: 'DRAFT',
      priority: 'NORMAL',
      recipeSnapshot: {
        recipeId: 'rec_001',
        recipeCode: 'REC-CARB-4140',
        revisionNumber: 1,
        stages: mockRecipe.stages
      },
      specificationSnapshot: {
        specificationId: 'spec_001',
        specCode: 'SPEC-AMS-2759',
        revisionNumber: 1,
        surfaceHardness: mockSpecification.surfaceHardness
      },
      materialAllocations: [],
      equipmentAssignment: {
        furnaceId: 'furnace_001',
        furnaceCode: 'FURNACE-SQF-01'
      },
      operatorAssignment: {
        operatorId: 'emp_001',
        operatorCode: 'EMP-001',
        operatorName: 'Marcus Vance'
      },
      timeline: {
        plannedStartDate: new Date('2026-09-01T08:00:00.000Z'),
        targetCompletionDate: new Date('2026-09-01T16:00:00.000Z'),
        actualStartDate: null,
        actualCompletionDate: null
      },
      transitionHistory: [],
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
    jest.spyOn(productionJobRepository, 'findByGrnId').mockResolvedValue([] as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/v1/production-jobs (Direct Job Creation)', () => {
    const mockPo = {
      id: 'po_001',
      _id: 'po_001',
      poNumber: 'PO-2026-0001',
      supplierName: 'Apex Aerospace Components',
      status: 'RECEIVED'
    };

    const mockGrn = {
      id: 'grn_001',
      _id: 'grn_001',
      grnNumber: 'GRN-2026-0001',
      poId: 'po_001',
      poNumber: 'PO-2026-0001',
      status: 'AVAILABLE_FOR_PLANNING',
      items: [
        {
          itemId: 'item_4140',
          itemCode: 'MAT-4140-BAR',
          itemName: 'AISI 4140 Round Bar',
          materialGrade: 'AISI 4140',
          acceptedQuantity: 500,
          recipeId: 'rec_001',
          uom: 'KG'
        }
      ]
    };

    it('should create a direct production job with frozen recipe and spec snapshots', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);
      const auditSpy = jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValue(mockPo as any);
      jest.spyOn(grnRepository, 'findGrnById').mockResolvedValue(mockGrn as any);
      jest.spyOn(grnRepository, 'findUnitsByGrnId').mockResolvedValue([] as any);
      jest.spyOn(customerRepository, 'findById').mockResolvedValue(mockCustomer as any);
      jest.spyOn(itemRepository, 'findById').mockResolvedValue(mockItem as any);
      jest.spyOn(recipeRepository, 'findById').mockResolvedValue(mockRecipe as any);
      jest.spyOn(specificationRepository, 'findById').mockResolvedValue(mockSpecification as any);
      jest.spyOn(furnaceCapacityRepository, 'findFurnaceById').mockResolvedValue({
        id: 'furnace_001',
        furnaceCode: 'FURNACE-SQF-01',
        locationBay: 'BAY_A',
        thermalCapabilities: { pyrometryClass: 'CLASS_2' }
      } as any);
      jest.spyOn(workforceCapacityRepository, 'findEmployeeById').mockResolvedValue({
        id: 'emp_001',
        employeeCode: 'EMP-001',
        fullName: 'Marcus Vance',
        defaultShift: 'SHIFT_1_MORNING'
      } as any);

      jest.spyOn(productionJobRepository, 'generateNextBatchOrderNumber').mockResolvedValue('BO-202608-0001');
      jest.spyOn(productionJobRepository, 'generateNextJobNumber').mockResolvedValue('BO-202608-0001');

      const mockCreated = createMockJobDocument({
        status: 'WAITING_FOR_PRODUCTION',
        boNumber: 'BO-202608-0001',
        jobNumber: 'BO-202608-0001',
        poId: 'po_001',
        grnId: 'grn_001',
        transitionHistory: [{ fromStatus: 'WAITING_FOR_PRODUCTION', toStatus: 'WAITING_FOR_PRODUCTION', reason: 'Direct Job Initiation' }]
      });
      jest.spyOn(productionJobRepository, 'create').mockResolvedValue(mockCreated as any);

      const res = await request(app)
        .post('/api/v1/production-jobs')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: 'po_001',
          grnId: 'grn_001',
          customerId: 'cust_001',
          itemId: 'item_4140',
          recipeId: 'rec_001',
          specificationId: 'spec_001',
          targetQuantity: 500,
          weight: 250,
          priority: 'NORMAL',
          plannedStartDate: '2026-09-01T08:00:00.000Z',
          targetCompletionDate: '2026-09-01T16:00:00.000Z',
          assignedFurnaceId: 'furnace_001',
          assignedOperatorId: 'emp_001'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('WAITING_FOR_PRODUCTION');
      expect(auditSpy).toHaveBeenCalled();
    });

    it('should reject direct job creation if recipe is unapproved', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);

      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValue(mockPo as any);
      jest.spyOn(grnRepository, 'findGrnById').mockResolvedValue(mockGrn as any);
      jest.spyOn(customerRepository, 'findById').mockResolvedValue(mockCustomer as any);
      jest.spyOn(itemRepository, 'findById').mockResolvedValue(mockItem as any);
      jest.spyOn(recipeRepository, 'findById').mockResolvedValue({
        ...mockRecipe,
        status: 'DRAFT' // Unapproved
      } as any);
      jest.spyOn(specificationRepository, 'findById').mockResolvedValue(mockSpecification as any);

      const res = await request(app)
        .post('/api/v1/production-jobs')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          poId: 'po_001',
          grnId: 'grn_001',
          customerId: 'cust_001',
          itemId: 'item_4140',
          recipeId: 'rec_001',
          specificationId: 'spec_001',
          targetQuantity: 500,
          weight: 250,
          plannedStartDate: '2026-09-01T08:00:00.000Z',
          targetCompletionDate: '2026-09-01T16:00:00.000Z'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('must be in APPROVED or ACTIVE status');
    });
  });

  describe('POST /api/v1/production-jobs/:id/transition (Lifecycle State Machine)', () => {
    it('should advance job through full 12-stage lifecycle and record timestamped transition history', async () => {
      const operatorToken = generateToken('usr_op', ['PLANT_MANAGER']);
      const auditSpy = jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const job = createMockJobDocument({ status: 'DRAFT' });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      // 1. DRAFT -> PENDING_REVIEW
      let res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/transition`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ toStatus: 'PENDING_REVIEW', reason: 'Submitted for metallurgical approval' });
      expect(res.status).toBe(200);
      expect(job.status).toBe('PENDING_REVIEW');
      expect(job.transitionHistory).toHaveLength(1);

      // 2. PENDING_REVIEW -> APPROVED
      res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/transition`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ toStatus: 'APPROVED', reason: 'Approved by Metallurgist' });
      expect(res.status).toBe(200);
      expect(job.status).toBe('APPROVED');

      // 3. APPROVED -> SCHEDULED
      res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/transition`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ toStatus: 'SCHEDULED', reason: 'Assigned to Furnace SQF-01' });
      expect(res.status).toBe(200);
      expect(job.status).toBe('SCHEDULED');

      // 4. SCHEDULED -> IN_PROGRESS
      res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/transition`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ toStatus: 'IN_PROGRESS', reason: 'Furnace loaded and cycle started' });
      expect(res.status).toBe(200);
      expect(job.status).toBe('IN_PROGRESS');
      expect(job.timeline.actualStartDate).toBeDefined();

      // 5. IN_PROGRESS -> PAUSED
      res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/pause`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ reason: 'Temporary atmosphere adjustment', category: 'ATMOSPHERE_LOSS' });
      expect(res.status).toBe(200);
      expect(job.status).toBe('PAUSED');

      // 6. PAUSED -> IN_PROGRESS
      res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/resume`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ actionTaken: 'Atmosphere restored and pressure stabilized' });
      expect(res.status).toBe(200);
      expect(job.status).toBe('IN_PROGRESS');

      // 7. IN_PROGRESS -> QUALITY_CHECK
      job.execution = {
        cycleTimer: { totalRunDurationMinutes: 240, totalDowntimeDurationMinutes: 10 },
        stageProgress: [
          {
            sequence: 1,
            stageName: 'Carburize Soak',
            actualTemperatureC: 920,
            actualDurationMinutes: 240,
            recordedAt: new Date()
          }
        ]
      };
      res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/complete`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ completedQuantity: 500, scrappedQuantity: 0 });
      expect(res.status).toBe(200);
      expect(job.status).toBe('QUALITY_CHECK');

      // 8. QUALITY_CHECK -> STORAGE
      res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/transition`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ toStatus: 'STORAGE', reason: 'Hardness 60 HRC verified, moved to warehouse' });
      expect(res.status).toBe(200);
      expect(job.status).toBe('STORAGE');

      // 9. STORAGE -> READY_FOR_DISPATCH
      res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/transition`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ toStatus: 'READY_FOR_DISPATCH', reason: 'CoC generated & packaging complete' });
      expect(res.status).toBe(200);
      expect(job.status).toBe('READY_FOR_DISPATCH');

      // 10. READY_FOR_DISPATCH -> DISPATCHED
      res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/transition`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ toStatus: 'DISPATCHED', reason: 'Loaded onto logistics carrier' });
      expect(res.status).toBe(200);
      expect(job.status).toBe('DISPATCHED');

      // 11. DISPATCHED -> COMPLETED
      res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/transition`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ toStatus: 'COMPLETED', reason: 'Customer delivery acknowledged' });
      expect(res.status).toBe(200);
      expect(job.status).toBe('COMPLETED');
      expect(job.timeline.actualCompletionDate).toBeDefined();
      expect(job.transitionHistory).toHaveLength(11);
      expect(auditSpy).toHaveBeenCalled();
    });

    it('should reject invalid lifecycle transition jumps with 400 Bad Request', async () => {
      const operatorToken = generateToken('usr_op', ['PLANT_MANAGER']);

      const job = createMockJobDocument({ status: 'DRAFT' });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      // Illegal jump: DRAFT -> COMPLETED
      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/transition`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ toStatus: 'COMPLETED' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid lifecycle transition');
    });
  });

  describe('PATCH /api/v1/production-jobs/:id (Pre-Production Modification Guard)', () => {
    it('should allow modifying job parameters in pre-production states (DRAFT/SCHEDULED)', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);

      const job = createMockJobDocument({ status: 'SCHEDULED', quantity: { targetQuantity: 500 } });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .patch(`/api/v1/production-jobs/${job.id}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ targetQuantity: 600, priority: 'HIGH' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(job.quantity.targetQuantity).toBe(600);
      expect(job.priority).toBe('HIGH');
    });

    it('should block modifying job parameters once IN_PROGRESS', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);

      const job = createMockJobDocument({ status: 'IN_PROGRESS' });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .patch(`/api/v1/production-jobs/${job.id}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ targetQuantity: 800 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Modifications are strictly locked');
    });
  });

  describe('POST /api/v1/production-jobs/:id/cancel (Controlled Cancellation)', () => {
    it('should cancel an active job when provided with mandatory reason', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);

      const job = createMockJobDocument({ status: 'SCHEDULED' });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/cancel`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ reason: 'Customer canceled purchase order PO-9988' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(job.status).toBe('CANCELLED');
      expect(job.cancellationReason).toBe('Customer canceled purchase order PO-9988');
    });

    it('should reject cancelling a COMPLETED job', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);

      const job = createMockJobDocument({ status: 'COMPLETED' });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/cancel`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ reason: 'Attempted retro cancellation' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Cannot cancel a COMPLETED production job');
    });
  });

  describe('GET /api/v1/production-jobs/queue (Prioritized Production Queue)', () => {
    it('should rank AOG_CRITICAL jobs ahead of URGENT, HIGH, and NORMAL priority jobs', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);

      const createQueueJob = (id: string, jobNumber: string, priority: string, dateStr: string) =>
        createMockJobDocument({
          id,
          jobNumber,
          priority,
          status: 'WAITING_FOR_PRODUCTION',
          waitingForProduction: true,
          workflowState: { waitingForProduction: true },
          poId: 'po_01',
          poNumber: 'PO-001',
          grnId: 'grn_01',
          grnNumber: 'GRN-001',
          weightKg: 100,
          quantity: { targetQuantity: 10, loadedQuantity: 10, completedQuantity: 0, scrappedQuantity: 0 },
          recipeSnapshot: { recipeCode: 'REC-01', stages: [] },
          timeline: { targetCompletionDate: new Date(dateStr) },
          processDetails: Array.from({ length: 15 }, (_, i) => ({
            serialNumber: i + 1,
            position: i + 1,
            stageName: `Stage ${i + 1}`,
            process: 'VACUUM_HEAT_TREATMENT'
          }))
        });

      const normalJob = createQueueJob('job_norm', 'JOB-202608-0001', 'NORMAL', '2026-09-02T10:00:00.000Z');
      const aogJob = createQueueJob('job_aog', 'JOB-202608-0002', 'AOG_CRITICAL', '2026-09-05T10:00:00.000Z');
      const highJob = createQueueJob('job_high', 'JOB-202608-0003', 'HIGH', '2026-09-01T10:00:00.000Z');

      jest.spyOn(productionJobRepository, 'findWaitingForProductionQueue').mockResolvedValue([aogJob, highJob, normalJob] as any);
      jest.spyOn(productionJobRepository, 'findActiveQueueJobs').mockResolvedValue([aogJob, highJob, normalJob] as any);

      const res = await request(app)
        .get('/api/v1/production-jobs/queue')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const queue = res.body.data;
      expect(queue).toHaveLength(3);
      // Rank 1: AOG_CRITICAL
      expect(queue[0].priority).toBe('AOG_CRITICAL');
      expect(queue[0].jobNumber).toBe('JOB-202608-0002');
      expect(queue[0].queuePosition).toBe(1);

      // Rank 2: HIGH
      expect(queue[1].priority).toBe('HIGH');
      expect(queue[1].jobNumber).toBe('JOB-202608-0003');

      // Rank 3: NORMAL
      expect(queue[2].priority).toBe('NORMAL');
      expect(queue[2].jobNumber).toBe('JOB-202608-0001');
    });
  });

  describe('RBAC Permission Gates', () => {
    it('should block unauthorized user lacking PRODUCTION_JOB_VIEW from accessing queue', async () => {
      const techToken = generateToken('usr_tech', ['MAINTENANCE_TECH']);

      const res = await request(app)
        .get('/api/v1/production-jobs/queue')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${techToken}`)
        .send();

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access Denied');
    });
  });
});
