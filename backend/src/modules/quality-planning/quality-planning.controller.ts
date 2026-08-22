import { Request, Response, NextFunction } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import {
  QualityPlanningService,
  qualityPlanningService
} from './quality-planning.service.js';
import { PaginationOptions } from '../../core/types/pagination.js';

export class QualityPlanningController extends BaseController {
  constructor(
    private readonly service: QualityPlanningService = qualityPlanningService
  ) {
    super();
  }

  public createPlan = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const plan = await this.service.createPlan(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.body
      );
      this.sendCreated(res, plan, 'Quality Plan created successfully in DRAFT status');
    } catch (error) {
      next(error);
    }
  };

  public updateDraftPlan = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const plan = await this.service.updateDraftPlan(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.params.id as string,
        req.body
      );
      this.sendSuccess(res, plan, 'Quality Plan draft updated successfully');
    } catch (error) {
      next(error);
    }
  };

  public approvePlan = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const plan = await this.service.approvePlan(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.params.id as string,
        req.body
      );
      this.sendSuccess(res, plan, 'Quality Plan approved successfully');
    } catch (error) {
      next(error);
    }
  };

  public createRevision = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const plan = await this.service.createRevision(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.params.id as string,
        req.body
      );
      this.sendCreated(res, plan, 'New Quality Plan revision created in DRAFT status');
    } catch (error) {
      next(error);
    }
  };

  public getPlanById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const plan = await this.service.getPlanById(tenantId, req.params.id as string);
      this.sendSuccess(res, plan, 'Quality Plan retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  public getActiveApprovedPlan = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const plan = await this.service.getActiveApprovedPlan(
        tenantId,
        req.params.planCode as string
      );
      this.sendSuccess(res, plan, 'Active approved Quality Plan retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  public findApplicablePlan = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const { processFamily, specCode, customerCode } = req.query;
      const plan = await this.service.findApplicablePlan(tenantId, {
        processFamily: processFamily as string,
        specCode: specCode as string,
        customerCode: customerCode as string | undefined
      });
      this.sendSuccess(res, plan, 'Applicable Quality Plan retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  public queryPlans = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const pagination: PaginationOptions = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        sort: req.query.sortBy
          ? { [req.query.sortBy as string]: req.query.sortOrder === 'asc' ? 1 : -1 }
          : undefined
      };

      const result = await this.service.queryPlans(
        tenantId,
        req.query as any,
        pagination
      );
      this.sendPaginated(
        res,
        result.items,
        result.page,
        result.limit,
        result.total,
        'Quality Plans retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  };
}

export const qualityPlanningController = new QualityPlanningController();
