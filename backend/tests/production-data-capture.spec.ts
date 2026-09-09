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

describe('Production Phase Prompt 5: Production Process Data Capture Verification', () => {
  const app = createApp();
  const testTenant = 'tenant_data_capture_001';

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
            soakCriteria: 'CORE_BELOW_100C',
            quenchParameters: {
              medium: 'HIGH_PURITY_NITROGEN',
              targetTemperatureC: 45,
              quenchDurationSeconds: 1200,
              agitationSpeedPercent: 100
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
      operatorAssignment: {
        operatorId: 'usr_operator_1',
        operatorName: 'John Operator',
        shift: 'DAY'
      },
      timeline: {
        plannedStartDate: new Date('2026-09-10T08:00:00.000Z'),
        targetCompletionDate: new Date('2026-09-11T08:00:00.000Z'),
        actualStartDate: new Date('2026-09-10T08:15:00.000Z')
      },
      execution: {
        furnaceCharge: {
          chargeNumber: 'CHG-202609-001',
          loadedWeightKg: 500,
          loadedPieceCount: 100,
          initialFurnaceTempC: 25,
          fixtureId: 'FIX-AERO-01',
          startedAt: new Date('2026-09-10T08:15:00.000Z'),
          startedBy: { userId: 'usr_operator_1', email: 'op@factory.com', role: 'FURNACE_OPERATOR' }
        },
        cycleTimer: {
          cycleStartTime: new Date('2026-09-10T08:15:00.000Z'),
          cycleEndTime: null,
          totalRunDurationMinutes: 0,
          totalDowntimeDurationMinutes: 0
        },
        stageProgress: [],
        downtimeLog: [],
        productionLogs: []
      },
      processDetails: Array.from({ length: 15 }, (_, i) => ({
        serialNumber: i + 1,
        processNumber: i + 1,
        partId: 'item_4340',
        partCode: 'PART-SHAFT-4340',
        partName: 'Turbine Rotor Shaft 4340',
        process: i === 0 ? 'Vacuum Heat Treatment' : `Operation ${i + 1}`,
        status: i === 0 ? 'IN_PROGRESS' : 'BLANK'
      })),
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
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Source-Driven Fields & BO Context Integrity', () => {
    it('should return authoritative BO context including PO, GRN, Item, Quantity, and exact Recipe revision', async () => {
      const opToken = generateToken('usr_op', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_ctx_01', 'BO-202609-001');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .get(`/api/v1/production-jobs/${job.id}`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${opToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.jobNumber).toBe('BO-202609-001');
      expect(data.poNumber).toBe('PO-2026-00101');
      expect(data.grnNumber).toBe('GRN-202609-0501');
      expect(data.item.itemCode).toBe('PART-SHAFT-4340');
      expect(data.item.materialGrade).toBe('AISI 4340');
      expect(data.recipeSnapshot.recipeCode).toBe('REC-VAC-4340');
      expect(data.recipeSnapshot.revisionNumber).toBe(2);
      expect(data.inProduction).toBe(true);
    });
  });

  describe('2. Furnace Charge Data Capture & Rigorous Validation', () => {
    it('should record furnace charge data with positive piece count and weight', async () => {
      const opToken = generateToken('usr_op', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_charge_01', 'BO-202609-002');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/charge`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          furnaceId: 'furnace_vac_01',
          chargeNumber: 'CHG-VAC-2026-0099',
          loadedWeightKg: 450.5,
          loadedPieceCount: 100,
          initialFurnaceTempC: 25,
          fixtureId: 'BASKET-INCONEL-01',
          thermocoupleLocations: ['TC-FRONT-TOP', 'TC-CENTER-LOAD', 'TC-REAR-BOTTOM'],
          shift: 'MORNING_SHIFT',
          notes: 'Pre-charge vacuum leak-up rate check passed.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(job.save).toHaveBeenCalled();
      expect(job.execution.furnaceCharge.chargeNumber).toBe('CHG-VAC-2026-0099');
      expect(job.execution.furnaceCharge.loadedWeightKg).toBe(450.5);
      expect(job.execution.furnaceCharge.loadedPieceCount).toBe(100);
      // Workflow invariant: must remain inProduction
      expect(job.inProduction).toBe(true);
      expect(job.waitingForInspection).toBe(false);
    });

    it('should reject non-positive loaded piece count or weight', async () => {
      const opToken = generateToken('usr_op', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_charge_02', 'BO-202609-003');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/charge`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          chargeNumber: 'CHG-BAD',
          loadedWeightKg: -10, // Invalid negative weight
          loadedPieceCount: 0, // Invalid zero pieces
          initialFurnaceTempC: 25
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(job.save).not.toHaveBeenCalled();
    });

    it('should reject initial furnace temperature exceeding furnace thermal rating', async () => {
      const opToken = generateToken('usr_op', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_charge_03', 'BO-202609-004');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/charge`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          furnaceId: 'furnace_vac_01',
          chargeNumber: 'CHG-OVERTEMP',
          loadedWeightKg: 200,
          loadedPieceCount: 50,
          initialFurnaceTempC: 1500 // Max is 1300C
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/exceeds furnace maximum rating/i);
    });

    it('should reject loaded charge weight exceeding furnace maximum capacity', async () => {
      const opToken = generateToken('usr_op', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_charge_04', 'BO-202609-005');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/charge`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          furnaceId: 'furnace_vac_01',
          chargeNumber: 'CHG-OVERWEIGHT',
          loadedWeightKg: 2500, // Max is 1000kg
          loadedPieceCount: 50,
          initialFurnaceTempC: 25
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/exceeds furnace maximum capacity/i);
    });
  });

  describe('3. Production Actuals vs Recipe Distinction & Immutability', () => {
    it('should capture stage actuals without modifying the bound recipe snapshot requirements', async () => {
      const opToken = generateToken('usr_op', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_stage_01', 'BO-202609-006');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/recipe-progress`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          stageSequence: 1,
          actualTemperatureC: 652, // Target is 650
          actualDurationMinutes: 46, // Target is 45
          operatorNotes: 'Preheat soaked to core thermocouple reading.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Recipe snapshot requirements must remain pristine
      expect(job.recipeSnapshot.stages[0].targetTemperatureC).toBe(650);
      expect(job.recipeSnapshot.stages[0].soakTimeMinutes).toBe(45);

      // Execution actuals must be recorded distinctly
      expect(job.execution.stageProgress[0].actualTemperatureC).toBe(652);
      expect(job.execution.stageProgress[0].actualDurationMinutes).toBe(46);
      expect(job.execution.stageProgress[0].temperatureDeviationC).toBe(2);
      expect(job.execution.stageProgress[0].isCompliant).toBe(true);
    });

    it('should reject non-positive actual temperature or soak duration', async () => {
      const opToken = generateToken('usr_op', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_stage_02', 'BO-202609-007');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/recipe-progress`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          stageSequence: 1,
          actualTemperatureC: 0, // Invalid: must be > 0
          actualDurationMinutes: -5 // Invalid: must be > 0
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(job.save).not.toHaveBeenCalled();
    });
  });

  describe('4. Strict Inspection Boundary Enforcement', () => {
    it('should reject submission of metallurgical hardness testing during production stage logging', async () => {
      const opToken = generateToken('usr_op', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_bound_01', 'BO-202609-008');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/recipe-progress`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          stageSequence: 1,
          actualTemperatureC: 650,
          actualDurationMinutes: 45,
          surfaceHardness: 58.5 // Boundary violation: belongs to QA Inspection!
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toMatch(/Inspection Boundary Violation/i);
      expect(job.save).not.toHaveBeenCalled();
    });

    it('should reject submission of microstructure analysis or case depth in production entry', async () => {
      const opToken = generateToken('usr_op', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_bound_02', 'BO-202609-009');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/save-production-data`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          operatorNotes: 'Cycle complete',
          microstructure: 'Tempered Martensite with retained austenite < 3%' // Boundary violation!
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toMatch(/Inspection Boundary Violation/i);
    });  });

  describe('5. Partial Saves vs Workflow Advance', () => {
    it('should allow incremental saving of partial production work without transitioning to inspection', async () => {
      const opToken = generateToken('usr_op', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_part_01', 'BO-202609-010');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/save-production-data`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          furnaceCharge: {
            chargeNumber: 'CHG-PART-01',
            loadedWeightKg: 300,
            loadedPieceCount: 100,
            initialFurnaceTempC: 30
          },
          stageProgress: {
            stageSequence: 1,
            actualTemperatureC: 650,
            actualDurationMinutes: 45,
            operatorNotes: 'Preheat ramp finished.'
          },
          operatorNotes: 'Partial work saved during shift handover.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Workflow Invariant: State MUST remain inProduction = true
      expect(res.body.data.inProduction).toBe(true);
      expect(res.body.data.waitingForInspection).toBe(false);
      expect(res.body.data.workflowState.inProduction).toBe(true);
      expect(res.body.data.workflowState.waitingForInspection).toBe(false);
    });

    it('should disallow saving production data on a BO that is not in production', async () => {
      const opToken = generateToken('usr_op', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_part_02', 'BO-202609-011', {
        status: JobStatus.WAITING_FOR_PRODUCTION,
        inProduction: false,
        waitingForProduction: true,
        workflowState: { waitingForProduction: true, inProduction: false }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/save-production-data`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          operatorNotes: 'Trying to save before taking into production'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not in production/i);
    });
  });

  describe('6. Incomplete vs Complete Production Approval Verification', () => {
    it('should reject approval for inspection when required recipe stages are incomplete', async () => {
      const supToken = generateToken('usr_sup', ['PLANT_MANAGER']);
      // Only stage 1 completed; stages 2 and 3 missing
      const job = createMockJobDoc('job_app_01', 'BO-202609-012', {
        execution: {
          stageProgress: [
            { stageSequence: 1, stageName: 'Preheat Ramp', actualTemperatureC: 650, actualDurationMinutes: 45 }
          ]
        }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${supToken}`)
        .send({
          completedQuantity: 100,
          scrappedQuantity: 0
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Incomplete Recipe execution/i);
    });

    it('should reject approval for inspection when pieces do not balance', async () => {
      const supToken = generateToken('usr_sup', ['PLANT_MANAGER']);
      const job = createMockJobDoc('job_app_02', 'BO-202609-013', {
        quantity: { targetQuantity: 100, loadedQuantity: 100, completedQuantity: 0, scrappedQuantity: 0 },
        execution: {
          stageProgress: [
            { stageSequence: 1, stageName: 'Preheat Ramp', actualTemperatureC: 650, actualDurationMinutes: 45 },
            { stageSequence: 2, stageName: 'Austenitizing Soak', actualTemperatureC: 845, actualDurationMinutes: 90 },
            { stageSequence: 3, stageName: 'High Pressure N2 Quench', actualTemperatureC: 45, actualDurationMinutes: 20 }
          ]
        }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      // Loaded is 100. Completed (80) + Scrapped (10) = 90 != 100
      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${supToken}`)
        .send({
          completedQuantity: 80,
          scrappedQuantity: 10
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Piece count balance discrepancy/i);
    });

    it('should atomically approve BO for inspection when all production data is complete and pieces balance', async () => {
      const supToken = generateToken('usr_sup', ['PLANT_MANAGER']);
      const job = createMockJobDoc('job_app_03', 'BO-202609-014', {
        quantity: { targetQuantity: 100, loadedQuantity: 100, completedQuantity: 0, scrappedQuantity: 0 },
        execution: {
          stageProgress: [
            { stageSequence: 1, stageName: 'Preheat Ramp', actualTemperatureC: 650, actualDurationMinutes: 45 },
            { stageSequence: 2, stageName: 'Austenitizing Soak', actualTemperatureC: 845, actualDurationMinutes: 90 },
            { stageSequence: 3, stageName: 'High Pressure N2 Quench', actualTemperatureC: 45, actualDurationMinutes: 20 }
          ]
        }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      jest.spyOn(productionJobRepository, 'atomicApproveForInspection').mockResolvedValue({
        ...job,
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
        },
        quantity: { targetQuantity: 100, loadedQuantity: 100, completedQuantity: 97, scrappedQuantity: 3 }
      } as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${supToken}`)
        .send({
          completedQuantity: 97,
          scrappedQuantity: 3,
          notes: 'Production complete, all 3 recipe stages finished. Handed off to QA.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inProduction).toBe(false);
      expect(res.body.data.waitingForInspection).toBe(true);
      expect(res.body.data.quantity.completedQuantity).toBe(97);
      expect(res.body.data.quantity.scrappedQuantity).toBe(3);
    });
  });
});
