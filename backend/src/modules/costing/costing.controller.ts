import { Request, Response, NextFunction } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import { costingService, CostingService, IActorContext } from './costing.service.js';

export class CostingController extends BaseController {
  constructor(private readonly service: CostingService = costingService) {
    super();
  }

  private getActorContext(req: Request): IActorContext {
    const user = this.getUser(req);
    return {
      userId: user.userId,
      email: user.email,
      role: user.roles?.[0],
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string,
      correlationId: (req.headers['x-correlation-id'] as string) || undefined
    };
  }

  // ==========================================
  // Rate Cards
  // ==========================================

  public getActiveRateCard = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const result = await this.service.getActiveRateCard(tenantId);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  public getAllRateCards = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const result = await this.service.getAllRateCards(tenantId);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  public getRateCardByCode = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const code = req.params.code as string;
      const result = await this.service.getRateCardByCode(tenantId, code);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  public createRateCard = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const result = await this.service.createRateCard(tenantId, actor, req.body);
      this.sendCreated(res, result, `Cost Rate Card '${result.rateCardCode}' (Rev ${result.revisionNumber}) created successfully`);
    } catch (error) {
      next(error);
    }
  };

  public updateRateCard = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const code = req.params.code as string;
      const result = await this.service.updateRateCard(tenantId, actor, code, req.body);
      this.sendSuccess(res, result, `Cost Rate Card '${code}' updated successfully`);
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // Job Costing
  // ==========================================

  public calculateJobCost = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const result = await this.service.calculateJobCost(tenantId, actor, req.body);
      this.sendCreated(res, result, `Job cost '${result.costingNumber}' calculated for job '${result.jobNumber}'`);
    } catch (error) {
      next(error);
    }
  };

  public recalculateJobCost = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const id = req.params.id as string;
      const result = await this.service.recalculateJobCost(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, `Job cost '${result.costingNumber}' recalculated successfully`);
    } catch (error) {
      next(error);
    }
  };

  public freezeJobCost = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const id = req.params.id as string;
      const result = await this.service.freezeJobCost(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, `Job cost '${result.costingNumber}' frozen against future rate adjustments`);
    } catch (error) {
      next(error);
    }
  };

  public getJobCostById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = req.params.id as string;
      const result = await this.service.getJobCostById(tenantId, id);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  public getJobCostByJobId = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const jobId = req.params.jobId as string;
      const result = await this.service.getJobCostByJobId(tenantId, jobId);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  public queryJobCosts = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const pagination = this.parsePagination(req);
      const result = await this.service.queryJobCosts(tenantId, req.query as any, pagination);
      this.sendPaginated(res, result.items, result.page, result.limit, result.total);
    } catch (error) {
      next(error);
    }
  };

  public getCostingSummaryReport = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const result = await this.service.getCostingSummaryReport(tenantId, req.query as any);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };
}

export const costingController = new CostingController();
