import { Request, Response, NextFunction } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import {
  QualityInspectionService,
  qualityInspectionService
} from './quality-inspection.service.js';
import { PaginationOptions } from '../../core/types/pagination.js';

export class QualityInspectionController extends BaseController {
  constructor(
    private readonly service: QualityInspectionService = qualityInspectionService
  ) {
    super();
  }

  public createInspection = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const inspection = await this.service.createInspection(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.body
      );
      this.sendCreated(res, inspection, 'Quality inspection created successfully');
    } catch (error) {
      next(error);
    }
  };

  public getInspections = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const pagination: PaginationOptions = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        sort: req.query.sortBy ? { [req.query.sortBy as string]: req.query.sortOrder === 'asc' ? 1 : -1 } : undefined
      };

      const result = await this.service.getInspections(
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
        'Quality inspections retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  };

  public getInspectionById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const inspection = await this.service.getInspectionById(
        tenantId,
        req.params.id as string
      );
      this.sendSuccess(res, inspection, 'Quality inspection retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  public getInspectionByJobId = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const inspections = await this.service.getInspectionByJobId(
        tenantId,
        req.params.jobId as string
      );
      this.sendSuccess(res, inspections, 'Job quality inspections retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  public assignInspector = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const inspection = await this.service.assignInspector(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.params.id as string,
        req.body
      );
      this.sendSuccess(res, inspection, 'Inspector assigned successfully');
    } catch (error) {
      next(error);
    }
  };

  public recordTestResults = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const inspection = await this.service.recordTestResults(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.params.id as string,
        req.body
      );
      this.sendSuccess(res, inspection, 'Test results recorded successfully');
    } catch (error) {
      next(error);
    }
  };

  public approveInspection = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const inspection = await this.service.approveInspection(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.params.id as string,
        req.body
      );
      this.sendSuccess(res, inspection, 'Quality inspection approved successfully');
    } catch (error) {
      next(error);
    }
  };

  public rejectInspection = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const inspection = await this.service.rejectInspection(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.params.id as string,
        req.body
      );
      this.sendSuccess(res, inspection, 'Quality inspection rejected and non-conformance logged');
    } catch (error) {
      next(error);
    }
  };

  public requestReinspection = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const inspection = await this.service.requestReinspection(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.params.id as string,
        req.body
      );
      this.sendSuccess(res, inspection, 'Reinspection cycle requested successfully');
    } catch (error) {
      next(error);
    }
  };
}

export const qualityInspectionController = new QualityInspectionController();
