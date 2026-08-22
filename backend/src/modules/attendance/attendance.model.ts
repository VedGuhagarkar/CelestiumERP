import { Schema, model } from 'mongoose';
import {
  ShiftDocument,
  ShiftScheduleDocument,
  AttendanceRecordDocument,
  LeaveRequestDocument,
  LeaveBalanceDocument,
  OvertimeRecordDocument,
  ShiftSwapRequestDocument,
  PlantHolidayDocument
} from './attendance.types.js';

// --- Shift Model ---

const ShiftSchema = new Schema<ShiftDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    shiftCode: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    startTime: { type: String, required: true, trim: true }, // e.g. '06:00'
    endTime: { type: String, required: true, trim: true }, // e.g. '14:00'
    durationHours: { type: Number, required: true, min: 1, max: 24 },
    breakDurationMinutes: { type: Number, default: 30 },
    gracePeriodMinutes: { type: Number, default: 15 },
    isOvernight: { type: Boolean, default: false },
    colorCode: { type: String, default: '#3b82f6' },
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String, default: null },
    isDeleted: { type: Boolean, default: false, index: true }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

ShiftSchema.index({ tenantId: 1, shiftCode: 1 }, { unique: true });

export const ShiftModel = model<ShiftDocument>('Shift', ShiftSchema);

// --- Shift Schedule (Roster Calendar) Model ---

const ShiftScheduleSchema = new Schema<ShiftScheduleDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    scheduleCode: { type: String, required: true, uppercase: true, trim: true, index: true },
    employeeId: { type: String, required: true, index: true },
    employeeCode: { type: String, required: true, uppercase: true, trim: true, index: true },
    employeeName: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    shiftId: { type: String, required: true, index: true },
    shiftCode: { type: String, required: true, uppercase: true, trim: true },
    shiftName: { type: String, required: true, trim: true },
    date: { type: Date, required: true, index: true },
    scheduledStartTime: { type: Date, required: true },
    scheduledEndTime: { type: Date, required: true },
    isRestDay: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['SCHEDULED', 'CONFIRMED', 'REASSIGNED', 'SWAPPED', 'CANCELLED'],
      default: 'SCHEDULED',
      index: true
    },
    notes: { type: String, default: null },
    isDeleted: { type: Boolean, default: false, index: true }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

ShiftScheduleSchema.index({ tenantId: 1, scheduleCode: 1 }, { unique: true });
ShiftScheduleSchema.index({ tenantId: 1, employeeId: 1, date: 1 });

export const ShiftScheduleModel = model<ShiftScheduleDocument>(
  'ShiftSchedule',
  ShiftScheduleSchema
);

// --- Attendance Record Model ---

const AttendanceRecordSchema = new Schema<AttendanceRecordDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    attendanceNumber: { type: String, required: true, uppercase: true, trim: true, index: true },
    employeeId: { type: String, required: true, index: true },
    employeeCode: { type: String, required: true, uppercase: true, trim: true, index: true },
    employeeName: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    shiftId: { type: String, required: true },
    shiftCode: { type: String, required: true, uppercase: true },
    date: { type: Date, required: true, index: true },
    clockInTime: { type: Date, default: null },
    clockOutTime: { type: Date, default: null },
    scheduledStartTime: { type: Date, required: true },
    scheduledEndTime: { type: Date, required: true },
    actualHoursWorked: { type: Number, default: 0 },
    regularHours: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    lateMinutes: { type: Number, default: 0 },
    earlyExitMinutes: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'ON_LEAVE', 'REST_DAY'],
      default: 'PRESENT',
      index: true
    },
    isJustifiedCorrection: { type: Boolean, default: false },
    correctionReason: { type: String, default: null },
    correctedBy: {
      userId: { type: String },
      email: { type: String },
      role: { type: String },
      correctedAt: { type: Date }
    },
    notes: { type: String, default: null },
    isDeleted: { type: Boolean, default: false, index: true }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

AttendanceRecordSchema.index({ tenantId: 1, attendanceNumber: 1 }, { unique: true });
AttendanceRecordSchema.index({ tenantId: 1, employeeId: 1, date: 1 });

export const AttendanceRecordModel = model<AttendanceRecordDocument>(
  'AttendanceRecord',
  AttendanceRecordSchema
);

// --- Leave Request Model ---

const LeaveRequestSchema = new Schema<LeaveRequestDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    requestNumber: { type: String, required: true, uppercase: true, trim: true, index: true },
    employeeId: { type: String, required: true, index: true },
    employeeCode: { type: String, required: true, uppercase: true, trim: true },
    employeeName: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    leaveType: {
      type: String,
      enum: ['ANNUAL', 'SICK', 'CASUAL', 'MATERNITY', 'PATERNITY', 'BEREAVEMENT', 'UNPAID'],
      required: true
    },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    totalDays: { type: Number, required: true, min: 0.5 },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
      default: 'PENDING',
      index: true
    },
    approvedBy: {
      userId: { type: String },
      email: { type: String },
      role: { type: String },
      approvedAt: { type: Date },
      comments: { type: String }
    },
    rejectionReason: { type: String, default: null },
    notes: { type: String, default: null },
    isDeleted: { type: Boolean, default: false, index: true }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

LeaveRequestSchema.index({ tenantId: 1, requestNumber: 1 }, { unique: true });

export const LeaveRequestModel = model<LeaveRequestDocument>(
  'LeaveRequest',
  LeaveRequestSchema
);

// --- Leave Balance Model ---

const LeaveTypeBalanceSchema = new Schema(
  {
    leaveType: {
      type: String,
      enum: ['ANNUAL', 'SICK', 'CASUAL', 'MATERNITY', 'PATERNITY', 'BEREAVEMENT', 'UNPAID'],
      required: true
    },
    totalAllocated: { type: Number, default: 0 },
    used: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
    available: { type: Number, default: 0 }
  },
  { _id: false }
);

const LeaveBalanceSchema = new Schema<LeaveBalanceDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    employeeId: { type: String, required: true, index: true },
    employeeCode: { type: String, required: true, uppercase: true, trim: true },
    employeeName: { type: String, required: true, trim: true },
    year: { type: Number, required: true, index: true },
    balances: [LeaveTypeBalanceSchema],
    isDeleted: { type: Boolean, default: false, index: true }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

LeaveBalanceSchema.index({ tenantId: 1, employeeId: 1, year: 1 }, { unique: true });

export const LeaveBalanceModel = model<LeaveBalanceDocument>(
  'LeaveBalance',
  LeaveBalanceSchema
);

// --- Overtime Record Model ---

const OvertimeRecordSchema = new Schema<OvertimeRecordDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    requestNumber: { type: String, required: true, uppercase: true, trim: true, index: true },
    employeeId: { type: String, required: true, index: true },
    employeeCode: { type: String, required: true, uppercase: true, trim: true },
    employeeName: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    date: { type: Date, required: true, index: true },
    shiftId: { type: String, required: true },
    shiftCode: { type: String, required: true, uppercase: true },
    requestedHours: { type: Number, required: true, min: 0.5, max: 12 },
    actualHours: { type: Number, default: null },
    reason: { type: String, required: true, trim: true },
    productionJobId: { type: String, default: null, index: true },
    productionJobNumber: { type: String, default: null },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
      default: 'PENDING',
      index: true
    },
    approvedBy: {
      userId: { type: String },
      email: { type: String },
      role: { type: String },
      approvedAt: { type: Date },
      comments: { type: String }
    },
    rejectionReason: { type: String, default: null },
    notes: { type: String, default: null },
    isDeleted: { type: Boolean, default: false, index: true }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

OvertimeRecordSchema.index({ tenantId: 1, requestNumber: 1 }, { unique: true });

export const OvertimeRecordModel = model<OvertimeRecordDocument>(
  'OvertimeRecord',
  OvertimeRecordSchema
);

// --- Shift Swap Request Model ---

const ShiftSwapRequestSchema = new Schema<ShiftSwapRequestDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    requestNumber: { type: String, required: true, uppercase: true, trim: true, index: true },
    requesterEmployeeId: { type: String, required: true, index: true },
    requesterEmployeeCode: { type: String, required: true },
    requesterEmployeeName: { type: String, required: true },
    requesterScheduleId: { type: String, required: true },

    targetEmployeeId: { type: String, required: true, index: true },
    targetEmployeeCode: { type: String, required: true },
    targetEmployeeName: { type: String, required: true },
    targetScheduleId: { type: String, required: true },

    date: { type: Date, required: true },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true
    },
    approvedBy: {
      userId: { type: String },
      email: { type: String },
      role: { type: String },
      approvedAt: { type: Date }
    },
    isDeleted: { type: Boolean, default: false, index: true }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

ShiftSwapRequestSchema.index({ tenantId: 1, requestNumber: 1 }, { unique: true });

export const ShiftSwapRequestModel = model<ShiftSwapRequestDocument>(
  'ShiftSwapRequest',
  ShiftSwapRequestSchema
);

// --- Plant Holiday Model ---

const PlantHolidaySchema = new Schema<PlantHolidayDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    holidayDate: { type: Date, required: true, index: true },
    name: { type: String, required: true, trim: true },
    isMandatoryShutdown: { type: Boolean, default: false },
    appliesToAllDepartments: { type: Boolean, default: true },
    department: { type: String, default: null },
    notes: { type: String, default: null },
    isDeleted: { type: Boolean, default: false, index: true }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

PlantHolidaySchema.index({ tenantId: 1, holidayDate: 1 }, { unique: true });

export const PlantHolidayModel = model<PlantHolidayDocument>(
  'PlantHoliday',
  PlantHolidaySchema
);
