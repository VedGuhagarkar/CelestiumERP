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

  public createBatchOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const job = await this.service.createBatchOrder(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.body
      );
      this.sendCreated(res, job, 'Batch Order created successfully in WAITING_FOR_PRODUCTION status');
    } catch (error) {
      next(error);
    }
  };

  public getEligiblePOs = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const pos = await this.service.getEligiblePOs(tenantId);
      this.sendSuccess(res, pos, 'Eligible Purchase Orders retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  public getEligibleGRNsForPO = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const grns = await this.service.getEligibleGRNsForPO(tenantId, req.params.poId as string);
      this.sendSuccess(res, grns, 'Eligible Goods Receipt Notes retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  public getEligiblePartsForGRN = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const parts = await this.service.getEligiblePartsForGRN(tenantId, req.params.grnId as string);
      this.sendSuccess(res, parts, 'Eligible GRN parts retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  public createDirectJob = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const job = await this.service.createDirectJob(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.body
      );
      this.sendCreated(res, job, 'Direct production job created successfully');
    } catch (error) {
      next(error);
    }
  };

  public updateJob = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const job = await this.service.updateJob(
        tenantId,
        user.userId,
        req.params.id as string,
        req.body
      );
      this.sendSuccess(res, job, 'Production job updated successfully');
    } catch (error) {
      next(error);
    }
  };

  public assignOperator = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const job = await this.service.assignOperator(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.params.id as string,
        req.body
      );
      this.sendSuccess(res, job, 'Operator assigned to job successfully');
    } catch (error) {
      next(error);
    }
  };

  public removeOperator = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const job = await this.service.removeOperator(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.params.id as string,
        req.body
      );
      this.sendSuccess(res, job, 'Operator removed from job successfully');
    } catch (error) {
      next(error);
    }
  };

  public assignFurnace = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const job = await this.service.assignFurnace(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.params.id as string,
        req.body
      );
      this.sendSuccess(res, job, 'Furnace assigned to job successfully');
    } catch (error) {
      next(error);
    }
  };

  public removeFurnace = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const job = await this.service.removeFurnace(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.params.id as string,
        req.body
      );
      this.sendSuccess(res, job, 'Furnace removed from job successfully');
    } catch (error) {
      next(error);
    }
  };

  public startJobExecution = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const job = await this.service.startJobExecution(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.params.id as string,
        req.body
      );
      this.sendSuccess(res, job, 'Furnace cycle execution started successfully');
    } catch (error) {
      next(error);
    }
  };

  public recordStageProgress = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const job = await this.service.recordStageProgress(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.params.id as string,
        req.body
      );
      this.sendSuccess(res, job, 'Heat treatment stage progress recorded successfully');
    } catch (error) {
      next(error);
    }
  };

  public pauseJobExecution = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const job = await this.service.pauseJobExecution(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.params.id as string,
        req.body
      );
      this.sendSuccess(res, job, 'Furnace cycle paused and downtime logged successfully');
    } catch (error) {
      next(error);
    }
  };

  public resumeJobExecution = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const job = await this.service.resumeJobExecution(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.params.id as string,
        req.body
      );
      this.sendSuccess(res, job, 'Furnace cycle resumed successfully');
    } catch (error) {
      next(error);
    }
  };

  public addProductionLog = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const job = await this.service.addProductionLog(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.params.id as string,
        req.body
      );
      this.sendSuccess(res, job, 'Production log recorded successfully');
    } catch (error) {
      next(error);
    }
  };

  public completeJobExecution = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const job = await this.service.completeJobExecution(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.params.id as string,
        req.body
      );
      this.sendSuccess(
        res,
        job,
        'Production execution completed and handed off to Quality Control'
      );
    } catch (error) {
      next(error);
    }
  };

  public transitionToStorage = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const job = await this.service.transitionToStorage(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.params.id as string,
        req.body
      );
      this.sendSuccess(res, job, 'Production job transferred to warehouse storage');
    } catch (error) {
      next(error);
    }
  };

  public getMachineUtilizationAndDowntime = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const stats = await this.service.getMachineUtilizationAndDowntime(
        tenantId,
        req.query.furnaceId as string
      );
      this.sendSuccess(
        res,
        stats,
        'Machine utilization and downtime analytics retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  };

  public transitionJob = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const job = await this.service.transitionJob(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.params.id as string,
        req.body
      );
      this.sendSuccess(res, job, 'Production job status transitioned successfully');
    } catch (error) {
      next(error);
    }
  };

  public cancelJob = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const job = await this.service.cancelJob(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.params.id as string,
        req.body
      );
      this.sendSuccess(res, job, 'Production job cancelled successfully');
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
      this.sendSuccess(res, queue, 'Prioritized production queue retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

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
