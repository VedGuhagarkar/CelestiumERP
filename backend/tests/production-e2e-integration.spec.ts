import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { furnaceCapacityRepository } from '../src/modules/furnace-capacity/furnace-capacity.repository.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { JobStatus } from '../src/core/constants/status.js';

describe('Production Phase Prompt 10: Complete Production Phase Integration, Testing and Final Cleanup', () => {
  const app = createApp();
  const testTenant = 'tenant_prod_e2e_p10_001';

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const createMockJobDoc = (id: string, jobNumber: string, overrides: any = {}) => {
    const doc: any = {
      _id: id,
      id,
      jobNumber,
      boNumber: jobNumber,
      batchOrderNumber: jobNumber,
      tenantId: testTenant,
      poId: 'po_aero_101',
      poNumber: 'PO-2026-00101',
      grnId: 'grn_aero_501',
      grnNumber: 'GRN-202609-0501',
      status: JobStatus.WAITING_FOR_PRODUCTION,
      waitingForProduction: true,
      inProduction: false,
      waitingForInspection: false,
      inInspection: false,
      waitingForDispatch: false,
      dispatched: false,
      workflowState: {
        waitingForProduction: true,
        inProduction: false,
        waitingForInspection: false,
        inInspection: false,
        waitingForDispatch: false,
        dispatched: false
      },
      priority: 'HIGH',
      assignedFurnaceId: 'furnace_vac_01',
      assignedFurnaceCode: 'FURNACE-VAC-01',
      assignedOperatorId: 'usr_prod_op01',
      customer: {
        customerId: 'cust_001',
        customerCode: 'CUST-AERO-01',
        customerName: 'Aero Dynamics Global Inc.'
      },
      item: {
        itemId: 'item_4340',
        itemCode: 'PART-SHAFT-4340',
        itemName: 'Turbine Rotor Shaft 4340',
        materialGrade: 'AISI 4340',
        uom: 'PCS'
      },
      quantity: {
        targetQuantity: 100,
        loadedQuantity: 100,
        completedQuantity: 0,
        scrappedQuantity: 0
      },
      weightKg: 50,
      recipeSnapshot: {
        recipeId: 'rec_vac_4340',
        recipeCode: 'REC-VAC-4340',
        name: 'Vacuum Austenitize & 2-Bar N2 Quench',
        revisionNumber: 2,
        processFamily: 'VACUUM_HEAT_TREATMENT',
        stages: [
          {
            sequence: 1,
            stageName: 'Preheat Ramp',
            targetTemperatureC: 650,
            temperatureToleranceMinusC: 10,
            temperatureTolerancePlusC: 10,
            soakTimeMinutes: 45,
            soakCriteria: 'SURFACE_TC_REACHED'
          },
          {
            sequence: 2,
            stageName: 'Austenitizing Soak',
            targetTemperatureC: 845,
            temperatureToleranceMinusC: 10,
            temperatureTolerancePlusC: 10,
            soakTimeMinutes: 90,
            soakCriteria: 'LOAD_THERMOCOUPLE_REACHED',
            atmosphereDetails: 'Partial pressure N2 1.5 mbar'
          }
        ]
      },
      processDetails: Array.from({ length: 15 }, (_, i) => ({
        serialNumber: i + 1,
        position: i + 1,
        stageName: `Stage ${i + 1}`,
        process: 'VACUUM_HEAT_TREATMENT',
        targetTemp: 650,
        targetDurationMinutes: 45
      })),
      genealogy: {
        whichPo: {
          poId: 'po_aero_101',
          poNumber: 'PO-2026-00101',
          supplierName: 'Aero Dynamics Global Inc.'
        },
        whichGrn: {
          grnId: 'grn_aero_501',
          grnNumber: 'GRN-202609-0501',
          supplierName: 'Aero Dynamics Global Inc.'
        },
        whichPart: {
          itemId: 'item_4340',
          itemCode: 'PART-SHAFT-4340',
          itemName: 'Turbine Rotor Shaft 4340',
          materialGrade: 'AISI 4340',
          uom: 'PCS'
        },
        whichRecipe: {
          recipeId: 'rec_vac_4340',
          recipeCode: 'REC-VAC-4340',
          recipeName: 'Vacuum Austenitize & 2-Bar N2 Quench',
          revisionNumber: 2,
          processFamily: 'VACUUM_HEAT_TREATMENT'
        },
        isImmutable: true
      },
      equipmentAssignment: {
        furnaceId: 'furnace_vac_01',
        furnaceCode: 'FURNACE-VAC-01',
        locationBay: 'Bay 1 Vacuum Bay',
        pyrometryClass: 'CLASS_2'
      },
      timeline: {
        plannedStartDate: new Date('2026-09-10T08:00:00.000Z'),
        targetCompletionDate: new Date('2026-09-11T08:00:00.000Z'),
        actualStartDate: null,
        dueDate: '2026-09-15'
      },
      execution: {
        furnaceCharge: null,
        stageProgress: []
      },
      transitionHistory: [],
      isDeleted: false,
      save: jest.fn().mockImplementation(async function () {
        return this;
      }),
      toJSON() {
        return { ...this };
      },
      ...overrides
    };

    return doc;
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);
    jest.spyOn(roleRepository, 'seedDefaultRolesForTenant').mockResolvedValue([] as any);

    jest.spyOn(furnaceCapacityRepository, 'findFurnaceById').mockImplementation(async (_tenant: string, id: string) => {
      if (id === 'furnace_vac_01') {
        return {
          id: 'furnace_vac_01',
          furnaceCode: 'FURNACE-VAC-01',
          name: 'Ipsen 2-Bar Vacuum Furnace',
          status: 'OPERATIONAL',
          locationBay: 'Bay 1 Vacuum Bay',
          capacityKg: 1000,
          thermalCapabilities: {
            maxOperatingTempC: 1300,
            pyrometryClass: 'CLASS_2',
            maxChargeWeightKg: 1000
          },
          isDeleted: false
        } as any;
      }
      return null;
    });

    jest.spyOn(roleRepository, 'findRolesByCodes').mockImplementation(async (_tenantId, codes) => {
      return codes.map((code) => {
        if (code === 'OPERATOR' || code === 'MACHINIST' || code === 'FURNACE_OPERATOR') {
          const fo = DEFAULT_FACTORY_ROLES.find((r) => r.code === 'FURNACE_OPERATOR')!;
          return { ...fo, code, id: `role_${code}`, status: 'active' };
        }
        if (code === 'PRODUCTION_SUPERVISOR' || code === 'PLANT_MANAGER') {
          const pm = DEFAULT_FACTORY_ROLES.find((r) => r.code === 'PLANT_MANAGER')!;
          return { ...pm, code, id: `role_${code}`, status: 'active' };
        }
        if (code === 'QC_INSPECTOR' || code === 'QUALITY_INSPECTOR') {
          const qc = DEFAULT_FACTORY_ROLES.find((r) => r.code === 'QC_INSPECTOR')!;
          return { ...qc, code, id: `role_${code}`, status: 'active' };
        }
        const found = DEFAULT_FACTORY_ROLES.find((r) => r.code === code);
        return (
          found
            ? { ...found, id: `role_${code}`, status: 'active' }
            : { code, id: `role_${code}`, status: 'active', permissions: [] }
        );
      }) as any;
    });
  });

  // ---------------------------------------------------------------------------
  // Section 2: Creation-to-Production Traceability (PO -> GRN -> BO -> Recipe -> Production)
  // ---------------------------------------------------------------------------
  describe('2. Creation-to-Production Traceability & Lineage Integrity', () => {
    it('should maintain verified, unbroken PO -> GRN -> BO -> Recipe -> Production lineage', async () => {
      const mockJob = createMockJobDoc('job_e2e_001', 'BO-202609-0001');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const opToken = generateToken('usr_prod_op01', ['PRODUCTION_SUPERVISOR']);

      const res = await request(app)
        .get('/api/v1/production-jobs/job_e2e_001/genealogy')
        .set('Authorization', `Bearer ${opToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const genealogy = res.body.data.genealogy || res.body.data;
      expect(genealogy.whichPo.poNumber).toBe('PO-2026-00101');
      expect(genealogy.whichGrn.grnNumber).toBe('GRN-202609-0501');
      expect(genealogy.whichPart.itemCode).toBe('PART-SHAFT-4340');
      expect(genealogy.whichRecipe.recipeCode).toBe('REC-VAC-4340');
      expect(genealogy.whichRecipe.revisionNumber).toBe(2);
      expect(genealogy.isImmutable).toBe(true);
    });

    it('should reject attempts to modify source genealogy or recipe relationships', async () => {
      const mockJob = createMockJobDoc('job_e2e_001', 'BO-202609-0001');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const opToken = generateToken('usr_prod_op01', ['PRODUCTION_SUPERVISOR']);

      const res = await request(app)
        .patch('/api/v1/production-jobs/job_e2e_001')
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          recipeSnapshot: { recipeCode: 'MALICIOUS-RECIPE' },
          poNumber: 'PO-MALICIOUS',
          grnNumber: 'GRN-MALICIOUS'
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.message || JSON.stringify(res.body.errors)).toMatch(/Recipe Protection Violation|Genealogy Violation|Read-Only Source Data Violation|validation failed/i);
    });
  });

  // ---------------------------------------------------------------------------
  // Section 3: Realistic 17-Step End-to-End Production Workflow
  // ---------------------------------------------------------------------------
  describe('3. Realistic 17-Step End-to-End Production Lifecycle Execution', () => {
    it('should successfully execute complete lifecycle from waiting to inspection handoff', async () => {
      // Step 1: Valid BO in WAITING_FOR_PRODUCTION
      const mockJob = createMockJobDoc('job_e2e_flow', 'BO-202609-FLOW', {
        status: JobStatus.WAITING_FOR_PRODUCTION,
        waitingForProduction: true,
        inProduction: false,
        waitingForInspection: false,
        workflowState: {
          waitingForProduction: true,
          inProduction: false,
          waitingForInspection: false,
          inInspection: false,
          waitingForDispatch: false,
          dispatched: false
        }
      });

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);
      jest.spyOn(productionJobRepository, 'findWaitingForProductionQueue').mockResolvedValue([mockJob]);
      jest.spyOn(productionJobRepository, 'findInProductionQueue').mockResolvedValue([]);
      jest.spyOn(productionJobRepository, 'findWaitingForInspectionQueue').mockResolvedValue([]);

      // Step 2: Log in as authorized Production user
      const opToken = generateToken('usr_prod_op01', ['PRODUCTION_SUPERVISOR']);

      // Step 3: View Production Queue
      const resQueue = await request(app)
        .get('/api/v1/production-jobs/waiting-for-production')
        .set('Authorization', `Bearer ${opToken}`);

      expect(resQueue.status).toBe(200);
      expect(resQueue.body.data).toHaveLength(1);
      expect(resQueue.body.data[0].jobNumber).toBe('BO-202609-FLOW');

      // Step 4: Select BO / View Operator Workspace
      const resWorkspace = await request(app)
        .get('/api/v1/production-jobs/job_e2e_flow/operator-workspace')
        .set('Authorization', `Bearer ${opToken}`);

      expect(resWorkspace.status).toBe(200);
      expect(resWorkspace.body.data.headerContext.recipe.recipeCode).toBe('REC-VAC-4340');
      expect(resWorkspace.body.data.headerContext.poNumber).toBe('PO-2026-00101');
      expect(resWorkspace.body.data.headerContext.grnNumber).toBe('GRN-202609-0501');
      expect(resWorkspace.body.data.headerContext.part.itemCode).toBe('PART-SHAFT-4340');

      // Step 5 & 6: Take the BO for production
      jest.spyOn(productionJobRepository, 'atomicTakeForProduction').mockImplementation(async () => {
        mockJob.status = JobStatus.IN_PRODUCTION;
        mockJob.waitingForProduction = false;
        mockJob.inProduction = true;
        mockJob.waitingForInspection = false;
        mockJob.workflowState = {
          waitingForProduction: false,
          inProduction: true,
          waitingForInspection: false,
          inInspection: false,
          waitingForDispatch: false,
          dispatched: false
        };
        mockJob.timeline.actualStartDate = new Date();
        return mockJob;
      });

      const resTake = await request(app)
        .post('/api/v1/production-jobs/job_e2e_flow/take-for-production')
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          furnaceId: 'furnace_vac_01',
          furnaceCode: 'FURNACE-VAC-01',
          notes: 'Started by Production Supervisor'
        });

      expect(resTake.status).toBe(200);
      expect(resTake.body.data.status).toBe('IN_PRODUCTION');

      // Step 7: Verify all previous workflow flags are cleared
      expect(mockJob.status).toBe('IN_PRODUCTION');
      expect(mockJob.waitingForProduction).toBe(false);
      expect(mockJob.inProduction).toBe(true);
      expect(mockJob.waitingForInspection).toBe(false);
      expect(mockJob.workflowState.inProduction).toBe(true);
      expect(mockJob.workflowState.waitingForProduction).toBe(false);

      // Step 8: Verify another Production user cannot take the BO
      jest.spyOn(productionJobRepository, 'atomicTakeForProduction').mockResolvedValue(null);
      const otherToken = generateToken('usr_prod_op02', ['FURNACE_OPERATOR']);

      const resTakeConflict = await request(app)
        .post('/api/v1/production-jobs/job_e2e_flow/take-for-production')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          furnaceId: 'furnace_vac_01',
          furnaceCode: 'FURNACE-VAC-01'
        });

      expect(resTakeConflict.status).toBe(409);
      expect(resTakeConflict.body.message).toMatch(/Concurrent Claim Conflict|already in production/i);

      // Step 9: Verify Recipe is displayed
      const resWorkspaceInProd = await request(app)
        .get('/api/v1/production-jobs/job_e2e_flow/operator-workspace')
        .set('Authorization', `Bearer ${opToken}`);

      expect(resWorkspaceInProd.status).toBe(200);
      expect(resWorkspaceInProd.body.data.recipePanel.stages).toHaveLength(2);
      expect(resWorkspaceInProd.body.data.recipePanel.stages[0].targetTemperatureC).toBe(650);

      // Step 10: Enter required Production data (Furnace Charge)
      const resCharge = await request(app)
        .post('/api/v1/production-jobs/job_e2e_flow/charge')
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          furnaceId: 'furnace_vac_01',
          furnaceCode: 'FURNACE-VAC-01',
          chargeNumber: 'CHG-202609-001',
          loadedPieceCount: 100,
          loadedWeightKg: 50,
          initialFurnaceTempC: 25,
          atmosphereType: 'VACUUM',
          shift: 'SHIFT_A',
          notes: 'Standard aero charge'
        });

      expect(resCharge.status).toBe(200);

      // Step 11: Validate actual values & Record Stage Progress
      const resStage1 = await request(app)
        .post('/api/v1/production-jobs/job_e2e_flow/recipe-stage-progress')
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          stageSequence: 1,
          actualTemperatureC: 652,
          actualDurationMinutes: 46,
          soakStartTime: new Date('2026-09-10T09:00:00.000Z'),
          soakEndTime: new Date('2026-09-10T09:46:00.000Z'),
          notes: 'Preheat ramp completed within ±10C spec'
        });

      expect(resStage1.status).toBe(200);

      const resStage2 = await request(app)
        .post('/api/v1/production-jobs/job_e2e_flow/recipe-stage-progress')
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          stageSequence: 2,
          actualTemperatureC: 846,
          actualDurationMinutes: 91,
          soakStartTime: new Date('2026-09-10T10:00:00.000Z'),
          soakEndTime: new Date('2026-09-10T11:31:00.000Z'),
          vacuumLevelMbar: 1.48,
          notes: 'Austenitizing soak completed; 2-bar N2 quench initiated'
        });

      expect(resStage2.status).toBe(200);

      // Step 12: Save Partial Production Data
      const resSave = await request(app)
        .post('/api/v1/production-jobs/job_e2e_flow/save-production-data')
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          operatorNotes: 'Production cycles verified by lead thermal engineer',
          furnaceCharge: {
            furnaceId: 'furnace_vac_01',
            furnaceCode: 'FURNACE-VAC-01',
            chargeNumber: 'CHG-202609-001',
            loadedPieceCount: 100,
            loadedWeightKg: 50,
            initialFurnaceTempC: 25,
            atmosphereType: 'VACUUM',
            notes: 'Verified load'
          }
        });

      expect(resSave.status).toBe(200);

      // Step 13: Complete all required Production information & evaluate readiness
      const resReadiness = await request(app)
        .get('/api/v1/production-jobs/job_e2e_flow/production-execution-readiness')
        .set('Authorization', `Bearer ${opToken}`);

      expect(resReadiness.status).toBe(200);
      expect(typeof resReadiness.body.data.isReadyForInspection).toBe('boolean');
      expect(resReadiness.body.data.status).toBe('IN_PRODUCTION');

      // Step 14: Approve the BO for Inspection
      jest.spyOn(productionJobRepository, 'atomicApproveForInspection').mockImplementation(async (_tenantId, _id, updateData: any) => {
        const setObj = updateData.$set || {};
        Object.assign(mockJob, setObj);
        mockJob.status = JobStatus.WAITING_FOR_INSPECTION;
        mockJob.inProduction = false;
        mockJob.waitingForInspection = true;
        mockJob.workflowState = {
          ...mockJob.workflowState,
          waitingForProduction: false,
          inProduction: false,
          waitingForInspection: true,
          inInspection: false,
          waitingForDispatch: false,
          dispatched: false
        };
        return mockJob;
      });

      const resApprove = await request(app)
        .post('/api/v1/production-jobs/job_e2e_flow/approve-for-inspection')
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          completedQuantity: 100,
          scrappedQuantity: 0,
          notes: 'Batch heat treatment execution completed. Handing off to QC inspection.'
        });

      expect(resApprove.status).toBe(200);
      expect(resApprove.body.data.status).toBe('WAITING_FOR_INSPECTION');

      // Step 15: Verify the state becomes waiting for inspection
      expect(mockJob.status).toBe(JobStatus.WAITING_FOR_INSPECTION);
      expect(mockJob.inProduction).toBe(false);
      expect(mockJob.waitingForInspection).toBe(true);
      expect(mockJob.workflowState.waitingForInspection).toBe(true);
      expect(mockJob.workflowState.inProduction).toBe(false);

      // Step 16: Verify the BO disappears from active Production
      jest.spyOn(productionJobRepository, 'findWaitingForProductionQueue').mockResolvedValue([]);
      jest.spyOn(productionJobRepository, 'findInProductionQueue').mockResolvedValue([]);
      jest.spyOn(productionJobRepository, 'findWaitingForInspectionQueue').mockResolvedValue([mockJob]);

      const resInProdQueue = await request(app)
        .get('/api/v1/production-jobs/in-production')
        .set('Authorization', `Bearer ${opToken}`);

      expect(resInProdQueue.status).toBe(200);
      expect(resInProdQueue.body.data).toHaveLength(0);

      // Step 17: Verify Inspection users can now identify it
      const qcToken = generateToken('usr_qc_lead', ['QUALITY_INSPECTOR']);
      const resInspQueue = await request(app)
        .get('/api/v1/production-jobs/waiting-for-inspection')
        .set('Authorization', `Bearer ${qcToken}`);

      expect(resInspQueue.status).toBe(200);
      expect(resInspQueue.body.data).toHaveLength(1);
      expect(resInspQueue.body.data[0].jobNumber).toBe('BO-202609-FLOW');
    }, 30000);
  });

  // ---------------------------------------------------------------------------
  // Section 4: Invalid Workflow Testing
  // ---------------------------------------------------------------------------
  describe('4. Invalid Workflow Rejection Matrix', () => {
    it('should reject taking a BO that is already in production', async () => {
      const mockJob = createMockJobDoc('job_in_prod', 'BO-IN-PROD', {
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true,
        workflowState: { inProduction: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const opToken = generateToken('usr_prod_op01', ['PRODUCTION_SUPERVISOR']);
      const res = await request(app)
        .post('/api/v1/production-jobs/job_in_prod/take-for-production')
        .set('Authorization', `Bearer ${opToken}`)
        .send({ furnaceId: 'furnace_vac_01', furnaceCode: 'FURNACE-VAC-01' });

      expect([400, 409]).toContain(res.status);
      expect(res.body.message).toMatch(/already in production|already in_production|already IN_PRODUCTION|Concurrent Claim Conflict/i);
    });

    it('should reject taking a BO waiting for inspection', async () => {
      const mockJob = createMockJobDoc('job_in_insp', 'BO-IN-INSP', {
        status: JobStatus.WAITING_FOR_INSPECTION,
        waitingForProduction: false,
        inProduction: false,
        waitingForInspection: true,
        workflowState: { waitingForInspection: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const opToken = generateToken('usr_prod_op01', ['PRODUCTION_SUPERVISOR']);
      const res = await request(app)
        .post('/api/v1/production-jobs/job_in_insp/take-for-production')
        .set('Authorization', `Bearer ${opToken}`)
        .send({ furnaceId: 'furnace_vac_01', furnaceCode: 'FURNACE-VAC-01' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Cannot take Batch Order|Invalid State Transition|Only Batch Orders waiting for production/i);
    });

    it('should reject taking a dispatched BO', async () => {
      const mockJob = createMockJobDoc('job_disp', 'BO-DISP', {
        status: JobStatus.DISPATCHED,
        waitingForProduction: false,
        inProduction: false,
        dispatched: true,
        workflowState: { dispatched: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const opToken = generateToken('usr_prod_op01', ['PRODUCTION_SUPERVISOR']);
      const res = await request(app)
        .post('/api/v1/production-jobs/job_disp/take-for-production')
        .set('Authorization', `Bearer ${opToken}`)
        .send({ furnaceId: 'furnace_vac_01', furnaceCode: 'FURNACE-VAC-01' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Cannot take Batch Order|Invalid State Transition/i);
    });

    it('should reject approving a waiting-for-production BO', async () => {
      const mockJob = createMockJobDoc('job_wait', 'BO-WAIT', {
        status: JobStatus.WAITING_FOR_PRODUCTION,
        waitingForProduction: true,
        inProduction: false,
        workflowState: { waitingForProduction: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const opToken = generateToken('usr_prod_op01', ['PRODUCTION_SUPERVISOR']);
      const res = await request(app)
        .post('/api/v1/production-jobs/job_wait/approve-for-inspection')
        .set('Authorization', `Bearer ${opToken}`)
        .send({ completedQuantity: 100 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Eligibility Violation|must be in 'IN_PRODUCTION'/i);
    });

    it('should reject approving an incomplete BO lacking furnace charge or execution data', async () => {
      const mockJob = createMockJobDoc('job_incomp', 'BO-INCOMP', {
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true,
        workflowState: { inProduction: true },
        execution: { furnaceCharge: null, stageProgress: [] }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const opToken = generateToken('usr_prod_op01', ['PRODUCTION_SUPERVISOR']);
      const res = await request(app)
        .post('/api/v1/production-jobs/job_incomp/approve-for-inspection')
        .set('Authorization', `Bearer ${opToken}`)
        .send({ completedQuantity: 100 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Cannot approve for inspection|Incomplete Production Execution|Incomplete Recipe execution/i);
    });

    it('should reject sending a BO directly from Production to Dispatch', async () => {
      const mockJob = createMockJobDoc('job_prod_disp', 'BO-PROD-DISP', {
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true,
        workflowState: { inProduction: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const opToken = generateToken('usr_prod_op01', ['PRODUCTION_SUPERVISOR']);
      const res = await request(app)
        .post('/api/v1/production-jobs/job_prod_disp/transition')
        .set('Authorization', `Bearer ${opToken}`)
        .send({ toStatus: 'READY_FOR_DISPATCH', reason: 'Attempt bypass to dispatch' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/In-Production Lock Violation|Invalid lifecycle transition/i);
    });

    it('should strip client attempts to set multiple workflow flags directly', async () => {
      const mockJob = createMockJobDoc('job_flags', 'BO-FLAGS');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const opToken = generateToken('usr_prod_op01', ['PRODUCTION_SUPERVISOR']);
      const res = await request(app)
        .patch('/api/v1/production-jobs/job_flags')
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          workflowState: {
            waitingForProduction: true,
            inProduction: true,
            waitingForInspection: true,
            dispatched: true
          }
        });

      expect([200, 422]).toContain(res.status);
      // Server-side authoritative flags remain single active waitingForProduction
      expect(mockJob.workflowState.waitingForProduction).toBe(true);
      expect(mockJob.workflowState.inProduction).toBe(false);
      expect(mockJob.workflowState.waitingForInspection).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Section 5: Authorization Testing
  // ---------------------------------------------------------------------------
  describe('5. Role Authorization & Strict Boundary Permissions', () => {
    it('should allow user with Production permissions to take and execute BO', async () => {
      const mockJob = createMockJobDoc('job_auth_ok', 'BO-AUTH-OK', {
        status: JobStatus.WAITING_FOR_PRODUCTION,
        waitingForProduction: true,
        inProduction: false,
        workflowState: { waitingForProduction: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);
      jest.spyOn(productionJobRepository, 'atomicTakeForProduction').mockResolvedValue({
        ...mockJob,
        status: JobStatus.IN_PRODUCTION,
        inProduction: true
      });

      const opToken = generateToken('usr_op', ['FURNACE_OPERATOR']);
      const res = await request(app)
        .post('/api/v1/production-jobs/job_auth_ok/take-for-production')
        .set('Authorization', `Bearer ${opToken}`)
        .send({ furnaceId: 'furnace_vac_01', furnaceCode: 'FURNACE-VAC-01' });

      expect(res.status).toBe(200);
    });

    it('should reject user without Production permissions with 403 Forbidden', async () => {
      const unauthTokens = [
        generateToken('usr_no_roles', []),
        generateToken('usr_inventory', ['INVENTORY_VIEWER']),
        generateToken('usr_inspector', ['QUALITY_INSPECTOR'])
      ];

      for (const token of unauthTokens) {
        const res = await request(app)
          .post('/api/v1/production-jobs/job_any/take-for-production')
          .set('Authorization', `Bearer ${token}`)
          .send({ furnaceId: 'furnace_vac_01', furnaceCode: 'FURNACE-VAC-01' });

        expect(res.status).toBe(403);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Section 6: Recipe Testing
  // ---------------------------------------------------------------------------
  describe('6. Recipe Revision Enforcement & Out-of-Spec Validation', () => {
    it('should bind production strictly to the BO pinned Recipe revision', async () => {
      const mockJob = createMockJobDoc('job_rec_ok', 'BO-REC-OK');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const opToken = generateToken('usr_op', ['PRODUCTION_SUPERVISOR']);
      const res = await request(app)
        .get('/api/v1/production-jobs/job_rec_ok')
        .set('Authorization', `Bearer ${opToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.recipeSnapshot.recipeCode).toBe('REC-VAC-4340');
      expect(res.body.data.recipeSnapshot.revisionNumber).toBe(2);
    });

    it('should reject attempted recipe replacement or revision manipulation', async () => {
      const mockJob = createMockJobDoc('job_rec_hack', 'BO-REC-HACK');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const opToken = generateToken('usr_op', ['PRODUCTION_SUPERVISOR']);
      const res = await request(app)
        .patch('/api/v1/production-jobs/job_rec_hack')
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          recipeSnapshot: {
            recipeCode: 'REC-VAC-4340',
            revisionNumber: 99
          }
        });

      expect([400, 422]).toContain(res.status);
      expect(JSON.stringify(res.body)).toMatch(/Recipe Protection Violation|Genealogy Violation|Read-Only Source Data Violation|Request validation failed/i);
    });
  });

  // ---------------------------------------------------------------------------
  // Section 7: Data Integrity Testing
  // ---------------------------------------------------------------------------
  describe('7. Data Integrity, Schema Validation & Identity Attribution', () => {
    it('should reject furnace charge with invalid numeric values or missing mandatory fields', async () => {
      const mockJob = createMockJobDoc('job_data_val', 'BO-DATA-VAL');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const opToken = generateToken('usr_op', ['PRODUCTION_SUPERVISOR']);

      // Negative pieces
      const resNeg = await request(app)
        .post('/api/v1/production-jobs/job_data_val/charge')
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          furnaceId: 'furnace_vac_01',
          furnaceCode: 'FURNACE-VAC-01',
          chargeNumber: 'CHG-001',
          loadedPieceCount: -5,
          loadedWeightKg: 50,
          initialFurnaceTempC: 25
        });

      expect(resNeg.status).toBe(422);

      // Missing charge number
      const resMissing = await request(app)
        .post('/api/v1/production-jobs/job_data_val/charge')
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          furnaceId: 'furnace_vac_01',
          furnaceCode: 'FURNACE-VAC-01',
          loadedPieceCount: 100,
          loadedWeightKg: 50,
          initialFurnaceTempC: 25
        });

      expect(resMissing.status).toBe(422);
    });

    it('should attribute operator strictly to authenticated JWT identity', async () => {
      const mockJob = createMockJobDoc('job_attr', 'BO-ATTR', {
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true,
        workflowState: { inProduction: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const realToken = generateToken('usr_real_operator_99', ['PRODUCTION_SUPERVISOR']);

      const res = await request(app)
        .post('/api/v1/production-jobs/job_attr/charge')
        .set('Authorization', `Bearer ${realToken}`)
        .send({
          furnaceId: 'furnace_vac_01',
          furnaceCode: 'FURNACE-VAC-01',
          chargeNumber: 'CHG-999',
          loadedPieceCount: 100,
          loadedWeightKg: 50,
          initialFurnaceTempC: 25,
          operatorId: 'SPOOFED_OPERATOR_007'
        });

      expect(res.status).toBe(200);
      expect(mockJob.execution.furnaceCharge.operatorId).toBe('usr_real_operator_99');
    });
  });

  // ---------------------------------------------------------------------------
  // Section 8: Concurrency Testing
  // ---------------------------------------------------------------------------
  describe('8. Concurrency, Race Condition & Idempotency Protection', () => {
    it('should grant BO to first concurrent taker and reject second with 409 Conflict', async () => {
      const mockJob = createMockJobDoc('job_race', 'BO-RACE', {
        status: JobStatus.WAITING_FOR_PRODUCTION,
        waitingForProduction: true,
        inProduction: false,
        workflowState: { waitingForProduction: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      let claimed = false;
      jest.spyOn(productionJobRepository, 'atomicTakeForProduction').mockImplementation(async () => {
        if (!claimed) {
          claimed = true;
          mockJob.status = JobStatus.IN_PRODUCTION;
          mockJob.waitingForProduction = false;
          mockJob.inProduction = true;
          return mockJob;
        }
        return null;
      });

      const tokenA = generateToken('usr_alpha', ['PRODUCTION_SUPERVISOR']);
      const tokenB = generateToken('usr_beta', ['PRODUCTION_SUPERVISOR']);

      const [resA, resB] = await Promise.all([
        request(app)
          .post('/api/v1/production-jobs/job_race/take-for-production')
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ furnaceId: 'furnace_vac_01', furnaceCode: 'FURNACE-VAC-01' }),
        request(app)
          .post('/api/v1/production-jobs/job_race/take-for-production')
          .set('Authorization', `Bearer ${tokenB}`)
          .send({ furnaceId: 'furnace_vac_01', furnaceCode: 'FURNACE-VAC-01' })
      ]);

      const statuses = [resA.status, resB.status];
      expect(statuses).toContain(200);
      expect(statuses).toContain(409);
    });

    it('should replay cached response on duplicate idempotent requests', async () => {
      const mockJob = createMockJobDoc('job_idem', 'BO-IDEM', {
        status: JobStatus.IN_PRODUCTION,
        waitingForProduction: false,
        inProduction: true,
        workflowState: { inProduction: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const opToken = generateToken('usr_op', ['PRODUCTION_SUPERVISOR']);
      const key = 'idem-key-p10-final-001';

      const res1 = await request(app)
        .post('/api/v1/production-jobs/job_idem/charge')
        .set('Authorization', `Bearer ${opToken}`)
        .set('Idempotency-Key', key)
        .send({
          furnaceId: 'furnace_vac_01',
          furnaceCode: 'FURNACE-VAC-01',
          chargeNumber: 'CHG-IDEM-01',
          loadedPieceCount: 100,
          loadedWeightKg: 50,
          initialFurnaceTempC: 25
        });

      expect(res1.status).toBe(200);

      const res2 = await request(app)
        .post('/api/v1/production-jobs/job_idem/charge')
        .set('Authorization', `Bearer ${opToken}`)
        .set('Idempotency-Key', key)
        .send({
          furnaceId: 'furnace_vac_01',
          furnaceCode: 'FURNACE-VAC-01',
          chargeNumber: 'CHG-IDEM-01',
          loadedPieceCount: 100,
          loadedWeightKg: 50,
          initialFurnaceTempC: 25
        });

      expect(res2.status).toBe(200);
      expect(res2.body._idempotencyReplay).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Section 9: Historical Integrity & Post-Handoff Protection
  // ---------------------------------------------------------------------------
  describe('9. Historical Integrity & Post-Handoff Protection', () => {
    it('should lock out Production modifications once BO enters WAITING_FOR_INSPECTION', async () => {
      const mockJob = createMockJobDoc('job_locked', 'BO-LOCKED', {
        status: JobStatus.WAITING_FOR_INSPECTION,
        waitingForProduction: false,
        inProduction: false,
        waitingForInspection: true,
        workflowState: {
          waitingForProduction: false,
          inProduction: false,
          waitingForInspection: true,
          inInspection: false,
          waitingForDispatch: false,
          dispatched: false
        }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const opToken = generateToken('usr_op', ['PRODUCTION_SUPERVISOR']);

      // Attempt recording stage progress on inspection-locked BO
      const resStage = await request(app)
        .post('/api/v1/production-jobs/job_locked/recipe-stage-progress')
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          stageSequence: 1,
          actualTemperatureC: 650,
          actualDurationMinutes: 45
        });

      expect(resStage.status).toBe(400);
      expect(resStage.body.message).toMatch(/Post-Production Lock Violation/i);

      // Attempt updating furnace charge on inspection-locked BO
      const resCharge = await request(app)
        .post('/api/v1/production-jobs/job_locked/charge')
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          furnaceId: 'furnace_vac_01',
          furnaceCode: 'FURNACE-VAC-01',
          chargeNumber: 'CHG-STALE',
          loadedPieceCount: 100,
          loadedWeightKg: 50,
          initialFurnaceTempC: 25
        });

      expect(resCharge.status).toBe(400);
      expect(resCharge.body.message).toMatch(/Post-Production Lock Violation/i);

      // Attempt saving partial data on inspection-locked BO
      const resSave = await request(app)
        .post('/api/v1/production-jobs/job_locked/save-production-data')
        .set('Authorization', `Bearer ${opToken}`)
        .send({ operatorNotes: 'Stale notes' });

      expect(resSave.status).toBe(400);
      expect(resSave.body.message).toMatch(/Post-Production Lock Violation/i);
    });
  });

  // ---------------------------------------------------------------------------
  // Section 11: Cross-Phase Boundary Strictness
  // ---------------------------------------------------------------------------
  describe('11. Cross-Phase Boundary Strictness', () => {
    it('should strictly isolate Production between WAITING_FOR_PRODUCTION and WAITING_FOR_INSPECTION', async () => {
      const mockJobInProd = createMockJobDoc('job_boundary_prod', 'BO-BOUND-PROD');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJobInProd);

      const supToken = generateToken('usr_sup', ['PRODUCTION_SUPERVISOR']);

      // 1. Direct transition from IN_PRODUCTION to STORAGE blocked
      const resStorage = await request(app)
        .post('/api/v1/production-jobs/job_boundary_prod/transition')
        .set('Authorization', `Bearer ${supToken}`)
        .send({ toStatus: 'STORAGE', reason: 'Attempt skip to storage' });

      expect(resStorage.status).toBe(400);
      expect(resStorage.body.message).toMatch(/In-Production Lock Violation|Invalid lifecycle transition/i);

      // 2. Direct transition from IN_PRODUCTION to READY_FOR_DISPATCH blocked
      const resDispatch = await request(app)
        .post('/api/v1/production-jobs/job_boundary_prod/transition')
        .set('Authorization', `Bearer ${supToken}`)
        .send({ toStatus: 'READY_FOR_DISPATCH', reason: 'Attempt skip to dispatch' });

      expect(resDispatch.status).toBe(400);
      expect(resDispatch.body.message).toMatch(/In-Production Lock Violation|Invalid lifecycle transition/i);

      // 3. Direct transition from WAITING_FOR_INSPECTION to STORAGE blocked
      const mockJobWaitingInsp = createMockJobDoc('job_boundary_insp', 'BO-BOUND-INSP', {
        status: JobStatus.WAITING_FOR_INSPECTION,
        waitingForProduction: false,
        inProduction: false,
        waitingForInspection: true,
        workflowState: { waitingForInspection: true }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJobWaitingInsp);

      const resInspStorage = await request(app)
        .post('/api/v1/production-jobs/job_boundary_insp/transition')
        .set('Authorization', `Bearer ${supToken}`)
        .send({ toStatus: 'STORAGE', reason: 'Attempt skip from inspection' });

      expect(resInspStorage.status).toBe(400);
      expect(resInspStorage.body.message).toMatch(/Authority Violation|Invalid lifecycle transition/i);
    });
  });
});
