import { Request, Response, NextFunction } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import { machineService, MachineService } from './machine.service.js';

export class MachineController extends BaseController {
  constructor(private readonly service: MachineService = machineService) {
    super();
  }

  public createMachine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const result = await this.service.createMachine(tenantId, actor, req.body);
      this.sendCreated(res, result, 'Machine registered successfully');
    } catch (error) {
      next(error);
    }
  };

  public updateMachine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const id = req.params.id as string;
      const result = await this.service.updateMachine(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, 'Machine configuration updated successfully');
    } catch (error) {
      next(error);
    }
  };

  public changeMachineStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const id = req.params.id as string;
      const result = await this.service.changeMachineStatus(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, `Machine status updated to '${req.body.status}'`);
    } catch (error) {
      next(error);
    }
  };

  public addNote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const id = req.params.id as string;
      const result = await this.service.addNote(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, 'Note added to machine log');
    } catch (error) {
      next(error);
    }
  };

  public getMachineById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = req.params.id as string;
      const result = await this.service.getMachineById(tenantId, id);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  public getMachineByCode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const machineCode = req.params.machineCode as string;
      const result = await this.service.getMachineByCode(tenantId, machineCode);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  public queryMachines = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const pagination = this.parsePagination(req);
      const result = await this.service.queryMachines(tenantId, req.query as any, pagination);
      this.sendPaginated(res, result.items, result.page, result.limit, result.total);
    } catch (error) {
      next(error);
    }
  };

  public findCapableMachines = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const criteria = {
        processFamily: req.query.processFamily as string,
        targetTemperatureC: req.query.targetTemperatureC ? Number(req.query.targetTemperatureC) : undefined,
        requiredLoadWeightKg: req.query.requiredLoadWeightKg ? Number(req.query.requiredLoadWeightKg) : undefined,
        status: req.query.status as any
      };
      const result = await this.service.findCapableMachines(tenantId, criteria);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  public getFleetSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const result = await this.service.getFleetSummary(tenantId);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  private getActor(req: Request) {
    const user = (req as any).user;
    return {
      userId: user?.userId || 'system',
      email: user?.email,
      role: user?.roles?.[0] || 'FACTORY_ENGINEER'
    };
  }
}

export const machineController = new MachineController();
