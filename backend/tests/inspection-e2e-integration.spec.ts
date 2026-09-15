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
import { dispatchRepository } from '../src/modules/dispatch/dispatch.repository.js';
import { customerRepository } from '../src/modules/customer/customer.repository.js';
import { finishedGoodsRepository } from '../src/modules/finished-goods/finished-goods.repository.js';
import { ProductionJob, ProductionJobModel } from '../src/modules/production-job/production-job.model.js';

describe('Inspection Phase Prompt 10: Complete Inspection Phase Integration, Testing and Final Cleanup', () => {
  jest.setTimeout(30000);
  const app = createApp();
  const testTenant = 'tenant_inspect_e2e_p10_001';

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const createE2EJobDocument = (overrides: any = {}) => {
    const doc: any = {
      _id: overrides._id || 'bo_inspect_e2e_001',
      id: overrides.id || overrides._id || 'bo_inspect_e2e_001',
      jobNumber: overrides.jobNumber || 'BO-202609-8800',
      boNumber: overrides.boNumber || overrides.jobNumber || 'BO-202609-8800',
      batchOrderNumber: overrides.boNumber || overrides.jobNumber || 'BO-202609-8800',
      tenantId: testTenant,
      status: overrides.status || JobStatus.WAITING_FOR_INSPECTION,
      priority: 'HIGH',

      poId: 'po_aero_88',
      poNumber: 'PO-2026-0088',
      grnId: 'grn_aero_88',
      grnNumber: 'GRN-202609-0088',

      waitingForProduction: overrides.waitingForProduction ?? false,
      inProduction: overrides.inProduction ?? false,
      waitingForInspection: overrides.waitingForInspection ?? (overrides.status === JobStatus.WAITING_FOR_INSPECTION || !overrides.status),
      inInspection: overrides.inInspection ?? false,
      waitingForDispatch: overrides.waitingForDispatch ?? false,
      dispatched: overrides.dispatched ?? false,
      inspection: overrides.inspection ?? false,

      workflowState: {
        waitingForProduction: overrides.workflowState?.waitingForProduction ?? (overrides.waitingForProduction ?? false),
        inProduction: overrides.workflowState?.inProduction ?? (overrides.inProduction ?? false),
        waitingForInspection: overrides.workflowState?.waitingForInspection ?? (overrides.waitingForInspection ?? (overrides.status === JobStatus.WAITING_FOR_INSPECTION || !overrides.status)),
        inInspection: overrides.workflowState?.inInspection ?? (overrides.inInspection ?? false),
        waitingForDispatch: overrides.workflowState?.waitingForDispatch ?? (overrides.waitingForDispatch ?? false),
        dispatched: overrides.workflowState?.dispatched ?? (overrides.dispatched ?? false),
        inspection: overrides.workflowState?.inspection ?? (overrides.inspection ?? false)
      },

      claimedBy: overrides.claimedBy !== undefined ? overrides.claimedBy : null,
      claimedAt: overrides.claimedAt !== undefined ? overrides.claimedAt : null,
      claimedByEmail: overrides.claimedByEmail !== undefined ? overrides.claimedByEmail : null,
      claimedByRole: overrides.claimedByRole !== undefined ? overrides.claimedByRole : null,

      customer: {
        customerId: 'cust_aero_01',
        customerCode: 'CUST-AERO-01',
        customerName: 'Aero Dynamics Global Inc.'
      },

      item: {
        itemId: 'item_pinion_4340',
        itemCode: 'PINION-4340',
        itemName: 'Helical Drive Pinion 4340',
        materialGrade: 'AISI 4340',
        uom: 'PCS'
      },

      genealogy: {
        whichPo: {
          poId: 'po_aero_88',
          poNumber: 'PO-2026-0088',
          supplierName: 'Aero Dynamics Global Inc.'
        },
        whichGrn: {
          grnId: 'grn_aero_88',
          grnNumber: 'GRN-202609-0088',
          supplierName: 'Aero Dynamics Global Inc.'
        },
        whichPart: {
          itemId: 'item_pinion_4340',
          itemCode: 'PINION-4340',
          partName: 'Helical Drive Pinion 4340'
        },
        heatNumber: 'HEAT-2026-X99',
        heatTreatLotNumber: 'HT-202609-0088'
      },

      recipeSnapshot: {
        recipeId: 'rec_carb_001',
        recipeCode: 'REC-CARB-001',
        name: 'Aerospace Carburize, Quench & Temper Cycle',
        revisionNumber: 2,
        processFamily: 'CASE_HARDENING_CARBURIZING',
        stages: [
          {
            sequence: 1,
            stageName: 'Carburize Boost & Diffuse',
            targetTemperatureC: 925,
            temperatureToleranceMinusC: 5,
            temperatureTolerancePlusC: 5,
            soakTimeMinutes: 240,
            carbonPotentialPercent: 1.15
          },
          {
            sequence: 2,
            stageName: 'Direct Oil Quench',
            targetTemperatureC: 60,
            temperatureToleranceMinusC: 5,
            temperatureTolerancePlusC: 5,
            soakTimeMinutes: 30,
            quenchMedia: 'Accelerated Quench Oil'
          },
          {
            sequence: 3,
            stageName: 'Stress Relief Temper',
            targetTemperatureC: 180,
            temperatureToleranceMinusC: 5,
            temperatureTolerancePlusC: 5,
            soakTimeMinutes: 120
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

      weightKg: 250,

      equipmentAssignment: {
        furnaceId: 'furnace_integral_01',
        furnaceCode: 'FURNACE-INT-01',
        locationBay: 'Bay-3'
      },

      execution: {
        furnaceCharge: overrides.execution?.furnaceCharge || {
          furnaceId: 'furnace_integral_01',
          furnaceCode: 'FURNACE-INT-01',
          chargeNumber: 'CHG-202609-0888',
          loadedPieces: 100,
          loadedWeightKg: 250,
          chargeDate: new Date('2026-09-14T08:00:00Z')
        },
        operatorAssignment: overrides.execution?.operatorAssignment || {
          operatorId: 'usr_op_marcus',
          operatorName: 'Marcus Vance',
          shiftId: 'SHIFT-MORNING'
        },
        stageProgress: overrides.execution?.stageProgress || [
          { stageSequence: 1, stageName: 'Carburize Boost & Diffuse', status: 'COMPLETED', completedAt: new Date() },
          { stageSequence: 2, stageName: 'Direct Oil Quench', status: 'COMPLETED', completedAt: new Date() },
          { stageSequence: 3, stageName: 'Stress Relief Temper', status: 'COMPLETED', completedAt: new Date() }
        ],
        inspectionData: overrides.execution?.inspectionData !== undefined ? overrides.execution.inspectionData : (overrides.inspectionData || null)
      },

      processDetails: Array.from({ length: 15 }, (_, i) => ({
        serialNumber: i + 1,
        processNumber: i + 1,
        process: `Operational Step #${i + 1}`,
        status: overrides.processDetailsStatus || 'PENDING',
        actualHardness: overrides.processDetailsHardness || null,
        isCompliant: overrides.processDetailsCompliant || null,
        verifiedBy: null,
        completedAt: null
      })),

      markModified: jest.fn(),
      save: jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      })
    };

    return doc;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);
    jest.spyOn(eventBus, 'publish').mockResolvedValue(undefined as any);

    jest.spyOn(roleRepository, 'findRolesByCodes').mockImplementation((tenantId, codes) => {
      const matched = DEFAULT_FACTORY_ROLES.filter((r) => codes.includes(r.code)).map((r) => ({
        ...r,
        tenantId,
        id: `role_${r.code.toLowerCase()}`,
        _id: `role_${r.code.toLowerCase()}`
      }));
      return Promise.resolve(matched as any);
    });

    jest.spyOn(roleRepository, 'seedDefaultRolesForTenant').mockResolvedValue(DEFAULT_FACTORY_ROLES as any);

    jest.spyOn(furnaceCapacityRepository, 'findFurnaceById').mockImplementation((tenantId, id) => {
      if (id === 'furnace_integral_01') {
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
  // 1. REPOSITORY-WIDE AUTHORITATIVE WORKFLOW & QUEUE PARTITIONING
  // ===========================================================================
  describe('1. Repository-Wide Authoritative Workflow & Queue Partitioning', () => {
    const qcInspectorToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);

    it('1.1 should query the waiting-for-inspection queue and return eligible BOs', async () => {
      const waitingJob = createE2EJobDocument({ status: JobStatus.WAITING_FOR_INSPECTION });
      jest.spyOn(productionJobRepository, 'findWaitingForInspectionQueue').mockResolvedValue([waitingJob] as any);

      const res = await request(app)
        .get('/api/v1/production-jobs/queue/waiting-for-inspection')
        .set('Authorization', `Bearer ${qcInspectorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].jobNumber).toBe('BO-202609-8800');
    });

    it('1.2 should query the in-inspection queue and return active claimed BOs', async () => {
      const activeJob = createE2EJobDocument({
        status: JobStatus.IN_INSPECTION,
        waitingForInspection: false,
        inInspection: true,
        claimedBy: 'usr_qc_lead'
      });
      jest.spyOn(productionJobRepository, 'findInInspectionQueue').mockResolvedValue([activeJob] as any);

      const res = await request(app)
        .get('/api/v1/production-jobs/queue/in-inspection')
        .set('Authorization', `Bearer ${qcInspectorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].claimedBy).toBe('usr_qc_lead');
    });

    it('1.3 should query the waiting-for-dispatch queue and return approved BOs', async () => {
      const approvedJob = createE2EJobDocument({
        status: JobStatus.WAITING_FOR_DISPATCH,
        waitingForInspection: false,
        inInspection: false,
        waitingForDispatch: true
      });
      jest.spyOn(productionJobRepository, 'findWaitingForDispatchQueue').mockResolvedValue([approvedJob] as any);

      const res = await request(app)
        .get('/api/v1/production-jobs/queue/waiting-for-dispatch')
        .set('Authorization', `Bearer ${qcInspectorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data[0].waitingForDispatch).toBe(true);
    });

    it('1.4 should query the inspection-failed queue and return quarantined BOs', async () => {
      const failedJob = createE2EJobDocument({
        status: 'INSPECTION',
        waitingForInspection: false,
        inInspection: false,
        inspection: true
      });
      jest.spyOn(productionJobRepository, 'findInspectionFailedQueue').mockResolvedValue([failedJob] as any);

      const res = await request(app)
        .get('/api/v1/production-jobs/queue/inspection-failed')
        .set('Authorization', `Bearer ${qcInspectorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data[0].inspection).toBe(true);
    });

    it('1.5 should support identical queue access via /api/v1/quality-inspections router parity', async () => {
      const waitingJob = createE2EJobDocument({ status: JobStatus.WAITING_FOR_INSPECTION });
      jest.spyOn(productionJobRepository, 'findWaitingForInspectionQueue').mockResolvedValue([waitingJob] as any);

      const res = await request(app)
        .get('/api/v1/quality-inspections/waiting-for-inspection')
        .set('Authorization', `Bearer ${qcInspectorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data[0].boNumber).toBe('BO-202609-8800');
    });
  });

  // ===========================================================================
  // 2. CREATION-TO-INSPECTION TRACEABILITY
  // ===========================================================================
  describe('2. Creation-to-Inspection Traceability', () => {
    const qcInspectorToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);

    it('2.1 should preserve the unbroken genealogy (PO -> GRN -> BO -> Recipe -> Production -> Inspection)', async () => {
      const job = createE2EJobDocument();
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .get('/api/v1/production-jobs/bo_inspect_e2e_001/workbench')
        .set('Authorization', `Bearer ${qcInspectorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.genealogy.poNumber).toBe('PO-2026-0088');
      expect(data.genealogy.grnNumber).toBe('GRN-202609-0088');
      expect(data.genealogy.boNumber).toBe('BO-202609-8800');
      expect(data.genealogy.heatNumber).toBe('HEAT-2026-X99');
      expect(data.recipeSnapshot.recipeCode).toBe('REC-CARB-001');
      expect(data.productionExecution.furnaceCode).toBe('FURNACE-INT-01');
      expect(data.productionExecution.chargeNumber).toBe('CHG-202609-0888');
    });

    it('2.2 should prohibit detaching inspection records or nullifying parent BO lineage', async () => {
      const job = createE2EJobDocument({
        status: JobStatus.IN_INSPECTION,
        inInspection: true,
        waitingForInspection: false,
        claimedBy: 'usr_qc_lead'
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_e2e_001/inspection-data')
        .set('Authorization', `Bearer ${qcInspectorToken}`)
        .send({
          measuredAverage: 60.0,
          genealogy: null // Attempt to detach
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Production Data Protection Violation/i);
    });
  });

  // ===========================================================================
  // 3. COMPLETE END-TO-END INSPECTION LIFECYCLE (18-STEP JOURNEY)
  // ===========================================================================
  describe('3. Complete End-to-End Inspection Lifecycle (18-step Journey)', () => {
    const qcInspectorToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);
    const competingInspectorToken = generateToken('usr_competing_qc', ['QC_INSPECTOR']);
    const dispatchUserToken = generateToken('usr_dispatch_dan', ['DISPATCH_OFFICER']);

    it('3.1 should execute the entire canonical 18-step lifecycle from waiting for inspection to dispatch eligibility', async () => {
      // 1. Initial State: BO in WAITING_FOR_INSPECTION
      let currentJob = createE2EJobDocument({
        status: JobStatus.WAITING_FOR_INSPECTION,
        waitingForInspection: true,
        inInspection: false,
        claimedBy: null
      });
      jest.spyOn(productionJobRepository, 'findById').mockImplementation(() => Promise.resolve(currentJob));
      jest.spyOn(productionJobRepository, 'findWaitingForInspectionQueue').mockResolvedValue([currentJob] as any);

      // 2 & 3. View Queue
      const queueRes = await request(app)
        .get('/api/v1/production-jobs/queue/waiting-for-inspection')
        .set('Authorization', `Bearer ${qcInspectorToken}`);
      expect(queueRes.status).toBe(200);
      expect(queueRes.body.data[0].jobNumber).toBe('BO-202609-8800');

      // 4 & 5. Take BO for Inspection
      jest.spyOn(productionJobRepository, 'atomicTakeForInspection').mockImplementation(() => {
        currentJob = {
          ...currentJob,
          status: JobStatus.IN_INSPECTION,
          waitingForInspection: false,
          inInspection: true,
          claimedBy: 'usr_qc_lead',
          claimedAt: new Date(),
          workflowState: {
            ...currentJob.workflowState,
            waitingForInspection: false,
            inInspection: true
          }
        };
        return Promise.resolve(currentJob as any);
      });

      const takeRes = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_e2e_001/take-for-inspection')
        .set('Authorization', `Bearer ${qcInspectorToken}`)
        .send({ notes: 'Claimed at Station QA-01 for case depth and hardness verification' });

      // 6 & 7. Verify atomic transition to inInspection and cleared flags
      expect(takeRes.status).toBe(200);
      expect(takeRes.body.data.inInspection).toBe(true);
      expect(takeRes.body.data.waitingForInspection).toBe(false);
      expect(takeRes.body.data.waitingForProduction).toBe(false);
      expect(takeRes.body.data.waitingForDispatch).toBe(false);

      // 8. Verify competing inspector cannot take the already claimed BO
      const competingTakeRes = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_e2e_001/take-for-inspection')
        .set('Authorization', `Bearer ${competingInspectorToken}`)
        .send({ notes: 'Competing inspector attempt' });
      expect(competingTakeRes.status).toBe(409);
      expect(competingTakeRes.body.message).toMatch(/already in inspection/i);

      // 9 & 10. Verify Workbench data: production protected & correct recipe displayed
      const workbenchRes = await request(app)
        .get('/api/v1/production-jobs/bo_inspect_e2e_001/workbench')
        .set('Authorization', `Bearer ${qcInspectorToken}`);
      expect(workbenchRes.status).toBe(200);
      expect(workbenchRes.body.data.recipeSnapshot.recipeCode).toBe('REC-CARB-001');
      expect(workbenchRes.body.data.productionExecution.furnaceCode).toBe('FURNACE-INT-01');

      // 11 & 12. Enter required inspection data & verify mandatory fields
      const inspectionPayload = {
        furnaceCode: 'FURNACE-INT-01',
        minHardness: 58,
        maxHardness: 62,
        scale: 'HRC',
        measuredAverage: 60.2,
        effectiveCaseDepthMm: 1.05,
        quantityReceived: 100,
        quantityDelivered: 100,
        quantityRejected: 0,
        isHardnessCompliant: true,
        isCaseDepthCompliant: true,
        testPoints: [
          { pointIdentifier: 'SURF-01', measuredValue: 60.5, location: 'Surface' },
          { pointIdentifier: 'SURF-02', measuredValue: 60.0, location: 'Surface' }
        ]
      };

      const recordRes = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_e2e_001/inspection-data')
        .set('Authorization', `Bearer ${qcInspectorToken}`)
        .send(inspectionPayload);
      expect(recordRes.status).toBe(200);
      expect(recordRes.body.data.execution.inspectionData.measuredAverage).toBe(60.2);

      // Update currentJob with recorded data
      currentJob = {
        ...currentJob,
        execution: {
          ...currentJob.execution,
          inspectionData: recordRes.body.data.execution.inspectionData
        }
      };

      // 13. Verify all 15 process detail rows
      for (let pos = 1; pos <= 15; pos++) {
        currentJob.processDetails[pos - 1] = {
          ...currentJob.processDetails[pos - 1],
          status: 'PASSED',
          actualHardness: 60.2,
          isCompliant: true,
          verifiedBy: 'usr_qc_lead'
        };
      }

      const verifyRowRes = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_e2e_001/verify-process-row')
        .set('Authorization', `Bearer ${qcInspectorToken}`)
        .send({
          serialNumber: 1,
          actualHardness: 60.2,
          status: 'PASSED'
        });
      expect(verifyRowRes.status).toBe(200);

      // 14 & 15. Approve BO for Dispatch
      jest.spyOn(productionJobRepository, 'atomicApproveForDispatch').mockImplementation(() => {
        currentJob = {
          ...currentJob,
          status: JobStatus.WAITING_FOR_DISPATCH,
          inInspection: false,
          waitingForDispatch: true,
          workflowState: {
            ...currentJob.workflowState,
            inInspection: false,
            waitingForDispatch: true
          }
        };
        return Promise.resolve(currentJob as any);
      });

      const approveRes = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_e2e_001/approve-dispatch')
        .set('Authorization', `Bearer ${qcInspectorToken}`)
        .send({
          furnaceCode: 'FURNACE-INT-01',
          measuredAverage: 60.2,
          effectiveCaseDepthMm: 1.05,
          quantityReceived: 100,
          quantityDelivered: 100
        });

      // 16. Verify atomic transition to waitingForDispatch
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.waitingForDispatch).toBe(true);
      expect(approveRes.body.data.inInspection).toBe(false);

      // 17. Verify queue partition: disappeared from in-inspection, in waiting-for-dispatch
      jest.spyOn(productionJobRepository, 'findInInspectionQueue').mockResolvedValue([]);
      jest.spyOn(productionJobRepository, 'findWaitingForDispatchQueue').mockResolvedValue([currentJob] as any);

      const activeQueueRes = await request(app)
        .get('/api/v1/production-jobs/queue/in-inspection')
        .set('Authorization', `Bearer ${qcInspectorToken}`);
      expect(activeQueueRes.body.data).toHaveLength(0);

      const dispatchQueueRes = await request(app)
        .get('/api/v1/production-jobs/queue/waiting-for-dispatch')
        .set('Authorization', `Bearer ${qcInspectorToken}`);
      expect(dispatchQueueRes.body.data).toHaveLength(1);
      expect(dispatchQueueRes.body.data[0].waitingForDispatch).toBe(true);

      // 18. Verify Dispatch users can identify it as eligible for Outward Challan creation
      const mockCustomer = {
        _id: 'cust_aero_01',
        id: 'cust_aero_01',
        customerCode: 'CUST-AERO-01',
        customerName: 'Aero Dynamics Global Inc.',
        companyName: 'Aero Dynamics Global Inc.',
        isDeleted: false,
        qualityStatus: 'approved'
      };
      const mockFg = {
        _id: 'fg_e2e_01',
        id: 'fg_e2e_01',
        fgLotNumber: 'FG-202609-001',
        customerCode: 'CUST-AERO-01',
        status: 'AVAILABLE',
        availableQuantity: 100,
        reservedQuantity: 0,
        uom: 'PCS',
        jobCardId: 'bo_inspect_e2e_001',
        jobCardNumber: 'BO-202609-8800',
        itemId: 'item_pinion_4340',
        itemCode: 'PINION-4340',
        description: 'Helical Drive Pinion 4340',
        heatLotNumber: 'HT-202609-0088',
        isDeleted: false,
        qualityRelease: {
          isReleased: true,
          releasedAt: new Date(),
          releasedByActorId: 'usr_qc_lead'
        },
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
        toJSON: jest.fn().mockReturnValue({})
      };
      jest.spyOn(customerRepository, 'findById').mockResolvedValue(mockCustomer as any);
      jest.spyOn(finishedGoodsRepository, 'findById').mockResolvedValue(mockFg as any);
      jest.spyOn(dispatchRepository, 'create').mockResolvedValue({
        id: 'dsp_consignment_001',
        dispatchNumber: 'DSP-2026-0001',
        deliveryChallanNumber: 'DC-2026-0001',
        status: 'DRAFT',
        lines: [{ finishedGoodsId: 'fg_e2e_01', dispatchedQuantity: 50 }],
        toJSON: jest.fn().mockReturnValue({})
      } as any);

      const ocResult = await dispatchService.createDispatch(
        testTenant,
        { userId: 'usr_dispatch_dan', role: 'DISPATCH_OFFICER' },
        {
          customerId: 'cust_aero_01',
          dispatchDate: new Date().toISOString(),
          destinationAddress: '100 Aerospace Blvd, Seattle, WA',
          lines: [{ finishedGoodsId: 'fg_e2e_01', dispatchedQuantity: 50 }]
        } as any
      );

      expect(ocResult).toBeDefined();
      expect(ocResult.dispatchNumber).toBe('DSP-2026-0001');
    });
  });

  // ===========================================================================
  // 4. REQUIRED HEAT-TREATMENT DATA TEST (THE SIX MANDATORY FIELDS)
  // ===========================================================================
  describe('4. Required Heat-Treatment Data Test', () => {
    const qcInspectorToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);

    const validApprovalBase = {
      furnaceCode: 'FURNACE-INT-01',
      minHardness: 58,
      maxHardness: 62,
      measuredAverage: 60.0,
      effectiveCaseDepthMm: 1.0,
      quantityReceived: 100,
      quantityDelivered: 100
    };

    const setupInInspectionJob = () => {
      const job = createE2EJobDocument({
        status: JobStatus.IN_INSPECTION,
        waitingForInspection: false,
        inInspection: true,
        claimedBy: 'usr_qc_lead',
        execution: {
          furnaceCharge: { furnaceCode: 'FURNACE-INT-01', loadedPieces: 100 },
          stageProgress: [{ status: 'COMPLETED' }],
          inspectionData: {
            furnaceCode: 'FURNACE-INT-01',
            minHardness: 58,
            maxHardness: 62,
            measuredAverage: 60,
            effectiveCaseDepthMm: 1.0,
            quantityReceived: 100,
            quantityDelivered: 100,
            isHardnessCompliant: true,
            isCaseDepthCompliant: true
          }
        },
        processDetailsStatus: 'PASSED',
        processDetailsHardness: 60.0,
        processDetailsCompliant: true
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);
      return job;
    };

    it('4.1 should reject approval when furnace/equipment identification is missing', async () => {
      setupInInspectionJob();
      const payload = { ...validApprovalBase, furnaceCode: '' };

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_e2e_001/approve-dispatch')
        .set('Authorization', `Bearer ${qcInspectorToken}`)
        .send(payload);

      expect([400, 422]).toContain(res.status);
      expect(JSON.stringify(res.body)).toMatch(/(Furnace|furnaceCode)/i);
    });

    it('4.2 should reject approval when hardness specification limits are missing', async () => {
      setupInInspectionJob();
      const payload = { ...validApprovalBase, minHardness: null, maxHardness: null };

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_e2e_001/approve-dispatch')
        .set('Authorization', `Bearer ${qcInspectorToken}`)
        .send(payload);

      expect([400, 422]).toContain(res.status);
      expect(JSON.stringify(res.body)).toMatch(/(Hardness|minHardness)/i);
    });

    it('4.3 should reject approval when actual measured hardness is missing', async () => {
      setupInInspectionJob();
      const payload = { ...validApprovalBase, measuredAverage: null };

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_e2e_001/approve-dispatch')
        .set('Authorization', `Bearer ${qcInspectorToken}`)
        .send(payload);

      expect([400, 422]).toContain(res.status);
      expect(JSON.stringify(res.body)).toMatch(/(measured|measuredAverage)/i);
    });

    it('4.4 should reject approval when effective case depth measurement is missing', async () => {
      setupInInspectionJob();
      const payload = { ...validApprovalBase, effectiveCaseDepthMm: null };

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_e2e_001/approve-dispatch')
        .set('Authorization', `Bearer ${qcInspectorToken}`)
        .send(payload);

      expect([400, 422]).toContain(res.status);
      expect(JSON.stringify(res.body)).toMatch(/(effectiveCaseDepthMm|Case depth)/i);
    });

    it('4.5 should reject approval when quantity received is missing or non-positive', async () => {
      setupInInspectionJob();
      const payload = { ...validApprovalBase, quantityReceived: 0 };

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_e2e_001/approve-dispatch')
        .set('Authorization', `Bearer ${qcInspectorToken}`)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/(Quantity received.*positive|Quantity Received)/i);
    });

    it('4.6 should reject approval when quantity delivered exceeds quantity received', async () => {
      setupInInspectionJob();
      const payload = { ...validApprovalBase, quantityReceived: 100, quantityDelivered: 105 };

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_e2e_001/approve-dispatch')
        .set('Authorization', `Bearer ${qcInspectorToken}`)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/(cannot exceed quantityReceived|cannot exceed quantity received)/i);
    });
  });

  // ===========================================================================
  // 5. FAILURE TEST & QUARANTINE LIFECYCLE
  // ===========================================================================
  describe('5. Failure Test & Quarantine Lifecycle', () => {
    const qcInspectorToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);

    it('5.1 should transition non-compliant BO to authoritative INSPECTION failure quarantine state', async () => {
      let failedJob = createE2EJobDocument({
        status: JobStatus.IN_INSPECTION,
        waitingForInspection: false,
        inInspection: true,
        claimedBy: 'usr_qc_lead'
      });
      jest.spyOn(productionJobRepository, 'findById').mockImplementation(() => Promise.resolve(failedJob));

      jest.spyOn(productionJobRepository, 'atomicFailInspection').mockImplementation(() => {
        failedJob = {
          ...failedJob,
          status: 'INSPECTION',
          inInspection: false,
          inspection: true,
          workflowState: {
            ...failedJob.workflowState,
            inInspection: false,
            inspection: true
          }
        };
        return Promise.resolve(failedJob as any);
      });

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_e2e_001/fail-inspection')
        .set('Authorization', `Bearer ${qcInspectorToken}`)
        .send({
          defectCategory: 'HARDNESS_OUT_OF_SPEC',
          defectReason: 'Core hardness 52 HRC below 58 HRC specification threshold',
          quantityRejected: 100,
          correctiveActionNotes: 'Quarantine and scrap'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inspection).toBe(true);
      expect(res.body.data.inInspection).toBe(false);
      expect(res.body.data.waitingForDispatch).toBe(false);
    });

    it('5.2 should strictly prevent Outward Challan creation in DispatchService for the failed BO', async () => {
      const failedJob = createE2EJobDocument({
        status: 'INSPECTION',
        inspection: true,
        inInspection: false,
        waitingForDispatch: false
      });
      const mockCustomer = {
        _id: 'cust_aero_01',
        customerCode: 'CUST-AERO-01',
        isDeleted: false,
        qualityStatus: 'approved'
      };
      const mockFg = {
        _id: 'fg_fail_01',
        fgLotNumber: 'FG-FAIL-01',
        customerCode: 'CUST-AERO-01',
        status: 'AVAILABLE',
        availableQuantity: 100,
        uom: 'PCS',
        jobCardId: 'bo_inspect_e2e_001',
        isDeleted: false
      };

      jest.spyOn(customerRepository, 'findById').mockResolvedValue(mockCustomer as any);
      jest.spyOn(finishedGoodsRepository, 'findById').mockResolvedValue(mockFg as any);
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(failedJob);

      await expect(
        dispatchService.createDispatch(
          testTenant,
          { userId: 'usr_dispatch_dan', role: 'DISPATCH_OFFICER' },
          {
            customerId: 'cust_aero_01',
            lines: [{ finishedGoodsId: 'fg_fail_01', dispatchedQuantity: 50 }]
          } as any
        )
      ).rejects.toThrow(/Dispatch Protection Violation.*failed Quality Inspection and is quarantined/i);
    });
  });

  // ===========================================================================
  // 6. WORKFLOW MANIPULATION TESTING
  // ===========================================================================
  describe('6. Workflow Manipulation Testing', () => {
    const qcInspectorToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);
    const plantManagerToken = generateToken('usr_plant_mgr', ['PLANT_MANAGER']);

    it('6.1 should reject taking an already inspected / approved BO with 400 Bad Request', async () => {
      const approvedJob = createE2EJobDocument({
        status: JobStatus.WAITING_FOR_DISPATCH,
        waitingForInspection: false,
        waitingForDispatch: true
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(approvedJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_e2e_001/take-for-inspection')
        .set('Authorization', `Bearer ${qcInspectorToken}`)
        .send({ notes: 'Invalid take attempt' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/(Take Inspection Error|Cannot take Batch Order)/i);
    });

    it('6.2 should reject approving a WAITING_FOR_INSPECTION BO without taking it with 400 Bad Request', async () => {
      const unclaimedJob = createE2EJobDocument({
        status: JobStatus.WAITING_FOR_INSPECTION,
        waitingForInspection: true,
        inInspection: false,
        claimedBy: null
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(unclaimedJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_e2e_001/approve-dispatch')
        .set('Authorization', `Bearer ${qcInspectorToken}`)
        .send({ furnaceCode: 'FURNACE-INT-01', measuredAverage: 60, effectiveCaseDepthMm: 1.0, quantityReceived: 100, quantityDelivered: 100 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not in active inspection/i);
    });

    it('6.3 should reject approving an incomplete BO with missing required data with 400 Bad Request', async () => {
      const incompleteJob = createE2EJobDocument({
        status: JobStatus.IN_INSPECTION,
        inInspection: true,
        claimedBy: 'usr_qc_lead'
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(incompleteJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_e2e_001/approve-dispatch')
        .set('Authorization', `Bearer ${qcInspectorToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('6.4 should reject approving a failed / quarantined BO with 400 Bad Request', async () => {
      const failedJob = createE2EJobDocument({
        status: 'INSPECTION',
        inspection: true,
        inInspection: false
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(failedJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_e2e_001/approve-dispatch')
        .set('Authorization', `Bearer ${qcInspectorToken}`)
        .send({ furnaceCode: 'FURNACE-INT-01', measuredAverage: 60, effectiveCaseDepthMm: 1.0, quantityReceived: 100, quantityDelivered: 100 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not in active inspection/i);
    });

    it('6.5 should reject setting multiple workflow flags simultaneously via schema validation', async () => {
      const multiFlagJob = new ProductionJob({
        tenantId: testTenant,
        jobNumber: 'BO-MULTI-TEST',
        boNumber: 'BO-MULTI-TEST',
        status: 'IN_INSPECTION',
        waitingForProduction: false,
        inProduction: false,
        waitingForInspection: false,
        inInspection: true,
        waitingForDispatch: true // INVALID
      });

      let err: any = null;
      try {
        await multiFlagJob.validate();
      } catch (e: any) {
        err = e;
      }
      expect(err).toBeDefined();
      expect(err.message).toMatch(/Mutual Exclusivity Violation/i);
    });

    it('6.6 should reject substituting or replacing recipeSnapshot with 400 Bad Request', async () => {
      const job = createE2EJobDocument({
        status: JobStatus.IN_INSPECTION,
        inInspection: true,
        claimedBy: 'usr_qc_lead'
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_e2e_001/inspection-data')
        .set('Authorization', `Bearer ${qcInspectorToken}`)
        .send({
          measuredAverage: 60,
          recipeSnapshot: { recipeCode: 'REC-UNAUTHORIZED-999' }
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Recipe Protection Violation/i);
    });

    it('6.7 should reject rewriting historical production data through inspection endpoints with 400 Bad Request', async () => {
      const job = createE2EJobDocument({
        status: JobStatus.IN_INSPECTION,
        inInspection: true,
        claimedBy: 'usr_qc_lead'
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_e2e_001/inspection-data')
        .set('Authorization', `Bearer ${qcInspectorToken}`)
        .send({
          measuredAverage: 60,
          furnaceCharge: { furnaceCode: 'FURNACE-FAKE', loadedWeightKg: 999 }
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Production Data Protection Violation/i);
    });

    it('6.8 should reject directly moving from IN_INSPECTION to DISPATCHED via generic /transition endpoint with 400 Bad Request', async () => {
      const job = createE2EJobDocument({
        status: JobStatus.IN_INSPECTION,
        inInspection: true,
        claimedBy: 'usr_qc_lead'
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_e2e_001/transition')
        .set('Authorization', `Bearer ${plantManagerToken}`)
        .send({ toStatus: 'DISPATCHED', reason: 'Attempt to bypass inspection approval' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Inspection Lock Violation/i);
    });
  });

  // ===========================================================================
  // 7. AUTHORIZATION TESTING
  // ===========================================================================
  describe('7. Authorization Testing', () => {
    const operatorToken = generateToken('usr_op_marcus', ['FURNACE_OPERATOR']);
    const dispatchToken = generateToken('usr_dispatch_dan', ['DISPATCH_OFFICER']);
    const inventoryToken = generateToken('usr_inv_clerk', ['INVENTORY_CLERK']);
    const qcInspectorToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);

    it('7.1 should permit authorized QC Inspector to perform inspection mutations', async () => {
      const job = createE2EJobDocument({
        status: JobStatus.WAITING_FOR_INSPECTION,
        waitingForInspection: true,
        inInspection: false,
        claimedBy: null
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);
      jest.spyOn(productionJobRepository, 'atomicTakeForInspection').mockResolvedValue({
        ...job,
        status: JobStatus.IN_INSPECTION,
        inInspection: true
      } as any);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_e2e_001/take-for-inspection')
        .set('Authorization', `Bearer ${qcInspectorToken}`)
        .send({ notes: 'Authorized take' });

      expect(res.status).toBe(200);
    });

    it('7.2 should reject unauthorized inventory clerk attempting inspection operations with 403 Forbidden', async () => {
      const job = createE2EJobDocument();
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_e2e_001/take-for-inspection')
        .set('Authorization', `Bearer ${inventoryToken}`)
        .send({ notes: 'Clerk take' });

      expect(res.status).toBe(403);
    });

    it('7.3 should reject production operator attempting inspection operations with 403 Forbidden', async () => {
      const job = createE2EJobDocument();
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_e2e_001/take-for-inspection')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ notes: 'Operator take' });

      expect(res.status).toBe(403);
    });

    it('7.4 should reject dispatch officer attempting inspection operations with 403 Forbidden', async () => {
      const job = createE2EJobDocument();
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_e2e_001/approve-dispatch')
        .set('Authorization', `Bearer ${dispatchToken}`)
        .send({ furnaceCode: 'FURNACE-INT-01', measuredAverage: 60, effectiveCaseDepthMm: 1.0, quantityReceived: 100, quantityDelivered: 100 });

      expect(res.status).toBe(403);
    });
  });

  // ===========================================================================
  // 8. CONCURRENCY & COLLISION TESTING
  // ===========================================================================
  describe('8. Concurrency & Collision Testing', () => {
    const inspectorAlphaToken = generateToken('usr_alpha', ['QC_INSPECTOR']);
    const inspectorBetaToken = generateToken('usr_beta', ['QC_INSPECTOR']);
    const metallurgistToken = generateToken('usr_metallurgist', ['METALLURGIST']);

    it('8.1 should handle race conditions: when two inspectors attempt atomic take, second receives 409 Conflict', async () => {
      const job = createE2EJobDocument({
        status: JobStatus.WAITING_FOR_INSPECTION,
        waitingForInspection: true,
        inInspection: false,
        claimedBy: null
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);
      jest.spyOn(productionJobRepository, 'atomicTakeForInspection').mockResolvedValue(null); // Collision

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_e2e_001/take-for-inspection')
        .set('Authorization', `Bearer ${inspectorBetaToken}`)
        .send({ notes: 'Simultaneous claim collision' });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already claimed by another inspector/i);
    });

    it('8.2 should reject competing inspector from editing claimed active session with 403 Forbidden', async () => {
      const job = createE2EJobDocument({
        status: JobStatus.IN_INSPECTION,
        inInspection: true,
        claimedBy: 'usr_alpha'
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_e2e_001/inspection-data')
        .set('Authorization', `Bearer ${inspectorBetaToken}`)
        .send({ measuredAverage: 60 });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Inspection Ownership Violation/i);
    });

    it('8.3 should permit supervisory Chief Metallurgist to override and edit claimed active session', async () => {
      const job = createE2EJobDocument({
        status: JobStatus.IN_INSPECTION,
        inInspection: true,
        claimedBy: 'usr_alpha'
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_e2e_001/inspection-data')
        .set('Authorization', `Bearer ${metallurgistToken}`)
        .send({ measuredAverage: 60.5 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('8.4 should reject duplicate approval requests on already approved BO with 400 Bad Request', async () => {
      const approvedJob = createE2EJobDocument({
        status: JobStatus.WAITING_FOR_DISPATCH,
        waitingForInspection: false,
        inInspection: false,
        waitingForDispatch: true
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(approvedJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_e2e_001/approve-dispatch')
        .set('Authorization', `Bearer ${inspectorAlphaToken}`)
        .send({ furnaceCode: 'FURNACE-INT-01', measuredAverage: 60, effectiveCaseDepthMm: 1.0, quantityReceived: 100, quantityDelivered: 100 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not in active inspection/i);
    });

    it('8.5 should reject duplicate failure requests on already quarantined BO with 400 Bad Request', async () => {
      const failedJob = createE2EJobDocument({
        status: 'INSPECTION',
        inspection: true,
        inInspection: false
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(failedJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_e2e_001/fail-inspection')
        .set('Authorization', `Bearer ${inspectorAlphaToken}`)
        .send({ defectCategory: 'OTHER', defectReason: 'Duplicate failure attempt' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not in active inspection/i);
    });

    it('8.6 should reject stale session modifications on already approved BO in WAITING_FOR_DISPATCH with 400 Bad Request', async () => {
      const approvedJob = createE2EJobDocument({
        status: JobStatus.WAITING_FOR_DISPATCH,
        waitingForInspection: false,
        inInspection: false,
        waitingForDispatch: true
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(approvedJob);

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_e2e_001/inspection-data')
        .set('Authorization', `Bearer ${inspectorAlphaToken}`)
        .send({ measuredAverage: 60.5 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not in active inspection/i);
    });
  });

  // ===========================================================================
  // 9. HISTORICAL INTEGRITY & CROSS-PHASE BOUNDARY ENFORCEMENT
  // ===========================================================================
  describe('9. Historical Integrity & Cross-Phase Boundary Enforcement', () => {
    const qcInspectorToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);

    it('9.1 should preserve all historical inspection results viewable after dispatch approval', async () => {
      const approvedJob = createE2EJobDocument({
        status: JobStatus.WAITING_FOR_DISPATCH,
        waitingForInspection: false,
        inInspection: false,
        waitingForDispatch: true,
        execution: {
          furnaceCharge: { furnaceCode: 'FURNACE-INT-01', chargeNumber: 'CHG-202609-0888' },
          inspectionData: {
            furnaceCode: 'FURNACE-INT-01',
            minHardness: 58,
            maxHardness: 62,
            measuredAverage: 60.2,
            effectiveCaseDepthMm: 1.05,
            quantityReceived: 100,
            quantityDelivered: 100,
            disposition: 'CONFORMING'
          }
        }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(approvedJob);

      const res = await request(app)
        .get('/api/v1/production-jobs/bo_inspect_e2e_001/workbench')
        .set('Authorization', `Bearer ${qcInspectorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.inspectionData.measuredAverage).toBe(60.2);
      expect(res.body.data.inspectionData.disposition).toBe('CONFORMING');
      expect(res.body.data.genealogy.poNumber).toBe('PO-2026-0088');
      expect(res.body.data.recipeSnapshot.recipeCode).toBe('REC-CARB-001');
    });

    it('9.2 should verify that Inspection phase endpoints do NOT create or execute Outward Challans', async () => {
      const job = createE2EJobDocument({
        status: JobStatus.IN_INSPECTION,
        inInspection: true,
        claimedBy: 'usr_qc_lead',
        execution: {
          furnaceCharge: { furnaceCode: 'FURNACE-INT-01' },
          stageProgress: [{ status: 'COMPLETED' }],
          inspectionData: {
            furnaceCode: 'FURNACE-INT-01',
            minHardness: 58,
            maxHardness: 62,
            measuredAverage: 60,
            effectiveCaseDepthMm: 1.0,
            quantityReceived: 100,
            quantityDelivered: 100,
            isHardnessCompliant: true,
            isCaseDepthCompliant: true
          }
        },
        processDetailsStatus: 'PASSED',
        processDetailsHardness: 60.0,
        processDetailsCompliant: true
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);
      jest.spyOn(productionJobRepository, 'atomicApproveForDispatch').mockResolvedValue({
        ...job,
        status: JobStatus.WAITING_FOR_DISPATCH,
        waitingForDispatch: true,
        inInspection: false,
        dispatched: false
      } as any);

      const dispatchSpy = jest.spyOn(dispatchService, 'createDispatch');

      const res = await request(app)
        .post('/api/v1/production-jobs/bo_inspect_e2e_001/approve-dispatch')
        .set('Authorization', `Bearer ${qcInspectorToken}`)
        .send({
          furnaceCode: 'FURNACE-INT-01',
          measuredAverage: 60,
          effectiveCaseDepthMm: 1.0,
          quantityReceived: 100,
          quantityDelivered: 100
        });

      expect(res.status).toBe(200);
      expect(res.body.data.waitingForDispatch).toBe(true);
      expect(res.body.data.dispatched).toBe(false);
      // DispatchService was NOT called by inspection approval (clean boundary)
      expect(dispatchSpy).not.toHaveBeenCalled();
    });
  });
});
