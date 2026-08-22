import { z } from 'zod';

export const LeaveTypeEnum = z.enum([
  'ANNUAL',
  'SICK',
  'CASUAL',
  'MATERNITY',
  'PATERNITY',
  'BEREAVEMENT',
  'UNPAID'
]);

export const AttendanceStatusEnum = z.enum([
  'PRESENT',
  'LATE',
  'HALF_DAY',
  'ABSENT',
  'ON_LEAVE',
  'REST_DAY'
]);

export const createShiftSchema = z.object({
  shiftCode: z.string().min(2).max(50).trim(),
  name: z.string().min(2).max(100).trim(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:mm format'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:mm format'),
  durationHours: z.number().min(1).max(24),
  breakDurationMinutes: z.number().min(0).max(180).optional(),
  gracePeriodMinutes: z.number().min(0).max(60).optional(),
  isOvernight: z.boolean().optional(),
  colorCode: z.string().optional(),
  notes: z.string().max(1000).optional()
});

export const updateShiftSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  durationHours: z.number().min(1).max(24).optional(),
  breakDurationMinutes: z.number().min(0).max(180).optional(),
  gracePeriodMinutes: z.number().min(0).max(60).optional(),
  isOvernight: z.boolean().optional(),
  colorCode: z.string().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(1000).optional()
});

export const createScheduleSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  shiftId: z.string().min(1, 'Shift ID is required'),
  date: z.string().or(z.date()),
  isRestDay: z.boolean().optional(),
  notes: z.string().max(1000).optional()
});

export const bulkCreateScheduleSchema = z.object({
  schedules: z.array(createScheduleSchema).min(1)
});

export const reassignShiftSchema = z.object({
  scheduleId: z.string().min(1),
  newShiftId: z.string().min(1),
  reason: z.string().max(500).optional()
});

export const clockInSchema = z.object({
  employeeId: z.string().min(1),
  shiftId: z.string().optional(),
  clockInTime: z.string().or(z.date()).optional(),
  notes: z.string().max(500).optional()
});

export const clockOutSchema = z.object({
  employeeId: z.string().min(1),
  clockOutTime: z.string().or(z.date()).optional(),
  notes: z.string().max(500).optional()
});

export const correctAttendanceSchema = z.object({
  clockInTime: z.string().or(z.date()).optional(),
  clockOutTime: z.string().or(z.date()).optional(),
  status: AttendanceStatusEnum.optional(),
  correctionReason: z.string().min(3).max(500)
});

export const createLeaveRequestSchema = z.object({
  employeeId: z.string().min(1),
  leaveType: LeaveTypeEnum,
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  reason: z.string().min(3).max(500),
  notes: z.string().max(500).optional()
});

export const approveLeaveSchema = z.object({
  comments: z.string().max(500).optional()
});

export const rejectLeaveSchema = z.object({
  rejectionReason: z.string().min(3).max(500)
});

export const createOvertimeRequestSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().or(z.date()),
  shiftId: z.string().min(1),
  requestedHours: z.number().min(0.5).max(12),
  reason: z.string().min(3).max(500),
  productionJobId: z.string().optional(),
  productionJobNumber: z.string().optional(),
  notes: z.string().max(500).optional()
});

export const approveOvertimeSchema = z.object({
  comments: z.string().max(500).optional()
});

export const rejectOvertimeSchema = z.object({
  rejectionReason: z.string().min(3).max(500)
});

export const createShiftSwapSchema = z.object({
  requesterScheduleId: z.string().min(1),
  targetScheduleId: z.string().min(1),
  reason: z.string().min(3).max(500)
});

export const createPlantHolidaySchema = z.object({
  holidayDate: z.string().or(z.date()),
  name: z.string().min(2).max(100),
  isMandatoryShutdown: z.boolean().optional(),
  appliesToAllDepartments: z.boolean().optional(),
  department: z.string().optional(),
  notes: z.string().max(500).optional()
});

export const querySchedulesSchema = z.object({
  employeeId: z.string().optional(),
  shiftId: z.string().optional(),
  department: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['SCHEDULED', 'CONFIRMED', 'REASSIGNED', 'SWAPPED', 'CANCELLED']).optional(),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional()
});

export const queryAttendanceSchema = z.object({
  employeeId: z.string().optional(),
  department: z.string().optional(),
  date: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: AttendanceStatusEnum.optional(),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional()
});

export const queryLeavesSchema = z.object({
  employeeId: z.string().optional(),
  leaveType: LeaveTypeEnum.optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional()
});

export const queryOvertimeSchema = z.object({
  employeeId: z.string().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
  date: z.string().optional(),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional()
});

export const queryWorkforceAvailabilitySchema = z.object({
  date: z.string(),
  shiftCode: z.string().optional(),
  department: z.string().optional(),
  requiredSkillCode: z.string().optional()
});
