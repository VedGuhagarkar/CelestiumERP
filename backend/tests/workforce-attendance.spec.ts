import request from 'supertest';
import { createApp } from '../src/app.js';
import { attendanceRepository } from '../src/modules/attendance/attendance.repository.js';
import { WorkforceMemberModel } from '../src/modules/workforce-capacity/workforce-member.model.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { PERMISSIONS } from '../src/modules/rbac/rbac.constants.js';
import { rbacService } from '../src/modules/rbac/rbac.service.js';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/app.config.js';

function createAuthToken(
  userId: string,
  tenantId: string,
  roles: string[] = ['FACTORY_OPERATIONS_MANAGER', 'PRODUCTION_SUPERVISOR']
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

function createMockShift(overrides: Record<string, any> = {}) {
  const defaultShift = {
    _id: 'shift_001',
    id: 'shift_001',
    tenantId: 'tenant_test_1',
    shiftCode: 'SHIFT-MORNING-A',
    name: 'Morning Operational Shift (A)',
    startTime: '06:00',
    endTime: '14:00',
    durationHours: 8.0,
    breakDurationMinutes: 30,
    gracePeriodMinutes: 15,
    isOvernight: false,
    colorCode: '#3b82f6',
    isActive: true,
    notes: 'Standard morning heat treatment furnace operations',
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
  return defaultShift;
}

function createMockSchedule(overrides: Record<string, any> = {}) {
  const defaultSched = {
    _id: 'sched_001',
    id: 'sched_001',
    tenantId: 'tenant_test_1',
    scheduleCode: 'SCH-202608-0001',
    employeeId: 'emp_001',
    employeeCode: 'EMP-OP-01',
    employeeName: 'Marcus Vance',
    department: 'HEAT_TREATMENT_OPERATIONS',
    shiftId: 'shift_001',
    shiftCode: 'SHIFT-MORNING-A',
    shiftName: 'Morning Operational Shift (A)',
    date: new Date('2026-08-25'),
    scheduledStartTime: new Date('2026-08-25T06:00:00Z'),
    scheduledEndTime: new Date('2026-08-25T14:00:00Z'),
    isRestDay: false,
    status: 'SCHEDULED',
    notes: null,
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
  return defaultSched;
}

function createMockAttendance(overrides: Record<string, any> = {}) {
  const defaultAtt = {
    _id: 'att_001',
    id: 'att_001',
    tenantId: 'tenant_test_1',
    attendanceNumber: 'ATT-202608-0001',
    employeeId: 'emp_001',
    employeeCode: 'EMP-OP-01',
    employeeName: 'Marcus Vance',
    department: 'HEAT_TREATMENT_OPERATIONS',
    shiftId: 'shift_001',
    shiftCode: 'SHIFT-MORNING-A',
    date: new Date('2026-08-25'),
    clockInTime: new Date('2026-08-25T06:05:00Z'),
    clockOutTime: null,
    scheduledStartTime: new Date('2026-08-25T06:00:00Z'),
    scheduledEndTime: new Date('2026-08-25T14:00:00Z'),
    actualHoursWorked: 0,
    regularHours: 0,
    overtimeHours: 0,
    lateMinutes: 0,
    earlyExitMinutes: 0,
    status: 'PRESENT',
    isJustifiedCorrection: false,
    correctionReason: null,
    correctedBy: null,
    notes: null,
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
  return defaultAtt;
}

describe('Workforce, Attendance & Operator Scheduling Subsystem', () => {
  const app = createApp();
  const tenantId = 'tenant_test_1';
  const managerId = 'usr_mgr_01';
  let managerToken: string;

  const mockEmployee = {
    _id: 'emp_001',
    id: 'emp_001',
    tenantId,
    employeeCode: 'EMP-OP-01',
    fullName: 'Marcus Vance',
    department: 'HEAT_TREATMENT_OPERATIONS',
    designation: 'Senior Vacuum Furnace Operator',
    defaultShift: 'SHIFT-MORNING-A',
    status: 'ACTIVE',
    skills: [
      {
        skillCode: 'SEALED_QUENCH_FURNACE_OPERATION',
        skillName: 'Sealed Quench Furnace Operation',
        proficiency: 'EXPERT',
        isCertified: true
      }
    ],
    isDeleted: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
    managerToken = createAuthToken(managerId, tenantId, ['FACTORY_OPERATIONS_MANAGER']);

    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

    jest.spyOn(rbacService, 'getUserEffectivePermissions').mockResolvedValue({
      tenantId,
      userId: managerId,
      roles: ['FACTORY_OPERATIONS_MANAGER'],
      permissions: [
        PERMISSIONS.WORKFORCE_EMPLOYEE_VIEW,
        PERMISSIONS.WORKFORCE_EMPLOYEE_MANAGE,
        PERMISSIONS.WORKFORCE_EMPLOYEE_CERTIFY,
        PERMISSIONS.WORKFORCE_ATTENDANCE_VIEW,
        PERMISSIONS.WORKFORCE_ATTENDANCE_MARK,
        PERMISSIONS.WORKFORCE_ATTENDANCE_APPROVE
      ],
      isSuperAdmin: false
    });
  });

  describe('POST /api/v1/attendance/shifts (Shift Definitions)', () => {
    it('should create a morning operational shift with grace period', async () => {
      jest.spyOn(attendanceRepository, 'findShiftByCode').mockResolvedValue(null);

      const mockShift = createMockShift();
      jest.spyOn(attendanceRepository, 'createShift').mockResolvedValue(mockShift as any);

      const res = await request(app)
        .post('/api/v1/attendance/shifts')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          shiftCode: 'SHIFT-MORNING-A',
          name: 'Morning Operational Shift (A)',
          startTime: '06:00',
          endTime: '14:00',
          durationHours: 8.0,
          breakDurationMinutes: 30,
          gracePeriodMinutes: 15
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.shiftCode).toBe('SHIFT-MORNING-A');
      expect(res.body.data.gracePeriodMinutes).toBe(15);
    });

    it('should reject duplicate shiftCode with 409 Conflict', async () => {
      const existing = createMockShift();
      jest.spyOn(attendanceRepository, 'findShiftByCode').mockResolvedValue(existing as any);

      const res = await request(app)
        .post('/api/v1/attendance/shifts')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          shiftCode: 'SHIFT-MORNING-A',
          name: 'Duplicate Shift',
          startTime: '06:00',
          endTime: '14:00',
          durationHours: 8.0
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('already exists');
    });
  });

  describe('POST /api/v1/attendance/schedules (Roster Scheduling & Conflict Engine)', () => {
    it('should create a shift schedule when no conflicts exist', async () => {
      jest.spyOn(WorkforceMemberModel, 'findOne').mockResolvedValue(mockEmployee as any);
      jest.spyOn(attendanceRepository, 'findShiftById').mockResolvedValue(createMockShift() as any);
      jest.spyOn(attendanceRepository, 'findApprovedLeavesForEmployee').mockResolvedValue(null);
      jest.spyOn(attendanceRepository, 'findEmployeeScheduleOnDate').mockResolvedValue([]);
      jest.spyOn(attendanceRepository, 'generateNextScheduleCode').mockResolvedValue('SCH-202608-0001');

      const mockSched = createMockSchedule();
      jest.spyOn(attendanceRepository, 'createSchedule').mockResolvedValue(mockSched as any);

      const res = await request(app)
        .post('/api/v1/attendance/schedules')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          employeeId: 'emp_001',
          shiftId: 'shift_001',
          date: '2026-08-25'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.scheduleCode).toBe('SCH-202608-0001');
      expect(res.body.data.employeeCode).toBe('EMP-OP-01');
    });

    it('should reject schedule creation with 409 Conflict when employee is already scheduled on that date', async () => {
      jest.spyOn(WorkforceMemberModel, 'findOne').mockResolvedValue(mockEmployee as any);
      jest.spyOn(attendanceRepository, 'findShiftById').mockResolvedValue(createMockShift() as any);
      jest.spyOn(attendanceRepository, 'findApprovedLeavesForEmployee').mockResolvedValue(null);
      jest.spyOn(attendanceRepository, 'findEmployeeScheduleOnDate').mockResolvedValue([createMockSchedule() as any]);

      const res = await request(app)
        .post('/api/v1/attendance/schedules')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          employeeId: 'emp_001',
          shiftId: 'shift_001',
          date: '2026-08-25'
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('Schedule conflict');
    });

    it('should reject schedule creation with 400 Bad Request when employee is on approved leave', async () => {
      jest.spyOn(WorkforceMemberModel, 'findOne').mockResolvedValue(mockEmployee as any);
      jest.spyOn(attendanceRepository, 'findShiftById').mockResolvedValue(createMockShift() as any);
      jest.spyOn(attendanceRepository, 'findApprovedLeavesForEmployee').mockResolvedValue({
        leaveType: 'ANNUAL'
      } as any);

      const res = await request(app)
        .post('/api/v1/attendance/schedules')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          employeeId: 'emp_001',
          shiftId: 'shift_001',
          date: '2026-08-25'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Approved ANNUAL leave exists');
    });
  });

  describe('POST /api/v1/attendance/clock-in & /clock-out (Attendance Recording)', () => {
    it('should record clock-in within grace period as PRESENT', async () => {
      jest.spyOn(WorkforceMemberModel, 'findOne').mockResolvedValue(mockEmployee as any);
      jest.spyOn(attendanceRepository, 'findEmployeeAttendanceOnDate').mockResolvedValue(null);
      jest.spyOn(attendanceRepository, 'findEmployeeScheduleOnDate').mockResolvedValue([createMockSchedule() as any]);
      jest.spyOn(attendanceRepository, 'findShiftById').mockResolvedValue(createMockShift() as any);
      jest.spyOn(attendanceRepository, 'generateNextAttendanceNumber').mockResolvedValue('ATT-202608-0001');

      const mockAtt = createMockAttendance({ status: 'PRESENT' });
      jest.spyOn(attendanceRepository, 'createAttendanceRecord').mockResolvedValue(mockAtt as any);

      const res = await request(app)
        .post('/api/v1/attendance/clock-in')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          employeeId: 'emp_001',
          clockInTime: '2026-08-25T06:05:00Z' // 5 mins in (within 15 min grace)
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PRESENT');
    });

    it('should record clock-out and compute actual and regular worked hours', async () => {
      const activeAtt = createMockAttendance({
        clockInTime: new Date('2026-08-25T06:00:00Z')
      });

      jest.spyOn(WorkforceMemberModel, 'findOne').mockResolvedValue(mockEmployee as any);
      jest.spyOn(attendanceRepository, 'findEmployeeAttendanceOnDate').mockResolvedValue(activeAtt as any);

      const res = await request(app)
        .post('/api/v1/attendance/clock-out')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          employeeId: 'emp_001',
          clockOutTime: '2026-08-25T14:30:00Z' // 8.5 hours
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(activeAtt.actualHoursWorked).toBe(8.5);
      expect(activeAtt.regularHours).toBe(8.0);
      expect(activeAtt.overtimeHours).toBe(0.5);
      expect(activeAtt.save).toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/attendance/records/:id/correct (Justified Attendance Corrections)', () => {
    it('should apply supervisor-justified attendance correction and record audit trail', async () => {
      const mockAtt = createMockAttendance();
      jest.spyOn(attendanceRepository, 'findAttendanceById').mockResolvedValue(mockAtt as any);

      const res = await request(app)
        .post('/api/v1/attendance/records/att_001/correct')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          clockInTime: '2026-08-25T06:00:00Z',
          clockOutTime: '2026-08-25T14:00:00Z',
          status: 'PRESENT',
          correctionReason: 'Biometric gate reader malfunction verified by security log'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockAtt.isJustifiedCorrection).toBe(true);
      expect(mockAtt.correctionReason).toContain('Biometric gate reader');
      expect(mockAtt.save).toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/attendance/leaves & /approve (Leave Management & Balance)', () => {
    it('should create leave request and approve it, deducting available balance', async () => {
      const mockLeaveBalance = {
        _id: 'bal_001',
        employeeId: 'emp_001',
        year: 2026,
        balances: [
          { leaveType: 'ANNUAL', totalAllocated: 18, used: 0, pending: 0, available: 18 }
        ],
        save: jest.fn().mockResolvedValue(true)
      };

      const mockLeaveReq = {
        _id: 'lv_001',
        id: 'lv_001',
        requestNumber: 'LV-202608-0001',
        employeeId: 'emp_001',
        employeeCode: 'EMP-OP-01',
        leaveType: 'ANNUAL',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-09-03'),
        totalDays: 3,
        status: 'PENDING',
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
        toJSON: jest.fn().mockImplementation(function () {
          const { save, toJSON, ...rest } = this;
          return rest;
        })
      };

      jest.spyOn(WorkforceMemberModel, 'findOne').mockResolvedValue(mockEmployee as any);
      jest.spyOn(attendanceRepository, 'findOrCreateLeaveBalance').mockResolvedValue(mockLeaveBalance as any);
      jest.spyOn(attendanceRepository, 'generateNextLeaveNumber').mockResolvedValue('LV-202608-0001');
      jest.spyOn(attendanceRepository, 'createLeaveRequest').mockResolvedValue(mockLeaveReq as any);
      jest.spyOn(attendanceRepository, 'findLeaveRequestById').mockResolvedValue(mockLeaveReq as any);
      jest.spyOn(attendanceRepository, 'findLeaveBalance').mockResolvedValue(mockLeaveBalance as any);
      jest.spyOn(attendanceRepository, 'querySchedules').mockResolvedValue({ items: [], total: 0, page: 1, limit: 100, totalPages: 0 });

      // 1. Submit Leave
      const submitRes = await request(app)
        .post('/api/v1/attendance/leaves')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          employeeId: 'emp_001',
          leaveType: 'ANNUAL',
          startDate: '2026-09-01',
          endDate: '2026-09-03',
          reason: 'Annual family leave'
        });

      expect(submitRes.status).toBe(201);
      expect(submitRes.body.success).toBe(true);

      // 2. Approve Leave
      const approveRes = await request(app)
        .post('/api/v1/attendance/leaves/lv_001/approve')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ comments: 'Approved by Operations Manager' });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.success).toBe(true);
      expect(mockLeaveReq.status).toBe('APPROVED');
      expect(mockLeaveBalance.balances[0].used).toBe(3);
      expect(mockLeaveBalance.balances[0].available).toBe(15);
    });
  });

  describe('POST /api/v1/attendance/overtime & /approve (Overtime Authorization)', () => {
    it('should submit overtime request linked to furnace soak and approve it', async () => {
      const mockOT = {
        _id: 'ot_001',
        id: 'ot_001',
        requestNumber: 'OT-202608-0001',
        employeeId: 'emp_001',
        employeeCode: 'EMP-OP-01',
        requestedHours: 2.0,
        status: 'PENDING',
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
        toJSON: jest.fn().mockImplementation(function () {
          const { save, toJSON, ...rest } = this;
          return rest;
        })
      };

      jest.spyOn(WorkforceMemberModel, 'findOne').mockResolvedValue(mockEmployee as any);
      jest.spyOn(attendanceRepository, 'findShiftById').mockResolvedValue(createMockShift() as any);
      jest.spyOn(attendanceRepository, 'generateNextOvertimeNumber').mockResolvedValue('OT-202608-0001');
      jest.spyOn(attendanceRepository, 'createOvertimeRecord').mockResolvedValue(mockOT as any);
      jest.spyOn(attendanceRepository, 'findOvertimeById').mockResolvedValue(mockOT as any);

      // 1. Submit OT
      const submitRes = await request(app)
        .post('/api/v1/attendance/overtime')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          employeeId: 'emp_001',
          date: '2026-08-25',
          shiftId: 'shift_001',
          requestedHours: 2.0,
          reason: 'Emergency vacuum furnace soak monitoring',
          productionJobId: 'job_001',
          productionJobNumber: 'JOB-202608-0001'
        });

      expect(submitRes.status).toBe(201);
      expect(submitRes.body.success).toBe(true);

      // 2. Approve OT
      const approveRes = await request(app)
        .post('/api/v1/attendance/overtime/ot_001/approve')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ comments: 'Authorized for critical job soak' });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.success).toBe(true);
      expect(mockOT.status).toBe('APPROVED');
    });
  });

  describe('GET /api/v1/attendance/availability (Workforce Availability for Production)', () => {
    it('should return available qualified operators matching certified skills', async () => {
      jest.spyOn(WorkforceMemberModel, 'find').mockResolvedValue([mockEmployee as any]);
      jest.spyOn(attendanceRepository, 'findApprovedLeavesForEmployee').mockResolvedValue(null);
      jest.spyOn(attendanceRepository, 'findEmployeeScheduleOnDate').mockResolvedValue([createMockSchedule() as any]);
      jest.spyOn(attendanceRepository, 'findEmployeeAttendanceOnDate').mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/attendance/availability?date=2026-08-25&shiftCode=SHIFT-MORNING-A&requiredSkillCode=SEALED_QUENCH_FURNACE_OPERATION')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].employeeCode).toBe('EMP-OP-01');
      expect(res.body.data[0].isAvailable).toBe(true);
      expect(res.body.data[0].availableHours).toBe(8.0);
    });
  });
});
