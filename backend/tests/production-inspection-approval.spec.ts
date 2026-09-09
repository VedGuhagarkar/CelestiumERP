import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { JobStatus } from '../src/core/constants/status.js';
import { DomainEvents } from '../src/core/constants/events.js';
import { eventBus } from '../src/core/events/domain-event-bus.js';

describe('Production Phase Prompt 6: Production-to-Inspection Approval Verification', () => {
  const app = createApp();
  const testTenant = 'tenant_approval_spec_001';

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
      assignedFurnaceId: 'furnace_f01',
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
        recipeCode: 'REC-VAC-AUST-01',
        recipeName: 'Vacuum Austenitizing & Pressure Quench',
        revisionNumber: 3,
        stages: [
          {
            sequence: 1,
            stageName: 'Preheat Ramp',
            targetTemperatureC: 650,
            temperatureToleranceMinusC: 10,
            temperatureTolerancePlusC: 10,
            targetDurationMinutes: 45,
            durationToleranceMinusMinutes: 5,
            durationTolerancePlusMinutes: 10
          },
          {
            sequence: 2,
            stageName: 'Austenitizing Soak',
            targetTemperatureC: 845,
            temperatureToleranceMinusC: 5,
            temperatureTolerancePlusC: 5,
            targetDurationMinutes: 90,
            durationToleranceMinusMinutes: 0,
            durationTolerancePlusMinutes: 15
          },
          {
            sequence: 3,
            stageName: 'High Pressure N2 Quench',
            targetTemperatureC: 50,
            temperatureToleranceMinusC: 20,
            temperatureTolerancePlusC: 20,
            targetDurationMinutes: 20,
            durationToleranceMinusMinutes: 0,
            durationTolerancePlusMinutes: 5
          }
        ]
      },
      execution: {
        furnaceCharge: {
          furnaceId: 'furnace_f01',
          operatorId: 'usr_op01',
          shiftId: 'shift_morning',
          loadNumber: 'LOAD-202609-01',
          loadedPieceCount: 100,
          loadedWeightKg: 50,
          setpointTempC: 845,
          atmosphereType: 'Vacuum'
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
        ]
      },
      transitionHistory: [],
      isDeleted: false,
      toJSON() {
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

  describe('1. Valid Production Completion & Atomic State Transition', () => {
    it('should successfully approve a completed production BO and atomically transition inProduction -> waitingForInspection', async () => {
      const operatorToken = generateToken('usr_op01', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_app_101', 'BO-202609-0101');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const publishedEvents: string[] = [];
      jest.spyOn(eventBus, 'publish').mockImplementation((evt: any) => {
        publishedEvents.push(evt.name);
      });

      const updatedJob = {
        ...job,
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
        quantity: { targetQuantity: 100, loadedQuantity: 100, completedQuantity: 98, scrappedQuantity: 2 },
        execution: {
          ...job.execution,
          qualityHandoff: {
            inspectionRequestId: 'INSP-REQ-202609-9999',
            completedQuantity: 98,
            scrappedQuantity: 2
          }
        }
      };
      jest.spyOn(productionJobRepository, 'atomicApproveForInspection').mockResolvedValue(updatedJob as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-for-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          completedQuantity: 98,
          scrappedQuantity: 2,
          notes: 'Thermal treatment completed without process excursions. Handed off to QA.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('WAITING_FOR_INSPECTION');
      expect(res.body.data.inProduction).toBe(false);
      expect(res.body.data.waitingForInspection).toBe(true);

      // Verify domain events
      expect(publishedEvents).toContain(DomainEvents.JOB_APPROVED_FOR_INSPECTION);
      expect(publishedEvents).toContain(DomainEvents.JOB_COMPLETED);

      // Verify audit log call
      expect(auditService.record).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          action: 'PRODUCTION_JOB_APPROVED_FOR_INSPECTION',
          metadata: expect.objectContaining({
            status: 'WAITING_FOR_INSPECTION',
            transition: 'inProduction -> waitingForInspection',
            completedQuantity: 98,
            scrappedQuantity: 2
          })
        })
      );
    });

    it('should support the route alias /approve-inspection identically', async () => {
      const plantMgrToken = generateToken('usr_mgr', ['PLANT_MANAGER']);
      const job = createMockJobDoc('job_app_alias', 'BO-202609-0102');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);
      jest.spyOn(productionJobRepository, 'atomicApproveForInspection').mockResolvedValue({
        ...job,
        status: JobStatus.WAITING_FOR_INSPECTION,
        inProduction: false,
        waitingForInspection: true
      } as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plantMgrToken}`)
        .send({
          completedQuantity: 100,
          scrappedQuantity: 0,
          notes: 'Alias endpoint verified.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('2. Incomplete Production Records Gating', () => {
    it('should reject approval when required recipe stages are incomplete', async () => {
      const operatorToken = generateToken('usr_op01', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_inc_stage', 'BO-202609-0103', {
        execution: {
          stageProgress: [
            { stageSequence: 1, stageName: 'Preheat Ramp', actualTemperatureC: 650, actualDurationMinutes: 45 },
            { stageSequence: 2, stageName: 'Austenitizing Soak', actualTemperatureC: 845, actualDurationMinutes: 90 }
            // Missing Sequence 3: High Pressure N2 Quench
          ]
        }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-for-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ completedQuantity: 100, scrappedQuantity: 0 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Incomplete Recipe execution.*Missing recipe stage/i);
    });

    it('should reject approval when no stage progress is logged at all', async () => {
      const operatorToken = generateToken('usr_op01', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_no_stages', 'BO-202609-0104', {
        recipeSnapshot: { stages: [] },
        execution: { stageProgress: [] }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-for-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ completedQuantity: 100, scrappedQuantity: 0 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/No production stage progress recorded/i);
    });

    it('should reject approval when piece counts do not balance (Completed + Scrapped != Loaded)', async () => {
      const operatorToken = generateToken('usr_op01', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_unbalanced', 'BO-202609-0105');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      // Loaded is 100. Completed (90) + Scrapped (5) = 95 != 100
      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-for-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ completedQuantity: 90, scrappedQuantity: 5 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Piece count balance discrepancy/i);
    });

    it('should reject approval when completed or scrapped quantities are negative', async () => {
      const operatorToken = generateToken('usr_op01', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_neg_qty', 'BO-202609-0106');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-for-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ completedQuantity: -10, scrappedQuantity: 110 });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('should reject approval when no operational furnace equipment is assigned', async () => {
      const operatorToken = generateToken('usr_op01', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_no_furnace', 'BO-202609-0107', {
        assignedFurnaceId: null,
        furnaceId: null,
        execution: {
          furnaceCharge: null,
          stageProgress: [
            { stageSequence: 1, stageName: 'Preheat Ramp', actualTemperatureC: 650, actualDurationMinutes: 45 },
            { stageSequence: 2, stageName: 'Austenitizing Soak', actualTemperatureC: 845, actualDurationMinutes: 90 },
            { stageSequence: 3, stageName: 'High Pressure N2 Quench', actualTemperatureC: 45, actualDurationMinutes: 20 }
          ]
        }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-for-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ completedQuantity: 100, scrappedQuantity: 0 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/No operational furnace equipment has been assigned/i);
    });
  });

  describe('3. Mandatory Telemetry Validation', () => {
    it('should reject approval when recorded stage progress contains non-positive actual temperature (<= 0°C)', async () => {
      const operatorToken = generateToken('usr_op01', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_zero_temp', 'BO-202609-0108', {
        execution: {
          stageProgress: [
            { stageSequence: 1, stageName: 'Preheat Ramp', actualTemperatureC: 650, actualDurationMinutes: 45 },
            { stageSequence: 2, stageName: 'Austenitizing Soak', actualTemperatureC: 0, actualDurationMinutes: 90 },
            { stageSequence: 3, stageName: 'High Pressure N2 Quench', actualTemperatureC: 45, actualDurationMinutes: 20 }
          ]
        }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-for-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ completedQuantity: 100, scrappedQuantity: 0 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid actual temperature.*Must be > 0°C/i);
    });

    it('should reject approval when recorded stage progress contains non-positive actual soak duration (<= 0 min)', async () => {
      const operatorToken = generateToken('usr_op01', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_zero_dur', 'BO-202609-0109', {
        execution: {
          stageProgress: [
            { stageSequence: 1, stageName: 'Preheat Ramp', actualTemperatureC: 650, actualDurationMinutes: 45 },
            { stageSequence: 2, stageName: 'Austenitizing Soak', actualTemperatureC: 845, actualDurationMinutes: 0 },
            { stageSequence: 3, stageName: 'High Pressure N2 Quench', actualTemperatureC: 45, actualDurationMinutes: 20 }
          ]
        }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-for-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ completedQuantity: 100, scrappedQuantity: 0 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid actual soak duration.*Must be > 0 min/i);
    });
  });

  describe('4. Recipe Compliance Verification & Deviation Concession Gating', () => {
    it('should reject automatic approval when process contains recipe tolerance excursions without explicit concession', async () => {
      const operatorToken = generateToken('usr_op01', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_dev_unapproved', 'BO-202609-0110', {
        execution: {
          stageProgress: [
            { stageSequence: 1, stageName: 'Preheat Ramp', actualTemperatureC: 650, actualDurationMinutes: 45, isCompliant: true },
            {
              stageSequence: 2,
              stageName: 'Austenitizing Soak',
              actualTemperatureC: 820, // 845 +/- 5 -> Excursion: -25°C
              actualDurationMinutes: 90,
              isCompliant: false,
              deviationWarning: 'Temperature excursion: actual 820°C is below allowable minimum 840°C (-25°C)'
            },
            { stageSequence: 3, stageName: 'High Pressure N2 Quench', actualTemperatureC: 45, actualDurationMinutes: 20, isCompliant: true }
          ]
        }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-for-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ completedQuantity: 100, scrappedQuantity: 0 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Recipe Compliance Violation.*unapproved Recipe deviations/i);
    });

    it('should allow approval of non-compliant process when concession is explicitly authorized', async () => {
      const metallurgistToken = generateToken('usr_met01', ['PLANT_MANAGER']);
      const job = createMockJobDoc('job_dev_concession', 'BO-202609-0111', {
        execution: {
          stageProgress: [
            { stageSequence: 1, stageName: 'Preheat Ramp', actualTemperatureC: 650, actualDurationMinutes: 45, isCompliant: true },
            {
              stageSequence: 2,
              stageName: 'Austenitizing Soak',
              actualTemperatureC: 820,
              actualDurationMinutes: 90,
              isCompliant: false,
              deviationWarning: 'Temperature excursion: actual 820°C is below allowable minimum 840°C (-25°C)'
            },
            { stageSequence: 3, stageName: 'High Pressure N2 Quench', actualTemperatureC: 45, actualDurationMinutes: 20, isCompliant: true }
          ]
        }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      jest.spyOn(productionJobRepository, 'atomicApproveForInspection').mockImplementation(async (_t, _id, update: any) => {
        return {
          ...job,
          ...update.$set,
          execution: {
            ...job.execution,
            qualityHandoff: update.$set['execution.qualityHandoff']
          },
          id: job.id
        } as any;
      });

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-for-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metallurgistToken}`)
        .send({
          completedQuantity: 100,
          scrappedQuantity: 0,
          concessionApproved: true,
          concessionReason: 'Metallurgical Engineering Concession #MC-2026-044 authorized by Chief Metallurgist after coupon micro-hardness check.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('WAITING_FOR_INSPECTION');
      expect(res.body.data.execution.qualityHandoff.concession).toBeDefined();
      expect(res.body.data.execution.qualityHandoff.concession.concessionApproved).toBe(true);
      expect(res.body.data.execution.qualityHandoff.concession.concessionReason).toMatch(/MC-2026-044/);
    });
  });

  describe('5. Eligibility Enforcement & State Invariants', () => {
    it('should reject approval if BO is in WAITING_FOR_PRODUCTION state', async () => {
      const operatorToken = generateToken('usr_op01', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_wait_prod', 'BO-202609-0112', {
        status: JobStatus.WAITING_FOR_PRODUCTION,
        waitingForProduction: true,
        inProduction: false,
        workflowState: {
          waitingForProduction: true,
          inProduction: false,
          waitingForInspection: false,
          inInspection: false,
          waitingForDispatch: false,
          dispatched: false
        }
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-for-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ completedQuantity: 100, scrappedQuantity: 0 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Eligibility Violation.*waiting for production/i);
    });

    it('should reject duplicate approval if BO is already in WAITING_FOR_INSPECTION', async () => {
      const operatorToken = generateToken('usr_op01', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_already_app', 'BO-202609-0113', {
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
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-for-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ completedQuantity: 100, scrappedQuantity: 0 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Eligibility Violation.*already approved/i);
    });
  });

  describe('6. Concurrency Protection & Duplicate Rejection', () => {
    it('should return 409 Conflict if atomicApproveForInspection fails due to concurrent transition', async () => {
      const operatorToken = generateToken('usr_op01', ['FURNACE_OPERATOR']);
      const job = createMockJobDoc('job_race', 'BO-202609-0114');
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(job as any);

      // Simulates second concurrent call failing atomic filter check
      jest.spyOn(productionJobRepository, 'atomicApproveForInspection').mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${job.id}/approve-for-inspection`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ completedQuantity: 100, scrappedQuantity: 0 });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/could not be transitioned to waiting for inspection.*concurrent modification/i);
    });
  });

  describe('7. Authorization & RBAC Enforcement', () => {
    it('should reject unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/v1/production-jobs/job_app_noauth/approve-for-inspection')
        .set('x-tenant-id', testTenant)
        .send({ completedQuantity: 100, scrappedQuantity: 0 });

      expect(res.status).toBe(401);
    });

    it('should reject users lacking production permissions with 403 Forbidden', async () => {
      const auditorToken = generateToken('usr_auditor', ['QUALITY_AUDITOR']);
      const res = await request(app)
        .post('/api/v1/production-jobs/job_app_forbidden/approve-for-inspection')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${auditorToken}`)
        .send({ completedQuantity: 100, scrappedQuantity: 0 });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('8. Production Lock Post-Approval & Post-Production Modification Prohibitions', () => {
    it('should disallow recording recipe stage progress once BO is approved for inspection', async () => {
      const operatorToken = generateToken('usr_op01', ['FURNACE_OPERATOR']);
      const approvedJob = createMockJobDoc('job_locked_post_app', 'BO-202609-0115', {
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
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(approvedJob as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${approvedJob.id}/recipe-progress`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          stageSequence: 1,
          stageName: 'Preheat Ramp',
          actualTemperatureC: 652,
          actualDurationMinutes: 46
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not in production|Post-Production Lock Violation/i);
    });

    it('should disallow saving partial production data once BO is approved for inspection', async () => {
      const operatorToken = generateToken('usr_op01', ['FURNACE_OPERATOR']);
      const approvedJob = createMockJobDoc('job_locked_save', 'BO-202609-0116', {
        status: JobStatus.WAITING_FOR_INSPECTION,
        inProduction: false,
        waitingForInspection: true
      });
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(approvedJob as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${approvedJob.id}/save-production-data`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ operatorNotes: 'Attempting to edit after approval' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not in production|Post-Production Lock Violation/i);
    });

    it('should disallow updating process details once BO is in WAITING_FOR_INSPECTION', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);
      const approvedJob = createMockJobDoc('job_locked_details', 'BO-202609-0117', {
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
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(approvedJob as any);

      const res = await request(app)
        .put(`/api/v1/production-jobs/${approvedJob.id}/process-details`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({ processDetails: [] });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Post-Production Lock Violation/i);
    });
  });

  describe('9. Dispatch Bypass Cleanup & Lifecycle Integrity', () => {
    it('should prohibit direct transition from WAITING_FOR_INSPECTION to STORAGE or READY_FOR_DISPATCH', async () => {
      const adminToken = generateToken('usr_admin', ['PLANT_MANAGER']);
      const approvedJob = createMockJobDoc('job_bypass_attempt', 'BO-202609-0118', {
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
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(approvedJob as any);

      const res = await request(app)
        .post(`/api/v1/production-jobs/${approvedJob.id}/transition`)
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          toStatus: 'STORAGE',
          reason: 'Attempting to bypass quality inspection'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Cannot bypass Quality Inspection|State Transition Authority Violation/i);
    });
  });
});
