import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { furnaceCapacityRepository } from '../src/modules/furnace-capacity/furnace-capacity.repository.js';
import { JobStatus } from '../src/core/constants/status.js';

describe('Production Phase Prompt 4: Recipe-Driven Production Execution Verification', () => {
  const app = createApp();
  const testTenant = 'tenant_recipe_exec_001';

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
      status: JobStatus.IN_PRODUCTION,
      waitingForProduction: false,
      inProduction: true,
      waitingForInspection: false,
      inInspection: false,
      waitingForDispatch: false,
      dispatched: false,
      workflowState: {
        waitingForProduction: false,
        inProduction: true,
        waitingForInspection: false,
        inInspection: false,
        waitingForDispatch: false,
        dispatched: false
      },
      priority: 'HIGH',
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
        revisionNumber: 3,
        processFamily: 'VACUUM_HEAT_TREATMENT',
        stages: [
          {
            sequence: 1,
            stageName: 'Preheat Ramp',
            targetTemperatureC: 650,
            temperatureToleranceMinusC: 10,
            temperatureTolerancePlusC: 10,
            soakTimeMinutes: 45,
            soakCriteria: 'LOAD_THERMOCOUPLE_REACHED'
          },
          {
            sequence: 2,
            stageName: 'Austenitizing Soak',
            targetTemperatureC: 845,
            temperatureToleranceMinusC: 10,
            temperatureTolerancePlusC: 10,
            soakTimeMinutes: 90,
            soakCriteria: 'LOAD_THERMOCOUPLE_REACHED',
            atmosphereControl: { type: 'CARBON_POTENTIAL', setpoint: 0.85, tolerance: 0.05 }
          },
          {
            sequence: 3,
            stageName: 'High Pressure N2 Quench',
            targetTemperatureC: 45,
            temperatureToleranceMinusC: 5,
            temperatureTolerancePlusC: 15,
            soakTimeMinutes: 20,
            soakCriteria: 'FIXED_TIME',
            quenchParameters: {
              medium: 'HIGH_PRESSURE_GAS_N2',
              targetTemperatureC: 45,
              agitationSpeedPercent: 100,
              quenchDurationSeconds: 1200,
              gasQuenchPressureBar: 2
            }
          }
        ]
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
        actualStartDate: new Date('2026-09-10T08:15:00.000Z'),
        dueDate: new Date('2026-09-12T08:00:00.000Z')
      },
      execution: {
        furnaceCharge: {
          chargeNumber: 'CHG-202609-001',
          loadedWeightKg: 50,
          loadedPieceCount: 100,
          initialFurnaceTempC: 25,
          startedAt: new Date('2026-09-10T08:15:00.000Z'),
          startedBy: { userId: 'op_01', email: 'op_01@factory.com', role: 'FURNACE_OPERATOR' }
        },
        cycleTimer: {
          cycleStartTime: new Date('2026-09-10T08:15:00.000Z'),
          totalRunDurationMinutes: 0,
          totalDowntimeDurationMinutes: 0
        },
        stageProgress: [],
        downtimeLog: [],
        productionLogs: []
      },
      isDeleted: false,
      save: jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      }),
      toJSON: function () {
        return { ...this };
      },
      toObject: function () {
        return { ...this };
      },
      ...overrides
    };
    return doc;
  };

  beforeEach(() => {
    jest.clearAllMocks();
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

  describe('1. Recipe as Authority & Validation Against Bound Recipe', () => {
    it('loads the authoritative Recipe and enforces execution against bound stages', async () => {
      const token = generateToken('operator_01', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_exec_01', 'BO-202609-0101');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post('/api/v1/production-jobs/job_exec_01/recipe-stage-progress')
        .set('Authorization', `Bearer ${token}`)
        .send({
          stageSequence: 1,
          actualTemperatureC: 652,
          actualDurationMinutes: 45
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(job.execution.stageProgress).toHaveLength(1);
      expect(job.execution.stageProgress[0].stageName).toBe('Preheat Ramp');
      expect(job.execution.stageProgress[0].targetTemperatureC).toBe(650);
      expect(job.execution.stageProgress[0].actualTemperatureC).toBe(652);
    });

    it('rejects stage sequence not present in the bound Recipe snapshot', async () => {
      const token = generateToken('operator_01', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_exec_02', 'BO-202609-0102');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post('/api/v1/production-jobs/job_exec_02/recipe-stage-progress')
        .set('Authorization', `Bearer ${token}`)
        .send({
          stageSequence: 99,
          actualTemperatureC: 850,
          actualDurationMinutes: 60
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Recipe Stage sequence 99 does not exist in referenced Recipe/i);
    });

    it('rejects arbitrary stage names that contradict the authoritative Recipe', async () => {
      const token = generateToken('operator_01', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_exec_03', 'BO-202609-0103');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post('/api/v1/production-jobs/job_exec_03/recipe-stage-progress')
        .set('Authorization', `Bearer ${token}`)
        .send({
          stageSequence: 1,
          stageName: 'Arbitrary Induction Step',
          actualTemperatureC: 650,
          actualDurationMinutes: 45
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Stage name 'Arbitrary Induction Step' does not match authoritative Recipe/i);
    });

    it('rejects execution if the Batch Order has no bound Recipe stages', async () => {
      const token = generateToken('operator_01', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_exec_04', 'BO-202609-0104', {
        recipeSnapshot: {
          recipeId: 'rec_empty',
          recipeCode: 'REC-EMPTY',
          revisionNumber: 1,
          stages: []
        }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post('/api/v1/production-jobs/job_exec_04/recipe-stage-progress')
        .set('Authorization', `Bearer ${token}`)
        .send({
          stageSequence: 1,
          actualTemperatureC: 650,
          actualDurationMinutes: 45
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/has no bound Recipe stages/i);
    });
  });

  describe('2. Recipe Revision Tracking & Immutability', () => {
    it('preserves the exact Recipe revision number associated with the BO', async () => {
      const token = generateToken('operator_01', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_exec_05', 'BO-202609-0105');
      expect(job.recipeSnapshot.revisionNumber).toBe(3);

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post('/api/v1/production-jobs/job_exec_05/recipe-stage-progress')
        .set('Authorization', `Bearer ${token}`)
        .send({
          stageSequence: 1,
          actualTemperatureC: 650,
          actualDurationMinutes: 45
        });

      expect(res.status).toBe(200);
      expect(job.recipeSnapshot.revisionNumber).toBe(3);
      expect(job.recipeSnapshot.recipeCode).toBe('REC-VAC-4340');
    });

    it('retains the planned Recipe targets without overwriting them with actual values', async () => {
      const token = generateToken('operator_01', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_exec_06', 'BO-202609-0106');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post('/api/v1/production-jobs/job_exec_06/recipe-stage-progress')
        .set('Authorization', `Bearer ${token}`)
        .send({
          stageSequence: 1,
          actualTemperatureC: 655,
          actualDurationMinutes: 48
        });

      expect(res.status).toBe(200);
      // Recipe specification requirement is preserved untouched
      expect(job.recipeSnapshot.stages[0].targetTemperatureC).toBe(650);
      expect(job.recipeSnapshot.stages[0].soakTimeMinutes).toBe(45);
      // Actuals are stored in execution history
      expect(job.execution.stageProgress[0].actualTemperatureC).toBe(655);
      expect(job.execution.stageProgress[0].actualDurationMinutes).toBe(48);
    });
  });

  describe('3. Planned vs Actual & Tolerance Deviation Validation', () => {
    it('validates compliant actual values within tolerance and marks isCompliant: true', async () => {
      const token = generateToken('operator_01', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_exec_07', 'BO-202609-0107');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      // Target: 650, Tol: -10/+10 => [640, 660]. Actual: 658 => Compliant (+8°C deviation)
      const res = await request(app)
        .post('/api/v1/production-jobs/job_exec_07/recipe-stage-progress')
        .set('Authorization', `Bearer ${token}`)
        .send({
          stageSequence: 1,
          actualTemperatureC: 658,
          actualDurationMinutes: 45
        });

      expect(res.status).toBe(200);
      const stage = job.execution.stageProgress[0];
      expect(stage.isCompliant).toBe(true);
      expect(stage.deviationWarning).toBeNull();
      expect(stage.temperatureDeviationC).toBe(8);
      expect(stage.durationDeviationMinutes).toBe(0);
    });

    it('identifies high out-of-tolerance deviation, marks isCompliant: false, and does not convert to passing', async () => {
      const token = generateToken('operator_01', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_exec_08', 'BO-202609-0108');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      // Target: 650, Tol: -10/+10 => [640, 660]. Actual: 672 => Out of spec (+22°C excursion)
      const res = await request(app)
        .post('/api/v1/production-jobs/job_exec_08/recipe-stage-progress')
        .set('Authorization', `Bearer ${token}`)
        .send({
          stageSequence: 1,
          actualTemperatureC: 672,
          actualDurationMinutes: 50
        });

      expect(res.status).toBe(200);
      const stage = job.execution.stageProgress[0];
      expect(stage.isCompliant).toBe(false);
      expect(stage.temperatureDeviationC).toBe(22);
      expect(stage.durationDeviationMinutes).toBe(5);
      expect(stage.deviationWarning).toMatch(/exceeds maximum allowable limit 660°C/i);
    });

    it('identifies low out-of-tolerance deviation and marks isCompliant: false', async () => {
      const token = generateToken('operator_01', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_exec_09', 'BO-202609-0109');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      // Target: 650, Tol: -10/+10 => [640, 660]. Actual: 630 => Out of spec (-20°C excursion)
      const res = await request(app)
        .post('/api/v1/production-jobs/job_exec_09/recipe-stage-progress')
        .set('Authorization', `Bearer ${token}`)
        .send({
          stageSequence: 1,
          actualTemperatureC: 630,
          actualDurationMinutes: 45
        });

      expect(res.status).toBe(200);
      const stage = job.execution.stageProgress[0];
      expect(stage.isCompliant).toBe(false);
      expect(stage.temperatureDeviationC).toBe(-20);
      expect(stage.deviationWarning).toMatch(/below minimum allowable limit 640°C/i);
    });
  });

  describe('4. Strict Process Sequence Enforcement', () => {
    it('rejects executing Stage 2 before Stage 1 has been executed (Sequence Bypass)', async () => {
      const token = generateToken('operator_01', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_exec_10', 'BO-202609-0110');
      // stageProgress is empty
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post('/api/v1/production-jobs/job_exec_10/recipe-stage-progress')
        .set('Authorization', `Bearer ${token}`)
        .send({
          stageSequence: 2,
          actualTemperatureC: 845,
          actualDurationMinutes: 90
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Process Sequence Violation: Stage 2.*cannot be executed before Stage 1 is completed/i);
    });

    it('rejects executing Stage 3 before Stage 2 has been executed', async () => {
      const token = generateToken('operator_01', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_exec_11', 'BO-202609-0111', {
        execution: {
          stageProgress: [
            {
              stageSequence: 1,
              stageName: 'Preheat Ramp',
              targetTemperatureC: 650,
              actualTemperatureC: 650,
              targetDurationMinutes: 45,
              actualDurationMinutes: 45,
              isCompliant: true
            }
          ]
        }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post('/api/v1/production-jobs/job_exec_11/recipe-stage-progress')
        .set('Authorization', `Bearer ${token}`)
        .send({
          stageSequence: 3,
          actualTemperatureC: 45,
          actualDurationMinutes: 20
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Process Sequence Violation: Stage 3.*cannot be executed before Stage 2 is completed/i);
    });

    it('allows executing stages in strict sequence (Stage 1 -> Stage 2 -> Stage 3)', async () => {
      const token = generateToken('operator_01', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_exec_12', 'BO-202609-0112');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      // 1. Stage 1
      const res1 = await request(app)
        .post('/api/v1/production-jobs/job_exec_12/recipe-stage-progress')
        .set('Authorization', `Bearer ${token}`)
        .send({
          stageSequence: 1,
          actualTemperatureC: 650,
          actualDurationMinutes: 45
        });
      expect(res1.status).toBe(200);

      // 2. Stage 2
      const res2 = await request(app)
        .post('/api/v1/production-jobs/job_exec_12/recipe-stage-progress')
        .set('Authorization', `Bearer ${token}`)
        .send({
          stageSequence: 2,
          actualTemperatureC: 845,
          actualDurationMinutes: 90,
          atmosphereDetails: { carbonPotential: 0.85 }
        });
      expect(res2.status).toBe(200);

      // 3. Stage 3
      const res3 = await request(app)
        .post('/api/v1/production-jobs/job_exec_12/recipe-stage-progress')
        .set('Authorization', `Bearer ${token}`)
        .send({
          stageSequence: 3,
          actualTemperatureC: 45,
          actualDurationMinutes: 20,
          quenchMedium: 'HIGH_PRESSURE_GAS_N2'
        });
      expect(res3.status).toBe(200);

      expect(job.execution.stageProgress).toHaveLength(3);
      expect(job.execution.stageProgress.map((s: any) => s.stageSequence)).toEqual([1, 2, 3]);
    });
  });

  describe('5. Data Integrity, Auditability & Inspection Boundary', () => {
    it('records authoritative audit logs with planned vs actual metrics', async () => {
      const token = generateToken('operator_01', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_exec_13', 'BO-202609-0113');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const auditSpy = jest.spyOn(auditService, 'record');

      await request(app)
        .post('/api/v1/production-jobs/job_exec_13/recipe-stage-progress')
        .set('Authorization', `Bearer ${token}`)
        .send({
          stageSequence: 1,
          actualTemperatureC: 650,
          actualDurationMinutes: 45
        });

      expect(auditSpy).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          action: 'PRODUCTION_RECIPE_STAGE_RECORDED',
          entityType: 'PRODUCTION_JOB',
          metadata: expect.objectContaining({
            stageSequence: 1,
            targetTemperatureC: 650,
            actualTemperatureC: 650,
            isCompliant: true
          })
        })
      );
    });

    it('records deviation audit log when actual values exceed tolerances', async () => {
      const token = generateToken('operator_01', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_exec_14', 'BO-202609-0114');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const auditSpy = jest.spyOn(auditService, 'record');

      await request(app)
        .post('/api/v1/production-jobs/job_exec_14/recipe-stage-progress')
        .set('Authorization', `Bearer ${token}`)
        .send({
          stageSequence: 1,
          actualTemperatureC: 680,
          actualDurationMinutes: 45
        });

      expect(auditSpy).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          action: 'PRODUCTION_STAGE_DEVIATION_FLAGGED',
          entityType: 'PRODUCTION_JOB',
          metadata: expect.objectContaining({
            stageSequence: 1,
            actualTemperatureC: 680,
            isCompliant: false,
            deviationWarning: expect.stringMatching(/exceeds maximum allowable limit/i)
          })
        })
      );
    });

    it('rejects recording stage progress when BO is not in production status', async () => {
      const token = generateToken('operator_01', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_exec_15', 'BO-202609-0115', {
        status: JobStatus.WAITING_FOR_PRODUCTION,
        inProduction: false,
        waitingForProduction: true
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job);

      const res = await request(app)
        .post('/api/v1/production-jobs/job_exec_15/recipe-stage-progress')
        .set('Authorization', `Bearer ${token}`)
        .send({
          stageSequence: 1,
          actualTemperatureC: 650,
          actualDurationMinutes: 45
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Batch Order is not in production/i);
    });
  });
});
