import { Request, Response, NextFunction } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import { productionPlanService, ProductionPlanService } from './production-plan.service.js';

export class ProductionPlanController extends BaseController {
  constructor(private readonly service: ProductionPlanService = productionPlanService) {
    super();
  }

  public create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const plan = await this.service.createPlan(tenantId, user.userId, req.body);
      this.sendCreated(res, plan, 'Production Plan created successfully');
    } catch (error) {
      next(error);
    }
  };

  public getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const plan = await this.service.getPlanById(tenantId, req.params.id as string);
      this.sendSuccess(res, plan, 'Production Plan retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  public getByNumber = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const plan = await this.service.getPlanByNumber(tenantId, req.params.planNumber as string);
      this.sendSuccess(res, plan, 'Production Plan retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  public query = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const { plans, total } = await this.service.queryPlans(tenantId, req.query as any);
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      this.sendPaginated(res, plans, page, limit, total, 'Production Plans retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  public update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const plan = await this.service.updatePlan(tenantId, req.params.id as string, user.userId, req.body);
      this.sendSuccess(res, plan, 'Production Plan updated successfully');
    } catch (error) {
      next(error);
    }
  };

  public updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const plan = await this.service.updatePlanStatus(tenantId, req.params.id as string, user.userId, req.body);
      this.sendSuccess(res, plan, 'Production Plan status updated successfully');
    } catch (error) {
      next(error);
    }
  };

  public recalculate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const plan = await this.service.recalculatePlan(tenantId, req.params.id as string, user.userId);
      this.sendSuccess(res, plan, 'Production Plan recalculated successfully');
    } catch (error) {
      next(error);
    }
  };
}

export const productionPlanController = new ProductionPlanController();
