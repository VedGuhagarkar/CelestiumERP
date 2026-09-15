import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { furnaceCapacityRepository } from '../src/modules/furnace-capacity/furnace-capacity.repository.js';
import { machineRepository } from '../src/modules/machine/machine.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { JobStatus } from '../src/core/constants/status.js';
import { eventBus } from '../src/core/events/domain-event-bus.js';
import { DomainEvents } from '../src/core/constants/events.js';
import { dispatchService } from '../src/modules/dispatch/dispatch.service.js';
import { finishedGoodsRepository } from '../src/modules/finished-goods/finished-goods.repository.js';
import { customerRepository } from '../src/modules/customer/customer.repository.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';

describe('Inspection Phase Prompt 7: Implement Inspection Failure Handling', () => {
  jest.setTimeout(30000);
  const app = createApp();
  const testTenant = 'tenant_inspect_failure_007';

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const createMockJobDocument = (overrides: any = {}) => {
    const doc: any = {
      _id: overrides._id || 'bo_inspect_fail_001',
      id: overrides.id || overrides._id || 'bo_inspect_fail_001',
      jobNumber: overrides.jobNumber || 'BO-202609-0701',
      boNumber: overrides.boNumber || overrides.jobNumber || 'BO-202609-0701',
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

      workflow: {
        waitingForProduction: overrides.workflow?.waitingForProduction ?? (overrides.waitingForProduction ?? false),
        inProduction: overrides.workflow?.inProduction ?? (overrides.inProduction ?? false),
        waitingForInspection: overrides.workflow?.waitingForInspection ?? (overrides.waitingForInspection ?? false),
        inInspection: overrides.workflow?.inInspection ?? (overrides.inInspection ?? true),
        waitingForDispatch: overrides.workflow?.waitingForDispatch ?? (overrides.waitingForDispatch ?? false),
        dispatched: overrides.workflow?.dispatched ?? (overrides.dispatched ?? false),
        inspection: overrides.workflow?.inspection ?? (overrides.inspection ?? false)
      },

      claimedBy: overrides.claimedBy ?? 'usr_qc_lead',
      claimedAt: overrides.claimedAt ?? new Date(),
      claimedByEmail: overrides.claimedByEmail ?? 'usr_qc_lead@factory.com',
      claimedByRole: overrides.claimedByRole ?? 'QC_INSPECTOR',

      customer: {
        customerId: 'cust_aero_01',
        customerCode: 'CUST-AERO-01',
        customerName: 'Aero Dynamics Global'
      },

      item: {
        itemId: 'item_pinion_01',
        itemCode: 'PART-PINION-4340',
        itemName: 'Turbine Pinion Gear 4340',
        materialGrade: 'AISI 4340 Alloy Steel',
        drawingNumber: 'DRW-PINION-4340-A',
        heatNumber: 'HEAT-4340-V9812'
      },

      quantity: {
        targetQuantity: 100,
        loadedQuantity: 100,
        completedQuantity: 0,
        scrappedQuantity: 0
      },

      weightKg: 65,

      genealogy: {
        poId: 'po_aero_2026_01',
        poNumber: 'PO-2026-0811',
        grnId: 'grn_aero_2026_01',
        grnNumber: 'GRN-2026-0811',
        whichPo: {
          poId: 'po_aero_2026_01',
          poNumber: 'PO-2026-0811',
          supplierName: 'Precision Steel Mills Ltd'
        },
        whichGrn: {
          grnId: 'grn_aero_2026_01',
          grnNumber: 'GRN-2026-0811'
        },
        whichPart: {
          itemId: 'item_pinion_01',
          partCode: 'PART-PINION-4340',
          partName: 'Turbine Pinion Gear 4340'
        },
        isImmutable: true
      },

      recipeSnapshot: {
        recipeId: 'rec_austenitize_4340',
        recipeCode: 'REC-AUST-4340',
        recipeName: 'Austenitize & Oil Quench',
        name: 'Austenitize & Oil Quench',
        revision: 1,
        processFamily: 'HARDENING_TEMPERING',
        stages: [
          { sequence: 1, stageName: 'Pre-Heat', targetTemperatureC: 650, soakTimeMinutes: 45 },
          { sequence: 2, stageName: 'Austenitizing Soak', targetTemperatureC: 845, soakTimeMinutes: 90 },
          { sequence: 3, stageName: 'Oil Quench', targetTemperatureC: 50, soakTimeMinutes: 20 }
        ],
        metallurgicalTargets: {
          minHardness: 58,
          maxHardness: 62,
          surfaceHardnessScale: 'HRC',
          caseDepthMinMm: 0.8,
          caseDepthMaxMm: 1.2
        }
      },

      equipmentAssignment: {
        furnaceId: 'furnace_ipsen_01',
        furnaceCode: 'FURNACE-IPSEN-01'
      },

      execution: {
        furnaceCharge: {
          chargeNumber: 'CHG-202609-001',
          furnaceId: 'furnace_ipsen_01',
          furnaceCode: 'FURNACE-IPSEN-01',
          loadedPieces: 100,
          loadedWeightKg: 65
        },
        inspectionData: {
          furnaceId: 'furnace_ipsen_01',
          furnaceCode: 'FURNACE-IPSEN-01',
          equipmentNotes: 'Standard calibrated probe',
          equipment: {
            furnaceId: 'furnace_ipsen_01',
            furnaceCode: 'FURNACE-IPSEN-01',
            equipmentNotes: 'Standard calibrated probe'
          },
          minHardness: 58,
          maxHardness: 62,
          scale: 'HRC',
          hardnessSpecification: {
            minHardness: 58,
            maxHardness: 62,
            scale: 'HRC'
          },
          measuredAverage: 52.4, // Out of spec: failing result
          isHardnessCompliant: false,
          testPoints: [
            { pointIdentifier: 'P1-Tip', measuredValue: 52.1, location: 'Tooth Tip' },
            { pointIdentifier: 'P2-Pitch', measuredValue: 52.5, location: 'Pitch Line' },
            { pointIdentifier: 'P3-Root', measuredValue: 52.6, location: 'Root Fillet' }
          ],
          actualHardness: {
            measuredAverage: 52.4,
            scale: 'HRC',
            isCompliant: false,
            testPoints: [
              { pointIdentifier: 'P1-Tip', measuredValue: 52.1, location: 'Tooth Tip' },
              { pointIdentifier: 'P2-Pitch', measuredValue: 52.5, location: 'Pitch Line' },
              { pointIdentifier: 'P3-Root', measuredValue: 52.6, location: 'Root Fillet' }
            ]
          },
          effectiveCaseDepthMm: 0.55, // Out of spec: target [0.8, 1.2]
          isCaseDepthCompliant: false,
          caseDepthMethod: 'MICROHARDNESS_TRAVERSE',
          caseDepth: {
            effectiveCaseDepthMm: 0.55,
            targetMinMm: 0.8,
            targetMaxMm: 1.2,
            isCompliant: false,
            method: 'MICROHARDNESS_TRAVERSE'
          },
          quantityReceived: 100,
          quantityDelivered: 0,
          quantityRejected: 100,
          quantities: {
            quantityReceived: 100,
            quantityDelivered: 0,
            quantityRejected: 100
          },
          inspectorId: 'usr_qc_lead',
          inspectorName: 'Chief Metallurgist',
          inspectedAt: new Date(),
          inspectedBy: {
            userId: 'usr_qc_lead',
            email: 'usr_qc_lead@factory.com',
            role: 'QC_INSPECTOR'
          },
          disposition: 'PENDING',
          notes: 'Preliminary hardness check shows low transformation'
        }
      },

      transitionHistory: [
        {
          fromStatus: 'WAITING_FOR_INSPECTION',
          toStatus: 'IN_INSPECTION',
          timestamp: new Date(),
          performedBy: { userId: 'usr_qc_lead', role: 'QC_INSPECTOR' }
        }
      ],

      isDeleted: false,
      save: jest.fn().mockResolvedValue(true)
    };

    return {
      ...doc,
      ...overrides,
      toJSON: () => doc
    };
  };

  const validFailurePayload = {
    defectCategory: 'METALLURGICAL_HARDNESS_DEFICIT',
    defectReason: 'Under-transformed martensite structure resulting in average hardness 52.4 HRC below specified 58.0 HRC threshold.',
    correctiveAction: 'Quarantine entire heat lot for metallurgical review; evaluate potential re-austenitization and re-tempering feasibility.',
    quantityRejected: 100,
    notes: 'Severe quench delay or bath temperature excursion observed during thermal run.'
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(roleRepository, 'seedDefaultRolesForTenant').mockResolvedValue([] as any);
    jest.spyOn(roleRepository, 'findRolesByCodes').mockImplementation(async (_tenantId, codes) => {
      return DEFAULT_FACTORY_ROLES.filter((r) => codes.includes(r.code)).map((r) => ({
        ...r,
        id: `role_${r.code}`,
        status: 'active'
      })) as any;
    });
    jest.spyOn(furnaceCapacityRepository, 'findFurnaceById').mockImplementation(async (_t: string, id: string) => {
      if (id === 'furnace_ipsen_01') {
        return { id: 'furnace_ipsen_01', furnaceCode: 'FURNACE-IPSEN-01', name: 'Ipsen Furnace 01' } as any;
      }
      return null;
    });
    jest.spyOn(furnaceCapacityRepository, 'findFurnaceByCode').mockImplementation(async (_t: string, code: string) => {
      if (code === 'FURNACE-IPSEN-01') {
        return { id: 'furnace_ipsen_01', furnaceCode: 'FURNACE-IPSEN-01', name: 'Ipsen Furnace 01' } as any;
      }
      return null;
    });
    jest.spyOn(machineRepository, 'findById').mockResolvedValue(null);
    jest.spyOn(machineRepository, 'findByCode').mockResolvedValue(null);
    jest.spyOn(productionJobRepository, 'atomicFailInspection').mockImplementation(async (_t: string, _id: string, updateData: any) => {
      const set = updateData.$set || {};
      return createMockJobDocument({
        status: set.status,
        waitingForProduction: set.waitingForProduction,
        inProduction: set.inProduction,
        waitingForInspection: set.waitingForInspection,
        inInspection: set.inInspection,
        waitingForDispatch: set.waitingForDispatch,
        dispatched: set.dispatched,
        inspection: set.inspection,
        workflowState: {
          waitingForProduction: set['workflowState.waitingForProduction'],
          inProduction: set['workflowState.inProduction'],
          waitingForInspection: set['workflowState.waitingForInspection'],
          inInspection: set['workflowState.inInspection'],
          waitingForDispatch: set['workflowState.waitingForDispatch'],
          dispatched: set['workflowState.dispatched'],
          inspection: set['workflowState.inspection']
        },
        workflow: {
          waitingForProduction: set['workflow.waitingForProduction'],
          inProduction: set['workflow.inProduction'],
          waitingForInspection: set['workflow.waitingForInspection'],
          inInspection: set['workflow.inInspection'],
          waitingForDispatch: set['workflow.waitingForDispatch'],
          dispatched: set['workflow.dispatched'],
          inspection: set['workflow.inspection']
        },
        execution: {
          inspectionData: set['execution.inspectionData']
        }
      }) as any;
    });
    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);
  });

  // -------------------------------------------------------------------------
  // 1. Failure Eligibility (Only inInspection may be failed)
  // -------------------------------------------------------------------------
  describe('1. Failure Eligibility Enforcement', () => {
    const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);

    it('rejects failure when BO is in WAITING_FOR_PRODUCTION with 400 Bad Request', async () => {
      const job = createMockJobDocument({
        status: JobStatus.WAITING_FOR_PRODUCTION,
        inInspection: false,
        waitingForProduction: true,
        workflowState: { inInspection: false, waitingForProduction: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/quality-inspections/${job.id}/fail-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(validFailurePayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not in active inspection/i);
    });

    it('rejects failure when BO is in IN_PRODUCTION with 400 Bad Request', async () => {
      const job = createMockJobDocument({
        status: JobStatus.IN_PRODUCTION,
        inInspection: false,
        inProduction: true,
        workflowState: { inInspection: false, inProduction: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/quality-inspections/${job.id}/fail-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(validFailurePayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not in active inspection/i);
    });

    it('rejects failure when BO is in WAITING_FOR_INSPECTION with 400 Bad Request', async () => {
      const job = createMockJobDocument({
        status: JobStatus.WAITING_FOR_INSPECTION,
        inInspection: false,
        waitingForInspection: true,
        workflowState: { inInspection: false, waitingForInspection: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/quality-inspections/${job.id}/fail-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(validFailurePayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not in active inspection/i);
    });

    it('rejects failure when BO is in WAITING_FOR_DISPATCH with 400 Bad Request', async () => {
      const job = createMockJobDocument({
        status: JobStatus.WAITING_FOR_DISPATCH,
        inInspection: false,
        waitingForDispatch: true,
        workflowState: { inInspection: false, waitingForDispatch: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/quality-inspections/${job.id}/fail-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(validFailurePayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not in active inspection/i);
    });

    it('rejects failure when BO is in DISPATCHED with 400 Bad Request', async () => {
      const job = createMockJobDocument({
        status: JobStatus.DISPATCHED,
        inInspection: false,
        dispatched: true,
        workflowState: { inInspection: false, dispatched: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/quality-inspections/${job.id}/fail-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(validFailurePayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not in active inspection/i);
    });

    it('rejects failure when BO is already in INSPECTION (quarantined) with 400 Bad Request', async () => {
      const job = createMockJobDocument({
        status: JobStatus.INSPECTION,
        inInspection: false,
        inspection: true,
        workflowState: { inInspection: false, inspection: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/quality-inspections/${job.id}/fail-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(validFailurePayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not in active inspection/i);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Authorization & Exclusive Inspection Ownership
  // -------------------------------------------------------------------------
  describe('2. Authorization & Ownership Enforcement', () => {
    it('rejects failure attempt by unauthorized non-inspection role (OPERATOR) with 403 Forbidden', async () => {
      const operatorToken = generateToken('usr_operator_01', ['OPERATOR']);
      const job = createMockJobDocument();
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/quality-inspections/${job.id}/fail-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send(validFailurePayload);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects failure attempt by unauthorized PLANNER role with 403 Forbidden', async () => {
      const plannerToken = generateToken('usr_planner_01', ['PRODUCTION_PLANNER']);
      const job = createMockJobDocument();
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/quality-inspections/${job.id}/fail-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send(validFailurePayload);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('allows failure by authorized QC Inspector with 200 OK', async () => {
      const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);
      const job = createMockJobDocument({ claimedBy: 'usr_qc_lead' });
      const failedJob = createMockJobDocument({
        ...job,
        status: JobStatus.INSPECTION,
        inInspection: false,
        inspection: true,
        workflowState: { inInspection: false, inspection: true },
        workflow: { inInspection: false, inspection: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(productionJobRepository, 'atomicFailInspection').mockResolvedValue(failedJob as any);
      jest.spyOn(auditService, 'record').mockResolvedValue({} as any);
      jest.spyOn(eventBus, 'publish').mockResolvedValue();

      const res = await request(app)
        .post(`/api/v1/quality-inspections/${job.id}/fail-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(validFailurePayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(JobStatus.INSPECTION);
    });

    it('enforces exclusive claimed inspector ownership and rejects competing inspector with 403 Forbidden', async () => {
      const competingQcToken = generateToken('usr_qc_other', ['QC_INSPECTOR']);
      const job = createMockJobDocument({ claimedBy: 'usr_qc_lead' }); // Claimed by different inspector
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/quality-inspections/${job.id}/fail-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${competingQcToken}`)
        .send(validFailurePayload);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Inspection Ownership Violation/i);
    });

    it('allows QA Lead / Metallurgist supervisory override of claimed inspection session with 200 OK', async () => {
      const leadToken = generateToken('usr_quality_lead', ['METALLURGIST']);
      const job = createMockJobDocument({ claimedBy: 'usr_qc_lead' });
      const failedJob = createMockJobDocument({
        ...job,
        status: JobStatus.INSPECTION,
        inInspection: false,
        inspection: true,
        workflowState: { inInspection: false, inspection: true },
        workflow: { inInspection: false, inspection: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(productionJobRepository, 'atomicFailInspection').mockResolvedValue(failedJob as any);
      jest.spyOn(auditService, 'record').mockResolvedValue({} as any);
      jest.spyOn(eventBus, 'publish').mockResolvedValue();

      const res = await request(app)
        .post(`/api/v1/quality-inspections/${job.id}/fail-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${leadToken}`)
        .send(validFailurePayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Failure Transition & Single Active State Machine Invariant
  // -------------------------------------------------------------------------
  describe('3. Failure Transition & Single Active State Invariant', () => {
    const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);

    it('atomically sets inInspection=false, inspection=true, and all other flags false (sum=1)', async () => {
      const job = createMockJobDocument({ claimedBy: 'usr_qc_lead' });
      let capturedUpdate: any = null;

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(productionJobRepository, 'atomicFailInspection').mockImplementation(async (_t, _id, update) => {
        capturedUpdate = update;
        return createMockJobDocument({
          ...job,
          ...update.$set,
          workflowState: {
            waitingForProduction: false,
            inProduction: false,
            waitingForInspection: false,
            inInspection: false,
            waitingForDispatch: false,
            dispatched: false,
            inspection: true
          },
          workflow: {
            waitingForProduction: false,
            inProduction: false,
            waitingForInspection: false,
            inInspection: false,
            waitingForDispatch: false,
            dispatched: false,
            inspection: true
          }
        }) as any;
      });
      jest.spyOn(auditService, 'record').mockResolvedValue({} as any);
      jest.spyOn(eventBus, 'publish').mockResolvedValue();

      const res = await request(app)
        .post(`/api/v1/quality-inspections/${job.id}/fail-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(validFailurePayload);

      expect(res.status).toBe(200);
      expect(capturedUpdate).toBeDefined();

      const $set = capturedUpdate.$set;

      // 1. Status and workflow flags check
      expect($set.status).toBe('INSPECTION');
      expect($set.inInspection).toBe(false);
      expect($set.inspection).toBe(true);
      expect($set.waitingForProduction).toBe(false);
      expect($set.inProduction).toBe(false);
      expect($set.waitingForInspection).toBe(false);
      expect($set.waitingForDispatch).toBe(false);
      expect($set.dispatched).toBe(false);

      // 2. Authoritative workflow.inspection requirement
      expect($set['workflow.inspection']).toBe(true);
      expect($set['workflow.inInspection']).toBe(false);
      expect($set['workflow.waitingForDispatch']).toBe(false);

      // 3. workflowState nested object check
      expect($set['workflowState.inspection']).toBe(true);
      expect($set['workflowState.inInspection']).toBe(false);
      expect($set['workflowState.waitingForDispatch']).toBe(false);

      // 4. Invariant: Exactly one active state (sum = 1)
      const flags = [
        $set.waitingForProduction,
        $set.inProduction,
        $set.waitingForInspection,
        $set.inInspection,
        $set.waitingForDispatch,
        $set.dispatched,
        $set.inspection
      ];
      const activeCount = flags.filter(Boolean).length;
      expect(activeCount).toBe(1);

      // 5. Piece count balance check
      expect($set['quantity.completedQuantity']).toBe(0);
      expect($set['quantity.scrappedQuantity']).toBe(100);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Data Preservation (Inspection Results & Test Readings Preserved)
  // -------------------------------------------------------------------------
  describe('4. Data Preservation & Failure Information', () => {
    const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);

    it('preserves test actuals, equipment, and measurements that led to failure without erasure', async () => {
      const job = createMockJobDocument({ claimedBy: 'usr_qc_lead' });
      let capturedUpdate: any = null;

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(productionJobRepository, 'atomicFailInspection').mockImplementation(async (_t, _id, update) => {
        capturedUpdate = update;
        return createMockJobDocument({ ...job, ...update.$set }) as any;
      });
      jest.spyOn(auditService, 'record').mockResolvedValue({} as any);
      jest.spyOn(eventBus, 'publish').mockResolvedValue();

      const res = await request(app)
        .post(`/api/v1/quality-inspections/${job.id}/fail-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(validFailurePayload);

      expect(res.status).toBe(200);

      const inspectionData = capturedUpdate.$set['execution.inspectionData'];
      expect(inspectionData).toBeDefined();

      // Equipment Preserved
      expect(inspectionData.furnaceId).toBe('furnace_ipsen_01');
      expect(inspectionData.furnaceCode).toBe('FURNACE-IPSEN-01');
      expect(inspectionData.equipment.furnaceId).toBe('furnace_ipsen_01');

      // Hardness Spec & Test Actuals Preserved
      expect(inspectionData.minHardness).toBe(58);
      expect(inspectionData.maxHardness).toBe(62);
      expect(inspectionData.measuredAverage).toBe(52.4);
      expect(inspectionData.testPoints.length).toBe(3);
      expect(inspectionData.isHardnessCompliant).toBe(false);

      // Case Depth Preserved
      expect(inspectionData.effectiveCaseDepthMm).toBe(0.55);
      expect(inspectionData.isCaseDepthCompliant).toBe(false);
      expect(inspectionData.caseDepthMethod).toBe('MICROHARDNESS_TRAVERSE');

      // Quantities Preserved
      expect(inspectionData.quantityReceived).toBe(100);
      expect(inspectionData.quantityDelivered).toBe(0);
      expect(inspectionData.quantityRejected).toBe(100);

      // Disposition & Failure Info Recorded
      expect(inspectionData.disposition).toBe('REJECTED');
      expect(inspectionData.defectCategory).toBe(validFailurePayload.defectCategory);
      expect(inspectionData.defectReason).toBe(validFailurePayload.defectReason);
      expect(inspectionData.correctiveAction).toBe(validFailurePayload.correctiveAction);
      expect(inspectionData.notes).toBe(validFailurePayload.notes);
    });

    it('rejects failure when defectCategory is missing with 422 Unprocessable Entity', async () => {
      const job = createMockJobDocument({ claimedBy: 'usr_qc_lead' });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const invalidPayload = { ...validFailurePayload, defectCategory: '' };
      const res = await request(app)
        .post(`/api/v1/quality-inspections/${job.id}/fail-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(invalidPayload);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('rejects failure when defectReason is missing with 422 Unprocessable Entity', async () => {
      const job = createMockJobDocument({ claimedBy: 'usr_qc_lead' });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const invalidPayload = { ...validFailurePayload, defectReason: '' };
      const res = await request(app)
        .post(`/api/v1/quality-inspections/${job.id}/fail-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(invalidPayload);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Dispatch Protection (Queue Exclusion & Ineligibility)
  // -------------------------------------------------------------------------
  describe('5. Dispatch Protection & Queue Exclusion', () => {
    const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);

    it('failed BO does not appear in waiting-for-dispatch queue', async () => {
      const failedJob = createMockJobDocument({
        status: JobStatus.INSPECTION,
        inInspection: false,
        inspection: true,
        waitingForDispatch: false,
        workflowState: { inInspection: false, inspection: true, waitingForDispatch: false }
      });

      // Mock repository queue returning only jobs with waitingForDispatch: true
      jest.spyOn(productionJobRepository, 'findWaitingForDispatchQueue').mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/quality-inspections/waiting-for-dispatch')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(0);
    });

    it('failed BO appears in inspection-failed quarantine queue', async () => {
      const failedJob = createMockJobDocument({
        status: JobStatus.INSPECTION,
        inInspection: false,
        inspection: true,
        waitingForDispatch: false,
        workflowState: { inInspection: false, inspection: true, waitingForDispatch: false }
      });

      jest.spyOn(productionJobRepository, 'findInspectionFailedQueue').mockResolvedValue([failedJob as any]);

      const res = await request(app)
        .get('/api/v1/quality-inspections/inspection-failed')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].status).toBe(JobStatus.INSPECTION);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Outward Challan (OC) Creation Protection
  // -------------------------------------------------------------------------
  describe('6. Outward Challan (OC) Creation Protection', () => {
    it('strictly blocks OC creation in DispatchService for finished goods linked to a failed BO', async () => {
      const actor = { userId: 'usr_dispatch_01', email: 'dispatch@factory.com', role: 'DISPATCH_MANAGER' };
      const failedJob = createMockJobDocument({
        id: 'bo_fail_oc_001',
        jobNumber: 'BO-202609-OCFAIL',
        status: JobStatus.INSPECTION,
        inInspection: false,
        inspection: true,
        waitingForDispatch: false,
        workflowState: { inInspection: false, inspection: true, waitingForDispatch: false }
      });

      const mockCustomer = {
        id: 'cust_01',
        customerCode: 'CUST-01',
        customerName: 'Test Customer',
        qualityStatus: 'active',
        isDeleted: false
      };

      const mockFg = {
        id: 'fg_01',
        fgLotNumber: 'FG-LOT-FAIL-01',
        customerCode: 'CUST-01',
        status: 'AVAILABLE',
        availableQuantity: 100,
        uom: 'PCS',
        jobCardId: 'bo_fail_oc_001',
        jobCardNumber: 'BO-202609-OCFAIL',
        isDeleted: false
      };

      jest.spyOn(customerRepository, 'findById').mockResolvedValue(mockCustomer as any);
      jest.spyOn(finishedGoodsRepository, 'findById').mockResolvedValue(mockFg as any);
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(failedJob as any);

      await expect(
        dispatchService.createDispatch(testTenant, actor, {
          customerId: 'cust_01',
          dispatchDate: new Date().toISOString(),
          destinationAddress: '123 Industrial Way',
          lines: [
            {
              finishedGoodsId: 'fg_01',
              dispatchedQuantity: 50
            }
          ]
        })
      ).rejects.toThrow(/Dispatch Protection Violation.*failed Quality Inspection and is quarantined/i);
    });
  });

  // -------------------------------------------------------------------------
  // 7. Duplicate Failure & Concurrency Race Protection
  // -------------------------------------------------------------------------
  describe('7. Duplicate Failure & Concurrency Control', () => {
    const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);

    it('returns 409 Conflict when atomicFailInspection returns null on concurrent collision', async () => {
      const job = createMockJobDocument({ claimedBy: 'usr_qc_lead' });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      // Simulate atomic findOneAndUpdate failing because another transaction already updated the state
      jest.spyOn(productionJobRepository, 'atomicFailInspection').mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/v1/quality-inspections/${job.id}/fail-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(validFailurePayload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Failure Conflict/i);
    });
  });

  // -------------------------------------------------------------------------
  // 8. State Manipulation & Quarantine Lockout
  // -------------------------------------------------------------------------
  describe('8. State Manipulation & Quarantine Lockout', () => {
    const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);
    const transitionOperatorToken = generateToken('usr_operator_01', ['FURNACE_OPERATOR']);

    it('prohibits generic status transition from INSPECTION to WAITING_FOR_DISPATCH with 400 Bad Request', async () => {
      const failedJob = createMockJobDocument({
        status: JobStatus.INSPECTION,
        inInspection: false,
        inspection: true,
        workflowState: { inInspection: false, inspection: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(failedJob as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${failedJob.id}/transition`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${transitionOperatorToken}`)
        .send({ toStatus: 'WAITING_FOR_DISPATCH', reason: 'Attempted bypass' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Quarantine Lock Violation/i);
    });

    it('prohibits generic status transition from INSPECTION to DISPATCHED with 400 Bad Request', async () => {
      const failedJob = createMockJobDocument({
        status: JobStatus.INSPECTION,
        inInspection: false,
        inspection: true,
        workflowState: { inInspection: false, inspection: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(failedJob as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${failedJob.id}/transition`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${transitionOperatorToken}`)
        .send({ toStatus: 'DISPATCHED', reason: 'Attempted bypass' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Quarantine Lock Violation/i);
    });

    it('prohibits calling approve-dispatch on failed BO with 400 Bad Request', async () => {
      const failedJob = createMockJobDocument({
        status: JobStatus.INSPECTION,
        inInspection: false,
        inspection: true,
        workflowState: { inInspection: false, inspection: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(failedJob as any);

      const res = await request(app)
        .post(`/api/v1/quality-inspections/${failedJob.id}/approve-dispatch`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({
          furnaceId: 'FURNACE-01',
          furnaceCode: 'FURNACE-01',
          minHardness: 58,
          maxHardness: 62,
          scale: 'HRC',
          measuredAverage: 60,
          effectiveCaseDepthMm: 1.0,
          quantityReceived: 100,
          quantityDelivered: 100
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not in active inspection/i);
    });

    it('prohibits taking failed BO into production with 400 Bad Request', async () => {
      const operatorToken = generateToken('usr_operator_01', ['FURNACE_OPERATOR']);
      const failedJob = createMockJobDocument({
        status: JobStatus.INSPECTION,
        inInspection: false,
        inspection: true,
        waitingForProduction: false,
        workflowState: { inInspection: false, inspection: true, waitingForProduction: false }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(failedJob as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${failedJob.id}/take-for-production`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ furnaceId: 'furnace_01' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Only Batch Orders waiting for production may be taken/i);
    });

    it('prohibits taking failed BO into inspection with 400 Bad Request', async () => {
      const failedJob = createMockJobDocument({
        status: JobStatus.INSPECTION,
        inInspection: false,
        inspection: true,
        claimedBy: null,
        workflowState: { inInspection: false, inspection: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(failedJob as any);

      const res = await request(app)
        .post(`/api/v1/quality-inspections/${failedJob.id}/take-for-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({ inspectorId: 'usr_qc_lead' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/completed\/dispatched\/quarantined status/i);
    });
  });

  // -------------------------------------------------------------------------
  // 9. Historical Integrity, Audit Trail & Domain Events
  // -------------------------------------------------------------------------
  describe('9. Historical Integrity, Audit Trail & Domain Events', () => {
    const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);

    it('records audit log and publishes DomainEvents.JOB_INSPECTION_FAILED with complete trace', async () => {
      const job = createMockJobDocument({ claimedBy: 'usr_qc_lead' });
      const failedJob = createMockJobDocument({
        ...job,
        status: JobStatus.INSPECTION,
        inInspection: false,
        inspection: true,
        workflowState: { inInspection: false, inspection: true },
        workflow: { inInspection: false, inspection: true }
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(productionJobRepository, 'atomicFailInspection').mockResolvedValue(failedJob as any);
      const auditSpy = jest.spyOn(auditService, 'record').mockResolvedValue({} as any);
      const eventSpy = jest.spyOn(eventBus, 'publish').mockResolvedValue();

      const res = await request(app)
        .post(`/api/v1/quality-inspections/${job.id}/fail-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(validFailurePayload);

      expect(res.status).toBe(200);

      // Verify Audit Call
      expect(auditSpy).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          action: 'INSPECTION_FAILED_QUARANTINED',
          actorId: 'usr_qc_lead',
          entityType: 'BatchOrder',
          metadata: expect.objectContaining({
            toStatus: 'INSPECTION',
            defectCategory: validFailurePayload.defectCategory,
            defectReason: validFailurePayload.defectReason
          })
        })
      );

      // Verify Domain Event Publication
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: DomainEvents.JOB_INSPECTION_FAILED,
          tenantId: testTenant,
          actorId: 'usr_qc_lead',
          payload: expect.objectContaining({
            jobId: failedJob.id,
            toStatus: 'INSPECTION',
            defectCategory: validFailurePayload.defectCategory,
            defectReason: validFailurePayload.defectReason
          })
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // 10. Router Compatibility & Dual Route Access
  // -------------------------------------------------------------------------
  describe('10. Router Compatibility & Dual Route Access', () => {
    const qcToken = generateToken('usr_qc_lead', ['QC_INSPECTOR']);

    it('allows failure via /api/v1/quality-inspections/:id/fail-inspection', async () => {
      const job = createMockJobDocument({ claimedBy: 'usr_qc_lead' });
      const failedJob = createMockJobDocument({
        ...job,
        status: JobStatus.INSPECTION,
        inInspection: false,
        inspection: true,
        workflowState: { inInspection: false, inspection: true },
        workflow: { inInspection: false, inspection: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(productionJobRepository, 'atomicFailInspection').mockResolvedValue(failedJob as any);
      jest.spyOn(eventBus, 'publish').mockResolvedValue();

      const res = await request(app)
        .post(`/api/v1/quality-inspections/${job.id}/fail-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(validFailurePayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(JobStatus.INSPECTION);
    });

    it('allows failure via /api/v1/production-jobs/:id/fail-inspection', async () => {
      const job = createMockJobDocument({ claimedBy: 'usr_qc_lead' });
      const failedJob = createMockJobDocument({
        ...job,
        status: JobStatus.INSPECTION,
        inInspection: false,
        inspection: true,
        workflowState: { inInspection: false, inspection: true },
        workflow: { inInspection: false, inspection: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(productionJobRepository, 'atomicFailInspection').mockResolvedValue(failedJob as any);
      jest.spyOn(eventBus, 'publish').mockResolvedValue();

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/fail-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(validFailurePayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(JobStatus.INSPECTION);
    });

    it('allows failure via /api/v1/production-jobs/batch-orders/:id/fail-inspection', async () => {
      const job = createMockJobDocument({ claimedBy: 'usr_qc_lead' });
      const failedJob = createMockJobDocument({
        ...job,
        status: JobStatus.INSPECTION,
        inInspection: false,
        inspection: true,
        workflowState: { inInspection: false, inspection: true },
        workflow: { inInspection: false, inspection: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(productionJobRepository, 'atomicFailInspection').mockResolvedValue(failedJob as any);
      jest.spyOn(eventBus, 'publish').mockResolvedValue();

      const res = await request(app)
        .post(`/api/v1/production-jobs/batch-orders/${job.id}/fail-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${qcToken}`)
        .send(validFailurePayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(JobStatus.INSPECTION);
    });
  });
});
