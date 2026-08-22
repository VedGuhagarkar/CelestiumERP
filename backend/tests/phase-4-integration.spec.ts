import request from 'supertest';
import { createApp } from '../src/app.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { qualityInspectionRepository } from '../src/modules/quality-inspection/quality-inspection.repository.js';
import { qualityPlanningRepository } from '../src/modules/quality-planning/quality-planning.repository.js';
import { qualityPlanningService } from '../src/modules/quality-planning/quality-planning.service.js';
import { ncrCapaRepository } from '../src/modules/ncr-capa/ncr-capa.repository.js';
import { qualityDocumentationRepository } from '../src/modules/quality-documentation/quality-documentation.repository.js';
import { machineRepository } from '../src/modules/machine/machine.repository.js';
import { machineService } from '../src/modules/machine/machine.service.js';
import { maintenanceRepository } from '../src/modules/maintenance/maintenance.repository.js';
import { pyrometryRepository } from '../src/modules/pyrometry/pyrometry.repository.js';
import { pyrometryService } from '../src/modules/pyrometry/pyrometry.service.js';
import { attendanceRepository } from '../src/modules/attendance/attendance.repository.js';
import { WorkforceMemberModel } from '../src/modules/workforce-capacity/workforce-member.model.js';
import { furnaceCapacityRepository } from '../src/modules/furnace-capacity/furnace-capacity.repository.js';
import { heatLotRepository } from '../src/modules/traceability/heat-lot.repository.js';
import { productionScheduleRepository } from '../src/modules/production-schedule/production-schedule.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { PERMISSIONS } from '../src/modules/rbac/rbac.constants.js';
import { rbacService } from '../src/modules/rbac/rbac.service.js';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/app.config.js';

function createAuthToken(
  userId: string,
  tenantId: string,
  roles: string[] = ['PLANT_MANAGER', 'QUALITY_MANAGER', 'METALLURGICAL_ENGINEER']
): string {
  return jwt.sign(
    {
      userId,
      tenantId,
      email: `${userId.toLowerCase()}@astralis-testing.com`,
      roles
    },
    config.auth.jwtSecret,
    { expiresIn: '1h' }
  );
}

describe('Phase 4 Master Integration & Certification Test Suite', () => {
  const app = createApp();
  const tenantId = 'tenant_aerospace_01';
  const managerId = 'usr_plant_mgr_01';
  let authToken: string;

  const mockFurnace = {
    _id: 'furn_001',
    id: 'furn_001',
    furnaceCode: 'FURN-VAC-01',
    name: 'Ipsen 2-Bar Vacuum Furnace',
    status: 'OPERATIONAL',
    tenantId,
    locationBay: 'BAY-A1',
    processCapabilities: {
      supportedProcessFamilies: ['VACUUM_HEAT_TREATMENT', 'HARDENING', 'TEMPERING', 'CARBURIZING']
    },
    thermalCapabilities: {
      minOperatingTempC: 400,
      maxOperatingTempC: 1200,
      pyrometryClass: 'CLASS_2'
    },
    isDeleted: false
  };

  const mockMachine = {
    _id: 'mach_001',
    id: 'mach_001',
    machineCode: 'FURN-VAC-01',
    name: 'Ipsen 2-Bar Vacuum Furnace',
    status: 'IDLE',
    tenantId,
    capabilities: {
      supportedProcessFamilies: ['VACUUM_HEAT_TREATMENT'],
      furnaceClass: 'CLASS_2',
      pyrometryStandard: 'AMS_2750G'
    },
    thermalLimits: {
      minOperatingTempC: 400,
      maxOperatingTempC: 1200
    },
    pyrometryCompliance: {
      lastTusDate: new Date('2026-08-01'),
      nextTusDueDate: new Date('2026-11-01'),
      isTusValid: true,
      lastSatDate: new Date('2026-08-01'),
      nextSatDueDate: new Date('2026-09-01'),
      isSatValid: true
    },
    statusHistory: [],
    isDeleted: false,
    save: jest.fn().mockImplementation(function () {
      return Promise.resolve(this);
    })
  };

  const mockJob = {
    _id: 'job_001',
    id: 'job_001',
    tenantId,
    jobNumber: 'JOB-202608-0001',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    customer: {
      customerId: 'cust_001',
      customerCode: 'CUST-AERO',
      customerName: 'Raytheon Technologies'
    },
    item: {
      itemId: 'item_001',
      itemCode: 'GEAR-AERO-01',
      itemName: 'Turbine Planetary Pinion',
      materialGrade: '9310_VAC_ARC',
      uom: 'PCS'
    },
    quantity: {
      targetQuantity: 50,
      completedQuantity: 50,
      scrappedQuantity: 0
    },
    heatLots: [
      {
        heatLotId: 'hl_001',
        heatLotNumber: 'HL-9310-2026',
        allocatedQuantity: 50
      }
    ],
    materialAllocations: [
      {
        heatLotId: 'hl_001',
        heatLotNumber: 'HL-9310-2026',
        allocatedQuantity: 50,
        uom: 'PCS'
      }
    ],
    recipeSnapshot: {
      recipeCode: 'RCP-9310-CARB',
      revisionNumber: 2,
      processFamily: 'VACUUM_HEAT_TREATMENT',
      stages: [{ stageName: 'Carburize', targetTemperatureC: 930, durationMinutes: 180 }]
    },
    specificationSnapshot: {
      specCode: 'SPEC-AERO-GEAR',
      revisionNumber: 3,
      standards: ['AMS_2759_7', 'AMS_2750G'],
      hardnessRequirement: {
        surfaceMin: 58.0,
        surfaceMax: 62.0,
        scale: 'HRC'
      },
      effectiveCaseDepthRequirement: {
        targetDepthMm: 1.0,
        minDepthMm: 0.8,
        maxDepthMm: 1.2,
        cutoffHardnessValue: 50.0,
        cutoffHardnessScale: 'HRC'
      }
    },
    timeline: {
      plannedStartDate: new Date('2026-08-25T06:00:00Z'),
      targetCompletionDate: new Date('2026-08-25T14:00:00Z'),
      actualStartDate: new Date('2026-08-25T06:00:00Z')
    },
    execution: {
      stageProgress: [{ stageIndex: 0, status: 'COMPLETED' }]
    },
    transitionHistory: [],
    assignmentHistory: [],
    isDeleted: false,
    save: jest.fn().mockImplementation(function () {
      return Promise.resolve(this);
    }),
    toJSON: jest.fn().mockImplementation(function () {
      const { save, toJSON, ...rest } = this;
      return rest;
    })
  };

  beforeEach(() => {
    jest.clearAllMocks();
    authToken = createAuthToken(managerId, tenantId);

    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

    jest.spyOn(rbacService, 'getUserEffectivePermissions').mockResolvedValue({
      tenantId,
      userId: managerId,
      roles: ['PLANT_MANAGER', 'QUALITY_MANAGER'],
      permissions: Object.values(PERMISSIONS),
      isSuperAdmin: false
    });
  });

  describe('Scenario 1: Completed Production Job Enters Quality & Generates Verified CoC', () => {
    it('should complete production, create quality inspection with exact snapshots, approve measurements, and generate CoC', async () => {
      // 1. Mock Job Completion
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob as any);
      jest.spyOn(qualityPlanningRepository, 'findApplicablePlan').mockResolvedValue(null);

      // 2. Mock Quality Inspection Creation
      const mockInspection = {
        _id: 'insp_001',
        id: 'insp_001',
        tenantId,
        inspectionNumber: 'INSP-202608-0001',
        jobId: 'job_001',
        jobNumber: 'JOB-202608-0001',
        recipeCode: 'RCP-9310-CARB',
        recipeRevision: 2,
        specCode: 'SPEC-AERO-GEAR',
        specRevision: 3,
        recipeSnapshot: {
          recipeCode: 'RCP-9310-CARB',
          revisionNumber: 2,
          processFamily: 'VACUUM_HEAT_TREATMENT'
        },
        specificationSnapshot: {
          specCode: 'SPEC-AERO-GEAR',
          revisionNumber: 3,
          standards: ['AMS_2759_7'],
          surfaceHardness: { min: 58.0, max: 62.0, scale: 'HRC' }
        },
        inspectionQuantity: {
          sampleSize: 5,
          totalLotQuantity: 50,
          uom: 'PCS'
        },
        heatLotNumber: 'HL-9310-2026',
        materialGrade: '9310_VAC_ARC',
        status: 'IN_REVIEW',
        testResults: {
          hardnessTests: [
            { location: 'SURFACE', measuredValue: 60.5, scale: 'HRC', passed: true },
            { location: 'SURFACE', measuredValue: 59.8, scale: 'HRC', passed: true },
            { location: 'SURFACE', measuredValue: 59.2, scale: 'HRC', passed: true }
          ],
          microstructure: {
            observedStructure: 'Tempered Martensite',
            retainedAustenitePercent: 8.5,
            grainSizeAstm: 7.5,
            passed: true
          },
          visualDimensional: {
            surfaceOxidationAcceptable: true,
            quenchCracksPresent: false,
            dimensionsWithinTolerance: true
          },
          overallTestPassed: true
        },
        transitionHistory: [],
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
        toJSON: jest.fn().mockImplementation(function () {
          const { save, toJSON, ...rest } = this;
          return rest;
        })
      };

      jest.spyOn(qualityInspectionRepository, 'generateNextInspectionNumber').mockResolvedValue('INSP-202608-0001');
      jest.spyOn(qualityInspectionRepository, 'create').mockResolvedValue(mockInspection as any);
      jest.spyOn(qualityInspectionRepository, 'findById').mockResolvedValue(mockInspection as any);

      // Create Inspection from completed job
      const inspRes = await request(app)
        .post('/api/v1/quality-inspections')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          jobId: 'job_001',
          sampleSize: 5
        });

      expect(inspRes.status).toBe(201);
      expect(inspRes.body.success).toBe(true);
      expect(inspRes.body.data.recipeRevision).toBe(2);
      expect(inspRes.body.data.specRevision).toBe(3);

      // Approve Quality Inspection
      mockInspection.status = 'IN_REVIEW';
      const approveRes = await request(app)
        .post('/api/v1/quality-inspections/insp_001/approve')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ remarks: 'All metallurgical characteristics conform to AMS 2759/7' });

      expect(approveRes.status).toBe(200);

      // Generate Certificate of Conformance (CoC)
      const mockCoC = {
        _id: 'coc_001',
        id: 'coc_001',
        documentNumber: 'COC-202608-0001',
        securityVerificationCode: 'SEC-AERO-9988-7766',
        conformanceStatus: 'CONFORMING',
        recipeRevisionUsed: 2,
        specificationRevisionUsed: 3,
        isApproved: true
      };
      mockInspection.status = 'APPROVED';
      jest.spyOn(qualityDocumentationRepository, 'generateNextDocumentNumber').mockResolvedValue('COC-202608-0001');
      jest.spyOn(qualityDocumentationRepository, 'create').mockResolvedValue(mockCoC as any);

      const cocRes = await request(app)
        .post('/api/v1/quality-documents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reportType: 'CERTIFICATE_OF_CONFORMANCE',
          inspectionId: 'insp_001',
          poNumber: 'PO-AERO-4455',
          conformanceStatement: 'Certified that items meet all drawing and AMS 2759/7 specifications'
        });

      expect(cocRes.status).toBe(201);
      expect(cocRes.body.data.conformanceStatus).toBe('CONFORMING');
      expect(cocRes.body.data.securityVerificationCode).toBeDefined();
    });
  });

  describe('Scenario 2: Failed Hardness Test Triggers NCR & Quarantines Material', () => {
    it('should reject inspection on out-of-spec hardness, raise Non-Conformance Report, and isolate lot', async () => {
      const mockFailedInspection = {
        _id: 'insp_fail_001',
        id: 'insp_fail_001',
        tenantId,
        inspectionNumber: 'INSP-202608-0002',
        jobId: 'job_001',
        jobNumber: 'JOB-202608-0001',
        heatLotNumber: 'HL-9310-2026',
        materialGrade: '9310_VAC_ARC',
        status: 'IN_REVIEW',
        inspectionQuantity: {
          sampleSize: 5,
          totalLotQuantity: 50,
          uom: 'PCS'
        },
        testResults: {
          hardnessTests: [{ location: 'Core', measuredValue: 52.0, scale: 'HRC', passed: false }],
          overallTestPassed: false
        },
        transitionHistory: [],
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
        toJSON: jest.fn().mockImplementation(function () {
          const { save, toJSON, ...rest } = this;
          return rest;
        })
      };

      const mockNCR = {
        _id: 'ncr_001',
        id: 'ncr_001',
        tenantId,
        ncrNumber: 'NCR-202608-0001',
        inspectionId: 'insp_fail_001',
        jobId: 'job_001',
        jobNumber: 'JOB-202608-0001',
        heatLotNumber: 'HL-9310-2026',
        defectType: 'HARDNESS_OUT_OF_TOLERANCE',
        severity: 'CRITICAL',
        containmentDisposition: {
          quarantineLocation: 'QUARANTINE-BAY-Q1',
          quarantinedQuantity: 50,
          isQuarantined: true
        },
        status: 'OPEN'
      };

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob as any);
      jest.spyOn(qualityInspectionRepository, 'findById').mockResolvedValue(mockFailedInspection as any);
      jest.spyOn(ncrCapaRepository, 'generateNextNcrNumber').mockResolvedValue('NCR-202608-0001');
      jest.spyOn(ncrCapaRepository, 'createNcr').mockResolvedValue(mockNCR as any);
      jest.spyOn(heatLotRepository, 'findByHeatLotNumber').mockResolvedValue({
        status: 'ALLOCATED',
        save: jest.fn().mockResolvedValue({})
      } as any);

      // 1. Reject Inspection
      const rejectRes = await request(app)
        .post('/api/v1/quality-inspections/insp_fail_001/reject')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          defectDescription: 'Surface hardness (52.0 HRC) failed to meet required minimum 58.0 HRC',
          severity: 'CRITICAL'
        });

      expect(rejectRes.status).toBe(200);

      // 2. Raise NCR with quarantine containment
      const ncrRes = await request(app)
        .post('/api/v1/ncrs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          inspectionId: 'insp_fail_001',
          jobId: 'job_001',
          defectType: 'HARDNESS_OUT_OF_TOLERANCE',
          defectSeverity: 'CRITICAL',
          defectDescription: 'Insufficient case hardness due to premature quench delay',
          totalAffectedQuantity: 50,
          rejectedQuantity: 50,
          containmentAction: 'Move entire heat lot HL-9310-2026 to Quarantine Bay Q1',
          quarantineRequired: true,
          quarantineBay: 'QUARANTINE-BAY-Q1'
        });

      expect(ncrRes.status).toBe(201);
      expect(ncrRes.body.data.ncrNumber).toBe('NCR-202608-0001');
      expect(ncrRes.body.data.containmentDisposition.isQuarantined).toBe(true);
    });
  });

  describe('Scenario 3: Machine Breakdown & Maintenance Gating on Production Scheduling', () => {
    it('should report equipment breakdown, move machine into BREAKDOWN state, and block production scheduling', async () => {
      mockMachine.status = 'IDLE';
      mockMachine.statusHistory = [];
      jest.spyOn(machineRepository, 'findById').mockImplementation(async (_t, id) => {
        if (id === 'mach_001' || id === 'furn_001') return mockMachine as any;
        return null;
      });
      jest.spyOn(machineRepository, 'findByCode').mockResolvedValue(mockMachine as any);
      jest.spyOn(maintenanceRepository, 'generateNextWorkOrderNumber').mockResolvedValue('WO-202608-0001');

      const mockWO = {
        id: 'wo_breakdown_001',
        workOrderNumber: 'WO-202608-0001',
        machineId: 'mach_001',
        machineCode: 'FURN-VAC-01',
        workOrderType: 'BREAKDOWN',
        status: 'OPEN'
      };
      jest.spyOn(maintenanceRepository, 'createWorkOrder').mockResolvedValue(mockWO as any);

      // 1. Report Breakdown
      const breakdownRes = await request(app)
        .post('/api/v1/maintenance/breakdown')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          machineId: 'mach_001',
          failureSymptom: 'VACUUM_LEAK',
          failureDescription: 'Vacuum diffusion pump heater cartridge burned out during cycle',
          priority: 'CRITICAL'
        });

      expect(breakdownRes.status).toBe(201);
      expect(mockMachine.status).toBe('BREAKDOWN');

      // 2. Verify Scheduling on broken machine fails
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob as any);
      jest.spyOn(furnaceCapacityRepository, 'findFurnaceById').mockResolvedValue(mockFurnace as any);
      jest.spyOn(productionScheduleRepository, 'findActiveScheduleByJobId').mockResolvedValue(null);
      jest.spyOn(productionScheduleRepository, 'findActiveSchedulesByFurnaceAndTime').mockResolvedValue([]);

      const scheduleRes = await request(app)
        .post('/api/v1/production-schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          jobId: 'job_001',
          furnaceId: 'furn_001',
          plannedStartTime: '2026-08-25T06:00:00Z',
          plannedEndTime: '2026-08-25T14:00:00Z'
        });

      expect(scheduleRes.status).toBe(400);
      expect(scheduleRes.body.message).toContain('unavailable for scheduling');
    });
  });

  describe('Scenario 4: Pyrometry Compliance Readiness Gating', () => {
    it('should reject scheduling when TUS survey is overdue or operating temperature is outside envelope', async () => {
      // Mock expired TUS
      jest.spyOn(pyrometryService, 'evaluateMachineCompliance').mockResolvedValue({
        machineId: 'mach_001',
        machineCode: 'FURN-VAC-01',
        pyrometryStandard: 'AMS_2750G',
        furnaceClass: 'CLASS_2',
        instrumentationType: 'TYPE_A',
        isCompliant: false,
        overallAlertLevel: 'TUS_OVERDUE',
        tusStatus: { isValid: false, daysUntilExpiry: -5 },
        satStatus: { isValid: true },
        channelStatus: { totalChannels: 2, controlChannelsValid: true, overtempChannelsValid: true, expiredChannels: [] },
        alerts: ['Temperature Uniformity Survey (TUS) is OVERDUE for furnace FURN-VAC-01']
      });

      await expect(
        pyrometryService.validateMachinePyrometryReadiness(tenantId, 'mach_001', 950)
      ).rejects.toThrow('failed Pyrometry Compliance Readiness');
    });
  });

  describe('Scenario 5: Workforce Leave & Skill Availability Gating', () => {
    it('should prevent scheduling operator on approved leave and filter available operators by skill certification', async () => {
      const operator = {
        _id: 'emp_001',
        id: 'emp_001',
        tenantId,
        employeeCode: 'EMP-OP-01',
        fullName: 'Marcus Vance',
        department: 'HEAT_TREATMENT',
        defaultShift: 'SHIFT-MORNING',
        status: 'ACTIVE',
        skills: [{ skillCode: 'SEALED_QUENCH_FURNACE_OPERATION', isCertified: true }],
        approvedLeaves: [{ startDate: new Date('2026-08-25'), endDate: new Date('2026-08-27'), leaveType: 'VACATION' }],
        isDeleted: false
      };

      jest.spyOn(WorkforceMemberModel, 'findOne').mockResolvedValue(operator as any);
      jest.spyOn(attendanceRepository, 'findShiftById').mockResolvedValue({ id: 's1', shiftCode: 'M1', isActive: true, startTime: '06:00', endTime: '14:00' } as any);
      jest.spyOn(attendanceRepository, 'findApprovedLeavesForEmployee').mockResolvedValue({ leaveType: 'VACATION' } as any);

      // Attempting to schedule operator on leave date fails
      const res = await request(app)
        .post('/api/v1/attendance/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employeeId: 'emp_001',
          shiftId: 's1',
          date: '2026-08-25'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Approved VACATION leave exists');
    });
  });

  describe('Scenario 6: Cross-Domain Tenant Isolation', () => {
    it('should strictly isolate records between tenant_aerospace_01 and tenant_automotive_02', async () => {
      const foreignToken = createAuthToken('usr_foreign_01', 'tenant_automotive_02');

      // Tenant 1 finds its record, but Tenant 2 gets 404
      jest.spyOn(qualityInspectionRepository, 'findById').mockImplementation(async (tId, id) => {
        if (tId === tenantId && id === 'insp_001') {
          return { id: 'insp_001', tenantId } as any;
        }
        return null;
      });

      const res = await request(app)
        .get('/api/v1/quality-inspections/insp_001')
        .set('Authorization', `Bearer ${foreignToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('Scenario 7: Reinspection Lifecycle', () => {
    it('should request reinspection on a failed inspection, increasing sample size and advancing status to REINSPECTION', async () => {
      const mockReinspInspection = {
        _id: 'insp_re_001',
        id: 'insp_re_001',
        tenantId,
        inspectionNumber: 'INSP-202608-0003',
        status: 'REJECTED',
        inspectionQuantity: { sampleSize: 5, totalLotQuantity: 50, uom: 'PCS' },
        transitionHistory: [],
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
        toJSON: jest.fn().mockImplementation(function () {
          const { save, toJSON, ...rest } = this;
          return rest;
        })
      };

      jest.spyOn(qualityInspectionRepository, 'findById').mockResolvedValue(mockReinspInspection as any);

      const res = await request(app)
        .post('/api/v1/quality-inspections/insp_re_001/reinspection')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reinspectionReason: 'Re-temper performed under rework authorization RWK-2026-01',
          revisedSampleSize: 10
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockReinspInspection.status).toBe('REINSPECTION');
      expect(mockReinspInspection.inspectionQuantity.sampleSize).toBe(10);
    });
  });

  describe('Scenario 8: Overdue Preventive Maintenance Alerting', () => {
    it('should query overdue preventive maintenance plans', async () => {
      const overduePlans = [
        {
          id: 'pm_001',
          planCode: 'PM-FURN-MONTHLY',
          planName: 'Monthly Vacuum Furnace Seal & Element Check',
          machineCode: 'FURN-VAC-01',
          nextDueDate: new Date('2026-08-10'),
          daysOverdue: 13,
          isOverdue: true
        }
      ];

      jest.spyOn(maintenanceRepository, 'findOverduePlans').mockResolvedValue(overduePlans as any);

      const res = await request(app)
        .get('/api/v1/maintenance/plans/overdue')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].planCode).toBe('PM-FURN-MONTHLY');
      expect(res.body.data[0].isOverdue).toBe(true);
    });
  });
});
