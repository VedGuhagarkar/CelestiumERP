import { Request, Response } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import { heatLotService, HeatLotService } from './heat-lot.service.js';
import { ActorContext } from '../customer/customer.service.js';
import { BadRequestError } from '../../core/errors/app-error.js';

export class HeatLotController extends BaseController {
  constructor(private readonly service: HeatLotService = heatLotService) {
    super();
  }

  private getActorContext(req: Request): ActorContext {
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

  public inwardHeatLot = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const actor = this.getActorContext(req);
    const heatLot = await this.service.inwardHeatLot(tenantId, req.body, actor);
    return this.sendCreated(res, heatLot, 'Heat lot inwarded successfully with MTR certification');
  };

  public getHeatLotById = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const heatLot = await this.service.getHeatLotById(tenantId, id);
    return this.sendSuccess(res, heatLot, 'Heat lot retrieved successfully');
  };

  public getHeatLotByNumber = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const number = req.params.number as string;
    const heatLot = await this.service.getHeatLotByNumber(tenantId, number);
    return this.sendSuccess(res, heatLot, 'Heat lot retrieved successfully');
  };

  public quarantineHeatLot = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const actor = this.getActorContext(req);
    const heatLot = await this.service.quarantineHeatLot(tenantId, id, req.body, actor);
    return this.sendSuccess(res, heatLot, 'Heat lot placed in QUARANTINED status');
  };

  public releaseHeatLot = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const actor = this.getActorContext(req);
    const heatLot = await this.service.releaseHeatLot(tenantId, id, req.body, actor);
    return this.sendSuccess(res, heatLot, 'Heat lot released for production allocation');
  };

  public allocateHeatLot = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const actor = this.getActorContext(req);
    const heatLot = await this.service.allocateHeatLot(tenantId, id, req.body, actor);
    return this.sendSuccess(res, heatLot, 'Heat lot quantity allocated to production job card');
  };

  public consumeHeatLot = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const actor = this.getActorContext(req);
    const heatLot = await this.service.consumeHeatLot(tenantId, id, req.body, actor);
    return this.sendSuccess(res, heatLot, 'Heat lot material consumption logged successfully');
  };

  public forwardTrace = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const number = req.params.number as string;
    const result = await this.service.forwardTrace(tenantId, number);
    return this.sendSuccess(res, result, 'Forward traceability genealogy generated successfully');
  };

  public backwardTrace = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const jobCardNumber = req.query.jobCardNumber as string;
    if (!jobCardNumber) {
      throw new BadRequestError('Query parameter jobCardNumber is required for backward traceability');
    }
    const result = await this.service.backwardTrace(tenantId, jobCardNumber);
    return this.sendSuccess(res, result, 'Backward traceability genealogy generated successfully');
  };

  public searchHeatLots = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const pagination = this.parsePagination(req);
    const filters = {
      search: req.query.search as string,
      itemId: req.query.itemId as string,
      itemCode: req.query.itemCode as string,
      materialGrade: req.query.materialGrade as string,
      supplierHeatNumber: req.query.supplierHeatNumber as string,
      mtrNumber: req.query.mtrNumber as string,
      status: req.query.status as any,
      storageLocation: req.query.storageLocation as string
    };

    const result = await this.service.searchHeatLots(tenantId, filters, pagination);
    return this.sendPaginated(
      res,
      result.items,
      result.page,
      result.limit,
      result.total,
      'Heat lots retrieved successfully'
    );
  };
}

export const heatLotController = new HeatLotController();
