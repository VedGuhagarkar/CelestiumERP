import mongoose from 'mongoose';
import { BaseService } from '../../core/services/base.service.js';
import { IAttendanceRepository, attendanceRepository } from './attendance.repository.js';
import { WorkforceMemberModel } from '../workforce-capacity/workforce-member.model.js';
import { auditService } from '../audit/audit.service.js';
import { DomainEvents } from '../../core/constants/events.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../core/errors/app-error.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';
import {
  ShiftDocument,
  ShiftScheduleDocument,
  AttendanceRecordDocument,
  LeaveRequestDocument,
  LeaveBalanceDocument,
  OvertimeRecordDocument,
  ShiftSwapRequestDocument,
  PlantHolidayDocument,
  CreateShiftDto,
  UpdateShiftDto,
  CreateScheduleDto,
  BulkCreateScheduleDto,
  ReassignShiftDto,
  ClockInDto,
  ClockOutDto,
  CorrectAttendanceDto,
  CreateLeaveRequestDto,
  ApproveLeaveDto,
  RejectLeaveDto,
  CreateOvertimeRequestDto,
  ApproveOvertimeDto,
  RejectOvertimeDto,
  CreateShiftSwapDto,
  CreatePlantHolidayDto,
  QuerySchedulesDto,
  QueryAttendanceDto,
  QueryLeavesDto,
  QueryOvertimeDto,
  QueryWorkforceAvailabilityDto,
  IWorkforceAvailabilityItem
} from './attendance.types.js';

export interface IActorContext {
  userId: string;
  email?: string;
  role?: string;
  fullName?: string;
}

export class AttendanceService extends BaseService {
  constructor(private readonly repo: IAttendanceRepository = attendanceRepository) {
    super('AttendanceService');
  }

  // ==================== Shift Definitions ====================

  public async createShift(
    tenantId: string,
    actor: IActorContext,
    dto: CreateShiftDto
  ): Promise<ShiftDocument> {
    const existing = await this.repo.findShiftByCode(tenantId, dto.shiftCode);
    if (existing) {
      throw new ConflictError(`Shift with code '${dto.shiftCode.toUpperCase()}' already exists`);
    }

    const shift = await this.repo.createShift(tenantId, {
      shiftCode: dto.shiftCode.toUpperCase(),
      name: dto.name,
      startTime: dto.startTime,
      endTime: dto.endTime,
      durationHours: dto.durationHours,
      breakDurationMinutes: dto.breakDurationMinutes ?? 30,
      gracePeriodMinutes: dto.gracePeriodMinutes ?? 15,
      isOvernight: dto.isOvernight ?? false,
      colorCode: dto.colorCode || '#3b82f6',
      isActive: true,
      notes: dto.notes || null
    });

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'SHIFT_CREATED',
      entityType: 'Shift',
      entityId: shift.id,
      metadata: { shiftCode: shift.shiftCode, name: shift.name }
    });

    return shift;
  }

  public async updateShift(
    tenantId: string,
    actor: IActorContext,
    id: string,
    dto: UpdateShiftDto
  ): Promise<ShiftDocument> {
    const shift = await this.repo.findShiftById(tenantId, id);
    if (!shift) {
      throw new NotFoundError(`Shift with ID '${id}' not found`);
    }

    const updated = await this.repo.updateShift(tenantId, id, dto);
    if (!updated) {
      throw new NotFoundError(`Shift with ID '${id}' not found`);
    }

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'SHIFT_UPDATED',
      entityType: 'Shift',
      entityId: updated.id,
      metadata: { shiftCode: updated.shiftCode }
    });

    return updated;
  }

  public async getActiveShifts(tenantId: string): Promise<ShiftDocument[]> {
    return await this.repo.findAllActiveShifts(tenantId);
  }

  // ==================== Shift Schedules & Roster ====================

  public async createSchedule(
    tenantId: string,
    actor: IActorContext,
    dto: CreateScheduleDto
  ): Promise<ShiftScheduleDocument> {
    const employee = await WorkforceMemberModel.findOne({
      _id: dto.employeeId,
      tenantId,
      isDeleted: false
    });
    if (!employee) {
      throw new NotFoundError(`Employee with ID '${dto.employeeId}' not found`);
    }

    const shift = await this.repo.findShiftById(tenantId, dto.shiftId);
    if (!shift || !shift.isActive) {
      throw new NotFoundError(`Active Shift with ID '${dto.shiftId}' not found`);
    }

    const scheduleDate = new Date(dto.date);

    // 1. Conflict Check: Check for approved leave on this date
    const leaveConflict = await this.repo.findApprovedLeavesForEmployee(
      tenantId,
      employee.id,
      scheduleDate
    );
    if (leaveConflict) {
      throw new BadRequestError(
        `Cannot schedule employee '${employee.employeeCode}' on ${scheduleDate.toISOString().slice(0, 10)}. Approved ${leaveConflict.leaveType} leave exists.`
      );
    }

    // 2. Conflict Check: Check for existing schedule on this date
    const existingSchedules = await this.repo.findEmployeeScheduleOnDate(
      tenantId,
      employee.id,
      scheduleDate
    );
    if (existingSchedules.length > 0 && !dto.isRestDay) {
      throw new ConflictError(
        `Schedule conflict: Employee '${employee.employeeCode}' is already scheduled for shift '${existingSchedules[0].shiftCode}' on ${scheduleDate.toISOString().slice(0, 10)}.`
      );
    }

    // Calculate start & end timestamps
    const [startH, startM] = shift.startTime.split(':').map(Number);
    const [endH, endM] = shift.endTime.split(':').map(Number);

    const scheduledStartTime = new Date(scheduleDate);
    scheduledStartTime.setHours(startH, startM, 0, 0);

    const scheduledEndTime = new Date(scheduleDate);
    if (shift.isOvernight || endH < startH) {
      scheduledEndTime.setDate(scheduledEndTime.getDate() + 1);
    }
    scheduledEndTime.setHours(endH, endM, 0, 0);

    const scheduleCode = await this.repo.generateNextScheduleCode(tenantId);

    const schedule = await this.repo.createSchedule(tenantId, {
      scheduleCode,
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      employeeName: employee.fullName,
      department: employee.department,
      shiftId: shift.id,
      shiftCode: shift.shiftCode,
      shiftName: shift.name,
      date: scheduleDate,
      scheduledStartTime,
      scheduledEndTime,
      isRestDay: dto.isRestDay ?? false,
      status: 'SCHEDULED',
      notes: dto.notes || null
    });

    this.publishEvent(DomainEvents.WORKFORCE_SHIFT_SCHEDULED, tenantId, {
      scheduleId: schedule.id,
      scheduleCode,
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      shiftCode: shift.shiftCode,
      date: scheduleDate
    }, actor.userId);

    return schedule;
  }

  public async bulkCreateSchedules(
    tenantId: string,
    actor: IActorContext,
    dto: BulkCreateScheduleDto
  ): Promise<ShiftScheduleDocument[]> {
    const created: ShiftScheduleDocument[] = [];
    for (const item of dto.schedules) {
      try {
        const sched = await this.createSchedule(tenantId, actor, item);
        created.push(sched);
      } catch (err: any) {
        this.logger.warn(`Skipping schedule item: ${err.message}`);
      }
    }
    return created;
  }

  public async reassignShift(
    tenantId: string,
    actor: IActorContext,
    dto: ReassignShiftDto
  ): Promise<ShiftScheduleDocument> {
    const schedule = await this.repo.findScheduleById(tenantId, dto.scheduleId);
    if (!schedule) {
      throw new NotFoundError(`Schedule with ID '${dto.scheduleId}' not found`);
    }

    const newShift = await this.repo.findShiftById(tenantId, dto.newShiftId);
    if (!newShift || !newShift.isActive) {
      throw new NotFoundError(`Active Shift with ID '${dto.newShiftId}' not found`);
    }

    const [startH, startM] = newShift.startTime.split(':').map(Number);
    const [endH, endM] = newShift.endTime.split(':').map(Number);

    const scheduledStartTime = new Date(schedule.date);
    scheduledStartTime.setHours(startH, startM, 0, 0);

    const scheduledEndTime = new Date(schedule.date);
    if (newShift.isOvernight || endH < startH) {
      scheduledEndTime.setDate(scheduledEndTime.getDate() + 1);
    }
    scheduledEndTime.setHours(endH, endM, 0, 0);

    schedule.shiftId = newShift.id;
    schedule.shiftCode = newShift.shiftCode;
    schedule.shiftName = newShift.name;
    schedule.scheduledStartTime = scheduledStartTime;
    schedule.scheduledEndTime = scheduledEndTime;
    schedule.status = 'REASSIGNED';
    if (dto.reason) schedule.notes = dto.reason;

    await schedule.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'SHIFT_REASSIGNED',
      entityType: 'ShiftSchedule',
      entityId: schedule.id,
      metadata: {
        employeeCode: schedule.employeeCode,
        newShiftCode: newShift.shiftCode,
        reason: dto.reason
      }
    });

    return schedule;
  }

  public async querySchedules(
    tenantId: string,
    query: QuerySchedulesDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<ShiftScheduleDocument>> {
    return await this.repo.querySchedules(tenantId, query, pagination);
  }

  // ==================== Clock-in / Clock-out Attendance ====================

  public async clockIn(
    tenantId: string,
    actor: IActorContext,
    dto: ClockInDto
  ): Promise<AttendanceRecordDocument> {
    const employee = await WorkforceMemberModel.findOne({
      tenantId,
      isDeleted: false,
      ...(mongoose.isValidObjectId(dto.employeeId)
        ? { _id: dto.employeeId }
        : {
            $or: [
              { employeeCode: dto.employeeId },
              { email: dto.employeeId.toLowerCase() },
              { firstName: new RegExp(`^${dto.employeeId}$`, 'i') }
            ]
          })
    });
    if (!employee) {
      throw new NotFoundError(`Employee with ID '${dto.employeeId}' not found`);
    }

    const now = dto.clockInTime ? new Date(dto.clockInTime) : new Date();

    // Check if attendance already recorded today
    let attendance = await this.repo.findEmployeeAttendanceOnDate(tenantId, employee.id, now);
    if (attendance && attendance.clockInTime) {
      throw new ConflictError(
        `Employee '${employee.employeeCode}' has already clocked in for today at ${attendance.clockInTime.toISOString()}`
      );
    }

    // Find shift schedule or default shift
    const schedules = await this.repo.findEmployeeScheduleOnDate(tenantId, employee.id, now);
    let shift: ShiftDocument | null = null;

    if (schedules.length > 0) {
      shift = await this.repo.findShiftById(tenantId, schedules[0].shiftId);
    } else if (dto.shiftId) {
      shift = await this.repo.findShiftById(tenantId, dto.shiftId);
    } else {
      shift = await this.repo.findShiftByCode(tenantId, employee.defaultShift);
    }

    if (!shift) {
      const activeShifts = await this.repo.findAllActiveShifts(tenantId);
      shift = activeShifts[0] || null;
    }

    const shiftCode = shift?.shiftCode || 'GENERAL_DAY';
    const shiftStartTime = shift?.startTime || '08:00';
    const graceMinutes = shift?.gracePeriodMinutes ?? 15;

    const [startH, startM] = shiftStartTime.split(':').map(Number);
    const scheduledStart = new Date(now);
    scheduledStart.setHours(startH, startM, 0, 0);

    const scheduledEnd = new Date(scheduledStart);
    scheduledEnd.setHours(scheduledEnd.getHours() + (shift?.durationHours || 8));

    // Calculate late minutes
    const diffMs = now.getTime() - scheduledStart.getTime();
    const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
    const isLate = diffMinutes > graceMinutes;
    const lateMinutes = isLate ? diffMinutes : 0;
    const status = isLate ? 'LATE' : 'PRESENT';

    const attendanceNumber = await this.repo.generateNextAttendanceNumber(tenantId);

    attendance = await this.repo.createAttendanceRecord(tenantId, {
      attendanceNumber,
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      employeeName: employee.fullName,
      department: employee.department,
      shiftId: shift?.id || 'default_shift',
      shiftCode,
      date: now,
      clockInTime: now,
      scheduledStartTime: scheduledStart,
      scheduledEndTime: scheduledEnd,
      actualHoursWorked: 0,
      regularHours: 0,
      overtimeHours: 0,
      lateMinutes,
      earlyExitMinutes: 0,
      status,
      isJustifiedCorrection: false,
      notes: dto.notes || null
    });

    this.publishEvent(DomainEvents.WORKFORCE_PUNCH_RECORDED, tenantId, {
      attendanceNumber,
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      punchType: 'CLOCK_IN',
      time: now,
      status
    }, actor.userId);

    return attendance;
  }

  public async clockOut(
    tenantId: string,
    actor: IActorContext,
    dto: ClockOutDto
  ): Promise<AttendanceRecordDocument> {
    const employee = await WorkforceMemberModel.findOne({
      tenantId,
      isDeleted: false,
      ...(mongoose.isValidObjectId(dto.employeeId)
        ? { _id: dto.employeeId }
        : {
            $or: [
              { employeeCode: dto.employeeId },
              { email: dto.employeeId.toLowerCase() },
              { firstName: new RegExp(`^${dto.employeeId}$`, 'i') }
            ]
          })
    });
    if (!employee) {
      throw new NotFoundError(`Employee with ID '${dto.employeeId}' not found`);
    }

    const now = dto.clockOutTime ? new Date(dto.clockOutTime) : new Date();

    const attendance = await this.repo.findEmployeeAttendanceOnDate(tenantId, employee.id, now);
    if (!attendance || !attendance.clockInTime) {
      throw new BadRequestError(`No active clock-in found for employee '${employee.employeeCode}' today`);
    }

    attendance.clockOutTime = now;

    // Compute actual worked hours
    const workedMs = now.getTime() - new Date(attendance.clockInTime).getTime();
    const workedHours = Math.max(0, Math.round((workedMs / 3600000) * 100) / 100);

    const scheduledHours = 8.0;
    const regularHours = Math.min(workedHours, scheduledHours);
    const overtimeHours = Math.max(0, Math.round((workedHours - scheduledHours) * 100) / 100);

    // Early departure check
    const schedEnd = new Date(attendance.scheduledEndTime);
    const earlyMs = schedEnd.getTime() - now.getTime();
    const earlyMinutes = earlyMs > 15 * 60000 ? Math.round(earlyMs / 60000) : 0;

    attendance.actualHoursWorked = workedHours;
    attendance.regularHours = regularHours;
    attendance.overtimeHours = overtimeHours;
    attendance.earlyExitMinutes = earlyMinutes;

    if (workedHours < 4.0 && attendance.status !== 'LATE') {
      attendance.status = 'HALF_DAY';
    }

    await attendance.save();

    this.publishEvent(DomainEvents.WORKFORCE_PUNCH_RECORDED, tenantId, {
      attendanceNumber: attendance.attendanceNumber,
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      punchType: 'CLOCK_OUT',
      time: now,
      workedHours
    }, actor.userId);

    return attendance;
  }

  public async correctAttendance(
    tenantId: string,
    actor: IActorContext,
    id: string,
    dto: CorrectAttendanceDto
  ): Promise<AttendanceRecordDocument> {
    const attendance = await this.repo.findAttendanceById(tenantId, id);
    if (!attendance) {
      throw new NotFoundError(`Attendance Record with ID '${id}' not found`);
    }

    if (dto.clockInTime) attendance.clockInTime = new Date(dto.clockInTime);
    if (dto.clockOutTime) attendance.clockOutTime = new Date(dto.clockOutTime);
    if (dto.status) attendance.status = dto.status;

    if (attendance.clockInTime && attendance.clockOutTime) {
      const workedMs =
        new Date(attendance.clockOutTime).getTime() - new Date(attendance.clockInTime).getTime();
      const workedHours = Math.max(0, Math.round((workedMs / 3600000) * 100) / 100);
      attendance.actualHoursWorked = workedHours;
      attendance.regularHours = Math.min(workedHours, 8.0);
      attendance.overtimeHours = Math.max(0, Math.round((workedHours - 8.0) * 100) / 100);
    }

    attendance.isJustifiedCorrection = true;
    attendance.correctionReason = dto.correctionReason;
    attendance.correctedBy = {
      userId: actor.userId,
      email: actor.email,
      role: actor.role,
      correctedAt: new Date()
    };

    await attendance.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'ATTENDANCE_CORRECTED',
      entityType: 'AttendanceRecord',
      entityId: attendance.id,
      metadata: {
        attendanceNumber: attendance.attendanceNumber,
        employeeCode: attendance.employeeCode,
        correctionReason: dto.correctionReason
      }
    });

    return attendance;
  }

  public async queryAttendance(
    tenantId: string,
    query: QueryAttendanceDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<AttendanceRecordDocument>> {
    return await this.repo.queryAttendance(tenantId, query, pagination);
  }

  // ==================== Leave Management ====================

  public async createLeaveRequest(
    tenantId: string,
    actor: IActorContext,
    dto: CreateLeaveRequestDto
  ): Promise<LeaveRequestDocument> {
    const employee = await WorkforceMemberModel.findOne({
      _id: dto.employeeId,
      tenantId,
      isDeleted: false
    });
    if (!employee) {
      throw new NotFoundError(`Employee with ID '${dto.employeeId}' not found`);
    }

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (start > end) {
      throw new BadRequestError('startDate cannot be after endDate');
    }

    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Check balance
    const year = start.getFullYear();
    const balance = await this.repo.findOrCreateLeaveBalance(
      tenantId,
      employee.id,
      employee.employeeCode,
      employee.fullName,
      year
    );

    const typeBal = balance.balances.find((b) => b.leaveType === dto.leaveType);
    if (typeBal && typeBal.available < diffDays && dto.leaveType !== 'UNPAID') {
      throw new BadRequestError(
        `Insufficient ${dto.leaveType} leave balance. Requested: ${diffDays} days, Available: ${typeBal.available} days.`
      );
    }

    const requestNumber = await this.repo.generateNextLeaveNumber(tenantId);

    const leaveReq = await this.repo.createLeaveRequest(tenantId, {
      requestNumber,
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      employeeName: employee.fullName,
      department: employee.department,
      leaveType: dto.leaveType,
      startDate: start,
      endDate: end,
      totalDays: diffDays,
      reason: dto.reason,
      status: 'PENDING',
      notes: dto.notes || null
    });

    // Mark pending in balance
    if (typeBal) {
      typeBal.pending += diffDays;
      await balance.save();
    }

    this.publishEvent(DomainEvents.WORKFORCE_LEAVE_REQUESTED, tenantId, {
      requestNumber,
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      leaveType: dto.leaveType,
      totalDays: diffDays
    }, actor.userId);

    return leaveReq;
  }

  public async approveLeave(
    tenantId: string,
    actor: IActorContext,
    id: string,
    dto: ApproveLeaveDto
  ): Promise<LeaveRequestDocument> {
    const leaveReq = await this.repo.findLeaveRequestById(tenantId, id);
    if (!leaveReq) {
      throw new NotFoundError(`Leave request with ID '${id}' not found`);
    }

    if (leaveReq.status !== 'PENDING') {
      throw new BadRequestError(`Cannot approve leave in status '${leaveReq.status}'`);
    }

    leaveReq.status = 'APPROVED';
    leaveReq.approvedBy = {
      userId: actor.userId,
      email: actor.email,
      role: actor.role,
      approvedAt: new Date(),
      comments: dto.comments || null
    };

    await leaveReq.save();

    // Deduct balance
    const year = new Date(leaveReq.startDate).getFullYear();
    const balance = await this.repo.findLeaveBalance(tenantId, leaveReq.employeeId, year);
    if (balance) {
      const typeBal = balance.balances.find((b) => b.leaveType === leaveReq.leaveType);
      if (typeBal) {
        typeBal.pending = Math.max(0, typeBal.pending - leaveReq.totalDays);
        typeBal.used += leaveReq.totalDays;
        typeBal.available = Math.max(0, typeBal.totalAllocated - typeBal.used);
        await balance.save();
      }
    }

    // Cancel any shift schedules overlapping the approved leave
    const schedules = await this.repo.querySchedules(
      tenantId,
      {
        employeeId: leaveReq.employeeId,
        startDate: leaveReq.startDate.toISOString(),
        endDate: leaveReq.endDate.toISOString()
      },
      { page: 1, limit: 100 }
    );

    for (const sched of schedules.items) {
      sched.status = 'CANCELLED';
      sched.notes = `Cancelled due to approved ${leaveReq.leaveType} leave (${leaveReq.requestNumber})`;
      await sched.save();
    }

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'LEAVE_APPROVED',
      entityType: 'LeaveRequest',
      entityId: leaveReq.id,
      metadata: {
        requestNumber: leaveReq.requestNumber,
        employeeCode: leaveReq.employeeCode,
        leaveType: leaveReq.leaveType
      }
    });

    this.publishEvent(DomainEvents.WORKFORCE_LEAVE_APPROVED, tenantId, {
      requestNumber: leaveReq.requestNumber,
      employeeId: leaveReq.employeeId,
      employeeCode: leaveReq.employeeCode,
      leaveType: leaveReq.leaveType
    }, actor.userId);

    return leaveReq;
  }

  public async rejectLeave(
    tenantId: string,
    actor: IActorContext,
    id: string,
    dto: RejectLeaveDto
  ): Promise<LeaveRequestDocument> {
    const leaveReq = await this.repo.findLeaveRequestById(tenantId, id);
    if (!leaveReq) {
      throw new NotFoundError(`Leave request with ID '${id}' not found`);
    }

    if (leaveReq.status !== 'PENDING') {
      throw new BadRequestError(`Cannot reject leave in status '${leaveReq.status}'`);
    }

    leaveReq.status = 'REJECTED';
    leaveReq.rejectionReason = dto.rejectionReason;
    await leaveReq.save();

    // Release pending balance
    const year = new Date(leaveReq.startDate).getFullYear();
    const balance = await this.repo.findLeaveBalance(tenantId, leaveReq.employeeId, year);
    if (balance) {
      const typeBal = balance.balances.find((b) => b.leaveType === leaveReq.leaveType);
      if (typeBal) {
        typeBal.pending = Math.max(0, typeBal.pending - leaveReq.totalDays);
        await balance.save();
      }
    }

    this.publishEvent(DomainEvents.WORKFORCE_LEAVE_REJECTED, tenantId, {
      requestNumber: leaveReq.requestNumber,
      employeeId: leaveReq.employeeId,
      employeeCode: leaveReq.employeeCode
    }, actor.userId);

    return leaveReq;
  }

  public async getLeaveBalance(
    tenantId: string,
    employeeId: string,
    year?: number
  ): Promise<LeaveBalanceDocument> {
    const yr = year || new Date().getFullYear();
    const employee = await WorkforceMemberModel.findOne({ _id: employeeId, tenantId, isDeleted: false });
    if (!employee) {
      throw new NotFoundError(`Employee with ID '${employeeId}' not found`);
    }

    return await this.repo.findOrCreateLeaveBalance(
      tenantId,
      employee.id,
      employee.employeeCode,
      employee.fullName,
      yr
    );
  }

  public async queryLeaves(
    tenantId: string,
    query: QueryLeavesDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<LeaveRequestDocument>> {
    return await this.repo.queryLeaves(tenantId, query, pagination);
  }

  // ==================== Overtime Authorization ====================

  public async createOvertimeRequest(
    tenantId: string,
    actor: IActorContext,
    dto: CreateOvertimeRequestDto
  ): Promise<OvertimeRecordDocument> {
    const employee = await WorkforceMemberModel.findOne({ _id: dto.employeeId, tenantId, isDeleted: false });
    if (!employee) {
      throw new NotFoundError(`Employee with ID '${dto.employeeId}' not found`);
    }

    const shift = await this.repo.findShiftById(tenantId, dto.shiftId);
    if (!shift) {
      throw new NotFoundError(`Shift with ID '${dto.shiftId}' not found`);
    }

    const requestNumber = await this.repo.generateNextOvertimeNumber(tenantId);

    const ot = await this.repo.createOvertimeRecord(tenantId, {
      requestNumber,
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      employeeName: employee.fullName,
      department: employee.department,
      date: new Date(dto.date),
      shiftId: shift.id,
      shiftCode: shift.shiftCode,
      requestedHours: dto.requestedHours,
      reason: dto.reason,
      productionJobId: dto.productionJobId || null,
      productionJobNumber: dto.productionJobNumber || null,
      status: 'PENDING',
      notes: dto.notes || null
    });

    this.publishEvent(DomainEvents.WORKFORCE_OVERTIME_REQUESTED, tenantId, {
      requestNumber,
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      requestedHours: dto.requestedHours
    }, actor.userId);

    return ot;
  }

  public async approveOvertime(
    tenantId: string,
    actor: IActorContext,
    id: string,
    dto: ApproveOvertimeDto
  ): Promise<OvertimeRecordDocument> {
    const ot = await this.repo.findOvertimeById(tenantId, id);
    if (!ot) {
      throw new NotFoundError(`Overtime request with ID '${id}' not found`);
    }

    if (ot.status !== 'PENDING') {
      throw new BadRequestError(`Cannot approve overtime in status '${ot.status}'`);
    }

    ot.status = 'APPROVED';
    ot.approvedBy = {
      userId: actor.userId,
      email: actor.email,
      role: actor.role,
      approvedAt: new Date(),
      comments: dto.comments || null
    };

    await ot.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'OVERTIME_APPROVED',
      entityType: 'OvertimeRecord',
      entityId: ot.id,
      metadata: { requestNumber: ot.requestNumber, requestedHours: ot.requestedHours }
    });

    this.publishEvent(DomainEvents.WORKFORCE_OVERTIME_APPROVED, tenantId, {
      requestNumber: ot.requestNumber,
      employeeId: ot.employeeId,
      employeeCode: ot.employeeCode,
      approvedHours: ot.requestedHours
    }, actor.userId);

    return ot;
  }

  public async rejectOvertime(
    tenantId: string,
    actor: IActorContext,
    id: string,
    dto: RejectOvertimeDto
  ): Promise<OvertimeRecordDocument> {
    const ot = await this.repo.findOvertimeById(tenantId, id);
    if (!ot) {
      throw new NotFoundError(`Overtime request with ID '${id}' not found`);
    }

    ot.status = 'REJECTED';
    ot.rejectionReason = dto.rejectionReason;
    await ot.save();

    return ot;
  }

  public async queryOvertime(
    tenantId: string,
    query: QueryOvertimeDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<OvertimeRecordDocument>> {
    return await this.repo.queryOvertime(tenantId, query, pagination);
  }

  // ==================== Shift Swaps ====================

  public async createShiftSwap(
    tenantId: string,
    actor: IActorContext,
    dto: CreateShiftSwapDto
  ): Promise<ShiftSwapRequestDocument> {
    const reqSched = await this.repo.findScheduleById(tenantId, dto.requesterScheduleId);
    if (!reqSched) throw new NotFoundError(`Requester schedule '${dto.requesterScheduleId}' not found`);

    const targetSched = await this.repo.findScheduleById(tenantId, dto.targetScheduleId);
    if (!targetSched) throw new NotFoundError(`Target schedule '${dto.targetScheduleId}' not found`);

    const requestNumber = await this.repo.generateNextSwapNumber(tenantId);

    const swap = await this.repo.createShiftSwap(tenantId, {
      requestNumber,
      requesterEmployeeId: reqSched.employeeId,
      requesterEmployeeCode: reqSched.employeeCode,
      requesterEmployeeName: reqSched.employeeName,
      requesterScheduleId: reqSched.id,
      targetEmployeeId: targetSched.employeeId,
      targetEmployeeCode: targetSched.employeeCode,
      targetEmployeeName: targetSched.employeeName,
      targetScheduleId: targetSched.id,
      date: reqSched.date,
      reason: dto.reason,
      status: 'PENDING'
    });

    return swap;
  }

  public async approveShiftSwap(
    tenantId: string,
    actor: IActorContext,
    swapId: string
  ): Promise<ShiftSwapRequestDocument> {
    const swap = await this.repo.findShiftSwapById(tenantId, swapId);
    if (!swap) throw new NotFoundError(`Shift swap with ID '${swapId}' not found`);

    if (swap.status !== 'PENDING') {
      throw new BadRequestError(`Cannot approve swap in status '${swap.status}'`);
    }

    const reqSched = await this.repo.findScheduleById(tenantId, swap.requesterScheduleId);
    const targetSched = await this.repo.findScheduleById(tenantId, swap.targetScheduleId);

    if (reqSched && targetSched) {
      // Swap shifts between the two schedules
      const tempShiftId = reqSched.shiftId;
      const tempShiftCode = reqSched.shiftCode;
      const tempShiftName = reqSched.shiftName;
      const tempStart = reqSched.scheduledStartTime;
      const tempEnd = reqSched.scheduledEndTime;

      reqSched.shiftId = targetSched.shiftId;
      reqSched.shiftCode = targetSched.shiftCode;
      reqSched.shiftName = targetSched.shiftName;
      reqSched.scheduledStartTime = targetSched.scheduledStartTime;
      reqSched.scheduledEndTime = targetSched.scheduledEndTime;
      reqSched.status = 'SWAPPED';

      targetSched.shiftId = tempShiftId;
      targetSched.shiftCode = tempShiftCode;
      targetSched.shiftName = tempShiftName;
      targetSched.scheduledStartTime = tempStart;
      targetSched.scheduledEndTime = tempEnd;
      targetSched.status = 'SWAPPED';

      await reqSched.save();
      await targetSched.save();
    }

    swap.status = 'APPROVED';
    swap.approvedBy = {
      userId: actor.userId,
      email: actor.email,
      role: actor.role,
      approvedAt: new Date()
    };
    await swap.save();

    this.publishEvent(DomainEvents.WORKFORCE_SHIFT_SWAPPED, tenantId, {
      swapId: swap.id,
      requestNumber: swap.requestNumber
    }, actor.userId);

    return swap;
  }

  // ==================== Plant Holidays ====================

  public async createPlantHoliday(
    tenantId: string,
    actor: IActorContext,
    dto: CreatePlantHolidayDto
  ): Promise<PlantHolidayDocument> {
    const holiday = await this.repo.createPlantHoliday(tenantId, {
      holidayDate: new Date(dto.holidayDate),
      name: dto.name,
      isMandatoryShutdown: dto.isMandatoryShutdown ?? false,
      appliesToAllDepartments: dto.appliesToAllDepartments ?? true,
      department: dto.department || null,
      notes: dto.notes || null
    });

    return holiday;
  }

  public async getPlantHolidays(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<PlantHolidayDocument[]> {
    return await this.repo.findHolidaysInDateRange(
      tenantId,
      new Date(startDate),
      new Date(endDate)
    );
  }

  // ==================== Real-time Workforce Availability for Production ====================

  public async getWorkforceAvailability(
    tenantId: string,
    query: QueryWorkforceAvailabilityDto
  ): Promise<IWorkforceAvailabilityItem[]> {
    const queryDate = new Date(query.date);

    // 1. Fetch active employees
    const filter: Record<string, any> = { tenantId, status: 'ACTIVE', isDeleted: false };
    if (query.department) filter.department = query.department;
    const employees = await WorkforceMemberModel.find(filter);

    const results: IWorkforceAvailabilityItem[] = [];

    for (const emp of employees) {
      // 2. Check if on leave
      const leave = await this.repo.findApprovedLeavesForEmployee(tenantId, emp.id, queryDate);
      const isOnLeave = !!leave;

      // 3. Check shift schedule
      const schedules = await this.repo.findEmployeeScheduleOnDate(tenantId, emp.id, queryDate);
      const scheduledShift = schedules.length > 0 ? schedules[0].shiftCode : emp.defaultShift;
      const isScheduled = schedules.length > 0 && schedules[0].status !== 'CANCELLED';

      // 4. Check attendance punch
      const attendance = await this.repo.findEmployeeAttendanceOnDate(tenantId, emp.id, queryDate);
      const attendanceStatus = attendance ? attendance.status : null;

      // 5. Skill matching
      const skills = ((emp.skills || []) as any[]).map((s: any) => ({
        skillCode: s.skillCode,
        skillName: s.skillName,
        proficiency: s.proficiency,
        isCertified: s.isCertified
      }));

      let matchesSkill = true;
      if (query.requiredSkillCode) {
        matchesSkill = skills.some(
          (s: any) => s.skillCode === query.requiredSkillCode && s.isCertified
        );
      }

      let matchesShift = true;
      if (query.shiftCode) {
        matchesShift = scheduledShift === query.shiftCode;
      }

      const isAvailable =
        !isOnLeave &&
        attendanceStatus !== 'ABSENT' &&
        matchesSkill &&
        matchesShift;

      results.push({
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        employeeName: emp.fullName,
        department: emp.department,
        shiftCode: scheduledShift,
        isScheduled,
        isOnLeave,
        leaveType: leave?.leaveType || null,
        attendanceStatus,
        isAvailable,
        skills,
        availableHours: isAvailable ? 8.0 : 0
      });
    }

    return results;
  }
}

export const attendanceService = new AttendanceService();
