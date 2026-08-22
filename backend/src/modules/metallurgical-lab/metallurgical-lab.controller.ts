import { Request, Response, NextFunction } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import {
  MetallurgicalLabService,
  metallurgicalLabService
} from './metallurgical-lab.service.js';
import { PaginationOptions } from '../../core/types/pagination.js';

export class MetallurgicalLabController extends BaseController {
  constructor(
    private readonly service: MetallurgicalLabService = metallurgicalLabService
  ) {
    super();
  }

  public createLabRecord = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const record = await this.service.createLabRecord(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.body
      );
      this.sendCreated(res, record, 'Laboratory test record created successfully');
    } catch (error) {
      next(error);
    }
  };

  public getRecordById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const record = await this.service.getRecordById(
        tenantId,
        req.params.id as string
      );
      this.sendSuccess(res, record, 'Laboratory test record retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  public getRecordsByInspectionId = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const records = await this.service.getRecordsByInspectionId(
        tenantId,
        req.params.inspectionId as string
      );
      this.sendSuccess(res, records, 'Inspection lab records retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  public getRecordsByJobId = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const records = await this.service.getRecordsByJobId(
        tenantId,
        req.params.jobId as string
      );
      this.sendSuccess(res, records, 'Job lab records retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  public queryRecords = async (
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

      const result = await this.service.queryRecords(
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
        'Laboratory test records retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  };

  public addHardnessMeasurement = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const record = await this.service.addHardnessMeasurement(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.params.id as string,
        req.body
      );
      this.sendSuccess(res, record, 'Hardness measurement recorded successfully');
    } catch (error) {
      next(error);
    }
  };

  public addHardnessTraverse = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const record = await this.service.addHardnessTraverse(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.params.id as string,
        req.body
      );
      this.sendSuccess(res, record, 'Hardness traverse recorded and effective case depth computed');
    } catch (error) {
      next(error);
    }
  };

  public addMicrostructureObservation = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const record = await this.service.addMicrostructureObservation(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.params.id as string,
        req.body
      );
      this.sendSuccess(res, record, 'Microstructure observation recorded successfully');
    } catch (error) {
      next(error);
    }
  };

  public lockLabRecord = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const record = await this.service.lockLabRecord(
        tenantId,
        { userId: user.userId, email: user.email, role: user.roles?.[0] },
        req.params.id as string,
        req.body
      );
      this.sendSuccess(res, record, 'Laboratory test record locked successfully');
    } catch (error) {
      next(error);
    }
  };
}

export const metallurgicalLabController = new MetallurgicalLabController();
