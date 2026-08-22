import { Request, Response, NextFunction } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import { maintenanceService, MaintenanceService } from './maintenance.service.js';

export class MaintenanceController extends BaseController {
  constructor(private readonly service: MaintenanceService = maintenanceService) {
    super();
  }

  // ==================== Preventive Plans ====================

  public createPreventivePlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const result = await this.service.createPreventivePlan(tenantId, actor, req.body);
      this.sendCreated(res, result, 'Preventive maintenance plan created successfully');
    } catch (error) {
      next(error);
    }
  };

  public updatePreventivePlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const id = req.params.id as string;
      const result = await this.service.updatePreventivePlan(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, 'Preventive maintenance plan updated');
    } catch (error) {
      next(error);
    }
  };

  public queryPlans = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const pagination = this.parsePagination(req);
      const result = await this.service.queryPlans(tenantId, req.query as any, pagination);
      this.sendPaginated(res, result.items, result.page, result.limit, result.total);
    } catch (error) {
      next(error);
    }
  };

  public getOverduePlans = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const result = await this.service.getOverduePlans(tenantId);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  // ==================== Breakdowns & Work Orders ====================

  public reportBreakdown = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const result = await this.service.reportBreakdown(tenantId, actor, req.body);
      this.sendCreated(res, result, 'Breakdown incident logged; equipment status transitioned to BREAKDOWN');
    } catch (error) {
      next(error);
    }
  };

  public resolveBreakdown = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const id = req.params.id as string;
      const result = await this.service.resolveBreakdown(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, 'Breakdown resolved and equipment returned to operational/testing state');
    } catch (error) {
      next(error);
    }
  };

  public createWorkOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const result = await this.service.createWorkOrder(tenantId, actor, req.body);
      this.sendCreated(res, result, 'Maintenance work order created successfully');
    } catch (error) {
      next(error);
    }
  };

  public completeWorkOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const id = req.params.id as string;
      const result = await this.service.completeWorkOrder(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, 'Maintenance work order completed');
    } catch (error) {
      next(error);
    }
  };

  public getWorkOrderById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = req.params.id as string;
      const result = await this.service.getWorkOrderById(tenantId, id);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  public queryWorkOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const pagination = this.parsePagination(req);
      const result = await this.service.queryWorkOrders(tenantId, req.query as any, pagination);
      this.sendPaginated(res, result.items, result.page, result.limit, result.total);
    } catch (error) {
      next(error);
    }
  };

  public getMetrics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const result = await this.service.getMetrics(tenantId);
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
      role: user?.roles?.[0] || 'MAINTENANCE_TECH'
    };
  }
}

export const maintenanceController = new MaintenanceController();
