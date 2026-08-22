import { Router } from 'express';
import { attendanceController } from './attendance.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import {
  requirePermission,
  requireAnyPermission
} from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';
import {
  createShiftSchema,
  updateShiftSchema,
  createScheduleSchema,
  bulkCreateScheduleSchema,
  reassignShiftSchema,
  clockInSchema,
  clockOutSchema,
  correctAttendanceSchema,
  createLeaveRequestSchema,
  approveLeaveSchema,
  rejectLeaveSchema,
  createOvertimeRequestSchema,
  approveOvertimeSchema,
  rejectOvertimeSchema,
  createShiftSwapSchema,
  createPlantHolidaySchema,
  querySchedulesSchema,
  queryAttendanceSchema,
  queryLeavesSchema,
  queryOvertimeSchema,
  queryWorkforceAvailabilitySchema
} from './attendance.validator.js';

export const attendanceRouter = Router();

attendanceRouter.use(authenticateJwt);

// --- Real-time Workforce Availability ---
attendanceRouter.get(
  '/availability',
  requirePermission(PERMISSIONS.WORKFORCE_EMPLOYEE_VIEW),
  validateRequest({ query: queryWorkforceAvailabilitySchema }),
  attendanceController.getWorkforceAvailability
);

// --- Shifts ---
attendanceRouter.get(
  '/shifts',
  requirePermission(PERMISSIONS.WORKFORCE_EMPLOYEE_VIEW),
  attendanceController.getActiveShifts
);

attendanceRouter.post(
  '/shifts',
  requirePermission(PERMISSIONS.WORKFORCE_EMPLOYEE_MANAGE),
  validateRequest({ body: createShiftSchema }),
  attendanceController.createShift
);

attendanceRouter.put(
  '/shifts/:id',
  requirePermission(PERMISSIONS.WORKFORCE_EMPLOYEE_MANAGE),
  validateRequest({ body: updateShiftSchema }),
  attendanceController.updateShift
);

// --- Shift Schedules & Roster ---
attendanceRouter.get(
  '/schedules',
  requirePermission(PERMISSIONS.WORKFORCE_EMPLOYEE_VIEW),
  validateRequest({ query: querySchedulesSchema }),
  attendanceController.querySchedules
);

attendanceRouter.post(
  '/schedules',
  requirePermission(PERMISSIONS.WORKFORCE_EMPLOYEE_MANAGE),
  validateRequest({ body: createScheduleSchema }),
  attendanceController.createSchedule
);

attendanceRouter.post(
  '/schedules/bulk',
  requirePermission(PERMISSIONS.WORKFORCE_EMPLOYEE_MANAGE),
  validateRequest({ body: bulkCreateScheduleSchema }),
  attendanceController.bulkCreateSchedules
);

attendanceRouter.post(
  '/schedules/reassign',
  requirePermission(PERMISSIONS.WORKFORCE_EMPLOYEE_MANAGE),
  validateRequest({ body: reassignShiftSchema }),
  attendanceController.reassignShift
);

// --- Shift Swaps ---
attendanceRouter.post(
  '/swaps',
  requirePermission(PERMISSIONS.WORKFORCE_ATTENDANCE_MARK),
  validateRequest({ body: createShiftSwapSchema }),
  attendanceController.createShiftSwap
);

attendanceRouter.post(
  '/swaps/:id/approve',
  requirePermission(PERMISSIONS.WORKFORCE_EMPLOYEE_MANAGE),
  attendanceController.approveShiftSwap
);

// --- Attendance Clocking & Corrections ---
attendanceRouter.get(
  '/records',
  requirePermission(PERMISSIONS.WORKFORCE_ATTENDANCE_VIEW),
  validateRequest({ query: queryAttendanceSchema }),
  attendanceController.queryAttendance
);

attendanceRouter.post(
  '/clock-in',
  requireAnyPermission(
    PERMISSIONS.WORKFORCE_ATTENDANCE_MARK,
    PERMISSIONS.WORKFORCE_EMPLOYEE_MANAGE
  ),
  validateRequest({ body: clockInSchema }),
  attendanceController.clockIn
);

attendanceRouter.post(
  '/clock-out',
  requireAnyPermission(
    PERMISSIONS.WORKFORCE_ATTENDANCE_MARK,
    PERMISSIONS.WORKFORCE_EMPLOYEE_MANAGE
  ),
  validateRequest({ body: clockOutSchema }),
  attendanceController.clockOut
);

attendanceRouter.post(
  '/records/:id/correct',
  requirePermission(PERMISSIONS.WORKFORCE_ATTENDANCE_APPROVE),
  validateRequest({ body: correctAttendanceSchema }),
  attendanceController.correctAttendance
);

// --- Leave Requests & Balances ---
attendanceRouter.get(
  '/leaves',
  requirePermission(PERMISSIONS.WORKFORCE_EMPLOYEE_VIEW),
  validateRequest({ query: queryLeavesSchema }),
  attendanceController.queryLeaves
);

attendanceRouter.post(
  '/leaves',
  requirePermission(PERMISSIONS.WORKFORCE_ATTENDANCE_MARK),
  validateRequest({ body: createLeaveRequestSchema }),
  attendanceController.createLeaveRequest
);

attendanceRouter.post(
  '/leaves/:id/approve',
  requirePermission(PERMISSIONS.WORKFORCE_EMPLOYEE_MANAGE),
  validateRequest({ body: approveLeaveSchema }),
  attendanceController.approveLeave
);

attendanceRouter.post(
  '/leaves/:id/reject',
  requirePermission(PERMISSIONS.WORKFORCE_EMPLOYEE_MANAGE),
  validateRequest({ body: rejectLeaveSchema }),
  attendanceController.rejectLeave
);

attendanceRouter.get(
  '/leaves/balances/:employeeId',
  requirePermission(PERMISSIONS.WORKFORCE_EMPLOYEE_VIEW),
  attendanceController.getLeaveBalance
);

// --- Overtime Requests ---
attendanceRouter.get(
  '/overtime',
  requirePermission(PERMISSIONS.WORKFORCE_ATTENDANCE_VIEW),
  validateRequest({ query: queryOvertimeSchema }),
  attendanceController.queryOvertime
);

attendanceRouter.post(
  '/overtime',
  requirePermission(PERMISSIONS.WORKFORCE_ATTENDANCE_MARK),
  validateRequest({ body: createOvertimeRequestSchema }),
  attendanceController.createOvertimeRequest
);

attendanceRouter.post(
  '/overtime/:id/approve',
  requirePermission(PERMISSIONS.WORKFORCE_ATTENDANCE_APPROVE),
  validateRequest({ body: approveOvertimeSchema }),
  attendanceController.approveOvertime
);

attendanceRouter.post(
  '/overtime/:id/reject',
  requirePermission(PERMISSIONS.WORKFORCE_ATTENDANCE_APPROVE),
  validateRequest({ body: rejectOvertimeSchema }),
  attendanceController.rejectOvertime
);

// --- Plant Holidays ---
attendanceRouter.get(
  '/holidays',
  requirePermission(PERMISSIONS.WORKFORCE_EMPLOYEE_VIEW),
  attendanceController.getPlantHolidays
);

attendanceRouter.post(
  '/holidays',
  requirePermission(PERMISSIONS.WORKFORCE_EMPLOYEE_MANAGE),
  validateRequest({ body: createPlantHolidaySchema }),
  attendanceController.createPlantHoliday
);
