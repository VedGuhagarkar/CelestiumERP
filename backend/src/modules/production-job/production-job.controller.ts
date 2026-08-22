import { Request, Response, NextFunction } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import {
  productionJobService,
  ProductionJobService
} from './production-job.service.js';

export class ProductionJobController extends BaseController {
  constructor(
    private readonly service: ProductionJobService = productionJobService
  ) {
    super();
  }

  public convertPlan = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const job = await this.service.convertPlanToJob(
        tenantId,
        user.userId,
        req.params.planId as string,
        req.body
      );
      this.sendCreated(res, job, 'Production plan converted to job successfully');
    } catch (error) {
      next(error);
    }
  };

  public getJobs = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

      const result = await this.service.getJobs(
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
        'Production jobs retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  };

  public getJobById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const job = await this.service.getJobById(tenantId, req.params.id as string);
      this.sendSuccess(res, job, 'Production job retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  public getJobsByPlan = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const jobs = await this.service.getJobsByPlanId(
        tenantId,
        req.params.planId as string
      );
      this.sendSuccess(res, jobs, 'Plan production jobs retrieved successfully');
    } catch (error) {
      next(error);
    }
  };
}

export const productionJobController = new ProductionJobController();
