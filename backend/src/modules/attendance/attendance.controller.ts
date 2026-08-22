import { Request, Response, NextFunction } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import { attendanceService, AttendanceService } from './attendance.service.js';

export class AttendanceController extends BaseController {
  constructor(private readonly service: AttendanceService = attendanceService) {
    super();
  }

  // ==================== Shifts ====================

  public createShift = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const result = await this.service.createShift(tenantId, actor, req.body);
      this.sendCreated(res, result, 'Shift created successfully');
    } catch (error) {
      next(error);
    }
  };

  public updateShift = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const id = req.params.id as string;
      const result = await this.service.updateShift(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, 'Shift updated successfully');
    } catch (error) {
      next(error);
    }
  };

  public getActiveShifts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const result = await this.service.getActiveShifts(tenantId);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  // ==================== Schedules (Roster) ====================

  public createSchedule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const result = await this.service.createSchedule(tenantId, actor, req.body);
      this.sendCreated(res, result, 'Shift scheduled successfully');
    } catch (error) {
      next(error);
    }
  };

  public bulkCreateSchedules = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const result = await this.service.bulkCreateSchedules(tenantId, actor, req.body);
      this.sendCreated(res, result, `${result.length} schedules created`);
    } catch (error) {
      next(error);
    }
  };

  public reassignShift = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const result = await this.service.reassignShift(tenantId, actor, req.body);
      this.sendSuccess(res, result, 'Shift reassigned');
    } catch (error) {
      next(error);
    }
  };

  public querySchedules = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const pagination = this.parsePagination(req);
      const result = await this.service.querySchedules(tenantId, req.query as any, pagination);
      this.sendPaginated(res, result.items, result.page, result.limit, result.total);
    } catch (error) {
      next(error);
    }
  };

  // ==================== Attendance ====================

  public clockIn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const result = await this.service.clockIn(tenantId, actor, req.body);
      this.sendCreated(res, result, 'Clock-in recorded');
    } catch (error) {
      next(error);
    }
  };

  public clockOut = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const result = await this.service.clockOut(tenantId, actor, req.body);
      this.sendSuccess(res, result, 'Clock-out recorded and hours computed');
    } catch (error) {
      next(error);
    }
  };

  public correctAttendance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const id = req.params.id as string;
      const result = await this.service.correctAttendance(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, 'Attendance record corrected and audited');
    } catch (error) {
      next(error);
    }
  };

  public queryAttendance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const pagination = this.parsePagination(req);
      const result = await this.service.queryAttendance(tenantId, req.query as any, pagination);
      this.sendPaginated(res, result.items, result.page, result.limit, result.total);
    } catch (error) {
      next(error);
    }
  };

  // ==================== Leaves ====================

  public createLeaveRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const result = await this.service.createLeaveRequest(tenantId, actor, req.body);
      this.sendCreated(res, result, 'Leave request submitted');
    } catch (error) {
      next(error);
    }
  };

  public approveLeave = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const id = req.params.id as string;
      const result = await this.service.approveLeave(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, 'Leave request approved and balance deducted');
    } catch (error) {
      next(error);
    }
  };

  public rejectLeave = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const id = req.params.id as string;
      const result = await this.service.rejectLeave(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, 'Leave request rejected');
    } catch (error) {
      next(error);
    }
  };

  public getLeaveBalance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const employeeId = req.params.employeeId as string;
      const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
      const result = await this.service.getLeaveBalance(tenantId, employeeId, year);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  public queryLeaves = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const pagination = this.parsePagination(req);
      const result = await this.service.queryLeaves(tenantId, req.query as any, pagination);
      this.sendPaginated(res, result.items, result.page, result.limit, result.total);
    } catch (error) {
      next(error);
    }
  };

  // ==================== Overtime ====================

  public createOvertimeRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const result = await this.service.createOvertimeRequest(tenantId, actor, req.body);
      this.sendCreated(res, result, 'Overtime request submitted');
    } catch (error) {
      next(error);
    }
  };

  public approveOvertime = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const id = req.params.id as string;
      const result = await this.service.approveOvertime(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, 'Overtime approved');
    } catch (error) {
      next(error);
    }
  };

  public rejectOvertime = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const id = req.params.id as string;
      const result = await this.service.rejectOvertime(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, 'Overtime rejected');
    } catch (error) {
      next(error);
    }
  };

  public queryOvertime = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const pagination = this.parsePagination(req);
      const result = await this.service.queryOvertime(tenantId, req.query as any, pagination);
      this.sendPaginated(res, result.items, result.page, result.limit, result.total);
    } catch (error) {
      next(error);
    }
  };

  // ==================== Shift Swaps ====================

  public createShiftSwap = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const result = await this.service.createShiftSwap(tenantId, actor, req.body);
      this.sendCreated(res, result, 'Shift swap request submitted');
    } catch (error) {
      next(error);
    }
  };

  public approveShiftSwap = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const id = req.params.id as string;
      const result = await this.service.approveShiftSwap(tenantId, actor, id);
      this.sendSuccess(res, result, 'Shift swap approved and roster updated');
    } catch (error) {
      next(error);
    }
  };

  // ==================== Plant Holidays ====================

  public createPlantHoliday = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const result = await this.service.createPlantHoliday(tenantId, actor, req.body);
      this.sendCreated(res, result, 'Plant holiday added');
    } catch (error) {
      next(error);
    }
  };

  public getPlantHolidays = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const startDate = (req.query.startDate as string) || new Date().toISOString();
      const endDate =
        (req.query.endDate as string) ||
        new Date(Date.now() + 90 * 86400000).toISOString();
      const result = await this.service.getPlantHolidays(tenantId, startDate, endDate);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  // ==================== Workforce Availability ====================

  public getWorkforceAvailability = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const result = await this.service.getWorkforceAvailability(tenantId, req.query as any);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  private getActor(req: Request) {
    const user = (req as any).user;
    return {
      userId: user?.userId || 'system',
      email: user?.email,
      role: user?.roles?.[0] || 'FACTORY_OPERATIONS_MANAGER',
      fullName: user?.fullName || 'Operations Manager'
    };
  }
}

export const attendanceController = new AttendanceController();
