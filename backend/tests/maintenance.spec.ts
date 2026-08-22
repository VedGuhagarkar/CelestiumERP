import request from 'supertest';
import { createApp } from '../src/app.js';
import { maintenanceRepository } from '../src/modules/maintenance/maintenance.repository.js';
import { machineRepository } from '../src/modules/machine/machine.repository.js';
import { machineService } from '../src/modules/machine/machine.service.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { PERMISSIONS } from '../src/modules/rbac/rbac.constants.js';
import { rbacService } from '../src/modules/rbac/rbac.service.js';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/app.config.js';

function createAuthToken(
  userId: string,
  tenantId: string,
  roles: string[] = ['FACTORY_ENGINEER', 'MAINTENANCE_TECH']
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

function createMockPlan(overrides: Record<string, any> = {}) {
  const defaultPlan = {
    _id: 'pm_plan_001',
    id: 'pm_plan_001',
    tenantId: 'tenant_test_1',
    planCode: 'PM-FURN-VAC-01-MONTHLY',
    name: 'Monthly Vacuum Furnace Roughing Pump & Seal Service',
    machineId: 'mach_001',
    machineCode: 'FURN-VAC-01',
    triggerType: 'CALENDAR',
    frequency: 'MONTHLY',
    calendarIntervalDays: 30,
    lastCompletedDate: null,
    nextDueDate: new Date('2026-09-01'),
    runtimeIntervalHours: 500,
    lastServiceRuntimeHours: 0,
    currentRuntimeHours: 250,
    nextDueRuntimeHours: 500,
    estimatedDurationHours: 4.0,
    checklistTasks: [
      {
        stepNumber: 1,
        taskDescription: 'Inspect and clean main door elastomer vacuum seal',
        isMandatory: true,
        requirementType: 'VISUAL_INSPECTION'
      },
      {
        stepNumber: 2,
        taskDescription: 'Measure roughing pump oil level and color',
        isMandatory: true,
        requirementType: 'PASS_FAIL'
      },
      {
        stepNumber: 3,
        taskDescription: 'Verify ultimate vacuum pressure at 10-3 mbar',
        isMandatory: true,
        requirementType: 'NUMERIC_READING',
        targetValue: '< 1.0E-3 mbar'
      }
    ],
    isActive: true,
    isOverdue: false,
    notes: 'Standard manufacturer monthly PM schedule',
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn().mockImplementation(function () {
      return Promise.resolve(this);
    }),
    toJSON: jest.fn().mockImplementation(function () {
      const { save, toJSON, ...rest } = this;
      return rest;
    }),
    ...overrides
  };
  return defaultPlan;
}

function createMockWorkOrder(overrides: Record<string, any> = {}) {
  const defaultWO = {
    _id: 'wo_test_001',
    id: 'wo_test_001',
    tenantId: 'tenant_test_1',
    workOrderNumber: 'WO-202608-0001',
    machineId: 'mach_001',
    machineCode: 'FURN-VAC-01',
    workOrderType: 'BREAKDOWN',
    priority: 'CRITICAL',
    status: 'OPEN',
    preventivePlanId: null,
    preventivePlanCode: null,
    breakdownReportedAt: new Date(Date.now() - 3600000), // 1 hour ago
    breakdownReportedBy: {
      userId: 'usr_operator_01',
      email: 'operator@astralis.internal',
      role: 'FURNACE_OPERATOR'
    },
    failureSymptom: 'HEATER_CIRCUIT_TRIP',
    failureDescription: 'Heating element zone 2 circuit breaker tripped under 930C soak cycle',
    productionInterrupted: true,
    affectedJobId: 'job_001',
    affectedJobNumber: 'JOB-202608-0001',
    rootCause: null,
    rootCauseCategory: null,
    assignedTechnicians: [],
    startedAt: new Date(Date.now() - 3600000),
    completedAt: null,
    downtimeDurationMinutes: null,
    repairActionsTaken: null,
    checklistExecutions: [],
    partsReplaced: [],
    laborRecords: [],
    totalLaborHours: 0,
    testingResolutionState: null,
    postMaintenanceVerifiedBy: null,
    notes: null,
    isDeleted: false,
    createdAt: new Date(Date.now() - 3600000),
    updatedAt: new Date(),
    save: jest.fn().mockImplementation(function () {
      return Promise.resolve(this);
    }),
    toJSON: jest.fn().mockImplementation(function () {
      const { save, toJSON, ...rest } = this;
      return rest;
    }),
    ...overrides
  };
  return defaultWO;
}

describe('Maintenance & Breakdown Management Subsystem', () => {
  const app = createApp();
  const tenantId = 'tenant_test_1';
  const techId = 'usr_tech_01';
  let techToken: string;

  const mockMachine = {
    _id: 'mach_001',
    id: 'mach_001',
    machineCode: 'FURN-VAC-01',
    name: 'Ipsen 2-Bar Vacuum Furnace',
    status: 'IDLE',
    tenantId,
    capabilities: {
      supportedProcessFamilies: ['VACUUM_HEAT_TREATMENT'],
      furnaceClass: 'CLASS_2'
    },
    isDeleted: false,
    save: jest.fn().mockImplementation(function () {
      return Promise.resolve(this);
    })
  };

  beforeEach(() => {
    jest.clearAllMocks();
    techToken = createAuthToken(techId, tenantId, ['FACTORY_ENGINEER', 'MAINTENANCE_TECH']);

    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

    jest.spyOn(rbacService, 'getUserEffectivePermissions').mockResolvedValue({
      tenantId,
      userId: techId,
      roles: ['FACTORY_ENGINEER'],
      permissions: [
        PERMISSIONS.MACHINES_FURNACE_VIEW,
        PERMISSIONS.MACHINES_FURNACE_OPERATE,
        PERMISSIONS.MACHINES_FURNACE_CONFIGURE,
        PERMISSIONS.MACHINES_TELEMETRY_VIEW
      ],
      isSuperAdmin: false
    });
  });

  describe('POST /api/v1/maintenance/plans (Preventive Maintenance Plans)', () => {
    it('should create a monthly preventive maintenance plan with checklist tasks', async () => {
      jest.spyOn(machineRepository, 'findById').mockResolvedValue(mockMachine as any);
      jest.spyOn(maintenanceRepository, 'findPlanByCode').mockResolvedValue(null);

      const mockPlan = createMockPlan();
      jest.spyOn(maintenanceRepository, 'createPlan').mockResolvedValue(mockPlan as any);

      const res = await request(app)
        .post('/api/v1/maintenance/plans')
        .set('Authorization', `Bearer ${techToken}`)
        .send({
          planCode: 'PM-FURN-VAC-01-MONTHLY',
          name: 'Monthly Vacuum Furnace Roughing Pump & Seal Service',
          machineId: 'mach_001',
          triggerType: 'CALENDAR',
          frequency: 'MONTHLY',
          calendarIntervalDays: 30,
          estimatedDurationHours: 4.0,
          checklistTasks: [
            {
              stepNumber: 1,
              taskDescription: 'Inspect and clean main door elastomer vacuum seal',
              isMandatory: true,
              requirementType: 'VISUAL_INSPECTION'
            },
            {
              stepNumber: 2,
              taskDescription: 'Measure roughing pump oil level and color',
              isMandatory: true,
              requirementType: 'PASS_FAIL'
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.planCode).toBe('PM-FURN-VAC-01-MONTHLY');
      expect(res.body.data.frequency).toBe('MONTHLY');
      expect(res.body.data.checklistTasks.length).toBe(3);
    });

    it('should reject plan creation with duplicate plan code with 409 Conflict', async () => {
      const existing = createMockPlan();
      jest.spyOn(maintenanceRepository, 'findPlanByCode').mockResolvedValue(existing as any);

      const res = await request(app)
        .post('/api/v1/maintenance/plans')
        .set('Authorization', `Bearer ${techToken}`)
        .send({
          planCode: 'PM-FURN-VAC-01-MONTHLY',
          name: 'Duplicate PM Plan',
          machineId: 'mach_001',
          triggerType: 'CALENDAR',
          frequency: 'MONTHLY',
          estimatedDurationHours: 2.0,
          checklistTasks: [
            { stepNumber: 1, taskDescription: 'Task 1', requirementType: 'PASS_FAIL' }
          ]
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('already exists');
    });
  });

  describe('GET /api/v1/maintenance/plans/overdue (Overdue Maintenance Detection)', () => {
    it('should retrieve overdue preventive maintenance plans', async () => {
      const overduePlan = createMockPlan({ isOverdue: true, nextDueDate: new Date('2026-07-01') });
      jest.spyOn(maintenanceRepository, 'findOverduePlans').mockResolvedValue([overduePlan as any]);

      const res = await request(app)
        .get('/api/v1/maintenance/plans/overdue')
        .set('Authorization', `Bearer ${techToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].planCode).toBe('PM-FURN-VAC-01-MONTHLY');
    });
  });

  describe('POST /api/v1/maintenance/breakdown (Breakdown Incident Reporting)', () => {
    it('should log breakdown incident and automatically move equipment into BREAKDOWN status', async () => {
      jest.spyOn(machineRepository, 'findById').mockResolvedValue(mockMachine as any);
      jest.spyOn(maintenanceRepository, 'generateNextWorkOrderNumber').mockResolvedValue('WO-202608-0001');

      const mockWO = createMockWorkOrder();
      jest.spyOn(maintenanceRepository, 'createWorkOrder').mockResolvedValue(mockWO as any);
      const statusSpy = jest.spyOn(machineService, 'changeMachineStatus').mockResolvedValue(mockMachine as any);

      const res = await request(app)
        .post('/api/v1/maintenance/breakdown')
        .set('Authorization', `Bearer ${techToken}`)
        .send({
          machineId: 'mach_001',
          failureSymptom: 'HEATER_CIRCUIT_TRIP',
          failureDescription: 'Heating element zone 2 circuit breaker tripped under 930C soak cycle',
          priority: 'CRITICAL',
          productionInterrupted: true,
          affectedJobId: 'job_001',
          affectedJobNumber: 'JOB-202608-0001'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.workOrderNumber).toBe('WO-202608-0001');
      expect(res.body.data.failureSymptom).toBe('HEATER_CIRCUIT_TRIP');
      expect(statusSpy).toHaveBeenCalledWith(
        tenantId,
        expect.anything(),
        'mach_001',
        expect.objectContaining({ status: 'BREAKDOWN' })
      );
    });
  });

  describe('POST /api/v1/maintenance/breakdown/:id/resolve (Breakdown Resolution & Reliability)', () => {
    it('should resolve breakdown recording root cause, replaced parts, labor, downtime, and return equipment to IDLE', async () => {
      const mockWO = createMockWorkOrder();
      jest.spyOn(maintenanceRepository, 'findWorkOrderById').mockResolvedValue(mockWO as any);
      jest.spyOn(machineRepository, 'findById').mockResolvedValue(mockMachine as any);
      const statusSpy = jest.spyOn(machineService, 'changeMachineStatus').mockResolvedValue(mockMachine as any);

      const res = await request(app)
        .post('/api/v1/maintenance/breakdown/wo_test_001/resolve')
        .set('Authorization', `Bearer ${techToken}`)
        .send({
          rootCause: 'Molybdenum heating element terminal connector oxidation caused excessive contact resistance and thermal breaker trip',
          rootCauseCategory: 'ELECTRICAL_FAILURE',
          repairActionsTaken: 'Cleaned copper busbar connection terminals, replaced molybdenum connector clamp, torqued to 35 Nm, and ran 30-minute vacuum dry-run at 500C.',
          partsReplaced: [
            {
              partNumber: 'MOLY-CLAMP-35',
              partDescription: 'Molybdenum Heating Terminal Clamp 35mm',
              quantity: 2,
              unitOfMeasure: 'PCS'
            }
          ],
          laborRecords: [
            {
              technicianId: 'usr_tech_01',
              technicianName: 'Marcus Wright',
              hoursSpent: 1.5,
              date: new Date()
            }
          ],
          testingResolutionState: 'IDLE',
          verificationNotes: 'Dry-run successful; heater current steady at 180A balance across 3 phases'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockWO.status).toBe('COMPLETED');
      expect(mockWO.rootCauseCategory).toBe('ELECTRICAL_FAILURE');
      expect(mockWO.downtimeDurationMinutes).toBeGreaterThan(0);
      expect(mockWO.partsReplaced.length).toBe(1);
      expect(mockWO.totalLaborHours).toBe(1.5);
      expect(mockWO.save).toHaveBeenCalled();
      expect(statusSpy).toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/maintenance/work-orders/:id/complete (Preventive Work Order Completion)', () => {
    it('should complete preventive work order and advance next due date on linked PM plan', async () => {
      const mockWO = createMockWorkOrder({
        workOrderType: 'PREVENTIVE',
        preventivePlanId: 'pm_plan_001'
      });
      const mockPlan = createMockPlan();

      jest.spyOn(maintenanceRepository, 'findWorkOrderById').mockResolvedValue(mockWO as any);
      jest.spyOn(maintenanceRepository, 'findPlanById').mockResolvedValue(mockPlan as any);
      jest.spyOn(machineService, 'changeMachineStatus').mockResolvedValue(mockMachine as any);

      const res = await request(app)
        .post('/api/v1/maintenance/work-orders/wo_test_001/complete')
        .set('Authorization', `Bearer ${techToken}`)
        .send({
          repairActionsTaken: 'Completed monthly oil change and seal cleaning per PM checklist',
          testingResolutionState: 'IDLE'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockWO.status).toBe('COMPLETED');
      expect(mockPlan.lastCompletedDate).toBeDefined();
      expect(mockPlan.save).toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/maintenance/metrics (MTTR / MTBF Reliability Analytics)', () => {
    it('should calculate factory MTTR and MTBF metrics across equipment history', async () => {
      const mockMetrics = {
        totalWorkOrders: 12,
        openWorkOrders: 2,
        activeBreakdowns: 1,
        totalDowntimeHours: 18.5,
        mttrHours: 2.3,
        mtbfHours: 420.0,
        overduePreventivePlansCount: 1
      };

      jest.spyOn(maintenanceRepository, 'getMetrics').mockResolvedValue(mockMetrics);

      const res = await request(app)
        .get('/api/v1/maintenance/metrics')
        .set('Authorization', `Bearer ${techToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mttrHours).toBe(2.3);
      expect(res.body.data.mtbfHours).toBe(420.0);
      expect(res.body.data.activeBreakdowns).toBe(1);
    });
  });
});
