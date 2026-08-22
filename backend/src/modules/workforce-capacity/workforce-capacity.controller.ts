import { Request, Response, NextFunction } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import {
  workforceCapacityService,
  WorkforceCapacityService
} from './workforce-capacity.service.js';

export class WorkforceCapacityController extends BaseController {
  constructor(
    private readonly service: WorkforceCapacityService = workforceCapacityService
  ) {
    super();
  }

  public createEmployee = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const employee = await this.service.createEmployee(tenantId, user.userId, req.body);
      this.sendCreated(res, employee, 'Workforce employee registered successfully');
    } catch (error) {
      next(error);
    }
  };

  public addOrUpdateSkill = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const employee = await this.service.addOrUpdateSkill(
        tenantId,
        user.userId,
        req.params.id as string,
        req.body
      );
      this.sendSuccess(res, employee, 'Employee technical skill certified successfully');
    } catch (error) {
      next(error);
    }
  };

  public getEmployees = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const employees = await this.service.getEmployees(tenantId, req.query);
      this.sendSuccess(res, employees, 'Workforce members retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  public getEmployeeById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const employee = await this.service.getEmployeeById(tenantId, req.params.id as string);
      this.sendSuccess(res, employee, 'Workforce member retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  public evaluateCoverage = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const result = await this.service.evaluateCoverage(tenantId, req.body);
      this.sendSuccess(res, result, 'Workforce coverage evaluated successfully');
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
      const allocation = await this.service.assignOperator(tenantId, user.userId, req.body);
      this.sendCreated(res, allocation, 'Operator assigned to shift successfully');
    } catch (error) {
      next(error);
    }
  };

  public releaseAssignment = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const user = this.getUser(req);
      const allocation = await this.service.releaseAssignment(
        tenantId,
        req.params.id as string,
        user.userId
      );
      this.sendSuccess(res, allocation, 'Shift assignment released successfully');
    } catch (error) {
      next(error);
    }
  };

  public getShiftCapacity = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const capacity = await this.service.getShiftCapacity(
        tenantId,
        req.query.date as string,
        req.query.shift as any,
        req.query.skillCode as string
      );
      this.sendSuccess(res, capacity, 'Shift workforce capacity retrieved successfully');
    } catch (error) {
      next(error);
    }
  };
}

export const workforceCapacityController = new WorkforceCapacityController();
