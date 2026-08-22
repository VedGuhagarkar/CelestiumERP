import { Document } from 'mongoose';

export type ShiftScheduleStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'REASSIGNED'
  | 'SWAPPED'
  | 'CANCELLED';

export type AttendanceStatus =
  | 'PRESENT'
  | 'LATE'
  | 'HALF_DAY'
  | 'ABSENT'
  | 'ON_LEAVE'
  | 'REST_DAY';

export type LeaveType =
  | 'ANNUAL'
  | 'SICK'
  | 'CASUAL'
  | 'MATERNITY'
  | 'PATERNITY'
  | 'BEREAVEMENT'
  | 'UNPAID';

export type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type OvertimeStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type ShiftSwapStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// --- Shift Definition ---

export interface IShift {
  tenantId: string;
  shiftCode: string;
  name: string;
  startTime: string; // e.g. '06:00'
  endTime: string; // e.g. '14:00'
  durationHours: number; // e.g. 8.0
  breakDurationMinutes: number; // e.g. 30
  gracePeriodMinutes: number; // e.g. 15
  isOvernight: boolean;
  colorCode?: string | null;
  isActive: boolean;
  notes?: string | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ShiftDocument = IShift & Document;

// --- Shift Schedule (Roster Calendar) ---

export interface IShiftSchedule {
  tenantId: string;
  scheduleCode: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  shiftId: string;
  shiftCode: string;
  shiftName: string;
  date: Date;
  scheduledStartTime: Date;
  scheduledEndTime: Date;
  isRestDay: boolean;
  status: ShiftScheduleStatus;
  notes?: string | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ShiftScheduleDocument = IShiftSchedule & Document;

// --- Attendance Record ---

export interface IAttendanceRecord {
  tenantId: string;
  attendanceNumber: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  shiftId: string;
  shiftCode: string;
  date: Date;
  clockInTime?: Date | null;
  clockOutTime?: Date | null;
  scheduledStartTime: Date;
  scheduledEndTime: Date;
  actualHoursWorked: number;
  regularHours: number;
  overtimeHours: number;
  lateMinutes: number;
  earlyExitMinutes: number;
  status: AttendanceStatus;
  isJustifiedCorrection: boolean;
  correctionReason?: string | null;
  correctedBy?: {
    userId: string;
    email?: string;
    role?: string;
    correctedAt: Date;
  } | null;
  notes?: string | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type AttendanceRecordDocument = IAttendanceRecord & Document;

// --- Leave Management ---

export interface ILeaveRequest {
  tenantId: string;
  requestNumber: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  reason: string;
  status: LeaveRequestStatus;
  approvedBy?: {
    userId: string;
    email?: string;
    role?: string;
    approvedAt: Date;
    comments?: string | null;
  } | null;
  rejectionReason?: string | null;
  notes?: string | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type LeaveRequestDocument = ILeaveRequest & Document;

export interface ILeaveTypeBalance {
  leaveType: LeaveType;
  totalAllocated: number;
  used: number;
  pending: number;
  available: number;
}

export interface ILeaveBalance {
  tenantId: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  year: number;
  balances: ILeaveTypeBalance[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type LeaveBalanceDocument = ILeaveBalance & Document;

// --- Overtime Records ---

export interface IOvertimeRecord {
  tenantId: string;
  requestNumber: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  date: Date;
  shiftId: string;
  shiftCode: string;
  requestedHours: number;
  actualHours?: number | null;
  reason: string;
  productionJobId?: string | null;
  productionJobNumber?: string | null;
  status: OvertimeStatus;
  approvedBy?: {
    userId: string;
    email?: string;
    role?: string;
    approvedAt: Date;
    comments?: string | null;
  } | null;
  rejectionReason?: string | null;
  notes?: string | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type OvertimeRecordDocument = IOvertimeRecord & Document;

// --- Shift Swap Requests ---

export interface IShiftSwapRequest {
  tenantId: string;
  requestNumber: string;
  requesterEmployeeId: string;
  requesterEmployeeCode: string;
  requesterEmployeeName: string;
  requesterScheduleId: string;

  targetEmployeeId: string;
  targetEmployeeCode: string;
  targetEmployeeName: string;
  targetScheduleId: string;

  date: Date;
  reason: string;
  status: ShiftSwapStatus;
  approvedBy?: {
    userId: string;
    email?: string;
    role?: string;
    approvedAt: Date;
  } | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ShiftSwapRequestDocument = IShiftSwapRequest & Document;

// --- Plant Holiday ---

export interface IPlantHoliday {
  tenantId: string;
  holidayDate: Date;
  name: string;
  isMandatoryShutdown: boolean;
  appliesToAllDepartments: boolean;
  department?: string | null;
  notes?: string | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type PlantHolidayDocument = IPlantHoliday & Document;

// --- Availability & Planning DTOs ---

export interface IWorkforceAvailabilityItem {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  shiftCode: string;
  isScheduled: boolean;
  isOnLeave: boolean;
  leaveType?: LeaveType | null;
  attendanceStatus?: AttendanceStatus | null;
  isAvailable: boolean;
  skills: Array<{
    skillCode: string;
    skillName: string;
    proficiency: string;
    isCertified: boolean;
  }>;
  availableHours: number;
}

export interface QueryWorkforceAvailabilityDto {
  date: string;
  shiftCode?: string;
  department?: string;
  requiredSkillCode?: string;
}

// --- DTOs ---

export interface CreateShiftDto {
  shiftCode: string;
  name: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  breakDurationMinutes?: number;
  gracePeriodMinutes?: number;
  isOvernight?: boolean;
  colorCode?: string;
  notes?: string;
}

export interface UpdateShiftDto {
  name?: string;
  startTime?: string;
  endTime?: string;
  durationHours?: number;
  breakDurationMinutes?: number;
  gracePeriodMinutes?: number;
  isOvernight?: boolean;
  colorCode?: string;
  isActive?: boolean;
  notes?: string;
}

export interface CreateScheduleDto {
  employeeId: string;
  shiftId: string;
  date: string | Date;
  isRestDay?: boolean;
  notes?: string;
}

export interface BulkCreateScheduleDto {
  schedules: CreateScheduleDto[];
}

export interface ReassignShiftDto {
  scheduleId: string;
  newShiftId: string;
  reason?: string;
}

export interface ClockInDto {
  employeeId: string;
  shiftId?: string;
  clockInTime?: string | Date;
  notes?: string;
}

export interface ClockOutDto {
  employeeId: string;
  clockOutTime?: string | Date;
  notes?: string;
}

export interface CorrectAttendanceDto {
  clockInTime?: string | Date;
  clockOutTime?: string | Date;
  status?: AttendanceStatus;
  correctionReason: string;
}

export interface CreateLeaveRequestDto {
  employeeId: string;
  leaveType: LeaveType;
  startDate: string | Date;
  endDate: string | Date;
  reason: string;
  notes?: string;
}

export interface ApproveLeaveDto {
  comments?: string;
}

export interface RejectLeaveDto {
  rejectionReason: string;
}

export interface CreateOvertimeRequestDto {
  employeeId: string;
  date: string | Date;
  shiftId: string;
  requestedHours: number;
  reason: string;
  productionJobId?: string;
  productionJobNumber?: string;
  notes?: string;
}

export interface ApproveOvertimeDto {
  comments?: string;
}

export interface RejectOvertimeDto {
  rejectionReason: string;
}

export interface CreateShiftSwapDto {
  requesterScheduleId: string;
  targetScheduleId: string;
  reason: string;
}

export interface CreatePlantHolidayDto {
  holidayDate: string | Date;
  name: string;
  isMandatoryShutdown?: boolean;
  appliesToAllDepartments?: boolean;
  department?: string;
  notes?: string;
}

export interface QuerySchedulesDto {
  employeeId?: string;
  shiftId?: string;
  department?: string;
  startDate?: string;
  endDate?: string;
  status?: ShiftScheduleStatus;
  page?: string | number;
  limit?: string | number;
}

export interface QueryAttendanceDto {
  employeeId?: string;
  department?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  status?: AttendanceStatus;
  page?: string | number;
  limit?: string | number;
}

export interface QueryLeavesDto {
  employeeId?: string;
  leaveType?: LeaveType;
  status?: LeaveRequestStatus;
  startDate?: string;
  endDate?: string;
  page?: string | number;
  limit?: string | number;
}

export interface QueryOvertimeDto {
  employeeId?: string;
  status?: OvertimeStatus;
  date?: string;
  page?: string | number;
  limit?: string | number;
}
