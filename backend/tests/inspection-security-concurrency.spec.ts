import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { furnaceCapacityRepository } from '../src/modules/furnace-capacity/furnace-capacity.repository.js';
import { machineRepository } from '../src/modules/machine/machine.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { JobStatus } from '../src/core/constants/status.js';
import { eventBus } from '../src/core/events/domain-event-bus.js';
import { DomainEvents } from '../src/core/constants/events.js';
import { dispatchService } from '../src/modules/dispatch/dispatch.service.js';
import { customerRepository } from '../src/modules/customer/customer.repository.js';
import { finishedGoodsRepository } from '../src/modules/finished-goods/finished-goods.repository.js';
import { ProductionJob, ProductionJobModel } from '../src/modules/production-job/production-job.model.js';

describe('Inspection Phase Prompt 9: Inspection Security, Concurrency and Data Integrity', () => {
  jest.setTimeout(30000);
  const app = createApp();
  const testTenant = 'tenant_inspect_sec_p9_001';

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const createMockJobDocument = (overrides: any = {}) => {
    const doc: any = {
      _id: overrides._id || 'bo_inspect_sec_001',
      id: overrides.id || overrides._id || 'bo_inspect_sec_001',
      jobNumber: overrides.jobNumber || 'BO-202609-0909',
      boNumber: overrides.boNumber || overrides.jobNumber || 'BO-202609-0909',
      tenantId: testTenant,
      status: overrides.status || JobStatus.IN_INSPECTION,
      priority: 'HIGH',

      waitingForProduction: overrides.waitingForProduction ?? false,
      inProduction: overrides.inProduction ?? false,
      waitingForInspection: overrides.waitingForInspection ?? false,
      inInspection: overrides.inInspection ?? true,
      waitingForDispatch: overrides.waitingForDispatch ?? false,
      dispatched: overrides.dispatched ?? false,
      inspection: overrides.inspection ?? false,

      workflowState: {
        waitingForProduction: overrides.workflowState?.waitingForProduction ?? (overrides.waitingForProduction ?? false),
        inProduction: overrides.workflowState?.inProduction ?? (overrides.inProduction ?? false),
        waitingForInspection: overrides.workflowState?.waitingForInspection ?? (overrides.waitingForInspection ?? false),
        inInspection: overrides.workflowState?.inInspection ?? (overrides.inInspection ?? true),
        waitingForDispatch: overrides.workflowState?.waitingForDispatch ?? (overrides.waitingForDispatch ?? false),
        dispatched: overrides.workflowState?.dispatched ?? (overrides.dispatched ?? false),
        inspection: overrides.workflowState?.inspection ?? (overrides.inspection ?? false)
      },

      claimedBy: overrides.claimedBy !== undefined ? overrides.claimedBy : 'usr_inspector_alpha',
      claimedAt: overrides.claimedAt !== undefined ? overrides.claimedAt : (overrides.claimedBy === null ? null : new Date()),
      claimedByEmail: overrides.claimedByEmail !== undefined ? overrides.claimedByEmail : (overrides.claimedBy === null ? null : 'usr_inspector_alpha@factory.com'),
      claimedByRole: overrides.claimedByRole !== undefined ? overrides.claimedByRole : (overrides.claimedBy === null ? null : 'QC_INSPECTOR'),

      customer: {
        customerId: 'cust_aero_01',
        customerCode: 'CUST-AERO-01',
        customerName: 'Aero Dynamics Global Inc.'
      },

      item: {
        itemId: 'item_pinion_01',
        itemCode: 'PART-PINION-4340',
        itemName: 'Turbine Pinion Gear 4340',
        materialGrade: 'AISI 4340 Alloy Steel',
        drawingNumber: 'DWG-AERO-PIN-01',
        uom: 'PCS'
      },

      recipeSnapshot: {
        recipeId: 'rec_carburize_4340',
        recipeCode: 'REC-CARB-4340',
        name: 'Carburize, Quench & Temper Case Hardening',
        revisionNumber: 3,
        processFamily: 'ATMOSPHERE_HEAT_TREATMENT',
        metallurgicalTargets: {
          minHardness: 58,
          maxHardness: 62,
          surfaceHardnessScale: 'HRC',
          effectiveCaseDepthMinMm: 0.8,
          effectiveCaseDepthMaxMm: 1.2
        },
        stages: [
          {
            sequence: 1,
            stageName: 'Carburize Soak',
            targetTemperatureC: 925,
            soakTimeMinutes: 240,
            atmosphereDetails: '0.90% Carbon Potential'
          },
          {
            sequence: 2,
            stageName: 'Oil Quench',
            targetTemperatureC: 60,
            soakTimeMinutes: 30,
            quenchMedia: 'Accelerated Quench Oil'
          }
        ]
      },

      specificationSnapshot: {
        surfaceHardness: { min: 58, max: 62, scale: 'HRC' },
        caseDepth: { minMm: 0.8, maxMm: 1.2 }
      },

      quantity: {
        targetQuantity: overrides.targetQuantity ?? 100,
        allocatedQuantity: 100,
        loadedQuantity: overrides.loadedQuantity ?? 100,
        completedQuantity: overrides.completedQuantity ?? 0,
        scrappedQuantity: overrides.scrappedQuantity ?? 0
      },

      weightKg: 150,

      equipmentAssignment: {
        furnaceId: 'furnace_integral_01',
        furnaceCode: 'FURNACE-INT-01',
        locationBay: 'Bay-3'
      },

      execution: {
        furnaceCharge: {
          furnaceId: 'furnace_integral_01',
          furnaceCode: 'FURNACE-INT-01',
          chargeNumber: 'CHG-202609-0099',
          loadedPieces: 100,
          loadedWeightKg: 150,
          chargeDate: new Date('2026-09-14T08:00:00Z')
        },
        operatorAssignment: {
          operatorId: 'usr_op_marcus',
          operatorName: 'Marcus Vance',
          shiftId: 'SHIFT-MORNING'
        },
        stageProgress: [
          { stageSequence: 1, stageName: 'Carburize Soak', status: 'COMPLETED', completedAt: new Date() },
          { stageSequence: 2, stageName: 'Oil Quench', status: 'COMPLETED', completedAt: new Date() }
        ],
        inspectionData: {
          furnaceId: 'furnace_integral_01',
          furnaceCode: 'FURNACE-INT-01',
          minHardness: 58,
          maxHardness: 62,
          scale: 'HRC',
          measuredAverage: 60.5,
          effectiveCaseDepthMm: 1.0,
          quantityReceived: 100,
          quantityDelivered: 100,
          quantityRejected: 0,
          isHardnessCompliant: true,
          isCaseDepthCompliant: true,
          testPoints: [
            { pointIdentifier: 'P1', measuredValue: 60.5, location: 'Surface' },
            { pointIdentifier: 'P2', measuredValue: 61.0, location: 'Surface' }
          ],
          disposition: 'PENDING'
        }
      },

      processDetails: Array.from({ length: 15 }, (_, i) => ({
        serialNumber: i + 1,
        processNumber: i + 1,
        process: `Inspection Test Position #${i + 1}`,
        status: 'PASSED',
        actualHardness: 60.5,
        isCompliant: true,
        verifiedBy: 'usr_inspector_alpha',
        completedAt: new Date().toISOString()
      })),

      save: jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      }),
      toJSON: jest.fn().mockImplementation(function (this: any) {
        return { ...this };
      })
    };

    return doc;
  };

  beforeEach(() => {
    jest.restoreAllMocks();

    // Setup Mock RBAC roles
    jest.spyOn(roleRepository, 'seedDefaultRolesForTenant').mockResolvedValue([] as any);
    jest.spyOn(roleRepository, 'findRolesByCodes').mockImplementation(async (_tenantId, codes) => {
      return DEFAULT_FACTORY_ROLES.filter((r) => codes.includes(r.code)).map((r) => ({
        ...r,
        id: `role_${r.code}`,
        status: 'active'
      })) as any;
    });

    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);
    jest.spyOn(eventBus, 'publish').mockImplementation(() => {});

    // Mock equipment master repository
    jest.spyOn(furnaceCapacityRepository, 'findFurnaceById').mockImplementation((tenantId, id) => {
      if (id === 'furnace_integral_01' || id === 'valid_furnace_master_id') {
        return Promise.resolve({
          id,
          furnaceCode: 'FURNACE-INT-01',
          thermalCapabilities: { pyrometryClass: 'CLASS_2' }
        } as any);
      }
      return Promise.resolve(null);
    });

    jest.spyOn(furnaceCapacityRepository, 'findFurnaceByCode').mockImplementation((tenantId, code) => {
      if (code === 'FURNACE-INT-01') {
        return Promise.resolve({
          id: 'furnace_integral_01',
          furnaceCode: 'FURNACE-INT-01',
          thermalCapabilities: { pyrometryClass: 'CLASS_2' }
        } as any);
      }
      return Promise.resolve(null);
    });

    jest.spyOn(machineRepository, 'findById').mockResolvedValue(null);
    jest.spyOn(machineRepository, 'findByCode').mockResolvedValue(null);
  });

  // ===========================================================================
  // 1. PERMISSION ENFORCEMENT
  // ===========================================================================
  describe('1. Permission Enforcement', () => {
    const operatorToken = generateToken('usr_operator_dan', ['OPERATOR']);
    const dispatchToken = generateToken('usr_dispatch_dan', ['DISPATCH_COORDINATOR']);
    const inspectorToken = generateToken('usr_inspector_alpha', ['QC_INSPECTOR']);

    it('1.1 should reject an unauthorized user (OPERATOR) attempting to take a BO for inspection with 403 Forbidden', async () => {
      const mockJob = createMockJobDocument({
        status: JobStatus.WAITING_FOR_INSPECTION,
        waitingForInspection: true,
        inInspection: false,
        claimedBy: null
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_sec_001/take-for-inspection')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ notes: 'Operator trying to claim inspection' });

      expect(res.status).toBe(403);
    });

    it('1.2 should reject an unauthorized user (DISPATCH) attempting to record inspection test data with 403 Forbidden', async () => {
      const mockJob = createMockJobDocument();
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_sec_001/inspection-data')
        .set('Authorization', `Bearer ${dispatchToken}`)
        .send({ measuredAverage: 60 });

      expect(res.status).toBe(403);
    });

    it('1.3 should reject an unauthorized user (OPERATOR) attempting to verify a process row with 403 Forbidden', async () => {
      const mockJob = createMockJobDocument();
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_sec_001/verify-process-row')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ serialNumber: 1, actualHardness: 60 });

      expect(res.status).toBe(403);
    });

    it('1.4 should reject an unauthorized user (DISPATCH) attempting to approve inspection with 403 Forbidden', async () => {
      const mockJob = createMockJobDocument();
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_sec_001/approve-dispatch')
        .set('Authorization', `Bearer ${dispatchToken}`)
        .send({ furnaceCode: 'FURNACE-INT-01', measuredAverage: 60, effectiveCaseDepthMm: 1.0, quantityReceived: 100, quantityDelivered: 100 });

      expect(res.status).toBe(403);
    });

    it('1.5 should reject an unauthorized user (OPERATOR) attempting to fail inspection with 403 Forbidden', async () => {
      const mockJob = createMockJobDocument();
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_sec_001/fail-inspection')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ defectCategory: 'HARDNESS_OUT_OF_SPEC', defectReason: 'Hardness failed tolerance' });

      expect(res.status).toBe(403);
    });

    it('1.6 should ignore client-submitted role in payload and rely strictly on authenticated JWT permissions', async () => {
      const mockJob = createMockJobDocument({
        status: JobStatus.WAITING_FOR_INSPECTION,
        waitingForInspection: true,
        inInspection: false,
        claimedBy: null
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      // Operator submits payload claiming to be QC_INSPECTOR
      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_sec_001/take-for-inspection')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ role: 'QC_INSPECTOR', userRole: 'QC_INSPECTOR', permissions: ['quality:inspection:record'] });

      expect(res.status).toBe(403);
    });

    it('1.7 should permit an authorized QC_INSPECTOR to take a BO for inspection', async () => {
      const mockJob = createMockJobDocument({
        status: JobStatus.WAITING_FOR_INSPECTION,
        waitingForInspection: true,
        inInspection: false,
        claimedBy: null
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);
      jest.spyOn(productionJobRepository, 'atomicTakeForInspection').mockResolvedValue({
        ...mockJob,
        status: JobStatus.IN_INSPECTION,
        inInspection: true,
        waitingForInspection: false
      } as any);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_sec_001/take-for-inspection')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({ notes: 'Certified inspector claiming BO' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ===========================================================================
  // 2. STATE ENFORCEMENT
  // ===========================================================================
  describe('2. State Enforcement', () => {
    const inspectorToken = generateToken('usr_inspector_alpha', ['QC_INSPECTOR']);
    const plantManagerToken = generateToken('usr_plant_mgr', ['PLANT_MANAGER']);

    it('2.1 should reject taking a BO that is currently in WAITING_FOR_PRODUCTION with 400 Bad Request', async () => {
      const mockJob = createMockJobDocument({
        status: JobStatus.WAITING_FOR_PRODUCTION,
        waitingForProduction: true,
        waitingForInspection: false,
        inInspection: false,
        claimedBy: null
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_sec_001/take-for-inspection')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not waiting for inspection/i);
    });

    it('2.2 should reject taking a BO that is currently in IN_PRODUCTION with 400 Bad Request', async () => {
      const mockJob = createMockJobDocument({
        status: JobStatus.IN_PRODUCTION,
        inProduction: true,
        waitingForInspection: false,
        inInspection: false,
        claimedBy: null
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_sec_001/take-for-inspection')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not waiting for inspection/i);
    });

    it('2.3 should reject taking a BO that is already in WAITING_FOR_DISPATCH with 400 Bad Request', async () => {
      const mockJob = createMockJobDocument({
        status: JobStatus.WAITING_FOR_DISPATCH,
        waitingForDispatch: true,
        waitingForInspection: false,
        inInspection: false,
        claimedBy: null
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_sec_001/take-for-inspection')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/completed\/dispatched\/quarantined/i);
    });

    it('2.4 should reject taking a BO that is already quarantined in INSPECTION with 400 Bad Request', async () => {
      const mockJob = createMockJobDocument({
        status: 'INSPECTION',
        inspection: true,
        waitingForInspection: false,
        inInspection: false,
        claimedBy: null
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_sec_001/take-for-inspection')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/completed\/dispatched\/quarantined/i);
    });

    it('2.5 should reject recording inspection data on a BO in WAITING_FOR_INSPECTION (not taken yet) with 400 Bad Request', async () => {
      const mockJob = createMockJobDocument({
        status: JobStatus.WAITING_FOR_INSPECTION,
        waitingForInspection: true,
        inInspection: false,
        claimedBy: null
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_sec_001/inspection-data')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({ measuredAverage: 60 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not in active inspection/i);
    });

    it('2.6 should reject approving for dispatch on a BO in WAITING_FOR_INSPECTION without claiming it with 400 Bad Request', async () => {
      const mockJob = createMockJobDocument({
        status: JobStatus.WAITING_FOR_INSPECTION,
        waitingForInspection: true,
        inInspection: false,
        claimedBy: null
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_sec_001/approve-dispatch')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({ furnaceCode: 'FURNACE-INT-01', measuredAverage: 60, effectiveCaseDepthMm: 1.0, quantityReceived: 100, quantityDelivered: 100 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not in active inspection/i);
    });

    it('2.7 should reject direct skipping from WAITING_FOR_INSPECTION to DISPATCHED via generic /transition endpoint with 400 Bad Request', async () => {
      const mockJob = createMockJobDocument({
        status: JobStatus.WAITING_FOR_INSPECTION,
        waitingForInspection: true,
        inInspection: false,
        claimedBy: null
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_sec_001/transition')
        .set('Authorization', `Bearer ${plantManagerToken}`)
        .send({ toStatus: 'DISPATCHED', reason: 'Attempting to skip inspection and dispatch directly' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/State Transition Authority Violation/i);
    });
  });

  // ===========================================================================
  // 3. EXCLUSIVE CLAIM & CONCURRENCY
  // ===========================================================================
  describe('3. Exclusive Claim & Concurrency', () => {
    const inspectorAlphaToken = generateToken('usr_inspector_alpha', ['QC_INSPECTOR']);
    const inspectorBetaToken = generateToken('usr_inspector_beta', ['QC_INSPECTOR']);
    const qualityLeadToken = generateToken('usr_qc_lead', ['METALLURGIST']);

    it('3.1 should reject taking an already claimed BO with 409 Conflict', async () => {
      const mockJob = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        inInspection: true,
        claimedBy: 'usr_inspector_alpha'
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_sec_001/take-for-inspection')
        .set('Authorization', `Bearer ${inspectorBetaToken}`)
        .send({ notes: 'Inspector Beta trying to claim already claimed BO' });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already in inspection/i);
    });

    it('3.2 should handle race conditions: when atomicTakeForInspection returns null, second concurrent inspector receives 409 Conflict', async () => {
      const mockJob = createMockJobDocument({
        status: JobStatus.WAITING_FOR_INSPECTION,
        waitingForInspection: true,
        inInspection: false,
        claimedBy: null
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);
      // Simulate MongoDB conditional update collision (first won, second returns null)
      jest.spyOn(productionJobRepository, 'atomicTakeForInspection').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_sec_001/take-for-inspection')
        .set('Authorization', `Bearer ${inspectorBetaToken}`)
        .send({ notes: 'Concurrent claim collision' });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already claimed by another inspector/i);
    });

    it('3.3 should reject a competing inspector from editing an active inspection session claimed by another inspector with 403 Forbidden', async () => {
      const mockJob = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        inInspection: true,
        claimedBy: 'usr_inspector_alpha'
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_sec_001/inspection-data')
        .set('Authorization', `Bearer ${inspectorBetaToken}`)
        .send({ measuredAverage: 60 });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Inspection Ownership Violation/i);
    });

    it('3.4 should permit a supervisory role (QUALITY_LEAD) to override and edit an active inspection session claimed by another inspector', async () => {
      const mockJob = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        inInspection: true,
        claimedBy: 'usr_inspector_alpha'
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_sec_001/inspection-data')
        .set('Authorization', `Bearer ${qualityLeadToken}`)
        .send({ measuredAverage: 60.5 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ===========================================================================
  // 4. DUPLICATE REQUESTS & IDEMPOTENCY
  // ===========================================================================
  describe('4. Duplicate Requests & Idempotency', () => {
    const inspectorToken = generateToken('usr_inspector_alpha', ['QC_INSPECTOR']);

    it('4.1 should reject duplicate approval on an already approved BO in WAITING_FOR_DISPATCH with 400 Bad Request or 409 Conflict', async () => {
      const mockJob = createMockJobDocument({
        status: JobStatus.WAITING_FOR_DISPATCH,
        waitingForDispatch: true,
        inInspection: false
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_sec_001/approve-dispatch')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({ furnaceCode: 'FURNACE-INT-01', measuredAverage: 60, effectiveCaseDepthMm: 1.0, quantityReceived: 100, quantityDelivered: 100 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not in active inspection/i);
    });

    it('4.2 should reject duplicate failure on an already quarantined BO in INSPECTION with 400 Bad Request or 409 Conflict', async () => {
      const mockJob = createMockJobDocument({
        status: 'INSPECTION',
        inspection: true,
        inInspection: false
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_sec_001/fail-inspection')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({ defectCategory: 'HARDNESS_OUT_OF_SPEC', defectReason: 'Repeated failure request' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not in active inspection/i);
    });

    it('4.3 should reject simultaneous atomic approval collision with 409 Conflict when atomicApproveForDispatch returns null', async () => {
      const mockJob = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        inInspection: true,
        claimedBy: 'usr_inspector_alpha'
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);
      jest.spyOn(productionJobRepository, 'atomicApproveForDispatch').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_sec_001/approve-dispatch')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({
          furnaceCode: 'FURNACE-INT-01',
          minHardness: 58,
          maxHardness: 62,
          measuredAverage: 60,
          effectiveCaseDepthMm: 1.0,
          quantityReceived: 100,
          quantityDelivered: 100
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/Approval Conflict/i);
    });
  });

  // ===========================================================================
  // 5. STALE SESSIONS
  // ===========================================================================
  describe('5. Stale Sessions', () => {
    const inspectorToken = generateToken('usr_inspector_alpha', ['QC_INSPECTOR']);

    it('5.1 should reject inspection data save from a stale session on an approved BO in WAITING_FOR_DISPATCH with 400 Bad Request', async () => {
      const mockJob = createMockJobDocument({
        status: JobStatus.WAITING_FOR_DISPATCH,
        waitingForDispatch: true,
        inInspection: false
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_sec_001/inspection-data')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({ measuredAverage: 61 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not in active inspection/i);
    });

    it('5.2 should reject inspection data save from a stale session on a quarantined BO in INSPECTION with 400 Bad Request', async () => {
      const mockJob = createMockJobDocument({
        status: 'INSPECTION',
        inspection: true,
        inInspection: false
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_sec_001/inspection-data')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({ measuredAverage: 61 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not in active inspection/i);
    });

    it('5.3 should reject process row verification from a stale session on a DISPATCHED BO with 400 Bad Request', async () => {
      const mockJob = createMockJobDocument({
        status: JobStatus.DISPATCHED,
        dispatched: true,
        inInspection: false
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_sec_001/verify-process-row')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({ serialNumber: 1, actualHardness: 60 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not in active inspection/i);
    });
  });

  // ===========================================================================
  // 6. PRODUCTION PROTECTION
  // ===========================================================================
  describe('6. Production Protection', () => {
    const inspectorToken = generateToken('usr_inspector_alpha', ['QC_INSPECTOR']);
    const plantManagerToken = generateToken('usr_plant_mgr', ['PLANT_MANAGER']);

    it('6.1 should reject rewriting furnaceCharge telemetry through inspection endpoints with 400 Bad Request', async () => {
      const mockJob = createMockJobDocument();
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_sec_001/inspection-data')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({
          measuredAverage: 60,
          furnaceCharge: { furnaceCode: 'FURNACE-FAKE', loadedWeightKg: 999 }
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Production Data Protection Violation/i);
    });

    it('6.2 should reject rewriting stageProgress or loadedQuantity through inspection endpoints with 400 Bad Request', async () => {
      const mockJob = createMockJobDocument();
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_sec_001/inspection-data')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({
          measuredAverage: 60,
          loadedQuantity: 50,
          stageProgress: [{ sequence: 1, status: 'REWRITTEN' }]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Production Data Protection Violation/i);
    });

    it('6.3 should reject modifying process details via PUT /:id/process-details while in inspection with 400 Bad Request', async () => {
      const mockJob = createMockJobDocument();
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .put('/api/v1/production-jobs/bo_inspect_sec_001/process-details')
        .set('Authorization', `Bearer ${plantManagerToken}`)
        .send({
          processDetails: [{ serialNumber: 1, process: 'Altered process' }]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Inspection Lock Violation/i);
    });
  });

  // ===========================================================================
  // 7. RECIPE PROTECTION
  // ===========================================================================
  describe('7. Recipe Protection', () => {
    const inspectorToken = generateToken('usr_inspector_alpha', ['QC_INSPECTOR']);

    it('7.1 should reject inspection user attempting to replace recipeSnapshot with 400 Bad Request', async () => {
      const mockJob = createMockJobDocument();
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_sec_001/inspection-data')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({
          measuredAverage: 60,
          recipeSnapshot: { recipeCode: 'REC-SUBSTITUTE-999', name: 'Altered Recipe' }
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Recipe Protection Violation/i);
    });

    it('7.2 should reject inspection user attempting to supply mismatched recipeCode or recipeId with 400 Bad Request', async () => {
      const mockJob = createMockJobDocument();
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_sec_001/inspection-data')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({
          measuredAverage: 60,
          recipeCode: 'REC-UNRELATED-999'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Recipe Protection Violation/i);
    });
  });

  // ===========================================================================
  // 8. DISPATCH PROTECTION
  // ===========================================================================
  describe('8. Dispatch Protection', () => {
    const inspectorToken = generateToken('usr_inspector_alpha', ['QC_INSPECTOR']);
    const plantManagerToken = generateToken('usr_plant_mgr', ['PLANT_MANAGER']);

    const mockCustomer = {
      _id: 'cust_aero_01',
      customerCode: 'CUST-AERO-01',
      isDeleted: false,
      qualityStatus: 'approved'
    };

    const mockFg = {
      _id: 'fg_sec_01',
      fgLotNumber: 'FG-202609-001',
      customerCode: 'CUST-AERO-01',
      status: 'AVAILABLE',
      availableQuantity: 100,
      uom: 'PCS',
      jobCardId: 'bo_inspect_sec_001',
      isDeleted: false
    };

    it('8.1 should reject Outward Challan (OC) creation in DispatchService for a BO currently in IN_INSPECTION', async () => {
      const mockJob = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        inInspection: true,
        waitingForDispatch: false
      });
      jest.spyOn(customerRepository, 'findById').mockResolvedValue(mockCustomer as any);
      jest.spyOn(finishedGoodsRepository, 'findById').mockResolvedValue(mockFg as any);
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      await expect(
        dispatchService.createDispatch(
          testTenant,
          { userId: 'usr_dispatch_dan', role: 'DISPATCH_COORDINATOR' },
          {
            customerId: 'cust_aero_01',
            lines: [
              {
                finishedGoodsId: 'fg_sec_01',
                dispatchedQuantity: 50
              }
            ]
          } as any
        )
      ).rejects.toThrow(/Dispatch Protection Violation/i);
    });

    it('8.2 should reject Outward Challan (OC) creation in DispatchService for a quarantined BO in INSPECTION', async () => {
      const mockJob = createMockJobDocument({
        status: 'INSPECTION',
        inspection: true,
        inInspection: false,
        waitingForDispatch: false
      });
      jest.spyOn(customerRepository, 'findById').mockResolvedValue(mockCustomer as any);
      jest.spyOn(finishedGoodsRepository, 'findById').mockResolvedValue(mockFg as any);
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      await expect(
        dispatchService.createDispatch(
          testTenant,
          { userId: 'usr_dispatch_dan', role: 'DISPATCH_COORDINATOR' },
          {
            customerId: 'cust_aero_01',
            lines: [
              {
                finishedGoodsId: 'fg_sec_01',
                dispatchedQuantity: 50
              }
            ]
          } as any
        )
      ).rejects.toThrow(/Dispatch Protection Violation/i);
    });

    it('8.3 should reject direct status transition from IN_INSPECTION to DISPATCHED via generic /transition endpoint with 400 Bad Request', async () => {
      const mockJob = createMockJobDocument({
        status: JobStatus.IN_INSPECTION,
        inInspection: true
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_sec_001/transition')
        .set('Authorization', `Bearer ${plantManagerToken}`)
        .send({ toStatus: 'DISPATCHED', reason: 'Attempting to bypass quality approval and dispatch directly' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Inspection Lock Violation/i);
    });
  });

  // ===========================================================================
  // 9. WORKFLOW INTEGRITY & MUTUAL EXCLUSIVITY
  // ===========================================================================
  describe('9. Workflow Integrity & Mutual Exclusivity', () => {
    it('9.1 should fail Mongoose validation if multiple workflow flags are set to true simultaneously', async () => {
      const job = new ProductionJob({
        tenantId: testTenant,
        jobNumber: 'BO-TEST-MULTI-01',
        boNumber: 'BO-TEST-MULTI-01',
        status: 'IN_INSPECTION',
        waitingForProduction: false,
        inProduction: false,
        waitingForInspection: false,
        inInspection: true,
        waitingForDispatch: true, // INVALID: two active flags
        dispatched: false,
        inspection: false,
        workflowState: {
          waitingForProduction: false,
          inProduction: false,
          waitingForInspection: false,
          inInspection: true,
          waitingForDispatch: true,
          dispatched: false,
          inspection: false
        }
      });

      let caughtError: any = null;
      try {
        await job.validate();
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).toBeDefined();
      expect(caughtError.message).toMatch(/Mutual Exclusivity Violation/i);
    });

    it('9.2 should verify that an approved BO has exactly one active state flag (waitingForDispatch = true)', () => {
      const approvedJob = createMockJobDocument({
        status: JobStatus.WAITING_FOR_DISPATCH,
        waitingForProduction: false,
        inProduction: false,
        waitingForInspection: false,
        inInspection: false,
        waitingForDispatch: true,
        dispatched: false,
        inspection: false,
        workflowState: {
          waitingForProduction: false,
          inProduction: false,
          waitingForInspection: false,
          inInspection: false,
          waitingForDispatch: true,
          dispatched: false,
          inspection: false
        }
      });

      const activeFlags = [
        approvedJob.waitingForProduction,
        approvedJob.inProduction,
        approvedJob.waitingForInspection,
        approvedJob.inInspection,
        approvedJob.waitingForDispatch,
        approvedJob.dispatched,
        approvedJob.inspection
      ].filter(Boolean);

      expect(activeFlags.length).toBe(1);
      expect(approvedJob.waitingForDispatch).toBe(true);
      expect(approvedJob.inInspection).toBe(false);
    });

    it('9.3 should verify that a quarantined failed BO has exactly one active state flag (inspection = true)', () => {
      const failedJob = createMockJobDocument({
        status: 'INSPECTION',
        waitingForProduction: false,
        inProduction: false,
        waitingForInspection: false,
        inInspection: false,
        waitingForDispatch: false,
        dispatched: false,
        inspection: true,
        workflowState: {
          waitingForProduction: false,
          inProduction: false,
          waitingForInspection: false,
          inInspection: false,
          waitingForDispatch: false,
          dispatched: false,
          inspection: true
        }
      });

      const activeFlags = [
        failedJob.waitingForProduction,
        failedJob.inProduction,
        failedJob.waitingForInspection,
        failedJob.inInspection,
        failedJob.waitingForDispatch,
        failedJob.dispatched,
        failedJob.inspection
      ].filter(Boolean);

      expect(activeFlags.length).toBe(1);
      expect(failedJob.inspection).toBe(true);
      expect(failedJob.waitingForDispatch).toBe(false);
      expect(failedJob.inInspection).toBe(false);
    });
  });
});
