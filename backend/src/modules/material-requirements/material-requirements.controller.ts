import { Request, Response, NextFunction } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import {
  materialRequirementsService,
  MaterialRequirementsService
} from './material-requirements.service.js';

export class MaterialRequirementsController extends BaseController {
  constructor(
    private readonly service: MaterialRequirementsService = materialRequirementsService
  ) {
    super();
  }

  public calculate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const requirements = await this.service.calculateRequirements(tenantId, req.body);
      this.sendSuccess(res, requirements, 'Material requirements calculated successfully');
    } catch (error) {
      next(error);
    }
  };

  public getShortages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const { shortages, total } = await this.service.getShortages(tenantId, req.query as any);
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      this.sendPaginated(res, shortages, page, limit, total, 'Material shortages retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  public reserve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const reservation = await this.service.reserveMaterial(tenantId, user.userId, req.body);
      this.sendCreated(res, reservation, 'Material reserved successfully');
    } catch (error) {
      next(error);
    }
  };

  public release = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const reservation = await this.service.releaseReservation(
        tenantId,
        req.params.id as string,
        user.userId,
        req.body
      );
      this.sendSuccess(res, reservation, 'Material reservation released successfully');
    } catch (error) {
      next(error);
    }
  };

  public getByPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const reservations = await this.service.getReservationsByPlan(
        tenantId,
        req.params.planId as string
      );
      this.sendSuccess(res, reservations, 'Plan material reservations retrieved successfully');
    } catch (error) {
      next(error);
    }
  };
}

export const materialRequirementsController = new MaterialRequirementsController();
