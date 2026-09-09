import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { productionJobService } from '../src/modules/production-job/production-job.service.js';
import { ProductionJobModel } from '../src/modules/production-job/production-job.model.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { JobStatus } from '../src/core/constants/status.js';

describe('Production Phase Prompt 7: Production Record Locking and Historical Integrity Verification', () => {
  const app = createApp();
  const testTenant = 'tenant_prod_lock_p7_001';

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
      tenantId: testTenant,
      poId: 'po_aero_101',
      poNumber: 'PO-2026-00101',
      grnId: 'grn_aero_501',
      grnNumber: 'GRN-202609-0501',
      status: JobStatus.WAITING_FOR_INSPECTION,
      waitingForProduction: false,
      inProduction: false,
      waitingForInspection: true,
      inInspection: false,
      waitingForDispatch: false,
      dispatched: false,
      workflowState: {
        waitingForProduction: false,
        inProduction: false,
        waitingForInspection: true,
        inInspection: false,
        waitingForDispatch: false,
        dispatched: false
      },
      priority: 'HIGH',
      assignedFurnaceId: 'furnace_vac_01',
      assignedOperatorId: 'usr_op01',
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
        completedQuantity: 98,
        scrappedQuantity: 2
      },
      weightKg: 50,
      recipeSnapshot: {
        recipeId: 'rec_vac_4340',
        recipeCode: 'REC-VAC-4340',
        recipeName: 'Vacuum Austenitize & 2-Bar N2 Quench',
        revisionNumber: 2,
        processFamily: 'VACUUM_HEAT_TREATMENT',
        stages: [
          { sequence: 1, stageName: 'Preheat Ramp', targetTemperatureC: 650, soakTimeMinutes: 45 },
          { sequence: 2, stageName: 'Austenitizing Soak', targetTemperatureC: 845, soakTimeMinutes: 90 },
          { sequence: 3, stageName: 'High Pressure N2 Quench', targetTemperatureC: 45, soakTimeMinutes: 20 }
        ]
      },
      genealogy: {
        whichPo: { poId: 'po_aero_101', poNumber: 'PO-2026-00101', supplierName: 'Aero Dynamics Global Inc.' },
        whichGrn: { grnId: 'grn_aero_501', grnNumber: 'GRN-202609-0501', supplierName: 'Aero Dynamics Global Inc.' },
        whichPart: { itemId: 'item_4340', itemCode: 'PART-SHAFT-4340', itemName: 'Turbine Rotor Shaft 4340', materialGrade: 'AISI 4340', uom: 'PCS' },
        whichRecipe: { recipeId: 'rec_vac_4340', recipeCode: 'REC-VAC-4340', recipeName: 'Vacuum Austenitize & 2-Bar N2 Quench', revisionNumber: 2, processFamily: 'VACUUM_HEAT_TREATMENT' },
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
        actualStartDate: new Date('2026-09-10T08:30:00.000Z'),
        actualCompletionDate: new Date('2026-09-10T14:30:00.000Z'),
        dueDate: new Date('2026-09-12T08:00:00.000Z')
      },
      execution: {
        furnaceCharge: {
          furnaceId: 'furnace_vac_01',
          operatorId: 'usr_op01',
          shiftId: 'shift_morning',
          chargeNumber: 'LOAD-202609-01',
          loadedPieceCount: 100,
          loadedWeightKg: 50,
          initialFurnaceTempC: 150,
          pyrometerCalibrationVerified: true
        },
        stageProgress: [
          {
            stageSequence: 1,
            stageName: 'Preheat Ramp',
            actualTemperatureC: 650,
            actualDurationMinutes: 45,
            isCompliant: true
          },
          {
            stageSequence: 2,
            stageName: 'Austenitizing Soak',
            actualTemperatureC: 845,
            actualDurationMinutes: 90,
            isCompliant: true
          },
          {
            stageSequence: 3,
            stageName: 'High Pressure N2 Quench',
            actualTemperatureC: 45,
            actualDurationMinutes: 20,
            isCompliant: true
          }
        ],
        qualityHandoff: {
          inspectionRequestId: 'INSP-REQ-202609-01',
          approvedByUserId: 'usr_op01',
          approvalTimestamp: new Date('2026-09-10T14:30:00.000Z'),
          completedQuantity: 98,
          scrappedQuantity: 2,
          productionNotes: 'Normal run, clean quench',
          status: 'PENDING_INSPECTION'
        }
      },
      processDetails: Array.from({ length: 15 }, (_, i) => ({
        serialNumber: i + 1,
        partCode: 'PART-SHAFT-4340',
        partName: 'Turbine Rotor Shaft 4340',
        process: 'VACUUM_HEAT_TREATMENT',
        recipeCode: 'REC-VAC-4340',
        minhardness: 45,
        maxhardness: 52,
        status: i === 0 ? 'COMPLETED' : 'BLANK',
        userName: 'Furnace Operator'
      })),
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
    jest.spyOn(roleRepository, 'findRolesByCodes').mockImplementation(async (_tenantId, codes) => {
      return DEFAULT_FACTORY_ROLES.filter((r) => codes.includes(r.code)).map((r) => ({
        ...r,
        id: `role_${r.code}`,
        status: 'active'
      })) as any;
    });
  });

  describe('1. Post-Production Record Locking on Active Telemetry Logging', () => {
    it('should reject furnace charge logging with Post-Production Lock Violation and log PRODUCTION_RECORD_LOCK_VIOLATION_ATTEMPT', async () => {
      const token = generateToken('usr_op01', ['FURNACE_OPERATOR', 'PLANT_MANAGER']);
      const job = createMockJobDoc('job_lock_001', 'BO-202609-0001');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const auditSpy = jest.spyOn(auditService, 'record');

      const response = await request(app)
        .post('/api/v1/production-jobs/job_lock_001/furnace-charge')
        .set('Authorization', `Bearer ${token}`)
        .send({
          chargeNumber: 'CHG-NEW-ATTEMPT',
          initialFurnaceTempC: 200,
          loadedPieceCount: 100,
          loadedWeightKg: 50
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Post-Production Lock Violation');
      expect(auditSpy).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          action: 'PRODUCTION_RECORD_LOCK_VIOLATION_ATTEMPT',
          entityId: 'job_lock_001',
          metadata: expect.objectContaining({
            attemptedOperation: 'recordFurnaceCharge',
            currentStatus: JobStatus.WAITING_FOR_INSPECTION
          })
        })
      );
    });

    it('should reject recordRecipeStageProgress on a post-production BO and record audit trail', async () => {
      const token = generateToken('usr_op01', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_lock_002', 'BO-202609-0002');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const auditSpy = jest.spyOn(auditService, 'record');

      const response = await request(app)
        .post('/api/v1/production-jobs/job_lock_002/recipe-stage-progress')
        .set('Authorization', `Bearer ${token}`)
        .send({
          stageSequence: 1,
          actualTemperatureC: 700,
          actualDurationMinutes: 50
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Post-Production Lock Violation');
      expect(auditSpy).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          action: 'PRODUCTION_RECORD_LOCK_VIOLATION_ATTEMPT',
          entityId: 'job_lock_002',
          metadata: expect.objectContaining({
            attemptedOperation: 'recordRecipeStageProgress'
          })
        })
      );
    });

    it('should reject saveProductionData on a post-production BO with Post-Production Lock Violation', async () => {
      const token = generateToken('usr_op01', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_lock_003', 'BO-202609-0003');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const auditSpy = jest.spyOn(auditService, 'record');

      const response = await request(app)
        .post('/api/v1/production-jobs/job_lock_003/save-production-data')
        .set('Authorization', `Bearer ${token}`)
        .send({
          furnaceCharge: {
            chargeNumber: 'CHG-REWRITE',
            loadedPieceCount: 100,
            loadedWeightKg: 50,
            initialFurnaceTempC: 150
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Post-Production Lock Violation');
      expect(auditSpy).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          action: 'PRODUCTION_RECORD_LOCK_VIOLATION_ATTEMPT',
          entityId: 'job_lock_003',
          metadata: expect.objectContaining({
            attemptedOperation: 'saveProductionData'
          })
        })
      );
    });
  });

  describe('2. Post-Production Planning and Resource Assignment Locks', () => {
    it('should reject planning modification (updateJob) on post-production BO', async () => {
      const job = createMockJobDoc('job_lock_plan', 'BO-202609-PLAN');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      await expect(
        productionJobService.updateJob(
          'job_lock_plan',
          { priority: 'LOW' as any },
          testTenant,
          'usr_planner01'
        )
      ).rejects.toThrow('Post-Production Lock Violation');
    });

    it('should reject operator assignment or removal on post-production BO', async () => {
      const job = createMockJobDoc('job_lock_op', 'BO-202609-OP');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      await expect(
        productionJobService.assignOperator(
          'job_lock_op',
          'usr_op99',
          testTenant,
          'usr_supervisor'
        )
      ).rejects.toThrow('Post-Production Lock Violation');

      await expect(
        productionJobService.removeOperator(
          'job_lock_op',
          testTenant,
          'usr_supervisor'
        )
      ).rejects.toThrow('Post-Production Lock Violation');
    });

    it('should reject furnace assignment or removal on post-production BO', async () => {
      const job = createMockJobDoc('job_lock_furnace', 'BO-202609-FURN');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      await expect(
        productionJobService.assignFurnace(
          'job_lock_furnace',
          'furnace_vac_02',
          testTenant,
          'usr_supervisor'
        )
      ).rejects.toThrow('Post-Production Lock Violation');

      await expect(
        productionJobService.removeFurnace(
          'job_lock_furnace',
          testTenant,
          'usr_supervisor'
        )
      ).rejects.toThrow('Post-Production Lock Violation');
    });

    it('should reject cancellation of a post-production BO awaiting inspection', async () => {
      const job = createMockJobDoc('job_lock_cancel', 'BO-202609-CANCEL');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      await expect(
        productionJobService.cancelJob(
          'job_lock_cancel',
          'Erroneous order cancellation request',
          testTenant,
          'usr_supervisor'
        )
      ).rejects.toThrow('Post-Production Lock Violation');
    });
  });

  describe('3. Strict Status Transition Guarding (No Rollbacks or Bypass)', () => {
    it('should reject transition from WAITING_FOR_INSPECTION back to IN_PROGRESS', async () => {
      const job = createMockJobDoc('job_trans_01', 'BO-202609-T01');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      await expect(
        productionJobService.transitionJob(
          testTenant,
          { userId: 'usr_op01', tenantId: testTenant, roles: ['FURNACE_OPERATOR'] },
          'job_trans_01',
          { toStatus: JobStatus.IN_PROGRESS, reason: 'Rollback to production' } as any
        )
      ).rejects.toThrow('State Transition Authority Violation');
    });

    it('should reject transition from WAITING_FOR_INSPECTION directly to STORAGE (bypassing inspection)', async () => {
      const job = createMockJobDoc('job_trans_02', 'BO-202609-T02');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      await expect(
        productionJobService.transitionJob(
          testTenant,
          { userId: 'usr_op01', tenantId: testTenant, roles: ['FURNACE_OPERATOR'] },
          'job_trans_02',
          { toStatus: JobStatus.STORAGE, reason: 'Attempting inspection bypass' } as any
        )
      ).rejects.toThrow('State Transition Authority Violation');
    });

    it('should allow transition from WAITING_FOR_INSPECTION strictly to QUALITY_CHECK', async () => {
      const job = createMockJobDoc('job_trans_03', 'BO-202609-T03');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(productionJobRepository, 'updateById').mockResolvedValue({
        ...job,
        status: JobStatus.QUALITY_CHECK,
        inInspection: true
      } as any);

      const result = await productionJobService.transitionJob(
        testTenant,
        { userId: 'usr_qc01', tenantId: testTenant, roles: ['QC_INSPECTOR'] },
        'job_trans_03',
        { toStatus: JobStatus.QUALITY_CHECK, reason: 'QC starting inspection' } as any
      );

      expect(result.status).toBe(JobStatus.QUALITY_CHECK);
    });
  });

  describe('4. Recipe Snapshot Immutability & Repository Protection', () => {
    it('should reject repository updateById attempting to modify recipeSnapshot', async () => {
      const job = createMockJobDoc('job_rep_recipe', 'BO-202609-REC');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      await expect(
        productionJobRepository.updateById(
          testTenant,
          'job_rep_recipe',
          {
            recipeSnapshot: {
              recipeCode: 'REC-SUBSTITUTED-99',
              name: 'Illegal Substitution',
              processFamily: 'ATMOSPHERIC'
            }
          } as any
        )
      ).rejects.toThrow('Recipe Protection Violation');
    });

    it('should reject repository updateById modifying piece counts or furnace charge on post-production BO', async () => {
      const job = createMockJobDoc('job_rep_lock', 'BO-202609-REP');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      await expect(
        productionJobRepository.updateById(
          testTenant,
          'job_rep_lock',
          {
            'quantity.completedQuantity': 100
          } as any
        )
      ).rejects.toThrow('Post-Production Lock Violation');

      await expect(
        productionJobRepository.updateById(
          testTenant,
          'job_rep_lock',
          {
            'execution.furnaceCharge': { chargeNumber: 'TAMPERED' }
          } as any
        )
      ).rejects.toThrow('Post-Production Lock Violation');
    });
  });

  describe('5. Mongoose Document Model Pre-Save Defense-in-Depth Guard', () => {
    const getPreSaveHook = () => {
      const hooks: any = (ProductionJobModel.schema as any).s?.hooks?._pres?.get('save') || [];
      return hooks.find((h: any) => h.fn.toString().includes('Post-Production Lock Violation'))?.fn;
    };

    it('should reject pre-save hook if recipeSnapshot is modified on an existing document', (done) => {
      const preSaveHook = getPreSaveHook();
      expect(preSaveHook).toBeDefined();

      const doc: any = {
        isNew: false,
        status: JobStatus.WAITING_FOR_PRODUCTION,
        waitingForProduction: true,
        workflowState: { waitingForProduction: true },
        isModified: (field: string) => field === 'recipeSnapshot'
      };

      preSaveHook.call(doc, (err: Error) => {
        expect(err).toBeDefined();
        expect(err.message).toContain('Recipe Protection Violation');
        done();
      });
    });

    it('should reject pre-save hook if locked execution fields are modified when waitingForInspection is true', (done) => {
      const preSaveHook = getPreSaveHook();
      expect(preSaveHook).toBeDefined();

      const doc: any = {
        isNew: false,
        waitingForInspection: true,
        workflowState: { waitingForInspection: true },
        status: JobStatus.WAITING_FOR_INSPECTION,
        isModified: (field: string) => field === 'execution.stageProgress'
      };

      preSaveHook.call(doc, (err: Error) => {
        expect(err).toBeDefined();
        expect(err.message).toContain('Post-Production Lock Violation');
        done();
      });
    });

    it('should reject pre-save hook if completed piece counts are modified on post-production BO', (done) => {
      const preSaveHook = getPreSaveHook();
      expect(preSaveHook).toBeDefined();

      const doc: any = {
        isNew: false,
        waitingForInspection: true,
        workflowState: { waitingForInspection: true },
        status: JobStatus.WAITING_FOR_INSPECTION,
        isModified: (field: string) => field === 'quantity.completedQuantity'
      };

      preSaveHook.call(doc, (err: Error) => {
        expect(err).toBeDefined();
        expect(err.message).toContain('Post-Production Lock Violation');
        done();
      });
    });
  });

  describe('6. Role & Permission Separation (QC Inspector vs Production Routes)', () => {
    it('should reject QC_INSPECTOR from modifying production execution routes (403 Forbidden)', async () => {
      const qcToken = generateToken('usr_qc01', ['QC_INSPECTOR']);

      const response = await request(app)
        .post('/api/v1/production-jobs/job_lock_001/furnace-charge')
        .set('Authorization', `Bearer ${qcToken}`)
        .send({
          chargeNumber: 'CHG-QC-ATTEMPT',
          initialFurnaceTempC: 100,
          loadedPieceCount: 100,
          loadedWeightKg: 50
        });

      expect(response.status).toBe(403);
    });

    it('should reject QC_INSPECTOR from logging recipe stage progress (403 Forbidden)', async () => {
      const qcToken = generateToken('usr_qc01', ['QC_INSPECTOR']);

      const response = await request(app)
        .post('/api/v1/production-jobs/job_lock_001/recipe-stage-progress')
        .set('Authorization', `Bearer ${qcToken}`)
        .send({
          stageSequence: 1,
          actualTemperatureC: 845,
          actualDurationMinutes: 90
        });

      expect(response.status).toBe(403);
    });
  });

  describe('7. Historical Read-Only Fidelity (GET /:id)', () => {
    it('should return complete production history, telemetry, piece counts, recipe, and genealogy in read-only mode', async () => {
      const token = generateToken('usr_viewer01', ['QC_INSPECTOR', 'FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_view_101', 'BO-202609-V101');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const response = await request(app)
        .get('/api/v1/production-jobs/job_view_101')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      const data = response.body.data || response.body;

      // Assert full execution telemetry is returned
      expect(data.jobNumber).toBe('BO-202609-V101');
      expect(data.status).toBe(JobStatus.WAITING_FOR_INSPECTION);
      expect(data.waitingForInspection).toBe(true);
      expect(data.quantity.loadedQuantity).toBe(100);
      expect(data.quantity.completedQuantity).toBe(98);
      expect(data.quantity.scrappedQuantity).toBe(2);

      // Recipe snapshot and genealogy are intact
      expect(data.recipeSnapshot.recipeCode).toBe('REC-VAC-4340');
      expect(data.recipeSnapshot.stages).toHaveLength(3);
      expect(data.genealogy.whichPo.poNumber).toBe('PO-2026-00101');
      expect(data.genealogy.whichGrn.grnNumber).toBe('GRN-202609-0501');

      // Execution details intact
      expect(data.execution.furnaceCharge.chargeNumber).toBe('LOAD-202609-01');
      expect(data.execution.stageProgress).toHaveLength(3);
      expect(data.execution.stageProgress[0].actualTemperatureC).toBe(650);
      expect(data.execution.qualityHandoff.status).toBe('PENDING_INSPECTION');
    });
  });
});
