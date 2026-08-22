import { Request, Response, NextFunction } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import {
  furnaceCapacityService,
  FurnaceCapacityService
} from './furnace-capacity.service.js';

export class FurnaceCapacityController extends BaseController {
  constructor(
    private readonly service: FurnaceCapacityService = furnaceCapacityService
  ) {
    super();
  }

  public createFurnace = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const furnace = await this.service.createFurnace(tenantId, user.userId, req.body);
      this.sendCreated(res, furnace, 'Furnace registered successfully');
    } catch (error) {
      next(error);
    }
  };

  public getFurnaces = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const furnaces = await this.service.getFurnaces(tenantId, req.query);
      this.sendSuccess(res, furnaces, 'Furnaces retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  public getFurnaceById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const furnace = await this.service.getFurnaceById(tenantId, req.params.id as string);
      this.sendSuccess(res, furnace, 'Furnace retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  public checkCompatibility = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const result = await this.service.checkCompatibility(tenantId, req.body);
      this.sendSuccess(res, result, 'Furnace compatibility check completed');
    } catch (error) {
      next(error);
    }
  };

  public bookCapacity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const allocation = await this.service.bookCapacity(tenantId, user.userId, req.body);
      this.sendCreated(res, allocation, 'Furnace capacity booked successfully');
    } catch (error) {
      next(error);
    }
  };

  public releaseAllocation = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const allocation = await this.service.releaseAllocation(
        tenantId,
        req.params.id as string,
        user.userId
      );
      this.sendSuccess(res, allocation, 'Furnace capacity booking released successfully');
    } catch (error) {
      next(error);
    }
  };

  public getUtilization = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const utilization = await this.service.getUtilization(
        tenantId,
        req.query.startDate as string,
        req.query.endDate as string,
        req.query.furnaceType as string
      );
      this.sendSuccess(res, utilization, 'Furnace utilization retrieved successfully');
    } catch (error) {
      next(error);
    }
  };
}

export const furnaceCapacityController = new FurnaceCapacityController();
