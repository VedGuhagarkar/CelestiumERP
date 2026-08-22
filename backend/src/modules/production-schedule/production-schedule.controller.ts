import { Request, Response, NextFunction } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import {
  productionScheduleService,
  ProductionScheduleService
} from './production-schedule.service.js';

export class ProductionScheduleController extends BaseController {
  constructor(
    private readonly service: ProductionScheduleService = productionScheduleService
  ) {
    super();
  }

  public scheduleJob = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const schedule = await this.service.scheduleJob(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.body
      );
      this.sendCreated(res, schedule, 'Production job scheduled successfully');
    } catch (error) {
      next(error);
    }
  };

  public rescheduleJob = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const schedule = await this.service.rescheduleJob(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.params.id as string,
        req.body
      );
      this.sendSuccess(res, schedule, 'Production schedule updated successfully');
    } catch (error) {
      next(error);
    }
  };

  public unscheduleJob = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const schedule = await this.service.unscheduleJob(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.params.id as string,
        req.body
      );
      this.sendSuccess(
        res,
        schedule,
        'Production schedule cancelled and job returned to backlog'
      );
    } catch (error) {
      next(error);
    }
  };

  public getProductionQueue = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const queue = await this.service.getProductionQueue(tenantId, req.query);
      this.sendSuccess(
        res,
        queue,
        'Prioritized production schedule queue retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  };

  public querySchedules = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

      const result = await this.service.querySchedules(
        tenantId,
        req.query as any,
        { page, limit }
      );

      this.sendPaginated(
        res,
        result.items,
        result.page,
        result.limit,
        result.total,
        'Production schedules retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  };

  public getScheduleById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const schedule = await this.service.getScheduleById(
        tenantId,
        req.params.id as string
      );
      this.sendSuccess(res, schedule, 'Production schedule details retrieved successfully');
    } catch (error) {
      next(error);
    }
  };
}

export const productionScheduleController = new ProductionScheduleController();
