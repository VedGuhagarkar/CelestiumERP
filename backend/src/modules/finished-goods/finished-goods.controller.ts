import { Request, Response } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import { finishedGoodsService, FinishedGoodsService } from './finished-goods.service.js';
import { ActorContext } from '../customer/customer.service.js';

export class FinishedGoodsController extends BaseController {
  constructor(private readonly service: FinishedGoodsService = finishedGoodsService) {
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

  public inwardFinishedGoods = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const actor = this.getActorContext(req);
    const fg = await this.service.inwardFinishedGoods(tenantId, req.body, actor);
    return this.sendCreated(res, fg, 'Finished goods inwarded successfully (Awaiting QC Release)');
  };

  public releaseFinishedGoods = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const actor = this.getActorContext(req);
    const fg = await this.service.releaseFinishedGoods(tenantId, id, req.body, actor);
    return this.sendSuccess(res, fg, 'Finished goods lot released for dispatch');
  };

  public reserveForDispatch = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const actor = this.getActorContext(req);
    const fg = await this.service.reserveForDispatch(tenantId, id, req.body, actor);
    return this.sendSuccess(res, fg, 'Finished goods quantity reserved for dispatch');
  };

  public releaseDispatchReservation = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const actor = this.getActorContext(req);
    const fg = await this.service.releaseDispatchReservation(tenantId, id, req.body, actor);
    return this.sendSuccess(res, fg, 'Finished goods reservation released successfully');
  };

  public moveLocation = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const actor = this.getActorContext(req);
    const fg = await this.service.moveLocation(tenantId, id, req.body, actor);
    return this.sendSuccess(res, fg, 'Finished goods location updated successfully');
  };

  public getById = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const fg = await this.service.getById(tenantId, id);
    return this.sendSuccess(res, fg, 'Finished goods retrieved successfully');
  };

  public getByLotNumber = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const lotNumber = req.params.lotNumber as string;
    const fg = await this.service.getByLotNumber(tenantId, lotNumber);
    return this.sendSuccess(res, fg, 'Finished goods retrieved successfully');
  };

  public search = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const pagination = this.parsePagination(req);
    const filters = {
      search: req.query.search as string,
      jobCardNumber: req.query.jobCardNumber as string,
      heatLotNumber: req.query.heatLotNumber as string,
      customerCode: req.query.customerCode as string,
      itemId: req.query.itemId as string,
      itemCode: req.query.itemCode as string,
      status: req.query.status as any,
      location: req.query.location as string,
      isReleased: req.query.isReleased !== undefined ? req.query.isReleased === 'true' : undefined
    };

    const result = await this.service.search(tenantId, filters, pagination);
    return this.sendPaginated(
      res,
      result.items,
      result.page,
      result.limit,
      result.total,
      'Finished goods retrieved successfully'
    );
  };
}

export const finishedGoodsController = new FinishedGoodsController();
