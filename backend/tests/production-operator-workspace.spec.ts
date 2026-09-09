import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { productionJobService } from '../src/modules/production-job/production-job.service.js';
import { ProductionJobModel } from '../src/modules/production-job/production-job.model.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { furnaceCapacityRepository } from '../src/modules/furnace-capacity/furnace-capacity.repository.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { JobStatus } from '../src/core/constants/status.js';

describe('Production Phase Prompt 8: Production Record View and Operator Workspace Verification', () => {
  const app = createApp();
  const testTenant = 'tenant_prod_workspace_p8_001';

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
      assignedFurnaceId: 'furnace_vac_01',
      assignedFurnaceCode: 'FURNACE-VAC-01',
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
          },
          {
            sequence: 3,
            stageName: 'High Pressure N2 Quench',
            targetTemperatureC: 45,
            temperatureToleranceMinusC: 10,
            temperatureTolerancePlusC: 10,
            soakTimeMinutes: 20,
            quenchParameters: {
              medium: 'HIGH_PRESSURE_N2',
              agitationSpeedRpm: 1500,
              mediaInitialTempC: 25,
              mediaFinalTempC: 45
            }
          }
        ]
      },
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
        actualStartDate: new Date('2026-09-10T08:30:00.000Z'),
        dueDate: '2026-09-15'
      },
      execution: {
        furnaceCharge: {
          furnaceId: 'furnace_vac_01',
          furnaceCode: 'FURNACE-VAC-01',
          operatorId: 'usr_op01',
          shift: 'SHIFT_A',
          chargeNumber: 'CHG-202609-001',
          loadedPieces: 100,
          loadedWeightKg: 50,
          initialFurnaceTempC: 25,
          atmosphereType: 'VACUUM',
          notes: 'Standard batch load with dual trailing load thermocouples'
        },
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
        const found = DEFAULT_FACTORY_ROLES.find((r) => r.code === code);
        return (
          found
            ? { ...found, id: `role_${code}`, status: 'active' }
            : { code, id: `role_${code}`, status: 'active', permissions: [] }
        );
      }) as any;
    });
  });

  describe('Invariant 1: Header Context Completeness', () => {
    it('should return complete authoritative header context for an active BO', async () => {
      const mockJob = createMockJobDoc('job_p8_001', 'BO-202609-0801');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const operatorToken = generateToken('usr_op01', ['OPERATOR', 'MACHINIST']);
      const res = await request(app)
        .get('/api/v1/production-jobs/job_p8_001/operator-workspace')
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;

      // Validate Header Context
      expect(data.headerContext).toBeDefined();
      expect(data.headerContext.boNumber).toBe('BO-202609-0801');
      expect(data.headerContext.poNumber).toBe('PO-2026-00101');
      expect(data.headerContext.grnNumber).toBe('GRN-202609-0501');
      expect(data.headerContext.part.itemCode).toBe('PART-SHAFT-4340');
      expect(data.headerContext.part.materialGrade).toBe('AISI 4340');
      expect(data.headerContext.quantity.loadedQuantity).toBe(100);
      expect(data.headerContext.weightKg).toBe(50);
      expect(data.headerContext.recipe.recipeCode).toBe('REC-VAC-4340');
      expect(data.headerContext.recipe.revisionNumber).toBe(2);
      expect(data.headerContext.dueDate).toBe('2026-09-15');
      expect(data.headerContext.currentProductionState).toBe('IN_PRODUCTION');
      expect(data.headerContext.isActionable).toBe(true);
      expect(data.headerContext.isLocked).toBe(false);
    });
  });

  describe('Invariant 2: Recipe Panel Distinction & Read-Only Master Protection', () => {
    it('should present recipe requirements with tolerance windows and mark master data protected', async () => {
      const mockJob = createMockJobDoc('job_p8_002', 'BO-202609-0802');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const supervisorToken = generateToken('usr_sup01', ['PRODUCTION_SUPERVISOR']);
      const res = await request(app)
        .get('/api/v1/production-jobs/job_p8_002/operator-workspace')
        .set('Authorization', `Bearer ${supervisorToken}`);

      expect(res.status).toBe(200);
      const recipePanel = res.body.data.recipePanel;

      expect(recipePanel.isMasterDataProtected).toBe(true);
      expect(recipePanel.stages).toHaveLength(3);
      expect(recipePanel.stages[0].stageName).toBe('Preheat Ramp');
      expect(recipePanel.stages[0].targetTemperatureC).toBe(650);
      expect(recipePanel.stages[0].minAllowedTemperatureC).toBe(640);
      expect(recipePanel.stages[0].maxAllowedTemperatureC).toBe(660);
      expect(recipePanel.stages[0].isReadOnly).toBe(true);
    });
  });

  describe('Invariant 3: Process Progression Tracking', () => {
    it('should accurately calculate progression percentage and classify stage statuses', async () => {
      const mockJob = createMockJobDoc('job_p8_003', 'BO-202609-0803', {
        execution: {
          furnaceCharge: { loadedPieces: 100, loadedWeightKg: 50 },
          stageProgress: [
            {
              stageSequence: 1,
              stageName: 'Preheat Ramp',
              targetTemperatureC: 650,
              actualTemperatureC: 652,
              targetDurationMinutes: 45,
              actualDurationMinutes: 46,
              isCompliant: true,
              deviationWarning: null
            }
          ]
        }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const operatorToken = generateToken('usr_op01', ['OPERATOR']);
      const res = await request(app)
        .get('/api/v1/production-jobs/job_p8_003/operator-workspace')
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(res.status).toBe(200);
      const progress = res.body.data.processProgress;

      expect(progress.totalStages).toBe(3);
      expect(progress.completedStages).toBe(1);
      expect(progress.progressPercentage).toBe(33);
      expect(progress.currentStageSequence).toBe(2);
      expect(progress.isAllStagesCompleted).toBe(false);

      // Verify stage details
      expect(progress.stages[0].status).toBe('COMPLETED_COMPLIANT');
      expect(progress.stages[1].status).toBe('NEXT_IN_SEQUENCE');
      expect(progress.stages[2].status).toBe('LOCKED');
    });
  });

  describe('Invariant 4: Validation Feedback & Out-of-Tolerance Tracking', () => {
    it('should classify stages with out-of-tolerance excursions as COMPLETED_DEVIATION', async () => {
      const mockJob = createMockJobDoc('job_p8_004', 'BO-202609-0804', {
        execution: {
          furnaceCharge: { loadedPieces: 100, loadedWeightKg: 50 },
          stageProgress: [
            {
              stageSequence: 1,
              stageName: 'Preheat Ramp',
              targetTemperatureC: 650,
              actualTemperatureC: 675, // +25°C deviation (exceeds ±10°C window)
              targetDurationMinutes: 45,
              actualDurationMinutes: 45,
              isCompliant: false,
              deviationWarning: 'Temperature exceeds upper tolerance (+15°C outside window)',
              temperatureDeviationC: 25
            }
          ]
        }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const operatorToken = generateToken('usr_op01', ['OPERATOR']);
      const res = await request(app)
        .get('/api/v1/production-jobs/job_p8_004/operator-workspace')
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(res.status).toBe(200);
      const progress = res.body.data.processProgress;
      expect(progress.stages[0].status).toBe('COMPLETED_DEVIATION');
      expect(progress.stages[0].actualExecution.isCompliant).toBe(false);
      expect(progress.stages[0].actualExecution.deviationWarning).toContain('Temperature exceeds upper tolerance');
    });
  });

  describe('Invariant 5: Real-Time Non-Silent Deviation Flagging During Stage Progress', () => {
    it('should flag temperature deviations non-silently when recording stage actuals', async () => {
      const mockJob = createMockJobDoc('job_p8_005', 'BO-202609-0805');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const operatorToken = generateToken('usr_op01', ['OPERATOR']);
      const res = await request(app)
        .post('/api/v1/production-jobs/job_p8_005/recipe-stage-progress')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          stageSequence: 1,
          actualTemperatureC: 675, // Out of spec (Window 640 - 660)
          actualDurationMinutes: 45,
          operatorNotes: 'Thermocouple overshoot during preheat'
        });

      expect(res.status).toBe(200);
      const stageProgress = res.body.data.execution.stageProgress[0];
      expect(stageProgress.isCompliant).toBe(false);
      expect(stageProgress.deviationWarning).toBeDefined();
      expect(stageProgress.temperatureDeviationC).toBe(25);
    });
  });

  describe('Invariant 6: Process Sequence Gating', () => {
    it('should reject recording stage 2 when stage 1 has not been executed', async () => {
      const mockJob = createMockJobDoc('job_p8_006', 'BO-202609-0806');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const operatorToken = generateToken('usr_op01', ['OPERATOR']);
      const res = await request(app)
        .post('/api/v1/production-jobs/job_p8_006/recipe-stage-progress')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          stageSequence: 2, // Out of sequence!
          actualTemperatureC: 845,
          actualDurationMinutes: 90
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Sequence Violation');
    });
  });

  describe('Invariant 7: Partial Work Saving Capability', () => {
    it('should save partial stage progress and keep BO in inProduction status without advancing to inspection', async () => {
      const mockJob = createMockJobDoc('job_p8_007', 'BO-202609-0807');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);
      jest.spyOn(productionJobRepository, 'updateById').mockImplementation(async (_t, _id, update) => {
        return { ...mockJob, ...update } as any;
      });

      const operatorToken = generateToken('usr_op01', ['OPERATOR']);
      const res = await request(app)
        .post('/api/v1/production-jobs/job_p8_007/save-production-data')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          stageProgress: {
            stageSequence: 1,
            actualTemperatureC: 650,
            actualDurationMinutes: 45,
            operatorNotes: 'Preheat ramp stabilized'
          },
          operatorNotes: 'Intermediate thermal check verified'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(JobStatus.IN_PRODUCTION);
      expect(res.body.data.workflowState.inProduction).toBe(true);
      expect(res.body.data.workflowState.waitingForInspection).toBe(false);
    });
  });

  describe('Invariant 8: Separate Completion & Approval Action', () => {
    it('should require separate explicit approval action to hand off to inspection', async () => {
      const mockJob = createMockJobDoc('job_p8_008', 'BO-202609-0808', {
        execution: {
          furnaceCharge: { loadedPieces: 100, loadedWeightKg: 50 },
          stageProgress: [
            { stageSequence: 1, actualTemperatureC: 650, actualDurationMinutes: 45, isCompliant: true },
            { stageSequence: 2, actualTemperatureC: 845, actualDurationMinutes: 90, isCompliant: true },
            { stageSequence: 3, actualTemperatureC: 45, actualDurationMinutes: 20, isCompliant: true }
          ]
        }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);
      jest.spyOn(productionJobRepository, 'atomicApproveForInspection').mockResolvedValue({
        ...mockJob,
        status: JobStatus.WAITING_FOR_INSPECTION,
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
      } as any);

      const supervisorToken = generateToken('usr_sup01', ['PRODUCTION_SUPERVISOR']);
      const res = await request(app)
        .post('/api/v1/production-jobs/job_p8_008/approve-for-inspection')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send({
          completedQuantity: 98,
          scrappedQuantity: 2,
          notes: 'Full recipe executed with zero deviations'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(JobStatus.WAITING_FOR_INSPECTION);
      expect(res.body.data.workflowState.waitingForInspection).toBe(true);
      expect(res.body.data.workflowState.inProduction).toBe(false);
    });
  });

  describe('Invariant 9: Piece Count Conservation Enforcement', () => {
    it('should reject approval when completed + scrapped does not equal loaded quantity', async () => {
      const mockJob = createMockJobDoc('job_p8_009', 'BO-202609-0809', {
        execution: {
          furnaceCharge: { loadedPieces: 100, loadedWeightKg: 50 },
          stageProgress: [
            { stageSequence: 1, actualTemperatureC: 650, actualDurationMinutes: 45, isCompliant: true },
            { stageSequence: 2, actualTemperatureC: 845, actualDurationMinutes: 90, isCompliant: true },
            { stageSequence: 3, actualTemperatureC: 45, actualDurationMinutes: 20, isCompliant: true }
          ]
        }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const supervisorToken = generateToken('usr_sup01', ['PRODUCTION_SUPERVISOR']);
      const res = await request(app)
        .post('/api/v1/production-jobs/job_p8_009/approve-for-inspection')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send({
          completedQuantity: 90,
          scrappedQuantity: 5, // Sum = 95 != 100
          notes: 'Missing 5 pieces'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Piece count balance discrepancy');
    });
  });

  describe('Invariant 10: Concession Gate for Deviating Batches', () => {
    it('should reject approval of out-of-tolerance batch without authorized concession', async () => {
      const mockJob = createMockJobDoc('job_p8_010', 'BO-202609-0810', {
        execution: {
          furnaceCharge: { loadedPieces: 100, loadedWeightKg: 50 },
          stageProgress: [
            { stageSequence: 1, actualTemperatureC: 675, actualDurationMinutes: 45, isCompliant: false, deviationWarning: 'Overheat' },
            { stageSequence: 2, actualTemperatureC: 845, actualDurationMinutes: 90, isCompliant: true },
            { stageSequence: 3, actualTemperatureC: 45, actualDurationMinutes: 20, isCompliant: true }
          ]
        }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const supervisorToken = generateToken('usr_sup01', ['PRODUCTION_SUPERVISOR']);
      const res = await request(app)
        .post('/api/v1/production-jobs/job_p8_010/approve-for-inspection')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send({
          completedQuantity: 100,
          scrappedQuantity: 0,
          notes: 'Attempting approval without concession'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Recipe Compliance Violation');
    });

    it('should permit approval of out-of-tolerance batch when concession is explicitly authorized', async () => {
      const mockJob = createMockJobDoc('job_p8_010b', 'BO-202609-0810B', {
        execution: {
          furnaceCharge: { loadedPieces: 100, loadedWeightKg: 50 },
          stageProgress: [
            { stageSequence: 1, actualTemperatureC: 675, actualDurationMinutes: 45, isCompliant: false, deviationWarning: 'Overheat' },
            { stageSequence: 2, actualTemperatureC: 845, actualDurationMinutes: 90, isCompliant: true },
            { stageSequence: 3, actualTemperatureC: 45, actualDurationMinutes: 20, isCompliant: true }
          ]
        }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);
      jest.spyOn(productionJobRepository, 'atomicApproveForInspection').mockResolvedValue({
        ...mockJob,
        status: JobStatus.WAITING_FOR_INSPECTION,
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
      } as any);

      const supervisorToken = generateToken('usr_sup01', ['PRODUCTION_SUPERVISOR']);
      const res = await request(app)
        .post('/api/v1/production-jobs/job_p8_010b/approve-for-inspection')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send({
          completedQuantity: 100,
          scrappedQuantity: 0,
          concessionApproved: true,
          concessionReason: 'Metallurgical engineer reviewed +15C excursion; acceptable for rough-machined state.',
          notes: 'Approved under engineering concession'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(JobStatus.WAITING_FOR_INSPECTION);
    });
  });

  describe('Invariant 11: State Awareness & Inactionability on Completed BO', () => {
    it('should report isActionable: false and isLocked: true for BO in WAITING_FOR_INSPECTION', async () => {
      const mockJob = createMockJobDoc('job_p8_011', 'BO-202609-0811', {
        status: JobStatus.WAITING_FOR_INSPECTION,
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

      const operatorToken = generateToken('usr_op01', ['OPERATOR']);
      const res = await request(app)
        .get('/api/v1/production-jobs/job_p8_011/operator-workspace')
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.headerContext.isActionable).toBe(false);
      expect(data.headerContext.isLocked).toBe(true);
      expect(data.headerContext.lockReason).toContain('Batch Order has concluded production');
      expect(data.stateAwareness.isActionable).toBe(false);
      expect(data.stateAwareness.isWaitingForInspection).toBe(true);
    });
  });

  describe('Invariant 12: Stale Session Protection', () => {
    it('should reject mutating telemetry on a completed record to protect against stale UI sessions', async () => {
      const mockJob = createMockJobDoc('job_p8_012', 'BO-202609-0812', {
        status: JobStatus.WAITING_FOR_INSPECTION,
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

      const operatorToken = generateToken('usr_op01', ['OPERATOR']);
      const res = await request(app)
        .post('/api/v1/production-jobs/job_p8_012/recipe-stage-progress')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          stageSequence: 1,
          actualTemperatureC: 650,
          actualDurationMinutes: 45
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Post-Production Lock Violation');
    });
  });

  describe('Invariant 13: Role Separation', () => {
    it('should reject QC Inspector mutating production telemetry (403 Forbidden)', async () => {
      const mockJob = createMockJobDoc('job_p8_013', 'BO-202609-0813');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const qcToken = generateToken('usr_qc01', ['QC_INSPECTOR']);
      const res = await request(app)
        .post('/api/v1/production-jobs/job_p8_013/recipe-stage-progress')
        .set('Authorization', `Bearer ${qcToken}`)
        .send({
          stageSequence: 1,
          actualTemperatureC: 650,
          actualDurationMinutes: 45
        });

      expect(res.status).toBe(403);
    });
  });

  describe('Invariant 14: Inspection Boundary Field Quarantine', () => {
    it('should reject laboratory hardness or case depth fields in production payload', async () => {
      const mockJob = createMockJobDoc('job_p8_014', 'BO-202609-0814');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const operatorToken = generateToken('usr_op01', ['OPERATOR']);
      const res = await request(app)
        .post('/api/v1/production-jobs/job_p8_014/save-production-data')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          stageProgress: {
            stageSequence: 1,
            actualTemperatureC: 650,
            actualDurationMinutes: 45
          },
          surfaceHardnessHRC: 55 // Quarantined laboratory QA field!
        });

      expect([400, 422]).toContain(res.status);
      const responsePayload = JSON.stringify(res.body);
      expect(responsePayload).toContain('Inspection Boundary Violation');
    });
  });

  describe('Invariant 15: Unbroken Source Genealogy Preservation', () => {
    it('should preserve unbroken PO -> GRN -> BO lineage in the operator workspace', async () => {
      const mockJob = createMockJobDoc('job_p8_015', 'BO-202609-0815');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const operatorToken = generateToken('usr_op01', ['OPERATOR']);
      const res = await request(app)
        .get('/api/v1/production-jobs/job_p8_015/operator-workspace')
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.headerContext.hierarchy.displayHierarchy).toBe('PO-2026-00101 / GRN-202609-0501 / BO-202609-0815');
      expect(data.headerContext.poId).toBe('po_aero_101');
      expect(data.headerContext.grnId).toBe('grn_aero_501');
    });
  });

  describe('Invariant 16: Furnace Charge Parameter Updates from Workspace', () => {
    it('should allow updating furnace charge parameters for an active in-production BO', async () => {
      const mockJob = createMockJobDoc('job_p8_016', 'BO-202609-0816');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      const operatorToken = generateToken('usr_op01', ['OPERATOR']);
      const res = await request(app)
        .post('/api/v1/production-jobs/job_p8_016/charge')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          chargeNumber: 'CHG-202609-8899',
          loadedPieceCount: 100,
          loadedWeightKg: 52,
          initialFurnaceTempC: 28,
          shift: 'SHIFT_B',
          notes: 'Shift B handover load update'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.execution.furnaceCharge.chargeNumber).toBe('CHG-202609-8899');
      expect(res.body.data.execution.furnaceCharge.shift).toBe('SHIFT_B');
    });
  });
});
