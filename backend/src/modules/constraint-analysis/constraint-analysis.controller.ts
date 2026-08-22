import { Request, Response, NextFunction } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import {
  constraintAnalysisService,
  ConstraintAnalysisService
} from './constraint-analysis.service.js';

export class ConstraintAnalysisController extends BaseController {
  constructor(
    private readonly service: ConstraintAnalysisService = constraintAnalysisService
  ) {
    super();
  }

  public evaluatePlan = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const report = await this.service.evaluatePlanConstraints(
        tenantId,
        req.params.planId as string
      );
      this.sendSuccess(res, report, 'Plan constraint analysis completed');
    } catch (error) {
      next(error);
    }
  };

  public factoryAudit = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const summary = await this.service.factoryAudit(tenantId, req.query);
      this.sendSuccess(res, summary, 'Factory constraint audit completed');
    } catch (error) {
      next(error);
    }
  };

  public getBottlenecks = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const summary = await this.service.factoryAudit(tenantId, req.query);
      this.sendSuccess(
        res,
        {
          topBottlenecks: summary.topBottlenecks,
          categoryBreakdown: summary.categoryBreakdown,
          overallReadinessPercentage: summary.overallReadinessPercentage
        },
        'Factory bottlenecks retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  };
}

export const constraintAnalysisController = new ConstraintAnalysisController();
