import {
  ShiftModel,
  ShiftScheduleModel,
  AttendanceRecordModel,
  LeaveRequestModel,
  LeaveBalanceModel,
  OvertimeRecordModel,
  ShiftSwapRequestModel,
  PlantHolidayModel
} from './attendance.model.js';
import {
  ShiftDocument,
  ShiftScheduleDocument,
  AttendanceRecordDocument,
  LeaveRequestDocument,
  LeaveBalanceDocument,
  OvertimeRecordDocument,
  ShiftSwapRequestDocument,
  PlantHolidayDocument,
  QuerySchedulesDto,
  QueryAttendanceDto,
  QueryLeavesDto,
  QueryOvertimeDto
} from './attendance.types.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export interface IAttendanceRepository {
  // Shifts
  createShift(tenantId: string, data: Partial<ShiftDocument>): Promise<ShiftDocument>;
  findShiftById(tenantId: string, id: string): Promise<ShiftDocument | null>;
  findShiftByCode(tenantId: string, shiftCode: string): Promise<ShiftDocument | null>;
  findAllActiveShifts(tenantId: string): Promise<ShiftDocument[]>;
  updateShift(tenantId: string, id: string, data: Partial<ShiftDocument>): Promise<ShiftDocument | null>;

  // Shift Schedules
  createSchedule(tenantId: string, data: Partial<ShiftScheduleDocument>): Promise<ShiftScheduleDocument>;
  findScheduleById(tenantId: string, id: string): Promise<ShiftScheduleDocument | null>;
  findEmployeeScheduleOnDate(tenantId: string, employeeId: string, date: Date): Promise<ShiftScheduleDocument[]>;
  querySchedules(tenantId: string, query: QuerySchedulesDto, pagination: PaginationOptions): Promise<PaginatedResult<ShiftScheduleDocument>>;
  generateNextScheduleCode(tenantId: string): Promise<string>;

  // Attendance
  createAttendanceRecord(tenantId: string, data: Partial<AttendanceRecordDocument>): Promise<AttendanceRecordDocument>;
  findAttendanceById(tenantId: string, id: string): Promise<AttendanceRecordDocument | null>;
  findEmployeeAttendanceOnDate(tenantId: string, employeeId: string, date: Date): Promise<AttendanceRecordDocument | null>;
  queryAttendance(tenantId: string, query: QueryAttendanceDto, pagination: PaginationOptions): Promise<PaginatedResult<AttendanceRecordDocument>>;
  generateNextAttendanceNumber(tenantId: string): Promise<string>;

  // Leaves
  createLeaveRequest(tenantId: string, data: Partial<LeaveRequestDocument>): Promise<LeaveRequestDocument>;
  findLeaveRequestById(tenantId: string, id: string): Promise<LeaveRequestDocument | null>;
  findApprovedLeavesForEmployee(tenantId: string, employeeId: string, date: Date): Promise<LeaveRequestDocument | null>;
  queryLeaves(tenantId: string, query: QueryLeavesDto, pagination: PaginationOptions): Promise<PaginatedResult<LeaveRequestDocument>>;
  generateNextLeaveNumber(tenantId: string): Promise<string>;

  // Leave Balances
  findOrCreateLeaveBalance(tenantId: string, employeeId: string, employeeCode: string, employeeName: string, year: number): Promise<LeaveBalanceDocument>;
  findLeaveBalance(tenantId: string, employeeId: string, year: number): Promise<LeaveBalanceDocument | null>;

  // Overtime
  createOvertimeRecord(tenantId: string, data: Partial<OvertimeRecordDocument>): Promise<OvertimeRecordDocument>;
  findOvertimeById(tenantId: string, id: string): Promise<OvertimeRecordDocument | null>;
  queryOvertime(tenantId: string, query: QueryOvertimeDto, pagination: PaginationOptions): Promise<PaginatedResult<OvertimeRecordDocument>>;
  generateNextOvertimeNumber(tenantId: string): Promise<string>;

  // Shift Swaps
  createShiftSwap(tenantId: string, data: Partial<ShiftSwapRequestDocument>): Promise<ShiftSwapRequestDocument>;
  findShiftSwapById(tenantId: string, id: string): Promise<ShiftSwapRequestDocument | null>;
  generateNextSwapNumber(tenantId: string): Promise<string>;

  // Plant Holidays
  createPlantHoliday(tenantId: string, data: Partial<PlantHolidayDocument>): Promise<PlantHolidayDocument>;
  findHolidaysInDateRange(tenantId: string, startDate: Date, endDate: Date): Promise<PlantHolidayDocument[]>;
}

export class AttendanceRepository implements IAttendanceRepository {
  // --- Shifts ---

  public async createShift(tenantId: string, data: Partial<ShiftDocument>): Promise<ShiftDocument> {
    const shift = new ShiftModel({ ...data, tenantId, isDeleted: false });
    return await shift.save();
  }

  public async findShiftById(tenantId: string, id: string): Promise<ShiftDocument | null> {
    return await ShiftModel.findOne({ _id: id, tenantId, isDeleted: false });
  }

  public async findShiftByCode(tenantId: string, shiftCode: string): Promise<ShiftDocument | null> {
    return await ShiftModel.findOne({ tenantId, shiftCode: shiftCode.toUpperCase(), isDeleted: false });
  }

  public async findAllActiveShifts(tenantId: string): Promise<ShiftDocument[]> {
    return await ShiftModel.find({ tenantId, isActive: true, isDeleted: false }).sort({ startTime: 1 });
  }

  public async updateShift(
    tenantId: string,
    id: string,
    data: Partial<ShiftDocument>
  ): Promise<ShiftDocument | null> {
    return await ShiftModel.findOneAndUpdate(
      { _id: id, tenantId, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );
  }

  // --- Schedules ---

  public async createSchedule(
    tenantId: string,
    data: Partial<ShiftScheduleDocument>
  ): Promise<ShiftScheduleDocument> {
    const schedule = new ShiftScheduleModel({ ...data, tenantId, isDeleted: false });
    return await schedule.save();
  }

  public async findScheduleById(tenantId: string, id: string): Promise<ShiftScheduleDocument | null> {
    return await ShiftScheduleModel.findOne({ _id: id, tenantId, isDeleted: false });
  }

  public async findEmployeeScheduleOnDate(
    tenantId: string,
    employeeId: string,
    date: Date
  ): Promise<ShiftScheduleDocument[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await ShiftScheduleModel.find({
      tenantId,
      employeeId,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $ne: 'CANCELLED' },
      isDeleted: false
    });
  }

  public async querySchedules(
    tenantId: string,
    query: QuerySchedulesDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<ShiftScheduleDocument>> {
    const filter: Record<string, any> = { tenantId, isDeleted: false };

    if (query.employeeId) filter.employeeId = query.employeeId;
    if (query.shiftId) filter.shiftId = query.shiftId;
    if (query.department) filter.department = query.department;
    if (query.status) filter.status = query.status;

    if (query.startDate || query.endDate) {
      filter.date = {};
      if (query.startDate) filter.date.$gte = new Date(query.startDate);
      if (query.endDate) filter.date.$lte = new Date(query.endDate);
    }

    const total = await ShiftScheduleModel.countDocuments(filter);
    const sort = pagination.sort || { date: 1, scheduledStartTime: 1 };
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;

    const data = await ShiftScheduleModel.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      items: data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  public async generateNextScheduleCode(tenantId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `SCH-${yearMonth}-`;

    const latest = await ShiftScheduleModel.findOne({
      tenantId,
      scheduleCode: { $regex: `^${prefix}` }
    })
      .sort({ scheduleCode: -1 })
      .select('scheduleCode')
      .lean();

    let seq = 1;
    if (latest && (latest as any).scheduleCode) {
      const parts = (latest as any).scheduleCode.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  // --- Attendance ---

  public async createAttendanceRecord(
    tenantId: string,
    data: Partial<AttendanceRecordDocument>
  ): Promise<AttendanceRecordDocument> {
    const rec = new AttendanceRecordModel({ ...data, tenantId, isDeleted: false });
    return await rec.save();
  }

  public async findAttendanceById(
    tenantId: string,
    id: string
  ): Promise<AttendanceRecordDocument | null> {
    return await AttendanceRecordModel.findOne({ _id: id, tenantId, isDeleted: false });
  }

  public async findEmployeeAttendanceOnDate(
    tenantId: string,
    employeeId: string,
    date: Date
  ): Promise<AttendanceRecordDocument | null> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await AttendanceRecordModel.findOne({
      tenantId,
      employeeId,
      date: { $gte: startOfDay, $lte: endOfDay },
      isDeleted: false
    });
  }

  public async queryAttendance(
    tenantId: string,
    query: QueryAttendanceDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<AttendanceRecordDocument>> {
    const filter: Record<string, any> = { tenantId, isDeleted: false };

    if (query.employeeId) filter.employeeId = query.employeeId;
    if (query.department) filter.department = query.department;
    if (query.status) filter.status = query.status;

    if (query.date) {
      const startOfDay = new Date(query.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(query.date);
      endOfDay.setHours(23, 59, 59, 999);
      filter.date = { $gte: startOfDay, $lte: endOfDay };
    } else if (query.startDate || query.endDate) {
      filter.date = {};
      if (query.startDate) filter.date.$gte = new Date(query.startDate);
      if (query.endDate) filter.date.$lte = new Date(query.endDate);
    }

    const total = await AttendanceRecordModel.countDocuments(filter);
    const sort = pagination.sort || { date: -1, clockInTime: -1 };
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;

    const data = await AttendanceRecordModel.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      items: data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  public async generateNextAttendanceNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `ATT-${yearMonth}-`;

    const latest = await AttendanceRecordModel.findOne({
      tenantId,
      attendanceNumber: { $regex: `^${prefix}` }
    })
      .sort({ attendanceNumber: -1 })
      .select('attendanceNumber')
      .lean();

    let seq = 1;
    if (latest && (latest as any).attendanceNumber) {
      const parts = (latest as any).attendanceNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  // --- Leaves ---

  public async createLeaveRequest(
    tenantId: string,
    data: Partial<LeaveRequestDocument>
  ): Promise<LeaveRequestDocument> {
    const req = new LeaveRequestModel({ ...data, tenantId, isDeleted: false });
    return await req.save();
  }

  public async findLeaveRequestById(
    tenantId: string,
    id: string
  ): Promise<LeaveRequestDocument | null> {
    return await LeaveRequestModel.findOne({ _id: id, tenantId, isDeleted: false });
  }

  public async findApprovedLeavesForEmployee(
    tenantId: string,
    employeeId: string,
    date: Date
  ): Promise<LeaveRequestDocument | null> {
    return await LeaveRequestModel.findOne({
      tenantId,
      employeeId,
      status: 'APPROVED',
      startDate: { $lte: date },
      endDate: { $gte: date },
      isDeleted: false
    });
  }

  public async queryLeaves(
    tenantId: string,
    query: QueryLeavesDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<LeaveRequestDocument>> {
    const filter: Record<string, any> = { tenantId, isDeleted: false };

    if (query.employeeId) filter.employeeId = query.employeeId;
    if (query.leaveType) filter.leaveType = query.leaveType;
    if (query.status) filter.status = query.status;

    if (query.startDate || query.endDate) {
      if (query.startDate) filter.startDate = { $gte: new Date(query.startDate) };
      if (query.endDate) filter.endDate = { $lte: new Date(query.endDate) };
    }

    const total = await LeaveRequestModel.countDocuments(filter);
    const sort = pagination.sort || { createdAt: -1 };
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;

    const data = await LeaveRequestModel.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      items: data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  public async generateNextLeaveNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `LV-${yearMonth}-`;

    const latest = await LeaveRequestModel.findOne({
      tenantId,
      requestNumber: { $regex: `^${prefix}` }
    })
      .sort({ requestNumber: -1 })
      .select('requestNumber')
      .lean();

    let seq = 1;
    if (latest && (latest as any).requestNumber) {
      const parts = (latest as any).requestNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  // --- Leave Balances ---

  public async findOrCreateLeaveBalance(
    tenantId: string,
    employeeId: string,
    employeeCode: string,
    employeeName: string,
    year: number
  ): Promise<LeaveBalanceDocument> {
    let bal = await LeaveBalanceModel.findOne({ tenantId, employeeId, year, isDeleted: false });
    if (!bal) {
      bal = new LeaveBalanceModel({
        tenantId,
        employeeId,
        employeeCode,
        employeeName,
        year,
        balances: [
          { leaveType: 'ANNUAL', totalAllocated: 18, used: 0, pending: 0, available: 18 },
          { leaveType: 'SICK', totalAllocated: 10, used: 0, pending: 0, available: 10 },
          { leaveType: 'CASUAL', totalAllocated: 8, used: 0, pending: 0, available: 8 }
        ]
      });
      await bal.save();
    }
    return bal;
  }

  public async findLeaveBalance(
    tenantId: string,
    employeeId: string,
    year: number
  ): Promise<LeaveBalanceDocument | null> {
    return await LeaveBalanceModel.findOne({ tenantId, employeeId, year, isDeleted: false });
  }

  // --- Overtime ---

  public async createOvertimeRecord(
    tenantId: string,
    data: Partial<OvertimeRecordDocument>
  ): Promise<OvertimeRecordDocument> {
    const ot = new OvertimeRecordModel({ ...data, tenantId, isDeleted: false });
    return await ot.save();
  }

  public async findOvertimeById(
    tenantId: string,
    id: string
  ): Promise<OvertimeRecordDocument | null> {
    return await OvertimeRecordModel.findOne({ _id: id, tenantId, isDeleted: false });
  }

  public async queryOvertime(
    tenantId: string,
    query: QueryOvertimeDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<OvertimeRecordDocument>> {
    const filter: Record<string, any> = { tenantId, isDeleted: false };

    if (query.employeeId) filter.employeeId = query.employeeId;
    if (query.status) filter.status = query.status;
    if (query.date) filter.date = new Date(query.date);

    const total = await OvertimeRecordModel.countDocuments(filter);
    const sort = pagination.sort || { date: -1 };
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;

    const data = await OvertimeRecordModel.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      items: data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  public async generateNextOvertimeNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `OT-${yearMonth}-`;

    const latest = await OvertimeRecordModel.findOne({
      tenantId,
      requestNumber: { $regex: `^${prefix}` }
    })
      .sort({ requestNumber: -1 })
      .select('requestNumber')
      .lean();

    let seq = 1;
    if (latest && (latest as any).requestNumber) {
      const parts = (latest as any).requestNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  // --- Shift Swaps ---

  public async createShiftSwap(
    tenantId: string,
    data: Partial<ShiftSwapRequestDocument>
  ): Promise<ShiftSwapRequestDocument> {
    const swap = new ShiftSwapRequestModel({ ...data, tenantId, isDeleted: false });
    return await swap.save();
  }

  public async findShiftSwapById(
    tenantId: string,
    id: string
  ): Promise<ShiftSwapRequestDocument | null> {
    return await ShiftSwapRequestModel.findOne({ _id: id, tenantId, isDeleted: false });
  }

  public async generateNextSwapNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `SWP-${yearMonth}-`;

    const latest = await ShiftSwapRequestModel.findOne({
      tenantId,
      requestNumber: { $regex: `^${prefix}` }
    })
      .sort({ requestNumber: -1 })
      .select('requestNumber')
      .lean();

    let seq = 1;
    if (latest && (latest as any).requestNumber) {
      const parts = (latest as any).requestNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  // --- Plant Holidays ---

  public async createPlantHoliday(
    tenantId: string,
    data: Partial<PlantHolidayDocument>
  ): Promise<PlantHolidayDocument> {
    const holiday = new PlantHolidayModel({ ...data, tenantId, isDeleted: false });
    return await holiday.save();
  }

  public async findHolidaysInDateRange(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<PlantHolidayDocument[]> {
    return await PlantHolidayModel.find({
      tenantId,
      holidayDate: { $gte: startDate, $lte: endDate },
      isDeleted: false
    }).sort({ holidayDate: 1 });
  }
}

export const attendanceRepository = new AttendanceRepository();
