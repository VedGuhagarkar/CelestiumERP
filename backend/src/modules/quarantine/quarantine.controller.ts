import { Request, Response } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import { quarantineService, QuarantineService } from './quarantine.service.js';
import { ActorContext } from '../customer/customer.service.js';

export class QuarantineController extends BaseController {
  constructor(private readonly service: QuarantineService = quarantineService) {
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

  public placeInQuarantine = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const actor = this.getActorContext(req);
    const record = await this.service.placeInQuarantine(tenantId, req.body, actor);
    return this.sendCreated(res, record, 'Material placed under quarantine successfully');
  };

  public releaseFromQuarantine = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const actor = this.getActorContext(req);
    const record = await this.service.releaseFromQuarantine(tenantId, id, req.body, actor);
    return this.sendSuccess(res, record, 'Quarantined material released back to stock');
  };

  public dispositionQuarantine = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const actor = this.getActorContext(req);
    const record = await this.service.dispositionQuarantine(tenantId, id, req.body, actor);
    return this.sendSuccess(res, record, 'Quarantine record dispositioned successfully');
  };

  public getQuarantineById = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const record = await this.service.getQuarantineById(tenantId, id);
    return this.sendSuccess(res, record, 'Quarantine record retrieved successfully');
  };

  public getQuarantineByNumber = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const number = req.params.number as string;
    const record = await this.service.getQuarantineByNumber(tenantId, number);
    return this.sendSuccess(res, record, 'Quarantine record retrieved successfully');
  };

  public searchQuarantines = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const pagination = this.parsePagination(req);
    const filters = {
      search: req.query.search as string,
      targetType: req.query.targetType as any,
      targetIdentifier: req.query.targetIdentifier as string,
      itemId: req.query.itemId as string,
      itemCode: req.query.itemCode as string,
      status: req.query.status as any,
      reasonCode: req.query.reasonCode as any,
      triggerSource: req.query.triggerSource as any
    };

    const result = await this.service.searchQuarantines(tenantId, filters, pagination);
    return this.sendPaginated(
      res,
      result.items,
      result.page,
      result.limit,
      result.total,
      'Quarantine records retrieved successfully'
    );
  };
}

export const quarantineController = new QuarantineController();
